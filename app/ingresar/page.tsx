import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: { absolute: 'Ingresar — Pura Tinta' }, robots: { index: false, follow: false } };

export default function IngresarPage() {
  return <LoginForm />;
}
