'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'inicio' },
  { href: '/pedido', label: 'hacer pedido' },
  { href: '/contacto', label: 'contacto' },
];

export default function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="Menú principal">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? 'is-active' : ''}
          aria-current={pathname === l.href ? 'page' : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
