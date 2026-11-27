import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { pageImageUrl } from '../api';
import { dict, Lang } from '../i18n';

export interface ViewerTarget {
  catalogName: string;
  assemblyCode: string;
  assemblyTitle: string | null;
  initialPage: number;
  diagramPages: number[];
  partsListPages: number[];
  highlightPart?: {
    keyNo: number;
    partName: string;
    assyDwgNo: string | null;
    dwgNo: string | null;
    qty: string | null;
  };
}

interface Props {
  target: ViewerTarget;
  lang: Lang;
  onClose: () => void;
}

export function PageViewerModal({ target, lang, onClose }: Props) {
  const t = dict[lang];
  const [currentPage, setCurrentPage] = useState(target.initialPage);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const pinchDist = useRef<number | null>(null);
  const pinchScale = useRef(1);

  useEffect(() => {
    setCurrentPage(target.initialPage);
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(5, +(s * 1.25).toFixed(2)));
      if (e.key === '-') setScale((s) => Math.max(0.5, +(s / 1.25).toFixed(2)));
      if (e.key === '0') {
        setScale(1);
        setPos({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const resetView = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  const switchPage = (p: number) => {
    setCurrentPage(p);
    resetView();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setScale((s) => Math.min(5, Math.max(0.5, +(s * factor).toFixed(2))));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || e.pointerType === 'touch') return;
    setPos({
      x: dragStart.current.px + (e.clientX - dragStart.current.x),
      y: dragStart.current.py + (e.clientY - dragStart.current.y),
    });
  };

  const handlePointerUp = () => setDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDist.current = Math.hypot(dx, dy);
      pinchScale.current = scale;
    } else if (e.touches.length === 1) {
      setDragging(true);
      dragStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        px: pos.x,
        py: pos.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const next = pinchScale.current * (dist / pinchDist.current);
      setScale(Math.min(5, Math.max(0.5, +next.toFixed(2))));
    } else if (e.touches.length === 1 && dragging) {
      setPos({
        x: dragStart.current.px + (e.touches[0].clientX - dragStart.current.x),
        y: dragStart.current.py + (e.touches[0].clientY - dragStart.current.y),
      });
    }
  };

  const handleTouchEnd = () => {
    pinchDist.current = null;
    setDragging(false);
  };

  const imgSrc = pageImageUrl(currentPage, target.catalogName);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="viewer-shell" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-header">
          <div className="viewer-title-block">
            <span className="code-badge">{target.assemblyCode}</span>
            <span className="viewer-title">{target.assemblyTitle || target.assemblyCode}</span>
            <span className="muted-tag">PDF p.{currentPage}</span>
          </div>
          <div className="viewer-controls">
            <button
              className="icon-btn"
              onClick={() => setScale((s) => Math.max(0.5, +(s / 1.25).toFixed(2)))}
              title={t.zoomOut}
            >
              <ZoomOut size={18} />
            </button>
            <span className="zoom-label">{Math.round(scale * 100)}%</span>
            <button
              className="icon-btn"
              onClick={() => setScale((s) => Math.min(5, +(s * 1.25).toFixed(2)))}
              title={t.zoomIn}
            >
              <ZoomIn size={18} />
            </button>
            <button className="icon-btn" onClick={resetView} title={t.resetZoom}>
              <RotateCcw size={18} />
            </button>
            <a className="icon-btn" href={imgSrc} target="_blank" rel="noreferrer" title={t.openOriginal}>
              <ExternalLink size={18} />
            </a>
            <button className="icon-btn close-btn" onClick={onClose} title={t.close}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="viewer-tabs">
          {target.diagramPages.map((p, idx) => (
            <button
              key={`d-${p}`}
              className={`page-pill ${currentPage === p ? 'active' : ''}`}
              onClick={() => switchPage(p)}
            >
              {t.diagramPage} {target.diagramPages.length > 1 ? idx + 1 : ''} (p.{p})
            </button>
          ))}
          {target.partsListPages.map((p, idx) => (
            <button
              key={`pl-${p}`}
              className={`page-pill ${currentPage === p ? 'active' : ''}`}
              onClick={() => switchPage(p)}
            >
              {t.partsListPage} {target.partsListPages.length > 1 ? `${idx + 1}/${target.partsListPages.length}` : ''} (p.{p})
            </button>
          ))}
        </div>

        {target.highlightPart && (
          <div className="callout-banner">
            <span className="callout-key">KEY #{target.highlightPart.keyNo}</span>
            <span className="callout-name">{target.highlightPart.partName}</span>
            <span className="callout-meta">
              {target.highlightPart.assyDwgNo ? `ASS'Y: ${target.highlightPart.assyDwgNo}` : ''}
              {target.highlightPart.assyDwgNo && target.highlightPart.dwgNo ? ' · ' : ''}
              {target.highlightPart.dwgNo ? `DWG: ${target.highlightPart.dwgNo}` : ''}
              {target.highlightPart.qty ? ` · Q'TY: ${target.highlightPart.qty}` : ''}
            </span>
          </div>
        )}

        <div
          className={`viewer-canvas ${dragging ? 'dragging' : ''}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={imgSrc}
            alt={`${target.assemblyCode} p.${currentPage}`}
            draggable={false}
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
