'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Icon3D, Eye, ArrowRight } from '../components/icons';
import { isAllowedEmail } from '../lib/config';
import { play } from '../lib/sound';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'forgot' | 'recovery';

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setMode('recovery'); return; }
      if (session && event === 'SIGNED_IN' && mode !== 'recovery') router.replace('/panel');
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session && !window.location.hash.includes('type=recovery')) router.replace('/panel');
    });
    return () => data.subscription.unsubscribe();
  }, [router, mode]);

  const fail = (text: string) => { setMsg({ kind: 'error', text }); play('error'); };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (mode !== 'recovery' && !(await isAllowedEmail(email))) {
      fail('Este correo no está autorizado. El panel es solo para el equipo de Pura Tinta.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) fail('Email o contraseña incorrectos.');
        else { play('ding'); router.replace('/panel'); }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/ingresar` });
        if (error) fail('No pudimos mandar el mail. Pedile al otro administrador que te cambie la contraseña desde el panel.');
        else setMsg({ kind: 'ok', text: 'Te mandamos un mail con un enlace para crear una contraseña nueva.' });
      } else {
        if (password.length < 8) { fail('La contraseña debe tener al menos 8 caracteres.'); return; }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) fail('No se pudo guardar la contraseña. Probá de nuevo.');
        else { play('ding'); router.replace('/panel'); }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login" id="contenido">
      <div className="login__art" aria-hidden="true">
        <Icon3D name="lock" size={360} eager className="login__lock" />
        <Icon3D name="sparkle" size={120} eager className="login__spark" />
        <Icon3D name="drop" size={110} eager className="login__drop" />
      </div>
      <div className="login__card">
        <Link href="/" className="login__logo" aria-label="Volver al inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-pura-tinta-480.webp" alt="Impresiones Pura Tinta" width="480" height="522" />
        </Link>
        <p className="eyebrow">Solo equipo Pura Tinta</p>
        <h1 className="display-sm">{mode === 'login' ? <>Entrá al <em>panel</em></> : mode === 'forgot' ? <>Recuperá tu <em>acceso</em></> : <>Creá tu <em>contraseña</em></>}</h1>
        <form onSubmit={onSubmit} className="login__form">
          {mode !== 'recovery' && (
            <label className="field">Email
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
            </label>
          )}
          {mode !== 'forgot' && (
            <label className="field">{mode === 'recovery' ? 'Contraseña nueva' : 'Contraseña'}
              <span className="pw">
                <input type={show ? 'text' : 'password'} required minLength={mode === 'recovery' ? 8 : 1} value={password}
                  autoComplete={mode === 'recovery' ? 'new-password' : 'current-password'} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="pw__eye" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShow(!show)}><Eye /></button>
              </span>
            </label>
          )}
          <button className="btn btn--ink btn--block btn--lg" type="submit" disabled={busy}>
            {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : mode === 'forgot' ? 'Mandarme el enlace' : 'Guardar y entrar'} <ArrowRight />
          </button>
          {msg && <p className={msg.kind === 'error' ? 'form-error' : 'form-ok'} role="alert">{msg.text}</p>}
        </form>
        {mode === 'login' && <button type="button" className="link-btn" onClick={() => { setMode('forgot'); setMsg(null); }}>Olvidé mi contraseña</button>}
        {mode === 'forgot' && <button type="button" className="link-btn" onClick={() => { setMode('login'); setMsg(null); }}>Volver a ingresar</button>}
        <p className="login__fine">Acceso restringido a los correos autorizados. Si no sos del equipo, <Link href="/">volvé al inicio</Link>.</p>
      </div>
    </main>
  );
}
