// Datos del negocio: cambiá acá y se actualiza en toda la web.
export const BUSINESS = {
  name: 'Pura Tinta',
  whatsappDisplay: '+54 9 2972418448',
  // Formato internacional para wa.me: 54 (Argentina) + 9 (celular) + número sin 0 ni 15.
  whatsappIntl: '5492972418448',
  instagram: 'impresiones.cipo.puratinta',
  // Cuando tenga alias de Mercado Pago, ponelo acá (ej: 'pura.tinta.mp') y aparece en la web y en los tickets.
  mercadoPagoAlias: '',
};

export const PRICES = { simple: 100, doble: 150 } as const;
export type Sides = keyof typeof PRICES;

export const whatsappUrl = (text?: string) =>
  `https://wa.me/${BUSINESS.whatsappIntl}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const instagramUrl = `https://instagram.com/${BUSINESS.instagram}`;

export const formatMoney = (n: number) => `$${n.toLocaleString('es-AR')}`;

// Doble faz: cada hoja lleva 2 páginas.
export const sheetsFor = (pages: number, sides: Sides) => (sides === 'doble' ? Math.ceil(pages / 2) : pages);
export const subtotalFor = (pages: number, copies: number, sides: Sides) => sheetsFor(pages, sides) * copies * PRICES[sides];

export const STATUS_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  en_proceso: 'En proceso',
  listo: 'Listo para retirar',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};
