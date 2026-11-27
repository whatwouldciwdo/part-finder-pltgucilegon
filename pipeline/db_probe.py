import os, psycopg
from dotenv import load_dotenv
load_dotenv(".env")
c = psycopg.connect(os.environ["DATABASE_URL"]); cur = c.cursor()
for q in ("spindle bolt", "G1-A0435-18", "pin 30"):
    cur.execute("""select s.no, a.code, a.title, p.key_no, p.part_name, p.assy_dwg_no, p.dwg_no, p.pdf_page
      from part p join assembly a on a.id=p.assembly_id join section s on s.id=a.section_id
      where lower(p.part_name) like %s or lower(p.assy_dwg_no) like %s or lower(p.dwg_no) like %s
      order by p.id limit 3""", (f"%{q.lower()}%",)*3)
    print(q, "->", cur.fetchall())
cur.execute("select count(*) from part"); print("total", cur.fetchone())
cur.execute("select count(*) from part where assy_dwg_no is null or dwg_no is null"); print("tanpa kode", cur.fetchone())
