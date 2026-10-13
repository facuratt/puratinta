import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

export const BUCKET = 'order-files';

export type OrderFile = {
  id: number;
  path: string;
  file_name: string;
  size_bytes: number;
  pages: number;
  copies: number;
  sides: 'simple' | 'doble';
  subtotal: number;
};

export type Order = {
  id: string;
  number: number;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  total: number;
  status: string;
  order_files?: OrderFile[];
  files?: OrderFile[];
};

export const orderCode = (n: number) => `PT-${String(n).padStart(4, '0')}`;
