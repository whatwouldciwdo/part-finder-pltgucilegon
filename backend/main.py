import os
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL")
PAGES_DIR = Path(os.environ.get("PAGES_DIR", str(ROOT / "data" / "pages")))
WEB_DIST_DIR = Path(os.environ.get("WEB_DIST_DIR", str(ROOT / "web" / "dist")))

pool: ConnectionPool | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global pool
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    pool = ConnectionPool(
        conninfo=DATABASE_URL,
        min_size=1,
        max_size=10,
        kwargs={"row_factory": dict_row},
    )
    yield
    if pool:
        pool.close()


app = FastAPI(title="Part Finder PLTGU Cilegon API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_pool() -> ConnectionPool:
    if pool is None:
        raise HTTPException(status_code=503, detail="Database pool not initialized")
    return pool


def normalize_query(q: str) -> list[str]:
    cleaned = re.sub(r"[φϕΦØ⌀]+", " ", q.strip().lower())
    return [t for t in cleaned.split() if t]


@app.get("/api/health")
def health():
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            cur.fetchone()
    return {"status": "ok"}


@app.get("/api/stats")
def stats():
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  (SELECT count(*) FROM catalog) AS catalogs,
                  (SELECT count(*) FROM section) AS sections,
                  (SELECT count(*) FROM assembly) AS assemblies,
                  (SELECT count(*) FROM part) AS parts
                """
            )
            return cur.fetchone()


@app.get("/api/catalogs")
def list_catalogs():
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id, c.name, c.title,
                       count(DISTINCT s.id) AS section_count,
                       count(DISTINCT a.id) AS assembly_count,
                       count(p.id) AS part_count
                FROM catalog c
                LEFT JOIN section s ON s.catalog_id = c.id
                LEFT JOIN assembly a ON a.section_id = s.id
                LEFT JOIN part p ON p.assembly_id = a.id
                GROUP BY c.id
                ORDER BY c.id
                """
            )
            return cur.fetchall()


@app.get("/api/sections")
def list_sections(catalog_id: int | None = None):
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            params: list = []
            where = ""
            if catalog_id is not None:
                where = "WHERE s.catalog_id = %s"
                params.append(catalog_id)

            cur.execute(
                f"""
                SELECT s.id, s.catalog_id, c.name AS catalog_name, s.no, s.name
                FROM section s
                JOIN catalog c ON c.id = s.catalog_id
                {where}
                ORDER BY s.catalog_id, s.no
                """,
                params,
            )
            sections = cur.fetchall()
            if not sections:
                return []

            sec_ids = [s["id"] for s in sections]
            cur.execute(
                """
                SELECT a.id, a.section_id, a.code, a.title,
                       count(DISTINCT p.id) AS part_count,
                       coalesce(
                         array_agg(DISTINCT ap.pdf_page ORDER BY ap.pdf_page)
                         FILTER (WHERE ap.kind = 'diagram'),
                         ARRAY[]::int[]
                       ) AS diagram_pages,
                       coalesce(
                         array_agg(DISTINCT ap.pdf_page ORDER BY ap.pdf_page)
                         FILTER (WHERE ap.kind = 'parts_list'),
                         ARRAY[]::int[]
                       ) AS parts_list_pages
                FROM assembly a
                LEFT JOIN part p ON p.assembly_id = a.id
                LEFT JOIN assembly_page ap ON ap.assembly_id = a.id
                WHERE a.section_id = ANY(%s)
                GROUP BY a.id
                ORDER BY split_part(a.code, '-', 1)::int, split_part(a.code, '-', 2)::int
                """,
                (sec_ids,),
            )
            by_sec: dict[int, list] = {}
            for row in cur.fetchall():
                by_sec.setdefault(row["section_id"], []).append(row)

            for s in sections:
                s["assemblies"] = by_sec.get(s["id"], [])
            return sections


