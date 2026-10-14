import type { StreamStatus } from '../hooks/useServerStream';

interface TopBarProps {
  alertStatus: StreamStatus;
  signalStatus: StreamStatus;
}

const NAV_LINKS = [
  { href: '#signal', label: 'Señal' },
  { href: '#map', label: 'Zonas de riesgo' },
  { href: '#events', label: 'Eventos' },
  { href: '#simulation', label: 'Simulación' },
  { href: '#rpc', label: 'Tráfico gRPC' },
];

export function TopBar({ alertStatus, signalStatus }: TopBarProps) {
  const isLive = alertStatus === 'live' && signalStatus === 'live';
  const statusText = isLive ? 'En vivo · gRPC-Web' : alertStatus === 'connecting' ? 'Conectando…' : 'Reconectando…';

  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <a className="brand" href="#top" aria-label="Galeras, monitor sísmico. Ir al inicio">
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M3 27 L12.5 10 L16 13.5 L19.5 10 L29 27 Z" fill="var(--accent)" />
            <path d="M13.5 6.5 q2.5 -3.5 5 0" stroke="var(--level-orange)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </svg>
          <span>
            Galeras <span className="brand__muted">· Monitor sísmico</span>
          </span>
        </a>
        <nav className="topbar__nav" aria-label="Secciones">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <span className="status-pill" role="status" aria-live="polite">
          <span className={`dot ${isLive ? 'dot--live' : 'dot--waiting'}`} aria-hidden="true" />
          {statusText}
        </span>
      </div>
    </header>
  );
}
