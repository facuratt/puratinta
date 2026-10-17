'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Icon3D, LogOut, Search, WhatsAppGlyph, Download, Printer } from '../components/icons';
import Ticket from '../components/Ticket';
import { DEFAULT_SETTINGS, formatMoney, STATUS_LABELS, type DayHours, type SiteSettings } from '../lib/config';
import { getTier, setTier } from '../lib/perf';
import { invalidateLive, useLive } from '../lib/settings';
import { play } from '../lib/sound';
import { BUCKET, orderCode, orderFiles, supabase, type Order } from '../lib/supabase';

const TABS = [
  { id: 'pedidos', label: 'Pedidos', icon: 'ticket' },
  { id: 'precios', label: 'Precios y horarios', icon: 'calc' },
  { id: 'web', label: 'Web y avisos', icon: 'mail' },
  { id: 'equipo', label: 'Equipo', icon: 'lock' },
  { id: 'mantenimiento', label: 'Mantenimiento', icon: 'printer' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const FILTERS = ['activos', 'nuevo', 'en_proceso', 'listo', 'entregado', 'cancelado', 'todos'] as const;
const ACTIVE = ['nuevo', 'en_proceso', 'listo'];

const customerWhatsapp = (phone: string, text: string) => {
  let digits = phone.replace(/\D/g, '').replace(/^0/, '');
  if (!digits.startsWith('54')) digits = `549${digits.replace(/^(\d{2,4})15/, '$1')}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};

type Team = { email: string; label: string; has_account: boolean; last_sign_in_at: string | null }[];

function Toast({ text }: { text: string }) { return text ? <div className="toast" role="status">{text}</div> : null; }

export default function PanelPage() {
  const router = useRouter();
  const live = useLive();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>('pedidos');
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('activos');
  const [query, setQuery] = useState('');
  const [printing, setPrinting] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [team, setTeam] = useState<Team>([]);
  const [toast, setToast] = useState('');

  const say = useCallback((t: string) => { setToast(t); setTimeout(() => setToast(''), 2600); }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); if (!data.session) router.replace('/ingresar'); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (!s) router.replace('/ingresar'); });
    const fromHash = window.location.hash.replace('#', '') as TabId;
    if (TABS.some((t) => t.id === fromHash)) setTab(fromHash);
    const q = new URLSearchParams(window.location.search).get('pedido');
    if (q) { setQuery(q); setFilter('todos'); }
    return () => data.subscription.unsubscribe();
  }, [router]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*, order_files(*)').order('created_at', { ascending: false }).limit(300);
    setOrders((data as Order[]) ?? []);
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(Boolean(data)));
  }, [session]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    supabase.rpc('admin_team').then(({ data }) => setTeam((data as Team) ?? []));
    const channel = supabase.channel('orders-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        setNewCount((n) => n + 1);
        play('ding');
        setTimeout(() => void load(), 1500);
        if ('Notification' in window && Notification.permission === 'granted') new Notification('Pura Tinta: ¡pedido nuevo!', { icon: '/brand/icon-192.png' });
      })
      .subscribe();
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
    const poll = setInterval(() => void load(), 60000);
    return () => { void supabase.removeChannel(channel); clearInterval(poll); };
  }, [isAdmin, load]);

  const me = useMemo(() => team.find((t) => t.email === session?.user.email?.toLowerCase()), [team, session]);

  function go(t: TabId) { setTab(t); history.replaceState(null, '', `#${t}`); play('paper'); }

  async function setStatus(order: Order, status: string) {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id);
    if (error) { say('No se pudo cambiar el estado'); play('error'); } else { say(`${orderCode(order.number)} → ${STATUS_LABELS[status]}`); play('stamp'); }
  }

  async function download(path: string, name: string) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300, { download: name });
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
    else say('No se encontró el archivo (puede que se haya liberado espacio).');
  }

  function printTicket(id: string) {
    setPrinting(id);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  if (checking || (session && isAdmin === null)) return <div className="panel panel--center"><Icon3D name="printer" size={120} eager /><p>Cargando el panel…</p></div>;
  if (!session) return null;
  if (isAdmin === false) {
    return (
      <div className="panel panel--center">
        <Icon3D name="lock" size={140} eager />
        <h1 className="display-sm">Sin acceso</h1>
        <p>Esta cuenta no está autorizada para administrar Pura Tinta.</p>
        <button className="btn btn--ink" onClick={() => supabase.auth.signOut()}>Salir</button>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const matches = (o: Order) => !q || orderCode(o.number).toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q) || o.customer_phone.includes(q);
  const inFilter = (o: Order, f: string) => (f === 'todos' ? true : f === 'activos' ? ACTIVE.includes(o.status) : o.status === f);
  const visible = orders.filter((o) => inFilter(o, filter) && matches(o));
  const today = new Date().toDateString();
  const todays = orders.filter((o) => new Date(o.created_at).toDateString() === today && o.status !== 'cancelado');

  return (
    <div className="panel">
      <header className="panel__top">
        <Link href="/" className="panel__logo" aria-label="Ver la web">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-pura-tinta-480.webp" alt="Pura Tinta" width="480" height="522" />
        </Link>
        <div className="panel__hello">
          <p className="eyebrow">Panel de administración</p>
          <h1>Hola, {me?.label ?? session.user.email}</h1>
        </div>
        {newCount > 0 && <button className="pill-new" onClick={() => { go('pedidos'); setFilter('nuevo'); setNewCount(0); }}>{newCount} pedido{newCount > 1 ? 's' : ''} nuevo{newCount > 1 ? 's' : ''}</button>}
        <Link href="/" className="btn btn--line btn--sm" target="_blank">Ver la web ↗</Link>
        <button className="btn btn--ink btn--sm" onClick={() => supabase.auth.signOut()}><LogOut /> Salir</button>
      </header>

      <nav className="ptabs" role="tablist" aria-label="Secciones del panel">
        {TABS.map((t) => (
          <a key={t.id} href={`#${t.id}`} role="tab" aria-selected={tab === t.id} className={`ptabs__tab${tab === t.id ? ' is-on' : ''}`}
            onClick={(e) => { e.preventDefault(); go(t.id); }} data-sfx="none">
            <Icon3D name={t.icon} size={34} eager /> {t.label}
          </a>
        ))}
      </nav>

      {tab === 'pedidos' && (
        <section className="ppane" role="tabpanel">
          <div className="stats">
            <div><span>Nuevos</span><b>{orders.filter((o) => o.status === 'nuevo').length}</b></div>
            <div><span>En proceso</span><b>{orders.filter((o) => o.status === 'en_proceso').length}</b></div>
            <div><span>Listos para retirar</span><b>{orders.filter((o) => o.status === 'listo').length}</b></div>
            <div><span>Hoy</span><b>{todays.length} · {formatMoney(todays.reduce((n, o) => n + o.total, 0))}</b></div>
          </div>
          <div className="ptools">
            <label className="search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por código, nombre o teléfono" /></label>
            <div className="chips">
              {FILTERS.map((f) => (
                <button key={f} className={`chip${filter === f ? ' is-on' : ''}`} onClick={() => setFilter(f)} data-sfx="toggle">
                  {f === 'activos' ? 'Activos' : f === 'todos' ? 'Todos' : STATUS_LABELS[f]} ({orders.filter((o) => inFilter(o, f)).length})
                </button>
              ))}
            </div>
            <button className="btn btn--line btn--sm" onClick={() => { void load(); say('Actualizado'); }}>Actualizar</button>
          </div>
          {visible.length === 0 && <div className="empty"><Icon3D name="copies" size={120} /><p>No hay pedidos acá todavía.</p></div>}
          <div className="porders">
            {visible.map((o) => (
              <article key={o.id} className={`porder status-${o.status}${q && orderCode(o.number).toLowerCase() === q ? ' is-hit' : ''}`}>
                <Ticket order={o} variant="negocio" settings={live.settings} className={printing === o.id ? 'ticket--print' : ''} />
                <div className="porder__actions">
                  <div className="statusbar" role="group" aria-label="Estado">
                    {Object.entries(STATUS_LABELS).map(([v, l]) => (
                      <button key={v} className={`chip chip--${v}${o.status === v ? ' is-on' : ''}`} onClick={() => void setStatus(o, v)} data-sfx="none">{l}</button>
                    ))}
                  </div>
                  {orderFiles(o).map((f) => (
                    <button key={f.id} className="filebtn" onClick={() => void download(f.path, f.file_name)}><Download /> {f.file_name}</button>
                  ))}
                  <div className="porder__row">
                    <button className="btn btn--ink btn--sm" onClick={() => printTicket(o.id)}><Printer /> Imprimir ticket</button>
                    <a className="btn btn--wa btn--sm" target="_blank" rel="noopener noreferrer"
                      href={customerWhatsapp(o.customer_phone, o.status === 'listo'
                        ? `Hola ${o.customer_name}! Tu pedido ${orderCode(o.number)} de Pura Tinta ya está listo para retirar. Total: ${formatMoney(o.total)}.`
                        : `Hola ${o.customer_name}! Te escribimos de Pura Tinta por tu pedido ${orderCode(o.number)}.`)}>
                      <WhatsAppGlyph /> WhatsApp al cliente
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'precios' && <PricesPane say={say} />}
      {tab === 'web' && <WebPane say={say} />}
      {tab === 'equipo' && <TeamPane say={say} team={team} me={session.user.email ?? ''} />}
      {tab === 'mantenimiento' && <MaintenancePane say={say} orders={orders} reload={load} />}
      <Toast text={toast} />
    </div>
  );
}

/* ───────────── Precios y horarios ───────────── */

async function saveSettings(patch: (s: SiteSettings) => SiteSettings) {
  const { data } = await supabase.from('site_settings').select('data').eq('id', 1).maybeSingle();
  const base = { ...DEFAULT_SETTINGS, ...((data?.data as Partial<SiteSettings>) ?? {}) } as SiteSettings;
  const { error } = await supabase.from('site_settings').update({ data: patch(base) }).eq('id', 1);
  if (!error) await invalidateLive();
  return error;
}

function HoursEditor({ value, onChange }: { value: DayHours; onChange: (v: DayHours) => void }) {
  return (
    <div className="hedit">
      <input className="hedit__label" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} aria-label="Días" />
      <label>Abre<input type="time" value={value.open} onChange={(e) => onChange({ ...value, open: e.target.value })} /></label>
      <label>Cierra<input type="time" value={value.close} onChange={(e) => onChange({ ...value, close: e.target.value })} /></label>
    </div>
  );
}

function PricesPane({ say }: { say: (t: string) => void }) {
  const live = useLive();
  const [prices, setPrices] = useState(live.prices);
  const [hours, setHours] = useState(live.settings.hours);
  const [bulk, setBulk] = useState(live.settings.bulk);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPrices(live.prices); setHours(live.settings.hours); setBulk(live.settings.bulk); }, [live.prices, live.settings.hours, live.settings.bulk]);

  async function save() {
    setBusy(true);
    const r = await Promise.all((['simple', 'doble'] as const).map((s) => supabase.from('prices').update({ price_per_sheet: Math.max(0, Math.round(prices[s])) }).eq('sides', s)));
    const e2 = await saveSettings((s) => ({ ...s, hours, bulk: { enabled: bulk.enabled, minSheets: Math.max(1, Math.round(bulk.minSheets)), dobleSheetPrice: Math.max(0, Math.round(bulk.dobleSheetPrice)) } }));
    setBusy(false);
    if (r.some((x) => x.error) || e2) { say('No se pudo guardar'); play('error'); } else { say('Guardado: la web ya muestra los cambios'); play('ding'); }
  }

  return (
    <section className="ppane ppane--form" role="tabpanel">
      <div className="pcard">
        <h2><Icon3D name="copies" size={48} /> Fotocopias B/N · precio por hoja</h2>
        <div className="pgrid">
          <label className="field">Simple faz ($)<input type="number" min={0} value={prices.simple} onChange={(e) => setPrices({ ...prices, simple: Number(e.target.value) })} /></label>
          <label className="field">Doble faz ($)<input type="number" min={0} value={prices.doble} onChange={(e) => setPrices({ ...prices, doble: Number(e.target.value) })} /></label>
        </div>
        <p className="hint">Estos precios los usa el sistema para calcular el total de cada pedido (y se ven en toda la web).</p>
      </div>
      <div className="pcard">
        <h2><Icon3D name="printer" size={48} /> Precio por cantidad · doble faz</h2>
        <Switch on={bulk.enabled} set={(v) => setBulk({ ...bulk, enabled: v })} label={bulk.enabled ? 'Activo' : 'Desactivado'}
          hint="Si el pedido suma esa cantidad de hojas doble faz o más, todas sus hojas doble faz van a este precio." />
        <div className="pgrid">
          <label className="field">Desde (hojas doble faz)<input type="number" min={1} value={bulk.minSheets} onChange={(e) => setBulk({ ...bulk, minSheets: Number(e.target.value) })} /></label>
          <label className="field">Precio por hoja ($)<input type="number" min={0} value={bulk.dobleSheetPrice} onChange={(e) => setBulk({ ...bulk, dobleSheetPrice: Number(e.target.value) })} /></label>
        </div>
        <p className="hint">Ejemplo: {Math.round(bulk.minSheets)} hojas doble faz = {formatMoney(bulk.minSheets * bulk.dobleSheetPrice)} ({formatMoney(bulk.dobleSheetPrice / 2)} la carilla).</p>
      </div>
      <div className="pcard">
        <h2><Icon3D name="clock" size={48} /> Horarios de atención</h2>
        <HoursEditor value={hours.weekdays} onChange={(v) => setHours({ ...hours, weekdays: v })} />
        <HoursEditor value={hours.weekend} onChange={(v) => setHours({ ...hours, weekend: v })} />
      </div>
      <button className="btn btn--ink btn--lg" onClick={() => void save()} disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
    </section>
  );
}

/* ───────────── Web y avisos ───────────── */

function Switch({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span className="switch__track"><i /></span>
      <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
    </label>
  );
}

function WebPane({ say }: { say: (t: string) => void }) {
  const live = useLive();
  const [s, setS] = useState(live.settings);
  const [notify, setNotify] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setS(live.settings); }, [live.settings]);
  useEffect(() => { supabase.rpc('admin_get_private').then(({ data }) => setNotify((data as Record<string, string> | null)?.notify_email ?? '')); }, []);

  async function save() {
    setBusy(true);
    const err = await saveSettings((cur) => ({ ...cur, ordersOpen: s.ordersOpen, announcement: s.announcement, mercadoPagoAlias: s.mercadoPagoAlias.trim(), pausedMessage: s.pausedMessage }));
    const { error: e2 } = notify.trim() ? await supabase.rpc('admin_set_private', { p_key: 'notify_email', p_value: notify.trim() }) : { error: null };
    setBusy(false);
    if (err || e2) { say(e2 ? 'Revisá el email de avisos' : 'No se pudo guardar'); play('error'); } else { say('Guardado'); play('ding'); }
  }

  return (
    <section className="ppane ppane--form" role="tabpanel">
      <div className="pcard">
        <h2><Icon3D name="ticket" size={48} /> Pedidos online</h2>
        <Switch on={s.ordersOpen} set={(v) => setS({ ...s, ordersOpen: v })} label={s.ordersOpen ? 'Recibiendo pedidos' : 'Pedidos en pausa'}
          hint="Si lo pausás, la gente arma el pedido igual y se le abre WhatsApp con todo el pedido escrito, listo para enviar." />
        <label className="field">Mensaje cuando está en pausa<input value={s.pausedMessage} maxLength={200} onChange={(e) => setS({ ...s, pausedMessage: e.target.value })} /></label>
      </div>
      <div className="pcard">
        <h2><Icon3D name="sparkle" size={48} /> Aviso en la web</h2>
        <Switch on={s.announcement.enabled} set={(v) => setS({ ...s, announcement: { ...s.announcement, enabled: v } })} label="Mostrar banda de aviso" hint="Aparece arriba de todo, en todas las páginas." />
        <label className="field">Texto del aviso<input value={s.announcement.text} maxLength={160} placeholder="Ej: El lunes feriado abrimos de 10:00 a 18:00"
          onChange={(e) => setS({ ...s, announcement: { ...s.announcement, text: e.target.value } })} /></label>
      </div>
      <div className="pcard">
        <h2><Icon3D name="card" size={48} /> Pagos y avisos por mail</h2>
        <label className="field">Alias de Mercado Pago <small>(vacío = &quot;coordiná el pago por WhatsApp&quot;)</small>
          <input value={s.mercadoPagoAlias} maxLength={60} placeholder="ej: pura.tinta.mp" onChange={(e) => setS({ ...s, mercadoPagoAlias: e.target.value })} /></label>
        <label className="field">Email donde llegan los pedidos <small>(podés poner varios separados por coma)</small>
          <input type="text" value={notify} onChange={(e) => setNotify(e.target.value)} /></label>
      </div>
      <button className="btn btn--ink btn--lg" onClick={() => void save()} disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
    </section>
  );
}

