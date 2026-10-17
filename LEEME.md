# Pura Tinta — web

Fusión de los proyectos **marmalade** (la chica animada que sigue el cursor, en el inicio) y **pouterby**
(Tinto, el monito animado, la cápsula de navegación, el radar y la marquesina), sobre papel y tinta.

## Páginas
- `/` inicio: hero con la chica · Cómo funciona (scroll-driven) · Precios + calculadora · Horarios (abierto/cerrado en vivo) · Tinto · WhatsApp / Instagram
- `/pedido` subir archivos en 3 pestañas → la impresora 3D imprime el ticket por la ranura → enviar por WhatsApp, descargar o imprimir
- `/contacto` WhatsApp, Instagram, QR, mensaje directo por WhatsApp, horarios, Mercado Pago
- `/ingresar` acceso **solo** para los correos autorizados → `/panel`
- `/panel` pestañas: Pedidos · Precios y horarios · Web y avisos · Equipo · Mantenimiento

## Qué se edita desde el panel (sin tocar código)
Precios por hoja, horarios, banda de aviso, pausar pedidos online (y su mensaje), alias de Mercado Pago,
email donde llegan los pedidos, contraseñas del equipo, modo mantenimiento, liberar espacio de archivos viejos.

## Datos fijos (código)
WhatsApp, Instagram y textos: `app/lib/config.ts`. Íconos 3D: `public/icons/` (renderizados con three.js).
Logo original sin modificar (solo sin el fondo exterior): `public/brand/`.

## Acceso restringido
- Supabase, tabla `allowed_admins`: solo esos correos pueden tener cuenta. Un trigger en `auth.users` bloquea cualquier otro registro.
- `is_admin()` mira esa lista; todas las políticas (pedidos, archivos, precios, ajustes) dependen de ella.
- La web también rechaza otros correos antes de consultar (compara un hash, así los correos no quedan publicados).
- Registro: `supabase/migrations/20261017_admin_y_ajustes.sql`.

## Aviso de pedidos por mail
Función `notify-order` (`supabase/functions/notify-order`). Manda la orden completa al email configurado en el panel.
- Sin configurar nada usa **FormSubmit**: el primer pedido manda un mail de activación al destino; hay que tocar "Activate" una vez.
- Para usar **Resend**: Supabase → Edge Functions → Secrets → `RESEND_API_KEY` (y `ORDER_EMAIL_FROM` con dominio verificado).
- `SITE_URL` (opcional) = la dirección pública, para el enlace al panel dentro del mail.

## Rendimiento
`html[data-perf]` = `high` | `low`. Se decide antes del primer pintado (memoria, núcleos, ahorro de datos, movimiento reducido)
y baja solo a liviano si los primeros segundos van lentos. Liviano: frames de Tinto en 560 px y menos cuadros, sin blur,
sin cursor-gota, canvas a 1x. También hay un botón "Modo liviano" en el pie de página.

## Sonidos
Sintetizados con Web Audio (`app/lib/sound.ts`): 0 KB de archivos. Botón de silencio en la cápsula y en el pie.

## Publicación (GitHub + Cloudflare)
Cloudflare toma el código de GitHub, corre `npm run build` y publica `out/`.
Dominio propio (para sacar el nombre del link): Cloudflare → Worker/Pages `puratinta` → Domains → Add custom domain.
Después: Supabase → Authentication → URL Configuration → **Site URL** = el dominio nuevo, y el secreto `SITE_URL`.

## Correr en la compu
```
npm install
npm run dev
```
Abrir http://localhost:3000
