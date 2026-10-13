import Link from 'next/link';
import type { ReactNode } from 'react';
import SiteNav from './site-nav';

// Estructura de las páginas internas: logo chico + menú, y el contenido.
export default function PageShell({ tag, title, children }: { tag: string; title: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <header className="page-header">
        <Link href="/" className="page-logo" aria-label="Pura Tinta — inicio">
          <img src="/logo-pura-tinta.webp" alt="" width="1254" height="1254" />
        </Link>
        <SiteNav />
      </header>
      <main className="page-main">
        <span className="tag">{tag}</span>
        <h1 className="headline page-title">{title}</h1>
        {children}
      </main>
    </div>
  );
}