@app.get("/api/assemblies/{assembly_id}")
def get_assembly(assembly_id: int):
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.id, a.code, a.title,
                       s.id AS section_id, s.no AS section_no, s.name AS section_name,
                       c.id AS catalog_id, c.name AS catalog_name,
                       coalesce(
                         array_agg(DISTINCT ap.pdf_page ORDER BY ap.pdf_page)
                         FILTER (WHERE ap.kind = 'diagram'),
                         ARRAY[]::int[]
                       ) AS diagram_pages,
                       coalesce(
                         array_agg(DISTINCT ap.pdf_page ORDER BY ap.pdf_page)
                         FILTER (WHERE ap.kind = 'parts_list'),
                         ARRAY[]::int[]
                       ) AS parts_list_pages
                FROM assembly a
                JOIN section s ON s.id = a.section_id
                JOIN catalog c ON c.id = s.catalog_id
                LEFT JOIN assembly_page ap ON ap.assembly_id = a.id
                WHERE a.id = %s
                GROUP BY a.id, s.id, c.id
                """,
                (assembly_id,),
            )
            asm = cur.fetchone()
            if not asm:
                raise HTTPException(status_code=404, detail="Assembly not found")

            cur.execute(
                """
                SELECT id, key_no, part_name, assy_dwg_no, dwg_no, qty, remarks, pdf_page
                FROM part
                WHERE assembly_id = %s
                ORDER BY key_no
                """,
                (assembly_id,),
            )
            asm["parts"] = cur.fetchall()
            return asm


@app.get("/api/search")
def search_parts(
    q: str = Query(default="", max_length=200),
    field: Literal["all", "part_name", "assy_dwg_no", "dwg_no"] = "all",
    catalog_id: int | None = None,
    section_id: int | None = None,
    assembly_id: int | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    tokens = normalize_query(q)
    raw_q = q.strip().lower()

    base_where: list[str] = []
    base_params: list = []

    if catalog_id is not None:
        base_where.append("c.id = %s")
        base_params.append(catalog_id)
    if section_id is not None:
        base_where.append("s.id = %s")
        base_params.append(section_id)
    if assembly_id is not None:
        base_where.append("a.id = %s")
        base_params.append(assembly_id)

    norm_name_expr = "regexp_replace(lower(p.part_name), '[φϕΦØ⌀]+', ' ', 'g')"

    def field_token_cond(tok_param_count: int = 1) -> str:
        if field == "part_name":
            return f"({norm_name_expr} LIKE %s)"
        if field == "assy_dwg_no":
            return "(lower(coalesce(p.assy_dwg_no, '')) LIKE %s)"
        if field == "dwg_no":
            return "(lower(coalesce(p.dwg_no, '')) LIKE %s)"
        return (
            f"({norm_name_expr} LIKE %s "
            "OR lower(coalesce(p.assy_dwg_no, '')) LIKE %s "
            "OR lower(coalesce(p.dwg_no, '')) LIKE %s)"
        )

    where_clauses = list(base_where)
    params = list(base_params)

    for tok in tokens:
        like_val = f"%{tok}%"
        where_clauses.append(field_token_cond())
        if field == "all":
            params.extend([like_val, like_val, like_val])
        else:
            params.append(like_val)

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    if raw_q:
        order_sql = """
            ORDER BY
              CASE
                WHEN lower(coalesce(p.dwg_no, '')) = %s OR lower(coalesce(p.assy_dwg_no, '')) = %s THEN 0
                WHEN lower(coalesce(p.dwg_no, '')) LIKE %s OR lower(coalesce(p.assy_dwg_no, '')) LIKE %s THEN 1
                WHEN lower(p.part_name) LIKE %s THEN 2
                ELSE 3
              END,
              greatest(
                similarity(lower(p.part_name), %s),
                similarity(lower(coalesce(p.assy_dwg_no, '')), %s),
                similarity(lower(coalesce(p.dwg_no, '')), %s)
              ) DESC,
              s.no, split_part(a.code, '-', 2)::int, p.key_no
        """
        prefix = f"{raw_q}%"
        order_params = [raw_q, raw_q, prefix, prefix, prefix, raw_q, raw_q, raw_q]
    else:
        order_sql = "ORDER BY s.no, split_part(a.code, '-', 2)::int, p.key_no"
        order_params = []

    select_sql = """
        SELECT p.id, p.key_no, p.part_name, p.assy_dwg_no, p.dwg_no, p.qty, p.remarks, p.pdf_page,
               a.id AS assembly_id, a.code AS assembly_code, a.title AS assembly_title,
               s.id AS section_id, s.no AS section_no, s.name AS section_name,
               c.id AS catalog_id, c.name AS catalog_name,
               coalesce(
                 (SELECT array_agg(ap.pdf_page ORDER BY ap.pdf_page)
                  FROM assembly_page ap
                  WHERE ap.assembly_id = a.id AND ap.kind = 'diagram'),
                 ARRAY[]::int[]
               ) AS diagram_pages,
               coalesce(
                 (SELECT array_agg(ap.pdf_page ORDER BY ap.pdf_page)
                  FROM assembly_page ap
                  WHERE ap.assembly_id = a.id AND ap.kind = 'parts_list'),
                 ARRAY[]::int[]
               ) AS parts_list_pages
        FROM part p
        JOIN assembly a ON a.id = p.assembly_id
        JOIN section s ON s.id = a.section_id
        JOIN catalog c ON c.id = s.catalog_id
    """

    fuzzy_used = False
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT count(*) AS total
                FROM part p
                JOIN assembly a ON a.id = p.assembly_id
                JOIN section s ON s.id = a.section_id
                JOIN catalog c ON c.id = s.catalog_id
                {where_sql}
                """,
                params,
            )
            total = cur.fetchone()["total"]

            if total > 0 or not raw_q:
                cur.execute(
                    f"{select_sql} {where_sql} {order_sql} LIMIT %s OFFSET %s",
                    params + order_params + [limit, offset],
                )
                items = cur.fetchall()
            else:
                # Fallback to trigram fuzzy match when exact/token search yields 0 results
                fuzzy_used = True
                fuzzy_where = list(base_where)
                fuzzy_params = list(base_params)
                if field == "part_name":
                    fuzzy_where.append("similarity(lower(p.part_name), %s) > 0.25")
                    fuzzy_params.append(raw_q)
                elif field == "assy_dwg_no":
                    fuzzy_where.append("similarity(lower(coalesce(p.assy_dwg_no, '')), %s) > 0.3")
                    fuzzy_params.append(raw_q)
                elif field == "dwg_no":
                    fuzzy_where.append("similarity(lower(coalesce(p.dwg_no, '')), %s) > 0.3")
                    fuzzy_params.append(raw_q)
                else:
                    fuzzy_where.append(
                        "(similarity(lower(p.part_name), %s) > 0.25 "
                        "OR similarity(lower(coalesce(p.assy_dwg_no, '')), %s) > 0.3 "
                        "OR similarity(lower(coalesce(p.dwg_no, '')), %s) > 0.3)"
                    )
                    fuzzy_params.extend([raw_q, raw_q, raw_q])

                f_where_sql = "WHERE " + " AND ".join(fuzzy_where)
                cur.execute(
                    f"""
                    SELECT count(*) AS total
                    FROM part p
                    JOIN assembly a ON a.id = p.assembly_id
                    JOIN section s ON s.id = a.section_id
                    JOIN catalog c ON c.id = s.catalog_id
                    {f_where_sql}
                    """,
                    fuzzy_params,
                )
                total = cur.fetchone()["total"]
                cur.execute(
                    f"{select_sql} {f_where_sql} {order_sql} LIMIT %s OFFSET %s",
                    fuzzy_params + order_params + [limit, offset],
                )
                items = cur.fetchall()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "fuzzy": fuzzy_used,
        "items": items,
    }


