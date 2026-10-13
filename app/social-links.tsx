import { BUSINESS, instagramUrl, whatsappUrl } from './config';

export default function SocialLinks({ showNumber = true }: { showNumber?: boolean }) {
  return (
    <div className="socials">
      <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${BUSINESS.whatsappDisplay}`}>
        <img src="/whatsapp.svg" alt="" width="35" height="35" />
        {showNumber && <span className="whatsapp-number">{BUSINESS.whatsappDisplay}</span>}
      </a>
      <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label={`Instagram @${BUSINESS.instagram}`}>
        <img src="/instagram.svg" alt="" width="35" height="35" />
      </a>
    </div>
  );
}
