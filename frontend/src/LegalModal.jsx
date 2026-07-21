export default function LegalModal({
  open,
  mode = 'privacy',
  onClose,
  onSwitchMode,
  privacyContactEmail,
  legalUpdatedAt,
}) {
  if (!open) return null;
  const isPrivacy = mode === 'privacy';

  return (
    <div className="legal-modal-backdrop" onClick={onClose}>
      <div className="legal-modal-card" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="legal-modal-close" onClick={onClose} aria-label="Chiudi informativa">
          ×
        </button>
        <div className="legal-modal-tabs">
          <button
            type="button"
            className={`legal-modal-tab ${isPrivacy ? 'active' : ''}`}
            onClick={() => onSwitchMode('privacy')}
          >
            Privacy
          </button>
          <button
            type="button"
            className={`legal-modal-tab ${!isPrivacy ? 'active' : ''}`}
            onClick={() => onSwitchMode('cookies')}
          >
            Cookie & Storage
          </button>
        </div>
        <div className="legal-modal-content">
          {isPrivacy ? (
            <>
              <div className="legal-modal-kicker">Informativa privacy</div>
              <h2>Come Aureo tratta dati, accessi e sicurezza</h2>
              <p>
                Aureo tratta i dati strettamente necessari per creare e gestire l’account, proteggere l’accesso,
                erogare il servizio, inviare conferme email e assisterti durante onboarding, rinnovi e supporto operativo.
              </p>
              <div className="legal-modal-grid">
                <div className="legal-modal-panel">
                  <h3>Titolare e contatto</h3>
                  <p>AUREO OS</p>
                  <p>
                    Contatto privacy: <a href={`mailto:${privacyContactEmail}`}>{privacyContactEmail}</a>
                  </p>
                </div>
                <div className="legal-modal-panel">
                  <h3>Dati che possono essere trattati</h3>
                  <ul>
                    <li>Email, password hash e dati di profilo</li>
                    <li>Stato dell’account, attivazioni e scadenze</li>
                    <li>Chiavi API inserite volontariamente dall’utente</li>
                    <li>Log tecnici e di sicurezza strettamente necessari</li>
                  </ul>
                </div>
                <div className="legal-modal-panel">
                  <h3>Finalità del trattamento</h3>
                  <ul>
                    <li>Autenticazione e sicurezza dell’accesso</li>
                    <li>Erogazione delle funzioni richieste</li>
                    <li>Conferma email, onboarding e supporto</li>
                    <li>Prevenzione abusi, spam e uso fraudolento</li>
                  </ul>
                </div>
                <div className="legal-modal-panel">
                  <h3>Basi e diritti</h3>
                  <ul>
                    <li>Base principale: esecuzione del servizio richiesto e sicurezza dell’account</li>
                    <li>I dati restano per il tempo necessario al servizio e agli obblighi di sicurezza</li>
                    <li>Puoi chiedere accesso, rettifica, cancellazione o limitazione</li>
                    <li>Puoi scrivere a {privacyContactEmail} per richieste privacy</li>
                  </ul>
                </div>
              </div>
              <div className="legal-modal-note">
                Ultimo aggiornamento: {legalUpdatedAt}. Se in futuro verranno attivati analytics avanzati, advertising,
                remarketing o fornitori terzi aggiuntivi, questa informativa dovrà essere aggiornata di conseguenza.
              </div>
            </>
          ) : (
            <>
              <div className="legal-modal-kicker">Cookie & storage</div>
              <h2>Cookie, storage locale e consenso</h2>
              <p>
                Aureo usa al momento solo strumenti tecnici e di memorizzazione locale strettamente necessari al
                funzionamento del sito e dell’area riservata. Non risultano attivi cookie di profilazione, advertising o marketing di default.
              </p>
              <div className="legal-modal-grid">
                <div className="legal-modal-panel">
                  <h3>Strumenti tecnici attivi oggi</h3>
                  <ul>
                    <li>Sessione di accesso</li>
                    <li>Stato demo e preferenze dell’interfaccia</li>
                    <li>Memoria dell’avviso informativo privacy/cookie</li>
                    <li>Impostazioni locali necessarie a migliorare usabilità e continuità</li>
                  </ul>
                </div>
                <div className="legal-modal-panel">
                  <h3>Quando serve il consenso</h3>
                  <p>
                    Per strumenti tecnici e strettamente necessari è richiesta l’informativa, non il consenso preventivo.
                    Se in futuro verranno attivati analytics non anonimizzati, advertising o profilazione, Aureo mostrerà
                    un banner di consenso prima di attivarli.
                  </p>
                </div>
                <div className="legal-modal-panel">
                  <h3>Revoca, rimozione e controllo</h3>
                  <ul>
                    <li>Puoi cancellare cookie e dati del sito dalle impostazioni del browser</li>
                    <li>La rimozione può comportare logout e reset di alcune preferenze</li>
                    <li>Puoi sempre riaprire questa informativa dal footer</li>
                    <li>Un eventuale rifiuto futuro di cookie facoltativi sarà semplice quanto l’accettazione</li>
                  </ul>
                </div>
                <div className="legal-modal-panel">
                  <h3>Trasparenza su strumenti futuri</h3>
                  <p>
                    Se verranno introdotti strumenti di misurazione o marketing, aggiorneremo questa sezione, la
                    privacy policy e il meccanismo di scelta granulare dell’utente.
                  </p>
                </div>
              </div>
              <div className="legal-modal-note">
                Riferimento operativo: cookie e altri strumenti tecnici oggi usati solo per autenticazione, sicurezza,
                preferenze e continuità dell’esperienza. Nessun tracciamento marketing attivo senza consenso separato.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
