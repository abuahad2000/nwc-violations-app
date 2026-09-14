"""Read-only diagnosis for the local Nitaq database and KMZ/API sources."""
from __future__ import annotations
import json, os, sqlite3, urllib.request, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
DB = Path(os.getenv("NWC_DATA_DIR", ROOT / "data")) / "nwc_local.db"
KMZ_DIR = Path(os.getenv("NITAQ_KMZ_DIR", r"C:\antigravity files\Encroachments\kmz"))
API = os.getenv("NITAQ_API_BASE", "http://localhost:3000")

def main() -> None:
    result: dict[str, object] = {"database": str(DB), "kmz_dir": str(KMZ_DIR), "api": {}}
    if DB.exists():
        with sqlite3.connect(f"file:{DB}?mode=ro", uri=True) as con:
            columns = [row[1] for row in con.execute("PRAGMA table_info(violations)")]
            result["reports_has_project_id"] = "project_id" in columns
            result["linked_reports"] = con.execute("SELECT COUNT(*) FROM violations WHERE project_id IS NOT NULL").fetchone()[0]
            result["total_reports"] = con.execute("SELECT COUNT(*) FROM violations").fetchone()[0]
            result["projects"] = con.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
    else:
        result["database_error"] = "قاعدة البيانات المحلية غير موجودة"
    files = sorted(KMZ_DIR.glob("*.kmz")) if KMZ_DIR.exists() else []
    result["kmz_files"] = [{"name": f.name, "exists": True, "valid_zip": zipfile.is_zipfile(f)} for f in files]
    for path in ("/api/projects", "/api/assignments"):
        try:
            with urllib.request.urlopen(API + path, timeout=5) as response:
                result["api"][path] = {"status": response.status, "ok": 200 <= response.status < 300}
        except Exception as exc:
            result["api"][path] = {"ok": False, "error": str(exc)}
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
