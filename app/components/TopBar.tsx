'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { play } from '../lib/sound';
import { supabase } from '../lib/supabase';
import { ArrowUpRight, Close, Lock, Menu } from './icons';

const LINKS = [
  { href: '/', label: 'Inicio', match: (p: string) => p === '/' },
  { href: '/#como-funciona', label: 'Cómo funciona' },
  { href: '/#precios', label: 'Precios' },
  { href: '/#horarios', label: 'Horarios' },
  { href: '/contacto', label: 'Contacto', match: (p: string) => p.startsWith('/contacto') },
];

export default function TopBar({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(Boolean(s)));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.documentElement.classList.add('menu-open');
    return () => { window.removeEventListener('keydown', onKey); document.documentElement.classList.remove('menu-open'); };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={`topbar topbar--${tone}${scrolled ? ' is-scrolled' : ''}`}>
      <div className="capsule">
        <Link href="/" className="brand" aria-label="Impresiones Pura Tinta — inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-pura-tinta-480.webp" alt="" width="480" height="522" className="brand__logo" />
        </Link>

        <nav className="capsule__links" aria-label="Principal">
          {LINKS.map((l) => {
            const current = l.match ? l.match(pathname) : false;
            return (
              <Link key={l.href} href={l.href} className={current ? 'is-current' : undefined} aria-current={current ? 'page' : undefined}>
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="capsule__tools">
          <Link href={signedIn ? '/panel' : '/ingresar'} className="icon-btn" aria-label={signedIn ? 'Ir al panel' : 'Ingresar (equipo Pura Tinta)'} title={signedIn ? 'Panel' : 'Ingresar'}>
            <Lock />
          </Link>
          <Link href="/pedido" className="capsule__cta" data-sfx="pop">
            Hacer pedido <ArrowUpRight />
          </Link>
          <button className="capsule__burger icon-btn" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open}
            onClick={() => { setOpen((o) => !o); play('paper'); }} data-sfx="none">
            {open ? <Close /> : <Menu />}
          </button>
        </div>
      </div>

      <div className={`sheet${open ? ' is-open' : ''}`} hidden={!open}>
        {LINKS.map((l, i) => (
          <Link key={l.href} href={l.href} style={{ ['--i' as string]: i }} onClick={() => setOpen(false)}>
            <span>0{i + 1}</span>{l.label}
          </Link>
        ))}
        <div className="sheet__row">
          <Link href="/pedido" className="btn btn--ink" onClick={() => setOpen(false)}>Hacer pedido <ArrowUpRight /></Link>
          <Link href={signedIn ? '/panel' : '/ingresar'} className="btn btn--ghost" onClick={() => setOpen(false)}><Lock /> {signedIn ? 'Panel' : 'Ingresar'}</Link>
        </div>
      </div>
    </header>
  );
}
