import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Lang } from '../i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const otherBrowser = /CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return ios && webkit && !otherBrowser;
}

export function InstallBanner({ lang }: { lang: Lang }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('pf_install_dismissed') === '1');

  useEffect(() => {
    if (isStandalone()) return;

    if (isIosSafari()) {
      setShowIos(true);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setShowIos(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (dismissed || (!promptEvent && !showIos)) return null;

  const dismiss = () => {
    sessionStorage.setItem('pf_install_dismissed', '1');
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setPromptEvent(null);
    }
  };

  const id = lang === 'id';

  return (
    <div className="install-banner" role="region" aria-label="Install App">
      <img src="/logo.png" alt="" className="install-banner-logo" />
      <div className="install-banner-text">
        <strong>{id ? 'Install Part Finder' : 'Install Part Finder'}</strong>
        {promptEvent ? (
          <span>{id ? 'Pasang ke layar utama untuk akses cepat seperti aplikasi.' : 'Add to your home screen for quick app-like access.'}</span>
        ) : (
          <span>
            {id ? (
              <>Ketuk <Share size={13} style={{ verticalAlign: '-2px' }} /> <b>Share</b> lalu pilih <b>Add to Home Screen</b>.</>
            ) : (
              <>Tap <Share size={13} style={{ verticalAlign: '-2px' }} /> <b>Share</b> then select <b>Add to Home Screen</b>.</>
            )}
          </span>
        )}
      </div>
      {promptEvent && (
        <button className="btn btn-primary btn-sm" onClick={handleInstall}>
          <Download size={14} /> {id ? 'Install' : 'Install'}
        </button>
      )}
      <button className="install-dismiss" onClick={dismiss} aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
}
