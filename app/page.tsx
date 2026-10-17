import ContactTiles from './components/ContactTiles';
import Footer from './components/Footer';
import Hero from './components/Hero';
import Hours from './components/Hours';
import HowItWorks from './components/HowItWorks';
import Prices from './components/Prices';
import Tinto from './components/Tinto';
import TopBar from './components/TopBar';

export default function Home() {
  return (
    <>
      <TopBar />
      <main id="contenido">
        <Hero />
        <HowItWorks />
        <Prices />
        <Hours />
        <Tinto />
        <ContactTiles />
      </main>
      <Footer />
    </>
  );
}
