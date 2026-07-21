export default function CookieNotice({ onReadDetails, onContinue }) {
  return (
    <div className="cookie-notice-banner">
      <div className="cookie-notice-copy">
        <strong>Privacy & Cookie essenziali</strong>
        <span>
          Questo sito usa solo cookie tecnici e storage locale necessari a login, sicurezza e preferenze.
          Nessun tracking marketing o profilazione attivi di default.
        </span>
      </div>
      <div className="cookie-notice-actions">
        <button type="button" className="btn btn-outline cookie-notice-button" onClick={onReadDetails}>
          Leggi i dettagli
        </button>
        <button type="button" className="btn btn-start cookie-notice-button" onClick={onContinue}>
          Continua
        </button>
      </div>
    </div>
  );
}