@app.get("/api/pages/{pdf_page}")
def get_page_image(pdf_page: int, catalog: str | None = None):
    if pdf_page < 1 or pdf_page > 9999:
        raise HTTPException(status_code=400, detail="Invalid page number")
    candidates = []
    if catalog:
        safe_cat = re.sub(r"[^a-zA-Z0-9_-]", "", catalog).lower()
        candidates.append(PAGES_DIR / safe_cat / f"p{pdf_page:03d}.webp")
    candidates.append(PAGES_DIR / f"p{pdf_page:03d}.webp")

    for path in candidates:
        if path.is_file():
            return FileResponse(
                path,
                media_type="image/webp",
                headers={"Cache-Control": "public, max-age=86400"},
            )
    raise HTTPException(status_code=404, detail="Page image not found")


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    if not WEB_DIST_DIR.is_dir():
        raise HTTPException(status_code=404, detail="Frontend build (web/dist) not found")

    dist_root = WEB_DIST_DIR.resolve()
    if full_path:
        target = (dist_root / full_path).resolve()
        if str(target).startswith(str(dist_root)) and target.is_file():
            cache = "public, max-age=31536000, immutable" if full_path.startswith("assets/") else "public, max-age=3600"
            if full_path in ("sw.js", "manifest.webmanifest"):
                cache = "no-cache"
            return FileResponse(target, headers={"Cache-Control": cache})

    index_file = dist_root / "index.html"
    if not index_file.is_file():
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(index_file, headers={"Cache-Control": "no-cache"})
