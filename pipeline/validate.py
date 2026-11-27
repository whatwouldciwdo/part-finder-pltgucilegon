"""Validasi hasil OCR: kontinuitas KEY NO. per assembly, format kode drawing, duplikat.
Pemakaian: python pipeline/validate.py
"""
import json, re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CODE = re.compile(r"^[A-Z0-9]{2,3}-[A-Z]?\d{4,5}(-[A-Z0-9]{1,3})?$")

pages = [json.loads(f.read_text("utf-8")) for f in sorted((ROOT / "data/ocr").glob("p*.json"))]
print(f"{len(pages)} halaman diproses")
by_code = defaultdict(list)
issues = []
for p in pages:
    if p["page_type"] == "parts_list":
        by_code[p["page_code"]].append(p)
        if not p["parts"]:
            issues.append(f"p{p['pdf_page']}: parts_list kosong")
total = 0
for code, ps in sorted(by_code.items(), key=lambda x: [int(i) for i in re.findall(r"\d+", x[0] or "0")]):
    keys = [x["key_no"] for p in sorted(ps, key=lambda p: p["pdf_page"]) for x in p["parts"]]
    total += len(keys)
    if keys != list(range(1, len(keys) + 1)):
        issues.append(f"{code}: KEY NO tidak berurutan {keys[:3]}...{keys[-3:]}")
    for p in ps:
        for x in p["parts"]:
            for f in ("assy_dwg_no", "dwg_no"):
                v = x.get(f)
                if v and v.strip() != "-" and not CODE.match(v):
                    issues.append(f"{code} p{p['pdf_page']} key {x['key_no']} {f}={v!r} format aneh")
            if not x.get("part_name"):
                issues.append(f"{code} p{p['pdf_page']} key {x['key_no']} tanpa part_name")
print(f"{len(by_code)} assembly, {total} part")
print(f"{len(issues)} isu")
for i in issues:
    print(" -", i)

