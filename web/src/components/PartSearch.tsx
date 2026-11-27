import { useEffect, useState } from 'react';
import { Check, Copy, FileText, Image as ImageIcon, Layers, Search, Sparkles, X } from 'lucide-react';
import { PartItem, SearchField, searchParts, SectionItem } from '../api';
import { dict, Lang } from '../i18n';
import { ViewerTarget } from './PageViewerModal';
const PAGE_SIZE = 50;
export function PartSearch({lang,catalogId,sections,setViewerTarget,setAssemblyModalId}: {
  lang: Lang; catalogId: number; sections: SectionItem[];
  setViewerTarget: (target: ViewerTarget) => void; setAssemblyModalId: (id: number, highlightKeyNo?: number) => void;
}) {
  const t = dict[lang];
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [field, setField] = useState<SearchField>('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [items, setItems] = useState<PartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [fuzzy, setFuzzy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 200);
    return () => window.clearTimeout(id);
  }, [query]);

  const hasQuery = debouncedQuery.trim().length > 0;

  useEffect(() => {
    if (!hasQuery) {
      setItems([]);
      setTotal(0);
      setFuzzy(false);
      setError(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    searchParts(
      {
        q: debouncedQuery,
        field,
        catalogId,
        sectionId,
        limit: PAGE_SIZE,
        offset: 0,
      },
      ctrl.signal,
    )
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setFuzzy(res.fuzzy);
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') {
          setError(String(e));
        }
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });

    return () => ctrl.abort();
  }, [hasQuery, debouncedQuery, field, catalogId, sectionId]);

  const handleLoadMore = () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    searchParts({
      q: debouncedQuery,
      field,
      catalogId,
      sectionId,
      limit: PAGE_SIZE,
      offset: items.length,
    })
      .then((res) => {
        setItems((prev) => [...prev, ...res.items]);
        setTotal(res.total);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingMore(false));
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1400);
    });
  };

  const openPartPage = (p: PartItem, kind: 'diagram' | 'scan') => {
    const initialPage =
      kind === 'diagram'
        ? p.diagram_pages[0] ?? p.pdf_page
        : p.pdf_page;
    setViewerTarget({
      catalogName: p.catalog_name,
      assemblyCode: p.assembly_code,
      assemblyTitle: p.assembly_title,
      initialPage,
      diagramPages: p.diagram_pages,
      partsListPages: p.parts_list_pages,
      highlightPart: {
        keyNo: p.key_no,
        partName: p.part_name,
        assyDwgNo: p.assy_dwg_no,
        dwgNo: p.dwg_no,
        qty: p.qty,
      },
    });
  };

  const hasActiveFilter = Boolean(query.trim() || sectionId || field !== 'all');

  const resetFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setField('all');
    setSectionId(null);
  };

  return (
          <>
            <section className="search-panel">
              <div className="search-input-wrap">
                <Search className="search-icon" size={20} />
                <input
                  type="search"
                  className="search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  autoFocus
                />
                {query && (
                  <button className="clear-btn" onClick={() => setQuery('')} aria-label="Clear">
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="filter-row">
                <div className="field-pills">
                  {(
                    [
                      ['all', t.fieldAll],
                      ['part_name', t.fieldPartName],
                      ['assy_dwg_no', t.fieldAssyDwg],
                      ['dwg_no', t.fieldDwg],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      className={`pill ${field === val ? 'active' : ''}`}
                      onClick={() => setField(val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {hasActiveFilter && (
                  <button className="link-reset" onClick={resetFilters}>
                    {t.clearFilter}
                  </button>
                )}
              </div>

              {sections.length > 0 && (
                <div className="section-chips">
                  <button
                    className={`chip ${sectionId === null ? 'active' : ''}`}
                    onClick={() => setSectionId(null)}
                  >
                    {t.allSections}
                  </button>
                  {sections.map((s) => (
                    <button
                      key={s.id}
                      className={`chip ${sectionId === s.id ? 'active' : ''}`}
                      onClick={() => setSectionId(sectionId === s.id ? null : s.id)}
                    >
                      <span className="chip-no">{s.no}</span>
                      {s.name.replace(/ SECTION$/i, '')}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {hasQuery && (
              <div className="results-bar">
                <div className="results-count">
                  {loading ? t.loading : t.resultsCount(items.length, total)}
                </div>
                {fuzzy && !loading && items.length > 0 && (
                  <span className="fuzzy-badge">
                    <Sparkles size={13} /> {t.fuzzyNotice}
                  </span>
                )}
              </div>
            )}

            {error && <div className="state-box error">{error}</div>}

            {!hasQuery && !error && (
              <div className="state-box">
                <div className="state-sub">{t.emptySearchHint}</div>
              </div>
            )}

            {hasQuery && !loading && !error && items.length === 0 && (
              <div className="state-box">
                <div className="state-title">{t.noResults}</div>
                <div className="state-sub">{t.noResultsHint}</div>
              </div>
            )}

            {items.length > 0 && (
              <>
                {/* Desktop table */}
                <div className="table-wrap desktop-only">
                  <table className="parts-table">
                    <thead>
                      <tr>
                        <th className="col-asm">{t.assembly}</th>
                        <th className="col-key">{t.keyNo}</th>
                        <th>{t.partName}</th>
                        <th>{t.assyDwgNo}</th>
                        <th>{t.dwgNo}</th>
                        <th className="col-qty">{t.qty}</th>
                        <th className="col-actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr
                          key={p.id}
                          className="clickable-row"
                          onClick={() => setAssemblyModalId(p.assembly_id, p.key_no)}
                        >
                          <td className="col-asm">
                            <button
                              className="asm-link"
                              onClick={(e) => { e.stopPropagation(); setAssemblyModalId(p.assembly_id, p.key_no); }}
                              title={`${p.section_no}. ${p.section_name}`}
                            >
                              <span className="code-badge">{p.assembly_code}</span>
                              <span className="asm-title-text">{p.assembly_title}</span>
                            </button>
                          </td>
                          <td className="col-key">
                            <span className="key-pill">#{p.key_no}</span>
                          </td>
                          <td className="part-name-cell">
                            <div>{p.part_name}</div>
                            {p.remarks && <div className="remarks-inline">{p.remarks}</div>}
                          </td>
                          <td className="mono">
                            {p.assy_dwg_no ? (
                              <span className="copy-wrap">
                                {p.assy_dwg_no}
                                <button
                                  className="copy-btn"
                                  onClick={(e) => { e.stopPropagation(); copyText(p.assy_dwg_no!, `a-${p.id}`); }}
                                  title={t.copy}
                                >
                                  {copiedKey === `a-${p.id}` ? <Check size={13} /> : <Copy size={13} />}
                                </button>
                              </span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td className="mono">
                            {p.dwg_no ? (
                              <span className="copy-wrap">
                                {p.dwg_no}
                                <button
                                  className="copy-btn"
                                  onClick={(e) => { e.stopPropagation(); copyText(p.dwg_no!, `d-${p.id}`); }}
                                  title={t.copy}
                                >
                                  {copiedKey === `d-${p.id}` ? <Check size={13} /> : <Copy size={13} />}
                                </button>
                              </span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td className="col-qty">{p.qty || '—'}</td>
                          <td className="actions-cell">
                            <div className="btn-row">
                              {p.diagram_pages.length > 0 && (
                                <button
                                  className="btn btn-xs btn-primary"
                                  onClick={(e) => { e.stopPropagation(); openPartPage(p, 'diagram'); }}
                                >
                                  <ImageIcon size={13} /> {t.viewDiagram}
                                </button>
                              )}
                              <button
                                className="btn btn-xs btn-outline"
                                onClick={(e) => { e.stopPropagation(); openPartPage(p, 'scan'); }}
                                title={`PDF p.${p.pdf_page}`}
                              >
                                <FileText size={13} /> p.{p.pdf_page}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="cards-list mobile-only">
                  {items.map((p) => (
                    <article
                      key={p.id}
                      className="part-card clickable-card"
                      onClick={() => setAssemblyModalId(p.assembly_id, p.key_no)}
                    >
                      <div className="card-top">
                        <button
                          className="asm-chip"
                          onClick={(e) => { e.stopPropagation(); setAssemblyModalId(p.assembly_id, p.key_no); }}
                        >
                          <span className="code-badge">{p.assembly_code}</span>
                          <span className="card-asm-title">{p.assembly_title}</span>
                        </button>
                        <span className="key-pill">#{p.key_no}</span>
                      </div>

                      <div className="card-part-name">{p.part_name}</div>
                      {p.remarks && <div className="remarks-inline">{p.remarks}</div>}

                      <div className="card-grid">
                        <div>
                          <div className="meta-label">{t.assyDwgNo}</div>
                          <div className="mono">
                            {p.assy_dwg_no ? (
                              <span className="copy-wrap">
                                {p.assy_dwg_no}
                                <button
                                  className="copy-btn"
                                  onClick={(e) => { e.stopPropagation(); copyText(p.assy_dwg_no!, `ma-${p.id}`); }}
                                >
                                  {copiedKey === `ma-${p.id}` ? <Check size={13} /> : <Copy size={13} />}
                                </button>
                              </span>
                            ) : (
                              '—'
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="meta-label">{t.dwgNo}</div>
                          <div className="mono">
                            {p.dwg_no ? (
                              <span className="copy-wrap">
                                {p.dwg_no}
                                <button
                                  className="copy-btn"
                                  onClick={(e) => { e.stopPropagation(); copyText(p.dwg_no!, `md-${p.id}`); }}
                                >
                                  {copiedKey === `md-${p.id}` ? <Check size={13} /> : <Copy size={13} />}
                                </button>
                              </span>
                            ) : (
                              '—'
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="meta-label">{t.qty}</div>
                          <div>{p.qty || '—'}</div>
                        </div>
                      </div>

                      <div className="card-actions">
                        {p.diagram_pages.length > 0 && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={(e) => { e.stopPropagation(); openPartPage(p, 'diagram'); }}
                          >
                            <ImageIcon size={14} /> {t.viewDiagram}
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={(e) => { e.stopPropagation(); openPartPage(p, 'scan'); }}
                        >
                          <FileText size={14} /> {t.viewScan} (p.{p.pdf_page})
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={(e) => { e.stopPropagation(); setAssemblyModalId(p.assembly_id, p.key_no); }}
                        >
                          <Layers size={14} /> {t.viewAssembly}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {items.length < total && (
                  <div className="load-more-wrap">
                    <button className="btn btn-outline" onClick={handleLoadMore} disabled={loadingMore}>
                      {loadingMore ? t.loading : t.loadMore}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
  );
}
