import { useEffect, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, X } from 'lucide-react';
import { AssemblyDetail, getAssembly, pageImageUrl } from '../api';
import { dict, Lang } from '../i18n';
import { ViewerTarget } from './PageViewerModal';

interface Props {
  assemblyId: number;
  highlightKeyNo?: number | null;
  lang: Lang;
  onClose: () => void;
  onOpenViewer: (target: ViewerTarget) => void;
}

export function AssemblyModal({ assemblyId, highlightKeyNo, lang, onClose, onOpenViewer }: Props) {
  const t = dict[lang];
  const [data, setData] = useState<AssemblyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (data && highlightKeyNo != null && highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [data, highlightKeyNo]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErr(null);
    getAssembly(assemblyId)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setErr(String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [assemblyId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openPage = (page: number, part?: AssemblyDetail['parts'][number]) => {
    if (!data) return;
    onOpenViewer({
      catalogName: data.catalog_name,
      assemblyCode: data.code,
      assemblyTitle: data.title,
      initialPage: page,
      diagramPages: data.diagram_pages,
      partsListPages: data.parts_list_pages,
      highlightPart: part
        ? {
            keyNo: part.key_no,
            partName: part.part_name,
            assyDwgNo: part.assy_dwg_no,
            dwgNo: part.dwg_no,
            qty: part.qty,
          }
        : undefined,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="assembly-modal" role="dialog" aria-modal="true" aria-label={t.assembly} onClick={(e) => e.stopPropagation()}>
        <div className="viewer-header">
          <div className="viewer-title-block">
            {data ? (
              <>
                <span className="code-badge">{data.code}</span>
                <div>
                  <div className="viewer-title">{data.title || data.code}</div>
                  <div className="sub-caption">
                    {data.catalog_name} · Section {data.section_no}: {data.section_name} · {t.partsCount(data.parts.length)}
                  </div>
                </div>
              </>
            ) : (
              <span className="viewer-title">{t.loading}</span>
            )}
          </div>
          <div className="viewer-controls">
            {data && data.diagram_pages.length > 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => openPage(data.diagram_pages[0])}>
                <ImageIcon size={15} /> {t.viewDiagram}
              </button>
            )}
            {data && data.parts_list_pages.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => openPage(data.parts_list_pages[0])}>
                <FileText size={15} /> {t.viewScan}
              </button>
            )}
            <button className="icon-btn close-btn" onClick={onClose} title={t.close}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="assembly-modal-body assembly-detail">
          {data && data.diagram_pages.length > 0 && <button className="drawing-preview" onClick={() => openPage(data.diagram_pages[0])}>
            <img src={pageImageUrl(data.diagram_pages[0], data.catalog_name)} alt={`${t.diagramPage} ${data.code}`} />
            <strong>{t.zoomIn} +</strong>
          </button>}
          {loading && <div className="state-box">{t.loading}</div>}
          {err && <div className="state-box error">{err}</div>}
          {data && (
            <div className="table-wrap">
              <table className="parts-table">
                <thead>
                  <tr>
                    <th className="col-key">{t.keyNo}</th>
                    <th>{t.partName}</th>
                    <th>{t.assyDwgNo}</th>
                    <th>{t.dwgNo}</th>
                    <th className="col-qty">{t.qty}</th>
                    <th>{t.remarks}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.parts.map((p) => {
                    const isHighlighted = highlightKeyNo != null && p.key_no === highlightKeyNo;
                    return (
                    <tr
                      key={p.id}
                      ref={isHighlighted ? highlightRowRef : undefined}
                      className={isHighlighted ? 'part-row-highlight' : undefined}
                    >
                      <td className="col-key">
                        <span className="key-pill">#{p.key_no}</span>
                      </td>
                      <td className="part-name-cell">{p.part_name}</td>
                      <td className="mono">{p.assy_dwg_no || '—'}</td>
                      <td className="mono">{p.dwg_no || '—'}</td>
                      <td className="col-qty">{p.qty || '—'}</td>
                      <td className="remarks-cell">{p.remarks || ''}</td>
                      <td className="actions-cell">
                        {data.diagram_pages.length > 0 && (
                          <button
                            className="btn btn-xs btn-outline"
                            onClick={() => openPage(data.diagram_pages[0], p)}
                          >
                            <ImageIcon size={13} /> {t.viewDiagram}
                          </button>
                        )}
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