/* ───────────── Equipo ───────────── */

function TeamPane({ say, team, me }: { say: (t: string) => void; team: Team; me: string }) {
  const [mine, setMine] = useState('');
  const [other, setOther] = useState<{ email: string; pw: string }>({ email: '', pw: '' });

  async function changeMine() {
    if (mine.length < 8) { say('Mínimo 8 caracteres'); play('error'); return; }
    const { error } = await supabase.auth.updateUser({ password: mine });
    if (error) { say('No se pudo cambiar'); play('error'); } else { setMine(''); say('Tu contraseña quedó cambiada'); play('ding'); }
  }
  async function resetOther() {
    const { error } = await supabase.rpc('admin_set_password', { p_email: other.email, p_password: other.pw });
    if (error) { say(error.message.includes('8') ? 'Mínimo 8 caracteres' : 'No se pudo cambiar'); play('error'); } else { setOther({ email: '', pw: '' }); say('Contraseña actualizada'); play('ding'); }
  }

  return (
    <section className="ppane ppane--form" role="tabpanel">
      <div className="pcard">
        <h2><Icon3D name="lock" size={48} /> Personas autorizadas</h2>
        <p className="hint">Solo estos correos pueden entrar. Cualquier otro queda bloqueado también en el servidor.</p>
        <ul className="team">
          {team.map((t) => (
            <li key={t.email}>
              <b>{t.label}</b><span>{t.email}</span>
              <small>{t.last_sign_in_at ? `Último ingreso: ${new Date(t.last_sign_in_at).toLocaleString('es-AR')}` : 'Todavía no ingresó'}</small>
            </li>
          ))}
        </ul>
      </div>
      <div className="pcard">
        <h2>Cambiar mi contraseña</h2>
        <div className="pgrid">
          <label className="field">Contraseña nueva<input type="password" autoComplete="new-password" minLength={8} value={mine} onChange={(e) => setMine(e.target.value)} /></label>
          <button className="btn btn--ink" onClick={() => void changeMine()}>Guardar</button>
        </div>
      </div>
      <div className="pcard">
        <h2>Restablecer la contraseña de otra persona del equipo</h2>
        <div className="pgrid">
          <label className="field">Persona
            <select value={other.email} onChange={(e) => setOther({ ...other, email: e.target.value })}>
              <option value="">Elegí…</option>
              {team.filter((t) => t.email !== me.toLowerCase()).map((t) => <option key={t.email} value={t.email}>{t.label}</option>)}
            </select>
          </label>
          <label className="field">Contraseña nueva<input type="text" minLength={8} value={other.pw} onChange={(e) => setOther({ ...other, pw: e.target.value })} /></label>
          <button className="btn btn--line" onClick={() => void resetOther()} disabled={!other.email}>Restablecer</button>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Mantenimiento ───────────── */

function MaintenancePane({ say, orders, reload }: { say: (t: string) => void; orders: Order[]; reload: () => Promise<void> }) {
  const live = useLive();
  const [stats, setStats] = useState<{ files: number; bytes: number; orders: number; orders_total: number } | null>(null);
  const [mail, setMail] = useState<string>('…');
  const [busy, setBusy] = useState(false);
  const [lite, setLite] = useState(false);
  useEffect(() => { setLite(getTier() === 'low'); }, []);

  const refresh = useCallback(() => {
    supabase.rpc('admin_storage_stats').then(({ data }) => setStats(data as typeof stats));
  }, []);
  useEffect(() => {
    refresh();
    supabase.functions.invoke('notify-order', { body: { ping: true } }).then(({ data }) => {
      const d = data as { method?: string; hasDestination?: boolean } | null;
      setMail(!d ? 'No responde' : d.method === 'resend' ? 'Resend (configurado)' : 'FormSubmit (gratis — confirmá el mail de activación la primera vez)');
    }).catch(() => setMail('No responde'));
  }, [refresh]);

  const old = orders.filter((o) => ['entregado', 'cancelado'].includes(o.status) && Date.now() - new Date(o.created_at).getTime() > 30 * 864e5);
  const oldFiles = old.flatMap((o) => orderFiles(o).map((f) => f.path));

  async function setMaint(v: boolean) {
    const err = await saveSettings((s) => ({ ...s, maintenance: v }));
    if (err) { say('No se pudo cambiar'); play('error'); } else { say(v ? 'Web en mantenimiento (vos la seguís viendo)' : 'Web publicada de nuevo'); play('stamp'); }
  }
  async function purge() {
    if (!oldFiles.length) return;
    if (!window.confirm(`Se borran ${oldFiles.length} archivos de ${old.length} pedidos entregados/cancelados hace más de 30 días. Los pedidos quedan en el historial. ¿Seguir?`)) return;
    setBusy(true);
    const { error } = await supabase.storage.from(BUCKET).remove(oldFiles);
    setBusy(false);
    if (error) { say('No se pudo liberar espacio'); play('error'); } else { say('Espacio liberado'); play('cut'); refresh(); void reload(); }
  }

  const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;
  return (
    <section className="ppane ppane--form" role="tabpanel">
      <div className="pcard">
        <h2><Icon3D name="printer" size={48} /> Estado de la web</h2>
        <Switch on={live.settings.maintenance} set={(v) => void setMaint(v)} label="Modo mantenimiento"
          hint="El público ve una pantalla de 'volvemos enseguida' con WhatsApp e Instagram. Ustedes siguen viendo la web normal." />
        <div className="kv">
          <span>Aviso de pedidos por mail</span><b>{mail}</b>
          <span>Pedidos registrados</span><b>{stats?.orders ?? '…'}</b>
          <span>Facturado (sin cancelados)</span><b>{stats ? formatMoney(stats.orders_total) : '…'}</b>
          <span>Archivos guardados</span><b>{stats ? `${stats.files} · ${mb(stats.bytes)} de 1 GB gratis` : '…'}</b>
        </div>
      </div>
      <div className="pcard">
        <h2><Icon3D name="copies" size={48} /> Liberar espacio</h2>
        <p className="hint">Borra los archivos de pedidos entregados o cancelados hace más de 30 días. El historial del pedido se conserva.</p>
        <button className="btn btn--line" disabled={!oldFiles.length || busy} onClick={() => void purge()}>
          {oldFiles.length ? `Borrar ${oldFiles.length} archivos viejos` : 'No hay archivos viejos para borrar'}
        </button>
      </div>
      <div className="pcard">
        <h2><Icon3D name="pen" size={48} /> Herramientas</h2>
        <Switch on={lite} set={(v) => { setLite(v); setTier(v ? 'low' : 'high'); }} label="Modo liviano en este equipo" hint="Menos animación para computadoras lentas." />
        <div className="links">
          <a href="https://supabase.com/dashboard/project/fhziyblckvrnnwiwvhie" target="_blank" rel="noopener noreferrer">Supabase (base de datos y archivos) ↗</a>
          <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer">Cloudflare (publicación y dominio) ↗</a>
          <a href="https://github.com/facuratt/puratinta" target="_blank" rel="noopener noreferrer">GitHub (código de la web) ↗</a>
        </div>
      </div>
    </section>
  );
}
