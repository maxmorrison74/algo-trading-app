export const OnboardingModal = ({ onClose, onGoToSettings, savedKeys = {} }) => {
  const alpacaReady = !!(savedKeys['ALPACA_KEY'] && savedKeys['ALPACA_SECRET']);
  const groqReady = !!savedKeys['GROQ_KEY'];
  const telegramReady = !!(savedKeys['TELEGRAM_BOT_TOKEN'] && savedKeys['TELEGRAM_CHAT_ID']);
  const pushoverReady = !!(savedKeys['PUSHOVER_APP_TOKEN'] && savedKeys['PUSHOVER_USER_KEY']);
  const alertsReady = telegramReady || pushoverReady;
  const setupSteps = [alpacaReady, groqReady, telegramReady, pushoverReady];
  const completedSteps = setupSteps.filter(Boolean).length;
  const setupProgress = Math.round((completedSteps / setupSteps.length) * 100);
  const primaryActionLabel = !alpacaReady
    ? 'Completa il setup broker'
    : !groqReady
      ? 'Attiva il layer AI'
      : !alertsReady
        ? 'Apri il Vault e attiva gli alert'
        : 'Apri il Vault e rifinisci il setup';
  const renderSetupBadge = (ready, requiredLabel = 'OPZIONALE') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
      <span style={{
        background: ready ? 'rgba(16,185,129,0.16)' : 'rgba(239,68,68,0.14)',
        color: ready ? '#34d399' : '#fca5a5',
        padding: '0.28rem 0.65rem',
        borderRadius: '999px',
        fontSize: '0.76rem',
        fontWeight: 800
      }}>
        {ready ? 'CONFIGURATA' : 'MANCANTE'}
      </span>
      <span style={{
        background: 'rgba(255,255,255,0.06)',
        color: '#cbd5e1',
        padding: '0.28rem 0.65rem',
        borderRadius: '999px',
        fontSize: '0.76rem',
        fontWeight: 700
      }}>
        {requiredLabel}
      </span>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: '#1a1f2e', padding: '2.5rem', borderRadius: '16px',
        width: '90%', maxWidth: '600px', border: '1px solid #334155',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem', background: 'transparent',
          border: 'none', color: '#64748b', fontSize: '1.5rem', cursor: 'pointer'
        }}>×</button>

        <h2 style={{ fontSize: '2rem', marginBottom: '1rem', background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Prima configurazione Aureo
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '1.05rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Qui sotto trovi tutto quello che ti serve per completare il setup del tuo accesso. Alcune chiavi sono indispensabili per operare, altre servono per potenziare alert e analisi.
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '1rem 1.1rem',
          marginBottom: '1.2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
            <div>
              <div style={{ color: '#e2e8f0', fontWeight: 800 }}>Setup progress</div>
              <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '0.2rem' }}>
                {completedSteps}/{setupSteps.length} chiavi configurate
              </div>
            </div>
            <div style={{ color: setupProgress === 100 ? '#34d399' : '#60a5fa', fontWeight: 800, fontSize: '1rem' }}>
              {setupProgress}%
            </div>
          </div>
          <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              width: `${setupProgress}%`,
              height: '100%',
              borderRadius: '999px',
              background: setupProgress === 100
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              boxShadow: setupProgress > 0 ? '0 0 18px rgba(96,165,250,0.35)' : 'none',
              transition: 'width 0.25s ease'
            }} />
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(167,139,250,0.08))',
          border: '1px solid rgba(96,165,250,0.22)',
          borderRadius: '14px',
          padding: '1rem 1.1rem',
          marginBottom: '1.6rem'
        }}>
          <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '0.55rem' }}>Ti basta sapere questo:</div>
          <div style={{ display: 'grid', gap: '0.45rem', color: '#cbd5e1', fontSize: '0.92rem', lineHeight: 1.5 }}>
            <div><strong style={{ color: '#fcd34d' }}>Obbligatoria:</strong> Alpaca, per collegare il broker e permettere al bot di operare.</div>
            <div><strong style={{ color: '#c084fc' }}>Consigliata:</strong> Groq, per sbloccare il layer AI su analisi e assistenza operativa.</div>
            <div><strong style={{ color: '#38bdf8' }}>Opzionali:</strong> Telegram e Pushover, per ricevere alert esterni anche fuori dalla piattaforma.</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.35rem', borderRadius: '12px', border: '1px solid rgba(252,211,77,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
              <h3 style={{ fontSize: '1.15rem', margin: 0, color: '#fcd34d' }}>1. Alpaca — Broker trading</h3>
              {renderSetupBadge(alpacaReady, 'OBBLIGATORIA')}
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.92rem', marginBottom: '0.85rem', lineHeight: 1.6 }}>
              Serve per collegare il tuo account broker ad Aureo. Senza questa chiave il bot non può operare sul mercato.
            </p>
            <div style={{ color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.55, marginBottom: '1rem' }}>
              <strong>Come trovarla:</strong> entra in Alpaca, apri la dashboard e genera <strong>API Key</strong> e <strong>Secret Key</strong> dalla sezione dedicata alle API.
            </div>
            <a href="https://alpaca.markets" target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-block', background: '#fcd34d', color: '#000', padding: '0.55rem 1rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none'
            }}>Apri Alpaca ↗</a>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.35rem', borderRadius: '12px', border: '1px solid rgba(167,139,250,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
              <h3 style={{ fontSize: '1.15rem', margin: 0, color: '#c084fc' }}>2. Groq — AI core</h3>
              {renderSetupBadge(groqReady, 'CONSIGLIATA')}
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.92rem', marginBottom: '0.85rem', lineHeight: 1.6 }}>
              Serve per attivare il motore AI di supporto: analisi, assistenza e arricchimento operativo.
            </p>
            <div style={{ color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.55, marginBottom: '1rem' }}>
              <strong>Come trovarla:</strong> entra nella console Groq, vai su <strong>API Keys</strong> e crea una nuova chiave. Copiala subito perché poi non viene mostrata di nuovo.
            </div>
            <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-block', background: '#c084fc', color: '#111827', padding: '0.55rem 1rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none'
            }}>Apri Groq ↗</a>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.35rem', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.16)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
              <h3 style={{ fontSize: '1.15rem', margin: 0, color: '#38bdf8' }}>3. Alert esterni — Telegram / Pushover</h3>
              {renderSetupBadge(alertsReady, 'OPZIONALI')}
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.92rem', marginBottom: '0.85rem', lineHeight: 1.6 }}>
              Servono per ricevere notifiche critiche fuori da Aureo: pause di sicurezza, warning importanti ed eventi operativi.
            </p>
            <div style={{ color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.55 }}>
              <strong>Telegram:</strong> ti servono <strong>Bot Token</strong> e <strong>Chat ID</strong> {telegramReady ? <span style={{ color: '#34d399' }}>• pronto</span> : <span style={{ color: '#fca5a5' }}>• mancante</span>}. Apri <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>BotFather ↗</a> per creare il bot.<br />
              <strong>Pushover:</strong> ti servono <strong>App Token</strong> e <strong>User Key</strong> {pushoverReady ? <span style={{ color: '#34d399' }}>• pronto</span> : <span style={{ color: '#fca5a5' }}>• mancante</span>}. Apri <a href="https://pushover.net" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>Pushover ↗</a> per creare account e token.<br />
              Puoi aggiungerle anche dopo: non bloccano l’avvio del broker.
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.55rem 0.95rem', borderRadius: '10px', background: 'rgba(56,189,248,0.14)', border: '1px solid rgba(56,189,248,0.28)', color: '#38bdf8', fontWeight: 700, fontSize: '0.86rem', textDecoration: 'none' }}>
                Apri BotFather ↗
              </a>
              {savedKeys['TELEGRAM_BOT_TOKEN'] && (
                <a href={`https://api.telegram.org/bot${savedKeys['TELEGRAM_BOT_TOKEN']}/getUpdates`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.55rem 0.95rem', borderRadius: '10px', background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.28)', color: '#a5b4fc', fontWeight: 700, fontSize: '0.86rem', textDecoration: 'none' }}>
                  Apri getUpdates ↗
                </a>
              )}
              <a href="https://pushover.net" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.55rem 0.95rem', borderRadius: '10px', background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.28)', color: '#34d399', fontWeight: 700, fontSize: '0.86rem', textDecoration: 'none' }}>
                Apri Pushover ↗
              </a>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', padding: '0.9rem 1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.55 }}>
          Una volta entrato nel Vault troverai i campi già separati per ogni servizio: broker, AI, Telegram e Pushover.
        </div>

        <button onClick={onGoToSettings} style={{
          width: '100%', padding: '1rem', marginTop: '2rem', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
        }}>
          {primaryActionLabel}
        </button>
      </div>
    </div>
  );
};

