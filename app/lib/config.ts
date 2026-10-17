// Datos del negocio. Lo que se puede cambiar desde el panel (precios, horarios, avisos, alias)
// viene de Supabase; estos valores son el respaldo si la base no responde.
export const BUSINESS = {
  name: 'Pura Tinta',
  fullName: 'Impresiones Pura Tinta',
  tagline: 'impresiones en blanco y negro',
  whatsappDisplay: '2972418448',
  whatsappPretty: '+54 9 2972 41-8448',
  // Formato internacional para wa.me: 54 (Argentina) + 9 (celular) + número sin 0 ni 15.
  whatsappIntl: '5492972418448',
  instagram: 'impresiones.cipo.puratinta',
  instagramUrl: 'https://www.instagram.com/impresiones.cipo.puratinta',
};

export type Sides = 'simple' | 'doble';
export type Prices = Record<Sides, number>;
export const DEFAULT_PRICES: Prices = { simple: 100, doble: 150 };

export type DayHours = { label: string; open: string; close: string };
export type SiteSettings = {
  ordersOpen: boolean;
  maintenance: boolean;
  announcement: { enabled: boolean; text: string };
  hours: { weekdays: DayHours; weekend: DayHours };
  mercadoPagoAlias: string;
  pausedMessage: string;
  /** Precio por cantidad: desde `minSheets` hojas doble faz en el pedido, cada hoja doble faz sale `dobleSheetPrice`. */
  bulk: { enabled: boolean; minSheets: number; dobleSheetPrice: number };
};

export const DEFAULT_SETTINGS: SiteSettings = {
  ordersOpen: true,
  maintenance: false,
  announcement: { enabled: false, text: '' },
  hours: {
    weekdays: { label: 'Lunes a viernes', open: '06:30', close: '22:30' },
    weekend: { label: 'Sábados y domingos', open: '10:00', close: '22:30' },
  },
  mercadoPagoAlias: '',
  pausedMessage: 'Por hoy no estamos tomando pedidos online. Escribinos por WhatsApp.',
  bulk: { enabled: true, minSheets: 50, dobleSheetPrice: 120 },
};

// Solo estos correos pueden entrar al panel (SHA-256, para no publicar las direcciones).
// La restricción real está en Supabase (tabla allowed_admins + trigger en auth.users).
export const ADMIN_EMAIL_HASHES = [
  'b6671a92210c9f140f6f9e4d024ee9737165a308a0ae225a2dae18637d651253',
  '1dc02733872e6d17c7e02ae012fd7303a818709324a6e7d22da11124395af8ef',
];

export async function isAllowedEmail(email: string) {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return ADMIN_EMAIL_HASHES.includes(hex);
}

export const whatsappUrl = (text?: string) =>
  `https://wa.me/${BUSINESS.whatsappIntl}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const formatMoney = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

// Doble faz: cada hoja lleva 2 páginas.
export const sheetsFor = (pages: number, sides: Sides) => (sides === 'doble' ? Math.ceil(pages / 2) : pages);
export const subtotalFor = (pages: number, copies: number, sides: Sides, prices: Prices) =>
  sheetsFor(pages, sides) * copies * prices[sides];

type Bulk = SiteSettings['bulk'];
export const bulkActive = (b: Bulk) => b.enabled && b.minSheets > 0 && b.dobleSheetPrice > 0;

/**
 * Precios de un pedido completo, igual que los calcula el servidor (create_order):
 * si el pedido suma `minSheets` o más hojas doble faz, todas las hojas doble faz van al precio por cantidad.
 */
export function priceOrder(items: { pages: number; copies: number; sides: Sides }[], prices: Prices, bulk: Bulk) {
  const dobleSheets = items.reduce((n, it) => n + (it.sides === 'doble' ? sheetsFor(it.pages, 'doble') * it.copies : 0), 0);
  const applied = bulkActive(bulk) && dobleSheets >= bulk.minSheets;
  const unit = (s: Sides) => (s === 'doble' && applied ? bulk.dobleSheetPrice : prices[s]);
  const lines = items.map((it) => {
    const sheets = sheetsFor(it.pages, it.sides) * it.copies;
    return { sheets, unit: unit(it.sides), subtotal: sheets * unit(it.sides) };
  });
  return {
    lines,
    total: lines.reduce((n, l) => n + l.subtotal, 0),
    sheets: lines.reduce((n, l) => n + l.sheets, 0),
    dobleSheets,
    applied,
    missing: bulkActive(bulk) && !applied && dobleSheets > 0 ? bulk.minSheets - dobleSheets : 0,
  };
}

/** "$60 la carilla": medio precio de hoja doble faz. */
export const carilla = (sheetPrice: number) => formatMoney(sheetPrice / 2);

export const STATUS_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  en_proceso: 'En proceso',
  listo: 'Listo para retirar',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const sidesLabel = (s: Sides) => (s === 'doble' ? 'doble faz' : 'simple faz');
