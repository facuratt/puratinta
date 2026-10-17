import Link from 'next/link';
import { Icon3D } from './components/icons';
import TopBar from './components/TopBar';

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main className="nf" id="contenido">
        <Icon3D name="copies" size={220} eager />
        <p className="eyebrow">Error 404</p>
        <h1 className="display">Esta hoja <em>se trabó</em>.</h1>
        <p>La página que buscás no existe o se movió.</p>
        <div className="nf__row">
          <Link href="/" className="btn btn--ink">Volver al inicio</Link>
          <Link href="/pedido" className="btn btn--line">Hacer un pedido</Link>
        </div>
      </main>
    </>
  );
}