export const NoticeTray = ({ notices = [], onDismiss }) => (
  <div className="notice-tray">
    {notices.map((notice) => (
      <div key={notice.id} className={`notice-card notice-card--${notice.type || 'info'}`}>
        <div className="notice-card-body">
          <strong>{notice.title}</strong>
          {notice.message ? <span>{notice.message}</span> : null}
        </div>
        <button type="button" className="notice-card-close" onClick={() => onDismiss?.(notice.id)}>×</button>
      </div>
    ))}
  </div>
);

export const ConfirmDialog = ({ config, onCancel, onConfirm }) => {
  if (!config?.open) return null;
  return (
    <div className="confirm-dialog-shell">
      <div className="confirm-dialog-card">
        <div className={`confirm-dialog-badge confirm-dialog-badge--${config.tone || 'warning'}`}>
          {config.kicker || 'Conferma richiesta'}
        </div>
        <h3>{config.title || 'Vuoi procedere?'}</h3>
        <p>{config.message || 'Conferma l’azione per continuare.'}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Annulla
          </button>
          <button
            type="button"
            className={`btn ${config.tone === 'danger' ? 'btn-stop' : 'btn-start'}`}
            onClick={onConfirm}
          >
            {config.confirmLabel || 'Conferma'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const SystemStatusBanner = ({ status = {}, isBackendOnline = true, onOpenHealth, onOpenTrading }) => {
  const runtimeHealth = status.runtime_health || {};
  const autoPaused = !!runtimeHealth.auto_paused;
  const scannerActive = !!status.modules?.trading;
  if (isBackendOnline && !autoPaused && scannerActive) return null;

  const tone = !isBackendOnline ? 'danger' : autoPaused ? 'warning' : 'info';
  const title = !isBackendOnline
    ? 'Backend non allineato'
    : autoPaused
      ? 'Trading auto-pausato in sicurezza'
      : 'Scanner trading in pausa';
  const message = !isBackendOnline
    ? 'L’interfaccia è attiva, ma i dati live non stanno arrivando correttamente. Conviene controllare la sezione health.'
    : autoPaused
      ? (runtimeHealth.auto_pause_reason || 'Il sistema ha fermato operatività e feed per proteggere il capitale.')
      : 'Il motore è fermo: nessun nuovo setup finché non lo riattivi.';
  const action = !isBackendOnline || autoPaused ? onOpenHealth : onOpenTrading;
  const actionLabel = !isBackendOnline || autoPaused ? 'Apri Health' : 'Apri Trading';

  return (
    <div className={`system-status-banner system-status-banner--${tone}`}>
      <div className="system-status-banner-copy">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      <button type="button" className="btn" onClick={action}>
        {actionLabel}
      </button>
    </div>
  );
};
