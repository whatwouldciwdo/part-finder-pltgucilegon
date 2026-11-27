CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS catalog (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL,
  title text,
  source_file text
);
CREATE TABLE IF NOT EXISTS section (
  id serial PRIMARY KEY,
  catalog_id int NOT NULL REFERENCES catalog ON DELETE CASCADE,
  no int NOT NULL,
  name text NOT NULL,
  UNIQUE (catalog_id, no)
);
CREATE TABLE IF NOT EXISTS assembly (
  id serial PRIMARY KEY,
  section_id int NOT NULL REFERENCES section ON DELETE CASCADE,
  code text NOT NULL,            -- mis. 2-2
  title text,
  UNIQUE (section_id, code)
);
CREATE TABLE IF NOT EXISTS assembly_page (
  assembly_id int NOT NULL REFERENCES assembly ON DELETE CASCADE,
  pdf_page int NOT NULL,
  kind text NOT NULL CHECK (kind IN ('diagram','parts_list')),
  PRIMARY KEY (assembly_id, pdf_page)
);
CREATE TABLE IF NOT EXISTS part (
  id serial PRIMARY KEY,
  assembly_id int NOT NULL REFERENCES assembly ON DELETE CASCADE,
  key_no int NOT NULL,
  part_name text NOT NULL,
  assy_dwg_no text,
  dwg_no text,
  qty text,
  remarks text,
  pdf_page int NOT NULL,
  UNIQUE (assembly_id, key_no)
);
CREATE INDEX IF NOT EXISTS part_name_trgm ON part USING gin (lower(part_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS part_assy_trgm ON part USING gin (lower(assy_dwg_no) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS part_dwg_trgm  ON part USING gin (lower(dwg_no) gin_trgm_ops);
