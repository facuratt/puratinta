-- Pago para confirmar el pedido: seña (por defecto 50%) o total, con comprobante.
-- El pedido NO está confirmado hasta que Pura Tinta recibe la seña o el total.
alter table public.orders add column if not exists payment_status text not null default 'pendiente';
alter table public.orders add column if not exists receipt_path text;
alter table public.orders add column if not exists receipt_at timestamptz;
alter table public.orders add column if not exists receipt_notified_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_status_check') then
    alter table public.orders add constraint orders_payment_status_check check (payment_status in ('pendiente', 'sena', 'pagado'));
  end if;
end $$;

-- El cliente adjunta el comprobante que subió a la carpeta de SU pedido (bucket order-files).
create or replace function public.attach_receipt(p_id uuid, p_path text)
returns boolean language plpgsql security definer set search_path = public, storage as $$
begin
  if p_path is null or p_path not like p_id::text || '/comprobante-%' then return false; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'order-files' and name = p_path) then return false; end if;
  update public.orders set receipt_path = p_path, receipt_at = now(), receipt_notified_at = null
   where id = p_id and created_at > now() - interval '30 days' and status <> 'cancelado';
  return found;
end $$;
revoke all on function public.attach_receipt(uuid, text) from public;
grant execute on function public.attach_receipt(uuid, text) to anon, authenticated;

-- Aviso por mail del comprobante (lo usa la función notify-order; una sola vez por comprobante).
create or replace function public.claim_receipt_notification(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare r json;
begin
  update public.orders set receipt_notified_at = now()
   where id = p_id and receipt_path is not null and receipt_notified_at is null and receipt_at > now() - interval '1 hour'
  returning json_build_object('number', number, 'customer_name', customer_name, 'customer_phone', customer_phone,
                              'total', total, 'receipt_at', receipt_at) into r;
  return r;
end $$;
revoke all on function public.claim_receipt_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_receipt_notification(uuid) to service_role;

-- Ajustes: alias y seña (editables en Panel → Web y avisos).
update public.site_settings set data = data || '{"mercadoPagoAlias": "lourdes.varea", "depositPct": 50}'::jsonb where id = 1;
