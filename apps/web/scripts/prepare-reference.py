"""Read-only source extraction. Writes a private review manifest; never decides geometry by names."""
from pathlib import Path
import json, re, zipfile, hashlib, difflib, html
import xml.etree.ElementTree as ET
import openpyxl

ROOT = Path(__file__).resolve().parents[3]
NS = {'k': 'http://www.opengis.net/kml/2.2'}
OP = r'\d{2}/\d{2}/\d/\d{2}/\d{4}/\d'
def normalized(value):
    value = re.sub('<[^>]+>', ' ', html.unescape(str(value or '')))
    value = value.translate(str.maketrans('أإآىة', 'ااايه'))
    value = ' '.join(re.findall(r'[\w]+', value.lower()))
    for phrase in ['اسم المشروع', 'مشروع جاري', 'تحت التنفيذ']:
        value = value.replace(phrase, ' ')
    replacements={'المرحله':'مرحله','الاولي':'اولي','الثانيه':'ثانيه','الثالثه':'ثالثه','الرابعه':'رابعه','الصرف':'صرف','الصحي':'صحي','المياه':'مياه','المياة':'مياه','بحي':'','حي':''}
    return ' '.join(' '.join(replacements.get(word,word) for word in value.split() if word!='جاري').split())

def identifier(prefix, value):
    return prefix + hashlib.sha256(str(value).encode()).hexdigest()[:24]

book = openpyxl.load_workbook(ROOT/'excel/بيانات_مقاولين_المشاريع_مع_نطاق_المشروع.xlsx', read_only=True, data_only=True)
rows = list(book.active.values); headers = rows[0]; projects = []
for values in rows[1:]:
    row = dict(zip(headers, values)); op = str(row.get('الرقم التشغيلي') or '').strip()
    if not op: continue
    name = str(row.get('إسم المشروع (Ar)') or '').strip()
    contractor = str(row.get('إسم المقاول') or '').strip()
    projects.append(dict(id=identifier('ref_',op), operational_number=op, name=name,
        contractor_name=contractor, contractor_id=identifier('cont_',contractor) if contractor else None,
        source_status=row.get('مرحلة المشروع'), status={'جاري':'ACTIVE','مسلم ابتدائي':'PRELIMINARY_HANDOVER','مسحوب':'WITHDRAWN'}.get(row.get('مرحلة المشروع'),'REVIEW'),
        scope_description=row.get('نطاق المشروع'),program_manager_name=row.get('مدير برنامج NWC'),project_manager_name=row.get('مدير مشروع NWC')))
op_map={p['operational_number']:p for p in projects}; boundaries=[]

for file in (ROOT/'kmz').glob('*.kmz'):
    digest=hashlib.sha256(file.read_bytes()).hexdigest()
    with zipfile.ZipFile(file) as archive:
        if sum(i.file_size for i in archive.infolist()) > 200*1024*1024: raise ValueError('KMZ unpacked size exceeds limit')
        for entry in archive.infolist():
            if not entry.filename.lower().endswith('.kml'): continue
            if entry.file_size>80*1024*1024 or '..' in Path(entry.filename).parts: raise ValueError('Invalid KML entry')
            source=archive.read(entry)
            if re.search(br'<!\s*(DOCTYPE|ENTITY)',source,re.I): raise ValueError('DTD/entities forbidden')
            root=ET.fromstring(source)
            styles={e.get('id'):e for e in root.findall('.//k:Style',NS)}
            style_maps={e.get('id'):e for e in root.findall('.//k:StyleMap',NS)}
            def walk(element, folders):
                tag=element.tag.split('}')[-1]
                name=element.findtext('k:name','',NS)
                current=folders+[name] if tag in ('Document','Folder') else folders
                if tag=='Placemark':
                    polygons=element.findall('.//k:Polygon',NS)
                    if not polygons: return
                    # Operational layer is explicit; networks/future/reference layers remain excluded.
                    if not any('جار' in f for f in folders): return
                    description=element.findtext('k:description','',NS)
                    sid=element.findtext('k:styleUrl','',NS).lstrip('#')
                    if sid in style_maps: sid=style_maps[sid].findtext('k:Pair/k:styleUrl','',NS).lstrip('#')
                    style=element.find('k:Style',NS)
                    if style is None: style=styles.get(sid)
                    color=style.findtext('k:PolyStyle/k:color','',NS) if style is not None else ''
                    rgb='#'+color[6:8]+color[4:6]+color[2:4] if len(color)==8 else None
                    found=set(re.findall(OP,html.unescape(name+' '+description))) & op_map.keys()
                    ranks=sorted(((difflib.SequenceMatcher(None,normalized(name),normalized(p['name'])).ratio(),p) for p in projects), key=lambda x:x[0],reverse=True)
                    project=op_map[next(iter(found))] if len(found)==1 else None
                    method='OPERATIONAL_NUMBER' if project else 'NEEDS_REVIEW'
                    exact=[p for p in projects if normalized(p['name'])==normalized(name)]
                    if not project and len(exact)==1:
                        project=exact[0];method='NORMALIZED_NAME'
                    coordinates=[]
                    for polygon in polygons:
                        rings=[]
                        for ring in polygon.findall('k:outerBoundaryIs/k:LinearRing/k:coordinates',NS)+polygon.findall('k:innerBoundaryIs/k:LinearRing/k:coordinates',NS):
                            points=[[float(c) for c in token.split(',')[:2]] for token in (ring.text or '').split()]
                            if len(points)>=4 and points[0]==points[-1]: rings.append(points)
                        if rings: coordinates.append(rings)
                    if not coordinates:return
                    geometry={'type':'Polygon','coordinates':coordinates[0]} if len(coordinates)==1 else {'type':'MultiPolygon','coordinates':coordinates}
                    boundaries.append(dict(id=identifier('bnd_',digest+name+json.dumps(geometry)),name=name,source_file=file.name,file_hash=digest,folders=folders,color=rgb,kml_color=color,geometry=geometry,
                        project_id=project['id'] if project else None,match_method=method,
                        candidates=[dict(project_id=p['id'],name=p['name'],operational_number=p['operational_number'],score=round(score,3)) for score,p in ranks[:3]]))
                for child in element:
                    if child.tag.split('}')[-1] in ('Document','Folder','Placemark'):walk(child,current)
            walk(root,[])
target=ROOT/'apps/web/data/reference-review.json';target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps({'projects':projects,'boundaries':boundaries},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'projects':len(projects),'operational_boundaries':len(boundaries),'matched':sum(bool(b['project_id']) for b in boundaries),'needs_review':sum(not b['project_id'] for b in boundaries)},ensure_ascii=False))
