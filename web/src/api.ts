export interface Stats {
  catalogs: number;
  sections: number;
  assemblies: number;
  parts: number;
}

export interface Catalog {
  id: number;
  name: string;
  title: string | null;
  section_count: number;
  assembly_count: number;
  part_count: number;
}

export interface AssemblySummary {
  id: number;
  section_id: number;
  code: string;
  title: string | null;
  part_count: number;
  diagram_pages: number[];
  parts_list_pages: number[];
}

export interface SectionItem {
  id: number;
  catalog_id: number;
  catalog_name: string;
  no: number;
  name: string;
  assemblies: AssemblySummary[];
}

export interface PartItem {
  id: number;
  key_no: number;
  part_name: string;
  assy_dwg_no: string | null;
  dwg_no: string | null;
  qty: string | null;
  remarks: string | null;
  pdf_page: number;
  assembly_id: number;
  assembly_code: string;
  assembly_title: string | null;
  section_id: number;
  section_no: number;
  section_name: string;
  catalog_id: number;
  catalog_name: string;
  diagram_pages: number[];
  parts_list_pages: number[];
}

export interface SearchResponse {
  total: number;
  limit: number;
  offset: number;
  fuzzy: boolean;
  items: PartItem[];
}

export interface AssemblyDetail {
  id: number;
  code: string;
  title: string | null;
  section_id: number;
  section_no: number;
  section_name: string;
  catalog_id: number;
  catalog_name: string;
  diagram_pages: number[];
  parts_list_pages: number[];
  parts: Array<{
    id: number;
    key_no: number;
    part_name: string;
    assy_dwg_no: string | null;
    dwg_no: string | null;
    qty: string | null;
    remarks: string | null;
    pdf_page: number;
  }>;
}

export type SearchField = 'all' | 'part_name' | 'assy_dwg_no' | 'dwg_no';

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

export function getStats(): Promise<Stats> {
  return fetchJson('/api/stats');
}

export function getCatalogs(): Promise<Catalog[]> {
  return fetchJson('/api/catalogs');
}

export function getSections(catalogId?: number | null): Promise<SectionItem[]> {
  const qs = catalogId ? `?catalog_id=${catalogId}` : '';
  return fetchJson(`/api/sections${qs}`);
}

export function getAssembly(assemblyId: number): Promise<AssemblyDetail> {
  return fetchJson(`/api/assemblies/${assemblyId}`);
}

export function searchParts(
  params: {
    q: string;
    field: SearchField;
    catalogId?: number | null;
    sectionId?: number | null;
    limit?: number;
    offset?: number;
  },
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const sp = new URLSearchParams();
  if (params.q.trim()) sp.set('q', params.q.trim());
  sp.set('field', params.field);
  if (params.catalogId) sp.set('catalog_id', String(params.catalogId));
  if (params.sectionId) sp.set('section_id', String(params.sectionId));
  sp.set('limit', String(params.limit ?? 50));
  sp.set('offset', String(params.offset ?? 0));
  return fetchJson(`/api/search?${sp.toString()}`, signal);
}

export function pageImageUrl(pdfPage: number, catalogName?: string): string {
  const qs = catalogName ? `?catalog=${encodeURIComponent(catalogName)}` : '';
  return `/api/pages/${pdfPage}${qs}`;
}
