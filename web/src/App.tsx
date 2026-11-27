import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, ChevronRight, Layers, Search } from 'lucide-react';
import { Catalog, getCatalogs, getSections, pageImageUrl, SectionItem } from './api';
import { dict, Lang } from './i18n';
import { AssemblyPage } from './components/AssemblyPage';
import { InstallBanner } from './components/InstallBanner';
import { PartSearch } from './components/PartSearch';
import { PageViewerModal, ViewerTarget } from './components/PageViewerModal';

function sectionImage(s: SectionItem) {
  if (s.catalog_name === 'M701F' && s.no >= 1 && s.no <= 6) return `/catalog/m701f/section-${s.no}.webp`;
  const page = s.assemblies.find(a => a.diagram_pages.length)?.diagram_pages[0];
  return page ? pageImageUrl(page, s.catalog_name) : undefined;
}
function sectionName(s: SectionItem) { return s.name.replace(/ SECTION$/i, '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }

export function App() {
  const [lang, language] = useState<Lang>(() => localStorage.getItem('pf_lang') === 'en' ? 'en' : 'id');
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [path, setPath] = useState(location.hash.slice(1));
  const [status, setStatus] = useState<'loading'|'ready'|'error'>('loading');
  const [attempt, retry] = useState(0);
  const [viewer, setViewer] = useState<ViewerTarget|null>(null);

  const [modelId, view, paramId, paramKey] = path.split('/');
  const model = catalogs.find(c => c.id === Number(modelId));
  const section = view === 'section' ? sections.find(s => s.id === Number(paramId)) : undefined;
  const assemblyId = view === 'assembly' && paramId ? Number(paramId) : null;
  const highlightKeyNo = view === 'assembly' && paramKey ? Number(paramKey) : null;
  const search = !!model && view === 'search';

  const t = dict[lang], id = lang === 'id';
  const modelsLabel = id ? 'Pilih model' : 'Select model';
  const title = !model
    ? modelsLabel
    : search
      ? t.tabSearch
      : assemblyId
        ? t.assembly
        : section
          ? sectionName(section)
          : 'Table of Contents';

  useEffect(() => {
    const change = () => { setPath(location.hash.slice(1)); setViewer(null); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => { localStorage.setItem('pf_lang', lang); document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    let live = true; setStatus('loading');
    Promise.all([getCatalogs(), getSections()]).then(([c, s]) => { if (live) { setCatalogs(c); setSections(s); setStatus('ready'); } }).catch(() => { if (live) setStatus('error'); });
    return () => { live = false; };
  }, [attempt]);

  const scoped = sections.filter(s => s.catalog_id === model?.id);
  const openAssemblyPage = (aid: number, keyNo?: number) => {
    if (!model) return;
    location.hash = keyNo != null ? `#${model.id}/assembly/${aid}/${keyNo}` : `#${model.id}/assembly/${aid}`;
  };

  return <div className="library">
    <aside className="rail"><a className="wordmark" href="#"><img src="/logo.png" alt="Part Finder" className="wordmark-logo"/> Part Finder</a><small>{id?'NAVIGASI KATALOG':'CATALOG NAVIGATION'}</small>
      <nav><a href="#" aria-current={!model?'page':undefined}><Layers size={17}/>{modelsLabel}</a>
      {model && <><a href={`#${model.id}`} aria-current={!search && !assemblyId?'page':undefined}><BookOpen size={17}/>Table of Contents</a><a href={`#${model.id}/search`} aria-current={search?'page':undefined}><Search size={17}/>{t.tabSearch}</a></>}</nav><footer>PLTGU CILEGON</footer></aside>
    <div className="workspace"><header className="utility"><span>Part Finder &nbsp; / &nbsp; {id?'Perpustakaan teknik':'Technical library'}</span><div className="lang-toggle">{(['id','en'] as const).map(l=><button key={l} aria-pressed={lang===l} className={lang===l?'active':''} onClick={()=>language(l)}>{l.toUpperCase()}</button>)}</div></header>
    <main className="library-body" key={path}>
      <p className="eyebrow">{model ? `MODEL ${model.name} / ${assemblyId ? 'ASSEMBLY' : section ? 'SECTION '+section.no : 'CATALOG'}` : 'PLTGU CILEGON / GAS TURBINE'}</p>
      {!assemblyId && <h1>{title}</h1>}
      {status!=='ready' ? <div role="status" className="state-box">{status==='loading'?t.loading:<>{id?'Katalog gagal dimuat.':'Cannot load catalog.'} <button className="btn btn-outline" onClick={()=>retry(n=>n+1)}>{id?'Coba lagi':'Retry'}</button></>}</div> : !model ? <>{!catalogs.length && <p>{id?'Belum ada katalog.':'No catalogs available.'}</p>}{catalogs.map(c=><a className="model-plate" key={c.id} href={`#${c.id}`}>
        {c.name==='M701F' && <img src="/catalog/m701f/model.webp" alt="M701F"/>}<div><small>{c.name==='M701F'?'MITSUBISHI / GAS TURBINE':'GAS TURBINE'}</small><h2>MODEL {c.name}</h2><p>{c.section_count} section &nbsp;/&nbsp; {c.assembly_count} assembly</p><strong>{id?'Buka katalog':'Open catalog'} <ArrowRight size={18}/></strong></div></a>)}</> : search ? <PartSearch lang={lang} catalogId={model.id} sections={scoped} setViewerTarget={setViewer} setAssemblyModalId={openAssemblyPage}/> : assemblyId ? <AssemblyPage assemblyId={assemblyId} highlightKeyNo={highlightKeyNo} lang={lang} onBack={() => history.length > 1 ? history.back() : (location.hash = `#${model.id}`)} onOpenViewer={setViewer}/> : section && section.catalog_id===model.id ? <div className="section-layout"><div className="section-summary">{sectionImage(section) && <img src={sectionImage(section)} alt=""/>}<p>{t.assembliesCount(section.assemblies.length)}</p><a href={`#${model.id}`}>Table of Contents</a></div><div><h2>{id?'Daftar assembly':'Assembly list'}</h2>{section.assemblies.map(a=><button className="assembly-row" key={a.id} onClick={()=>openAssemblyPage(a.id)}><span>{a.code}</span><b>{a.title||a.code}</b><ChevronRight size={18}/></button>)}</div></div> : <div className="section-tiles">{scoped.map(s=><a key={s.id} href={`#${model.id}/section/${s.id}`}><small>SECTION {String(s.no).padStart(2,'0')}</small>{sectionImage(s) && <img src={sectionImage(s)} alt=""/>}<h2>{sectionName(s)}</h2><p>{t.assembliesCount(s.assemblies.length)} <ArrowRight size={16}/></p></a>)}</div>}
    </main></div>
    {viewer && <PageViewerModal target={viewer} lang={lang} onClose={()=>setViewer(null)}/>}
    <InstallBanner lang={lang}/>
  </div>;
}
