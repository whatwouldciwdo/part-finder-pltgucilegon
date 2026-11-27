"""Ingest hasil OCR ke PostgreSQL.
Pemakaian: python pipeline/ingest.py pipeline/catalogs/m701f.json [--reset]
"""
import json, os, re, sys
from pathlib import Path
import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


def clean(v):
    if v is None:
        return None
    v = re.sub(r"\s+", " ", str(v)).strip()
    return None if v in ("", "-") else v


def norm_name(s):
    s = re.sub(r"[φϕΦØ⌀]\s*(?=\d)", "φ", s)  # diameter: "ϕ 30" -> "φ30"
    return s


def main():
    cfg = json.loads(Path(sys.argv[1]).read_text("utf-8-sig"))
    pages = [json.loads(f.read_text("utf-8-sig")) for f in sorted((ROOT / "data/ocr").glob("p*.json"))]
    pages.sort(key=lambda p: p["pdf_page"])
    asm = {}  # code -> {title, pages:{diagram:[],parts_list:[]}, parts:{key:row}}
    dup = 0
    for p in pages:
        code = p.get("page_code")
        if p["page_type"] not in ("diagram", "parts_list") or not code or not re.fullmatch(r"\d-\d+", code):
            continue
        a = asm.setdefault(code, {"title": None, "pages": [], "parts": {}})
        a["pages"].append((p["pdf_page"], p["page_type"]))
        if p["page_type"] == "parts_list":
            t = re.sub(r"\s*\(\d+/\d+\)\s*$", "", p.get("title") or "").strip()
            a["title"] = a["title"] or t or None
            for x in p["parts"]:
                k = x["key_no"]
                if k in a["parts"]:
                    dup += 1  # halaman duplikat di PDF
                    continue
                a["parts"][k] = dict(
                    key_no=k, part_name=norm_name(clean(x["part_name"]) or ""),
                    assy_dwg_no=clean(x.get("assy_dwg_no")), dwg_no=clean(x.get("dwg_no")),
                    qty=clean(x.get("qty")), remarks=clean(x.get("remarks")), pdf_page=p["pdf_page"])
    with psycopg.connect(os.environ["DATABASE_URL"]) as c:
        cur = c.cursor()
        cur.execute((ROOT / "backend/schema.sql").read_text("utf-8-sig"))
        if "--reset" in sys.argv:
            cur.execute("DELETE FROM catalog WHERE name=%s", (cfg["name"],))
        cur.execute("INSERT INTO catalog(name,title,source_file) VALUES(%s,%s,%s) RETURNING id",
                    (cfg["name"], cfg.get("title"), cfg.get("source")))
        cid = cur.fetchone()[0]
        sec = {}
        for no, name in cfg["sections"].items():
            cur.execute("INSERT INTO section(catalog_id,no,name) VALUES(%s,%s,%s) RETURNING id", (cid, int(no), name))
            sec[no] = cur.fetchone()[0]
        nparts = 0
        for code, a in sorted(asm.items(), key=lambda x: [int(i) for i in x[0].split("-")]):
            cur.execute("INSERT INTO assembly(section_id,code,title) VALUES(%s,%s,%s) RETURNING id",
                        (sec[code.split("-")[0]], code, a["title"]))
            aid = cur.fetchone()[0]
            for pg, kind in a["pages"]:
                cur.execute("INSERT INTO assembly_page VALUES(%s,%s,%s) ON CONFLICT DO NOTHING", (aid, pg, kind))
            for r in a["parts"].values():
                cur.execute("INSERT INTO part(assembly_id,key_no,part_name,assy_dwg_no,dwg_no,qty,remarks,pdf_page) "
                            "VALUES(%s,%s,%s,%s,%s,%s,%s,%s)",
                            (aid, r["key_no"], r["part_name"], r["assy_dwg_no"], r["dwg_no"], r["qty"], r["remarks"], r["pdf_page"]))
                nparts += 1
    print(f"{len(asm)} assembly, {nparts} part, {dup} duplikat dilewati")


if __name__ == "__main__":
    main()

