import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const workspaceRoot = path.resolve(process.cwd(), '../..');
const projPath = path.resolve(
  workspaceRoot,
  'excel',
  'بيانات_مقاولين_المشاريع_مع_نطاق_المشروع.xlsx',
);
const projWb = XLSX.readFile(projPath);
console.log('Project sheets:', projWb.SheetNames);
const projRows = XLSX.utils.sheet_to_json(projWb.Sheets[projWb.SheetNames[0]]);
console.log('Total project rows:', projRows.length);
console.log('Project row sample:', projRows[0]);

const geojsonPath = path.resolve(workspaceRoot, 'data', 'projects_boundaries.geojson');
const boundaries = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
console.log('Boundaries feature count:', boundaries.features.length);
console.log('Boundary sample props:', boundaries.features[0].properties);

const violPath = path.resolve(workspaceRoot, 'excel', 'التعديات.xlsx');
const violWb = XLSX.readFile(violPath);
console.log('Viol sheets:', violWb.SheetNames);
const violRows = XLSX.utils.sheet_to_json(violWb.Sheets[violWb.SheetNames[0]]);
console.log('Total viol rows:', violRows.length);
console.log('Viol row sample:', JSON.stringify(violRows[0], null, 2));
