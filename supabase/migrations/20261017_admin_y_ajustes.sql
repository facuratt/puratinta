-- Pura Tinta · rediseño 2026 — aplicado en el proyecto Supabase "pura-tinta" el 17/10/2026.
-- Queda como registro. Los correos autorizados NO se guardan en este repo público:
-- viven en la tabla public.allowed_admins (Supabase → Table editor).

-- 1) Correos autorizados: solo estas personas pueden tener cuenta y administrar.
create table if not exists public.allowed_admins (
  email text primary key check (email = lower(email)),
  label text
);
alter table public.allowed_admins enable row level security; -- sin políticas: nadie la lee desde la web
-- insert into public.allowed_admins (email, label) values ('correo@ejemplo.com', 'Nombre');

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    join public.allowed_admins a on a.email = lower(u.email)
    where u.id = (select auth.uid())
  );
$$;

-- Nadie fuera de la lista puede crear una cuenta (ni cambiar su email a uno no autorizado).
create or replace function public.guard_auth_users()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or not exists (select 1 from public.allowed_admins where email = lower(new.email)) then
    raise exception 'Correo no autorizado';
  end if;
  return new;
end $$;
create or replace trigger guard_auth_users before insert or update of email on auth.users
  for each row execute function public.guard_auth_users();

-- 2) Ajustes de la web editables desde el panel (lectura pública, edición solo admins).
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.site_settings enable row level security;
create policy "anyone reads site settings" on public.site_settings for select to anon, authenticated using (true);
create policy "admin updates site settings" on public.site_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.touch_site_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.jwt() ->> 'email'), new.updated_by);
  return new;
end $$;
create or replace trigger touch_site_settings before update on public.site_settings
  for each row execute function public.touch_site_settings();

insert into public.site_settings (id, data) values (1, jsonb_build_object(
  'ordersOpen', true,
  'maintenance', false,
  'announcement', jsonb_build_object('enabled', false, 'text', ''),
  'hours', jsonb_build_object(
    'weekdays', jsonb_build_object('label', 'Lunes a viernes', 'open', '06:30', 'close', '22:30'),
    'weekend', jsonb_build_object('label', 'Sábados y domingos', 'open', '10:00', 'close', '22:30')
  ),
  'mercadoPagoAlias', '',
  'pausedMessage', 'Por hoy no estamos tomando pedidos online. Escribinos por WhatsApp.'
)) on conflict (id) do nothing;

-- Datos privados (email de avisos). Solo el servidor y los admins (vía funciones).
create table if not exists public.private_settings (key text primary key, value text not null);
alter table public.private_settings enable row level security;
-- insert into public.private_settings (key, value) values ('notify_email', 'correo@ejemplo.com');

create or replace function public.admin_get_private()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_object_agg(key, value) from public.private_settings), '{}'::jsonb);
end $$;

create or replace function public.admin_set_private(p_key text, p_value text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Sin permiso'; end if;
  if p_key not in ('notify_email') then raise exception 'Clave inválida'; end if;
  if p_key = 'notify_email' and p_value !~* '^[^@\s]+@[^@\s]+\.[^@\s]+(\s*,\s*[^@\s]+@[^@\s]+\.[^@\s]+)*$' then
    raise exception 'Email inválido';
  end if;
  insert into public.private_settings (key, value) values (p_key, trim(p_value))
  on conflict (key) do update set value = excluded.value;
end $$;

-- 3) Equipo y mantenimiento.
create or replace function public.admin_team()
returns table (email text, label text, has_account boolean, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Sin permiso'; end if;
  return query
    select a.email, a.label, u.id is not null, u.last_sign_in_at
    from public.allowed_admins a left join auth.users u on lower(u.email) = a.email
    order by a.label;
end $$;

create or replace function public.admin_set_password(p_email text, p_password text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Sin permiso'; end if;
  if not exists (select 1 from public.allowed_admins where email = lower(p_email)) then raise exception 'Correo no autorizado'; end if;
  if char_length(p_password) < 8 then raise exception 'La contraseña debe tener al menos 8 caracteres'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
  where lower(email) = lower(p_email);
end $$;

create or replace function public.admin_storage_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Sin permiso'; end if;
  return jsonb_build_object(
    'files', (select count(*) from storage.objects where bucket_id = 'order-files'),
    'bytes', (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects where bucket_id = 'order-files'),
    'orders', (select count(*) from public.orders),
    'orders_total', (select coalesce(sum(total), 0) from public.orders where status <> 'cancelado')
  );
end $$;

-- 4) create_order ahora respeta "pausar pedidos" y el modo mantenimiento (ver la función en Supabase).

-- 5) Precio por cantidad (17/10/2026): site_settings.data.bulk = { enabled, minSheets, dobleSheetPrice }.
--    create_order suma las hojas doble faz de todo el pedido; si llegan a minSheets, todas las hojas doble faz
--    se cobran a dobleSheetPrice (por defecto: desde 50 hojas, $120 la hoja = $60 la carilla). Editable desde el panel.
