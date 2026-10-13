import Link from 'next/link';
import FooterBackground from './footer-background';
import SiteNav from './site-nav';
import SocialLinks from './social-links';

export default function Home() {
  return (
    <footer className="footer" aria-label="Pura Tinta">
      <FooterBackground />
      <SiteNav />
      <div className="jobs">
        <span className="tag">horarios de atención</span>
        <span className="headline job-title">impresiones<br />en blanco y negro</span>
        <div className="footer-nav">
          <span>Lunes a viernes</span>
          <span>06:30 a 22:30</span>
          <span>Sábados y domingos</span>
          <span>10:00 a 22:30</span>
        </div>
      </div>
      <div className="logo" role="img" aria-label="Impresiones Pura Tinta">
        {/* Logo original, sin modificaciones. */}
        <img src="/logo-pura-tinta.webp" alt="" width="1254" height="1254" />
      </div>
      <div className="contact">
        <span className="tag">fotocopias B/N</span>
        <div className="headline contact-links">
          <span>Simple faz: $100</span>
          <span>Doble faz: $150</span>
        </div>
        <p className="note">*subí tus archivos y retiralos impresos</p>
        <Link href="/pedido" className="pill-button hero-cta">hacer mi pedido</Link>
        <SocialLinks />
      </div>
    </footer>
  );
}
