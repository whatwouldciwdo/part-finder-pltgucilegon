import os, psycopg
from dotenv import load_dotenv
load_dotenv(".env")
url = os.environ["DATABASE_URL"]
c = psycopg.connect(url, connect_timeout=8, autocommit=True)
cur = c.cursor()
cur.execute("select version()"); print(cur.fetchone()[0][:40])
cur.execute("select datname from pg_database where not datistemplate"); print("db:", [r[0] for r in cur])
cur.execute("select rolcreatedb, rolsuper from pg_roles where rolname=current_user"); print("createdb/super:", cur.fetchone())
cur.execute("select name from pg_available_extensions where name in ('pg_trgm','unaccent')"); print("ext:", [r[0] for r in cur])
cur.execute("select 1 from pg_database where datname='part_finder'")
if cur.fetchone():
    print("part_finder sudah ada")
else:
    cur.execute("create database part_finder"); print("part_finder dibuat")
