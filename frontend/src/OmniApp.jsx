import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import heroAsset from './assets/hero.png';
import ChartsStudio from './ChartsStudio';
const AUTH_TOKEN_KEY = 'omni_auth_token';
const AUTH_TIME_KEY = 'omni_auth_time';
const DEMO_MODE_KEY = 'omni_demo_mode';
const BILLING_ENABLED = true;
const TAB_TITLES = {
  home: 'Dashboard',
  trading: 'Stock Market',
  charts: 'Charts',
  develop: 'Engine Room',
  sports_arb: 'Sports SureBets',
  value_bets: 'AI Sentiment',
  ai_content: 'AI Content',
  saas: 'SaaS & Billing',
};

const DEMO_BILLING_OVERVIEW = {
  metrics: {
    active_customers: 3,
    trialing_customers: 2,
    monthly_recurring_revenue: 777,
    annual_run_rate: 9324,
    leads_count: 6,
    collection_rate: 75,
  },
  plans: [
    {
      id: 'starter',
      name: 'Starter',
      price_monthly: 79,
      currency: 'EUR',
      description: 'Per trader indipendenti che vogliono dashboard e demo operativa.',
      features: ['Dashboard live', 'Demo mode', '1 workspace', 'Supporto email'],
      modules: ['dashboard', 'trading'],
      checkout_url: 'https://buy.stripe.com/test_starter',
    },
    {
      id: 'pro',
      name: 'Pro',
      price_monthly: 199,
      currency: 'EUR',
      description: 'Per utenti che vogliono automazioni, segnali e moduli avanzati.',
      features: ['Tutti i moduli core', 'Alert operativi', '3 workspace', 'Priority support'],
      modules: ['dashboard', 'trading', 'sentiment'],
      checkout_url: 'https://buy.stripe.com/test_pro',
    },
    {
      id: 'elite',
      name: 'Elite',
      price_monthly: 499,
      currency: 'EUR',
      description: 'Per desk, consulenti e clienti ad alto valore con onboarding guidato.',
      features: ['White-glove onboarding', 'Utenti multipli', 'Billing priority', 'Canale dedicato'],
      modules: ['dashboard', 'trading', 'sentiment', 'ai_content', 'billing'],
      checkout_url: 'https://buy.stripe.com/test_elite',
    },
  ],
  customers: [
    { id: 'cus_demo_alpha', company: 'Alpha Quant Studio', contact_name: 'Marco Rossi', email: 'marco@alphaquant.studio', plan_id: 'pro', status: 'active', seats: 3, monthly_amount: 199, next_billing_at: '2026-07-12' },
    { id: 'cus_demo_beta', company: 'Beta Capital Lab', contact_name: 'Giulia Bianchi', email: 'giulia@betacapitallab.com', plan_id: 'starter', status: 'trialing', seats: 1, monthly_amount: 79, next_billing_at: '2026-07-08' },
  ],
  leads: [
    { id: 'lead_demo_1', company: 'Omega Signals', contact_name: 'Luca Verdi', email: 'luca@omegasignals.io', plan_id: 'elite', status: 'lead', created_at: '2026-07-02' },
  ],
  recent_activity: [
    { id: 'act_1', user_email: 'marco@alphaquant.studio', amount: 99, currency: 'USDT', txid: 'T...X8Y9', status: 'verified' },
    { id: 'act_2', user_email: 'giulia@betacapitallab.com', amount: 99, currency: 'USDT', txid: 'T...J3K4', status: 'pending' },
  ],
  settings: { trial_days: 7, currency: 'EUR' },
};

const safeStorageGet = (key, fallback = '') => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const value = window.localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const safeStorageSet = (key, value) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch {}
};

const safeStorageRemove = (key) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(key);
  } catch {}
};

const parseJsonSafely = async (response, fallback = null) => {
  try {
    return await response.json();
  } catch {
    return fallback;
  }
};

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const getAuthToken = () => safeStorageGet(AUTH_TOKEN_KEY, '');
const isDemoSession = () => safeStorageGet(DEMO_MODE_KEY, '') === '1';

const clearAuthSession = () => {
  safeStorageRemove(AUTH_TOKEN_KEY);
  safeStorageRemove(AUTH_TIME_KEY);
  safeStorageRemove(DEMO_MODE_KEY);
  safeStorageRemove('USER_ROLE');
  safeStorageRemove('USER_STATUS');
};

const getStatusScope = (activeTab) => {
  switch (activeTab) {
    case 'trading':
    case 'charts':
      return 'trading';
    case 'sports_arb':
      return 'sports_arb';
    case 'value_bets':
      return 'value_bets';
    case 'ai_content':
      return 'ai_content';
    case 'home':
      return 'home';
    default:
      return 'core';
  }
};

const getStatusPollingMs = (activeTab) => {
  switch (activeTab) {
    case 'trading':
    case 'charts':
      return 2000;
    case 'sports_arb':
    case 'value_bets':
    case 'ai_content':
      return 3500;
    default:
      return 5000;
  }
};

const deriveCryptoEngineState = (status = {}) => {
  const symbols = Array.isArray(status.symbols) ? status.symbols : [];
  const logs = Array.isArray(status.logs) ? status.logs : [];
  const positions = status.positions || {};
  const cryptoSymbols = symbols.filter((sym) => String(sym).includes('/'));
  const cryptoPositions = Object.entries(positions).filter(([sym, pos]) => String(sym).includes('/') && pos !== 'LIQUID');
  const recentCryptoLogs = logs.filter((line) => {
    const rendered = String(line || '');
    return cryptoSymbols.some((sym) => rendered.includes(sym)) || rendered.includes('crypto');
  }).slice(0, 20);

  const hasFeedHeartbeat = recentCryptoLogs.some((line) => line.includes('CRYPTO CHECK')) || logs.some((line) => String(line).includes('WebSocket Connesso'));
  const hasOrderActivity = recentCryptoLogs.some((line) => line.includes('ORDINE') || line.includes('FAST SCALP'));
  const hasGuardedSkip = recentCryptoLogs.some((line) =>
    line.includes('AI VETO') ||
    line.includes('LSTM VETO') ||
    line.includes('RISK FILTER') ||
    line.includes('SKIP SHORT') ||
    line.includes('volatilità troppo bassa') ||
    line.includes('nessun setup tecnico valido')
  );

  if (!cryptoSymbols.length) {
    return {
      level: 'hidden',
      title: 'Crypto Engine non in watchlist',
      subtitle: 'Nessun asset crypto selezionato nella watchlist attuale.',
      badge: 'OFF WATCHLIST',
      tone: '#64748b',
      border: 'rgba(100, 116, 139, 0.35)',
      background: 'rgba(15, 23, 42, 0.55)',
      monitoredCount: 0,
      activeCount: 0,
      lastEvent: 'Aggiungi almeno un simbolo crypto per monitorarlo.',
    };
  }

  if (!status.modules?.trading) {
    return {
      level: 'off',
      title: 'Crypto Engine in pausa',
      subtitle: 'Il motore operativo è fermo: nessuna scansione o ingresso crypto in corso.',
      badge: 'SCANNER OFF',
      tone: '#94a3b8',
      border: 'rgba(148, 163, 184, 0.35)',
      background: 'rgba(15, 23, 42, 0.55)',
      monitoredCount: cryptoSymbols.length,
      activeCount: cryptoPositions.length,
      lastEvent: recentCryptoLogs[0] || 'Riavvia lo scanner per riprendere la sorveglianza crypto.',
    };
  }

  if (cryptoPositions.length > 0 || hasOrderActivity) {
    return {
      level: 'active',
      title: 'Crypto Engine operativo',
      subtitle: cryptoPositions.length > 0
        ? 'Ci sono posizioni crypto aperte o appena gestite dal motore.'
        : 'Il motore ha rilevato attività recente sulle crypto monitorate.',
      badge: 'ATTIVO',
      tone: '#10b981',
      border: 'rgba(16, 185, 129, 0.45)',
      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16), rgba(6, 182, 212, 0.08))',
      monitoredCount: cryptoSymbols.length,
      activeCount: cryptoPositions.length,
      lastEvent: recentCryptoLogs[0] || 'Attività crypto rilevata di recente.',
    };
  }

  if (hasGuardedSkip) {
    return {
      level: 'guarded',
      title: 'Crypto Engine prudente ma sano',
      subtitle: 'Il feed gira, ma i filtri di sicurezza stanno evitando ingressi deboli o poco puliti.',
      badge: 'FILTRO ATTIVO',
      tone: '#f59e0b',
      border: 'rgba(245, 158, 11, 0.4)',
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(30, 41, 59, 0.5))',
      monitoredCount: cryptoSymbols.length,
      activeCount: cryptoPositions.length,
      lastEvent: recentCryptoLogs[0] || 'I controlli stanno proteggendo gli ingressi crypto.',
    };
  }

  if (hasFeedHeartbeat) {
    return {
      level: 'watching',
      title: 'Crypto Engine in sorveglianza',
      subtitle: 'Le crypto sono monitorate correttamente e il motore è in attesa di un setup migliore.',
      badge: 'MONITORING',
      tone: '#38bdf8',
      border: 'rgba(56, 189, 248, 0.4)',
      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.14), rgba(15, 23, 42, 0.5))',
      monitoredCount: cryptoSymbols.length,
      activeCount: cryptoPositions.length,
      lastEvent: recentCryptoLogs[0] || 'Feed crypto attivo e in attesa di conferme.',
    };
  }

  return {
    level: 'warming',
    title: 'Crypto Engine in attesa dati',
    subtitle: 'La sezione è pronta, ma non ci sono ancora eventi crypto sufficienti per mostrare attività.',
    badge: 'SYNC',
    tone: '#a78bfa',
    border: 'rgba(167, 139, 250, 0.4)',
    background: 'linear-gradient(135deg, rgba(76, 29, 149, 0.18), rgba(15, 23, 42, 0.5))',
    monitoredCount: cryptoSymbols.length,
    activeCount: cryptoPositions.length,
    lastEvent: 'Aspetto i prossimi cicli di scansione per confermare lo stato crypto.',
  };
};

const deriveCryptoEngineDetails = (status = {}) => {
  const symbols = Array.isArray(status.symbols) ? status.symbols : [];
  const logs = Array.isArray(status.logs) ? status.logs : [];
  const positions = status.positions || {};
  const cryptoSymbols = symbols.filter((sym) => String(sym).includes('/'));
  const cryptoPositions = Object.entries(positions)
    .filter(([sym, pos]) => String(sym).includes('/') && pos !== 'LIQUID')
    .map(([sym]) => sym);

  const recentCryptoLogs = logs.filter((line) => {
    const rendered = String(line || '');
    return cryptoSymbols.some((sym) => rendered.includes(sym)) || rendered.includes('crypto');
  }).slice(0, 6);

  const reasons = [];

  if (!status.modules?.trading) {
    reasons.push('Scanner trading spento: finché resta in pausa, le crypto non possono aprire operazioni.');
  }
  if (cryptoSymbols.length === 0) {
    reasons.push('Nessuna crypto presente nella watchlist corrente.');
  }
  if (recentCryptoLogs.some((line) => line.includes('volatilità troppo bassa'))) {
    reasons.push('Mercato troppo piatto: il motore evita ingressi forzati quando manca movimento reale.');
  }
  if (recentCryptoLogs.some((line) => line.includes('nessun setup tecnico valido'))) {
    reasons.push('Nessun setup tecnico pulito: indicatori e pattern non sono ancora allineati.');
  }
  if (recentCryptoLogs.some((line) => line.includes('LSTM VETO'))) {
    reasons.push('Filtro LSTM prudente: la probabilità del movimento non supera la soglia minima.');
  }
  if (recentCryptoLogs.some((line) => line.includes('AI VETO'))) {
    reasons.push('Conferma AI mancante: il motore non entra se il sentiment o il pattern non convincono.');
  }
  if (recentCryptoLogs.some((line) => line.includes('RISK FILTER'))) {
    reasons.push('Protezione rischio attiva: il sistema sta evitando duplicazioni o condizioni non sicure.');
  }
  if (recentCryptoLogs.some((line) => line.includes('SKIP SHORT'))) {
    reasons.push('Short crypto bloccati: su Alpaca le crypto vengono trattate solo lato acquisto.');
  }
  if (cryptoPositions.length > 0) {
    reasons.push(`Posizioni crypto già aperte: ${cryptoPositions.join(' • ')}.`);
  }

  if (!reasons.length) {
    reasons.push('Il motore è pronto: sta solo aspettando dati e conferme sufficienti per esporsi.');
  }

  return {
    reasons: reasons.slice(0, 5),
    recentLogs: recentCryptoLogs,
    cryptoSymbols,
    cryptoPositions,
  };
};

const deriveCryptoSymbolStates = (status = {}) => {
  const symbols = Array.isArray(status.symbols) ? status.symbols : [];
  const logs = Array.isArray(status.logs) ? status.logs : [];
  const positions = status.positions || {};
  const cryptoSymbols = symbols.filter((sym) => String(sym).includes('/'));

  return cryptoSymbols.map((symbol) => {
    const symbolLogs = logs.filter((line) => String(line || '').includes(symbol));
    const latest = symbolLogs[0] || '';
    const hasOpenPosition = positions[symbol] && positions[symbol] !== 'LIQUID';

    if (!status.modules?.trading) {
      return { symbol, label: 'Pausa', tone: '#94a3b8', bg: 'rgba(148, 163, 184, 0.14)', border: 'rgba(148, 163, 184, 0.35)', reason: 'Scanner spento' };
    }
    if (hasOpenPosition) {
      return { symbol, label: 'Open', tone: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.35)', reason: 'Posizione aperta' };
    }
    if (latest.includes('ORDINE') || latest.includes('FAST SCALP')) {
      return { symbol, label: 'Ready', tone: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.35)', reason: 'Attività recente' };
    }
    if (latest.includes('volatilità troppo bassa')) {
      return { symbol, label: 'Flat', tone: '#38bdf8', bg: 'rgba(56, 189, 248, 0.14)', border: 'rgba(56, 189, 248, 0.35)', reason: 'Mercato piatto' };
    }
    if (latest.includes('nessun setup tecnico valido')) {
      return { symbol, label: 'Watch', tone: '#a78bfa', bg: 'rgba(167, 139, 250, 0.14)', border: 'rgba(167, 139, 250, 0.35)', reason: 'In osservazione' };
    }
    if (latest.includes('AI VETO') || latest.includes('LSTM VETO') || latest.includes('RISK FILTER') || latest.includes('SKIP SHORT')) {
      return { symbol, label: 'Veto', tone: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.35)', reason: 'Filtro attivo' };
    }
    return { symbol, label: 'Sync', tone: '#64748b', bg: 'rgba(100, 116, 139, 0.14)', border: 'rgba(100, 116, 139, 0.35)', reason: 'In attesa dati' };
  });
};

const getCryptoSymbolStateMap = (status = {}) =>
  Object.fromEntries(deriveCryptoSymbolStates(status).map((item) => [item.symbol, item]));

const parsePredictionMetrics = (prediction = '') => {
  const text = String(prediction || '');
  const take = (regex) => {
    const match = text.match(regex);
    return match ? Number(match[1]) : null;
  };
  return {
    lstm: take(/LSTM:\s*([-\d.]+)%/i),
    rsi: take(/RSI\(1M\):\s*([-\d.]+)/i),
    macd: take(/MACD:\s*([-\d.]+)/i),
    vwap: take(/VWAP:\s*([-\d.]+)/i),
  };
};

const deriveSystemHealthSnapshot = ({ status = {}, risk = {}, savedKeys = {}, isBackendOnline = true, cryptoEngine = null }) => {
  const runtimeHealth = status?.runtime_health || {};
  const alertArmed = !!((savedKeys?.PUSHOVER_APP_TOKEN && savedKeys?.PUSHOVER_USER_KEY) || (savedKeys?.TELEGRAM_BOT_TOKEN && savedKeys?.TELEGRAM_CHAT_ID));
  const riskEnabled = risk?.enabled !== false;
  const scannerOn = !!status?.modules?.trading;
  const positionsUsagePct = Number(risk?.positions_usage_pct || 0);
  let score = 100;
  const warnings = [];
  const strengths = [];

  if (!isBackendOnline) {
    score -= 34;
    warnings.push('Backend non raggiungibile: la piattaforma non ha piena telemetria.');
  } else {
    strengths.push('Backend online e raggiungibile.');
  }

  const runtimeStatus = String(runtimeHealth?.status || 'green').toLowerCase();
  if (runtimeStatus === 'red') {
    score -= 22;
    warnings.push(runtimeHealth?.summary || 'Runtime critico: c’è almeno un servizio da verificare.');
  } else if (runtimeStatus === 'yellow') {
    score -= 10;
    warnings.push(runtimeHealth?.summary || 'Runtime da osservare: non tutto è perfettamente allineato.');
  } else {
    strengths.push(runtimeHealth?.summary || 'Runtime stabile.');
  }

  if (!scannerOn) {
    score -= 12;
    warnings.push('Scanner fermo: finché resta spento non nasceranno nuovi setup.');
  } else {
    strengths.push('Scanner attivo e in ascolto del mercato.');
  }

  if (!riskEnabled) {
    score -= 16;
    warnings.push('Risk management disattivato: operatività meno protetta.');
  } else if (risk?.can_trade === false) {
    score -= 10;
    warnings.push(risk?.reason || 'Risk engine attivo ma sta bloccando nuovi ingressi.');
  } else {
    strengths.push('Risk engine operativo e pronto a filtrare gli ingressi.');
  }

  if (!alertArmed) {
    score -= 8;
    warnings.push('Notifiche non armate: potresti perderti un evento critico.');
  } else {
    strengths.push('Canali alert pronti.');
  }

  if (positionsUsagePct >= 100) {
    score -= 8;
    warnings.push('Capienza posizioni piena: prima di entrare serve liberare uno slot.');
  } else if (positionsUsagePct >= 80) {
    score -= 4;
    warnings.push('Capienza posizioni quasi satura.');
  } else {
    strengths.push('Capienza posizioni ancora disponibile.');
  }

  if (cryptoEngine?.level === 'active' || cryptoEngine?.level === 'watching' || cryptoEngine?.level === 'guarded') {
    strengths.push('Crypto engine vivo e monitorato.');
  }

  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  const label = normalized >= 88 ? 'Elite' : normalized >= 72 ? 'Strong' : normalized >= 55 ? 'Guarded' : 'Fragile';
  const tone = normalized >= 88 ? '#10b981' : normalized >= 72 ? '#38bdf8' : normalized >= 55 ? '#f59e0b' : '#ef4444';

  return {
    score: normalized,
    label,
    tone,
    warnings: warnings.slice(0, 4),
    strengths: strengths.slice(0, 4),
  };
};

const deriveOpsActionPlan = ({ status = {}, risk = {}, savedKeys = {}, isBackendOnline = true }) => {
  const runtimeHealth = asObject(status?.runtime_health);
  const actions = [];
  const alertReady = !!(
    (savedKeys?.PUSHOVER_APP_TOKEN && savedKeys?.PUSHOVER_USER_KEY && savedKeys?.PUSHOVER_ALERTS_ENABLED !== false) ||
    (savedKeys?.TELEGRAM_BOT_TOKEN && savedKeys?.TELEGRAM_CHAT_ID && savedKeys?.TELEGRAM_ALERTS_ENABLED !== false)
  );

  if (!isBackendOnline) {
    actions.push({
      priority: 'critical',
      title: 'Backend non raggiungibile',
      detail: 'La piattaforma sta lavorando con telemetria incompleta e va riallineata subito.',
    });
  }

  if (runtimeHealth?.auto_paused) {
    actions.push({
      priority: 'critical',
      title: 'Auto-pause attiva',
      detail: runtimeHealth?.auto_pause_reason || 'Il motore si è fermato per protezione.',
    });
  }

  if (risk?.enabled === false) {
    actions.push({
      priority: 'high',
      title: 'Risk management spento',
      detail: 'Riattivalo prima di lasciare Aureo senza supervisione.',
    });
  } else if (risk?.can_trade === false) {
    actions.push({
      priority: 'high',
      title: 'Risk engine in blocco',
      detail: risk?.reason || 'I limiti attuali stanno impedendo nuovi ingressi.',
    });
  }

  if (!status?.modules?.trading) {
    actions.push({
      priority: 'high',
      title: 'Scanner fermo',
      detail: 'Finché il motore trading è spento non nasceranno nuovi setup.',
    });
  }

  if (!alertReady) {
    actions.push({
      priority: 'medium',
      title: 'Alert non armati',
      detail: 'Completa almeno Telegram o Pushover per ricevere eventi critici.',
    });
  }

  if ((runtimeHealth?.heartbeat_age_sec ?? 0) > 300) {
    actions.push({
      priority: 'medium',
      title: 'Heartbeat vecchio',
      detail: 'Il motore non sta dando segnali recenti: controlla loop e sincronizzazione.',
    });
  }

  if ((runtimeHealth?.last_bar_age_sec ?? 0) > 1200) {
    actions.push({
      priority: 'medium',
      title: 'Feed dati fermo',
      detail: 'I prezzi non si aggiornano da troppo: meglio verificare prima di fidarsi del runtime.',
    });
  }

  if (!actions.length) {
    actions.push({
      priority: 'good',
      title: 'Nessuna azione urgente',
      detail: 'Sistema allineato: puoi lasciarlo lavorare con un buon margine di tranquillità.',
    });
  }

  return actions.slice(0, 4);
};

const deriveEntryReadiness = ({ status = {}, risk = {}, symbol = '', row = null }) => {
  const normalizedSymbol = String(symbol || '').toUpperCase();
  const logs = Array.isArray(status?.logs) ? status.logs : [];
  const positions = status?.positions || {};
  const riskEnabled = risk?.enabled !== false;
  const isCrypto = normalizedSymbol.includes('/');
  const symbolLogs = normalizedSymbol
    ? logs.filter((line) => String(line || '').toUpperCase().includes(normalizedSymbol)).slice(0, 10)
    : [];
  const blockers = [];
  const watchItems = [];
  const greenLights = [];
  let score = 100;

  if (!normalizedSymbol) {
    blockers.push('Nessun simbolo selezionato: scegli un asset per leggere la readiness.');
    score -= 45;
  }

  if (!status?.modules?.trading) {
    blockers.push('Scanner spento: il motore non sta cercando ingressi.');
    score -= 30;
  } else {
    greenLights.push('Scanner attivo.');
  }

  if (!isCrypto && status?.market_open === false) {
    blockers.push('Mercato azionario chiuso: il setup può maturare ma non eseguirsi.');
    score -= 18;
  } else if (!isCrypto) {
    greenLights.push('Mercato azionario aperto.');
  }

  if (!riskEnabled) {
    blockers.push('Risk management spento: meglio riattivarlo prima di forzare ingressi.');
    score -= 16;
  } else if (risk?.can_trade === false) {
    blockers.push(risk?.reason || 'Risk engine attivo ma sta bloccando nuovi ordini.');
    score -= 18;
  } else {
    greenLights.push('Risk engine pronto.');
  }

  if (normalizedSymbol && positions[normalizedSymbol] && positions[normalizedSymbol] !== 'LIQUID') {
    blockers.push(`Esiste già una posizione aperta su ${normalizedSymbol}.`);
    score -= 22;
  }

  if (row?.sentiment === 'BEARISH') {
    blockers.push('Sentiment AI bearish: il layer AI sta raffreddando l’ingresso.');
    score -= 14;
  } else if (row?.sentiment === 'BULLISH') {
    greenLights.push('Sentiment AI bullish.');
  }

  const metrics = parsePredictionMetrics(row?.prediction || '');
  if (metrics.lstm !== null) {
    if (metrics.lstm >= 55) greenLights.push(`LSTM sopra soglia (${metrics.lstm.toFixed(1)}%).`);
    else {
      watchItems.push(`LSTM ancora prudente (${metrics.lstm.toFixed(1)}%).`);
      score -= 8;
    }
  }
  if (metrics.rsi !== null) {
    if (metrics.rsi >= 35 && metrics.rsi <= 70) greenLights.push(`RSI bilanciato (${metrics.rsi.toFixed(1)}).`);
    else watchItems.push(`RSI fuori fascia ideale (${metrics.rsi.toFixed(1)}).`);
  }
  if (metrics.macd !== null && metrics.macd < 0) {
    watchItems.push(`MACD ancora debole (${metrics.macd.toFixed(2)}).`);
    score -= 5;
  }

  const hasVeto = symbolLogs.some((line) => /AI VETO|LSTM VETO|RISK FILTER|SKIP SHORT/i.test(String(line || '')));
  const hasNoSetup = symbolLogs.some((line) => /nessun setup tecnico valido|volatilità troppo bassa/i.test(String(line || '')));
  const hasRecentAction = symbolLogs.some((line) => /BUY|SELL|ORDINE|ATTIVATO/i.test(String(line || '')));

  if (hasVeto) {
    blockers.push('Uno dei filtri ha appena bocciato il setup.');
    score -= 12;
  }
  if (hasNoSetup) {
    watchItems.push('Il mercato non sta offrendo ancora un setup pulito.');
    score -= 8;
  }
  if (hasRecentAction) {
    greenLights.push('C’è attività recente sul simbolo.');
  }

  if (!blockers.length && !watchItems.length) {
    greenLights.push('Nessun freno evidente: il motore aspetta solo conferma esecutiva.');
  }

  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  const label = normalized >= 78 ? 'Pronto' : normalized >= 58 ? 'In osservazione' : 'Frenato';
  const tone = normalized >= 78 ? '#10b981' : normalized >= 58 ? '#f59e0b' : '#ef4444';

  return {
    score: normalized,
    label,
    tone,
    blockers: blockers.slice(0, 4),
    watchItems: watchItems.slice(0, 4),
    greenLights: greenLights.slice(0, 4),
    recentLogs: symbolLogs.slice(0, 4),
  };
};

const deriveEntryHeadline = (readiness) => {
  if (!readiness) {
    return {
      label: 'Nessun contesto',
      detail: 'Seleziona un simbolo per leggere il contesto operativo.',
      tone: '#64748b',
      bg: 'rgba(100,116,139,0.14)',
      border: 'rgba(100,116,139,0.35)',
    };
  }

  if (readiness.blockers?.length) {
    return {
      label: 'Frenato',
      detail: readiness.blockers[0],
      tone: '#ef4444',
      bg: 'rgba(239,68,68,0.14)',
      border: 'rgba(239,68,68,0.35)',
    };
  }

  if (readiness.watchItems?.length) {
    return {
      label: 'In maturazione',
      detail: readiness.watchItems[0],
      tone: '#f59e0b',
      bg: 'rgba(245,158,11,0.14)',
      border: 'rgba(245,158,11,0.35)',
    };
  }

  return {
    label: 'Pronto',
    detail: readiness.greenLights?.[0] || 'Setup pulito: manca solo il momento esecutivo.',
    tone: '#10b981',
    bg: 'rgba(16,185,129,0.14)',
    border: 'rgba(16,185,129,0.35)',
  };
};

const deriveTradePerformance = (tradeHistory = []) => {
  const trades = Array.isArray(tradeHistory) ? tradeHistory : [];
  const bySymbol = {};

  trades.forEach((trade) => {
    const symbol = String(trade?.symbol || '').trim();
    if (!symbol) return;
    const profitUsd = Number(trade?.profit_usd || 0);
    const profitPct = Number(trade?.profit_pct || 0);
    if (!bySymbol[symbol]) {
      bySymbol[symbol] = {
        symbol,
        trades: 0,
        wins: 0,
        losses: 0,
        totalPnl: 0,
        totalPct: 0,
        lastDate: '',
        lastSide: '',
      };
    }
    const row = bySymbol[symbol];
    row.trades += 1;
    row.totalPnl += profitUsd;
    row.totalPct += profitPct;
    row.lastDate = trade?.date || row.lastDate;
    row.lastSide = trade?.side || row.lastSide;
    if (profitUsd > 0) row.wins += 1;
    else if (profitUsd < 0) row.losses += 1;
  });

  const symbolRows = Object.values(bySymbol)
    .map((row) => ({
      ...row,
      avgPct: row.trades ? row.totalPct / row.trades : 0,
      winRate: row.trades ? (row.wins / row.trades) * 100 : 0,
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl);

  const recentTrades = [...trades].slice(-8).reverse();

  return {
    totalTrades: trades.length,
    totalPnl: symbolRows.reduce((acc, row) => acc + row.totalPnl, 0),
    bestSymbol: symbolRows[0] || null,
    weakestSymbol: [...symbolRows].sort((a, b) => a.totalPnl - b.totalPnl)[0] || null,
    symbolRows,
    recentTrades,
  };
};

const deriveTopOpportunities = ({ status = {}, risk = {}, tableDataBySymbol = {} }) => {
  const symbols = Array.isArray(status?.symbols) ? status.symbols : [];
  const rankedRows = Array.isArray(status?.symbol_selection?.ranked) ? status.symbol_selection.ranked : [];
  const rankedMap = Object.fromEntries(rankedRows.map((row) => [row.symbol, row]));

  return symbols
    .map((symbol) => {
      const tableRow = tableDataBySymbol[symbol] || rankedMap[symbol] || null;
      const readiness = deriveEntryReadiness({ status, risk, symbol, row: tableRow });
      const headline = deriveEntryHeadline(readiness);
      return {
        symbol,
        readiness,
        headline,
        rankingScore: Number(rankedMap[symbol]?.score ?? -1),
        selectionReason: rankedMap[symbol]?.selection_reason || '',
        sentiment: tableRow?.sentiment || 'NEUTRAL',
      };
    })
    .sort((a, b) => {
      if (b.readiness.score !== a.readiness.score) return b.readiness.score - a.readiness.score;
      return b.rankingScore - a.rankingScore;
    })
    .slice(0, 3);
};

const SymbolTabButton = ({ sym, selected, onClick, cryptoState }) => (
  <button
    className={`tab-btn ${selected ? 'active-tab' : ''}`}
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.45rem',
      ...(cryptoState ? {
        borderColor: cryptoState.border,
        boxShadow: selected ? `0 0 0 1px ${cryptoState.border} inset` : 'none',
      } : {}),
    }}
    title={cryptoState ? `${cryptoState.label} • ${cryptoState.reason}` : sym}
  >
    <span>{sym}</span>
    {cryptoState && (
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: cryptoState.tone,
          boxShadow: `0 0 10px ${cryptoState.tone}`,
          flexShrink: 0,
        }}
      ></span>
    )}
  </button>
);

const authFetch = async (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  const token = getAuthToken();
  if (!token && isDemoSession()) {
    return new Response(JSON.stringify({ detail: 'Demo mode attiva: azione live non disponibile' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    clearAuthSession();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('omni-auth-expired'));
    }
  }
  return response;
};

const base64urlToBytes = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const base64urlToBuffer = (value) => base64urlToBytes(value).buffer;

const bufferToBase64url = (value) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const HighRiskPnLSparkline = ({ history = [] }) => {
  const data = Array.isArray(history)
    ? history.map((x, i) => ({
        idx: i,
        pnl: Number(x.pnl ?? x.pnl_pct ?? 0),
      }))
    : [];

  if (!data.length) {
    return <span style={{ opacity: 0.45, fontSize: 11 }}>—</span>;
  }

  const last = data[data.length - 1]?.pnl ?? 0;
  const stroke = last >= 0 ? '#10b981' : '#ef4444';

  return (
    <div style={{ width: 90, height: 34 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(2)}%`, 'P&L']}
            labelFormatter={() => ''}
            contentStyle={{
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: 8,
              fontSize: 11,
              color: '#fff',
            }}
          />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke={stroke}
            fill={stroke}
            fillOpacity={0.18}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};



class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{color: 'red', padding: '2rem'}}>
        <h2>React Crash!</h2>
        <pre>{this.state.error.toString()}</pre>
      </div>;
    }
    return this.props.children;
  }
}

const ToggleSwitch = ({
  checked,
  onChange,
  disabled = false,
  busy = false,
  labelOn = 'ON',
  labelOff = 'OFF',
  title,
}) => (
  <button
    type="button"
    className={`risk-toggle-switch ${checked ? 'is-on' : 'is-off'} ${busy ? 'is-busy' : ''}`}
    onClick={onChange}
    disabled={disabled || busy}
    aria-pressed={checked}
    title={title}
  >
    <span className="risk-toggle-switch-track">
      <span className="risk-toggle-switch-thumb"></span>
    </span>
    <span className="risk-toggle-switch-label">{checked ? labelOn : labelOff}</span>
  </button>
);

const classifyTradingLog = (line = '') => {
  const text = String(line || '');
  if (
    text.includes('AUTO-PAUSE') ||
    text.includes('CIRCUIT BREAKER') ||
    text.includes('CRASH') ||
    text.includes('ERRORE') ||
    text.includes('backend offline')
  ) {
    return { label: 'Criticità runtime', tone: '#ef4444', border: 'rgba(239, 68, 68, 0.35)', category: 'critical' };
  }
  if (
    text.includes('CHIUSO') ||
    text.includes('STOP LOSS') ||
    text.includes('TAKE PROFIT') ||
    text.includes('AUTO-EXIT')
  ) {
    return { label: 'Exit / gestione', tone: '#38bdf8', border: 'rgba(56, 189, 248, 0.35)', category: 'exit' };
  }
  if (
    text.includes('BUY') ||
    text.includes('SELL') ||
    text.includes('ATTIVATO') ||
    text.includes('ORDINE')
  ) {
    return { label: 'Ordine / esecuzione', tone: '#10b981', border: 'rgba(16, 185, 129, 0.35)', category: 'execution' };
  }
  if (
    text.includes('SETUP LONG') ||
    text.includes('SETUP SHORT') ||
    text.includes('BREAKOUT') ||
    text.includes('MOMENTUM')
  ) {
    return { label: 'Setup trovato', tone: '#22c55e', border: 'rgba(34, 197, 94, 0.35)', category: 'setup' };
  }
  if (
    text.includes('VETO') ||
    text.includes('RISK FILTER') ||
    text.includes('SKIP') ||
    text.includes('nessun setup tecnico valido') ||
    text.includes('volatilità troppo bassa') ||
    text.includes('Posizione già aperta')
  ) {
    return { label: 'Setup scartato', tone: '#f59e0b', border: 'rgba(245, 158, 11, 0.35)', category: 'skip' };
  }
  return { label: 'Telemetria', tone: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)', category: 'telemetry' };
};

const extractLogSymbol = (line = '', symbols = []) => {
  const rendered = String(line || '').toUpperCase();
  const match = symbols.find((symbol) => rendered.includes(String(symbol).toUpperCase()));
  if (match) return match;
  const generic = rendered.match(/\b[A-Z]{2,5}(?:\/USD)?\b/);
  return generic ? generic[0] : '';
};

const classifyCryptoLog = (line = '') => {
  const text = String(line || '');
  if (text.includes('BUY') || text.includes('SCALP BUY') || text.includes('ORDINE')) {
    return { label: 'Ingresso', tone: '#10b981', border: 'rgba(16, 185, 129, 0.35)' };
  }
  if (text.includes('SELL') || text.includes('SCALP SELL') || text.includes('AUTO-EXIT') || text.includes('posizione chiusa')) {
    return { label: 'Exit', tone: '#38bdf8', border: 'rgba(56, 189, 248, 0.35)' };
  }
  if (text.includes('AI VETO') || text.includes('LSTM VETO')) {
    return { label: 'Filtro AI', tone: '#f59e0b', border: 'rgba(245, 158, 11, 0.35)' };
  }
  if (text.includes('RISK FILTER') || text.includes('Posizione già aperta') || text.includes('SKIP SHORT')) {
    return { label: 'Filtro Risk', tone: '#ef4444', border: 'rgba(239, 68, 68, 0.35)' };
  }
  return { label: 'Monitoraggio', tone: '#a78bfa', border: 'rgba(167, 139, 250, 0.35)' };
};

const AlertReadinessCard = ({ savedKeys = {}, runtimeHealth = {}, lastVaultSync = '' }) => {
  const channels = [
    {
      name: 'Telegram',
      ready: !!(savedKeys['TELEGRAM_BOT_TOKEN'] && savedKeys['TELEGRAM_CHAT_ID'] && savedKeys['TELEGRAM_ALERTS_ENABLED'] !== false),
      detail: !(savedKeys['TELEGRAM_BOT_TOKEN'] && savedKeys['TELEGRAM_CHAT_ID'])
        ? 'Manca token o chat id.'
        : savedKeys['TELEGRAM_ALERTS_ENABLED'] === false
          ? 'Canale configurato ma disattivato via switch.'
          : 'Canale di messaggistica configurato.',
    },
    {
      name: 'Pushover',
      ready: !!(savedKeys['PUSHOVER_APP_TOKEN'] && savedKeys['PUSHOVER_USER_KEY'] && savedKeys['PUSHOVER_ALERTS_ENABLED'] !== false),
      detail: !(savedKeys['PUSHOVER_APP_TOKEN'] && savedKeys['PUSHOVER_USER_KEY'])
        ? 'Manca app token o user key.'
        : savedKeys['PUSHOVER_ALERTS_ENABLED'] === false
          ? 'Canale configurato ma disattivato via switch.'
          : 'Push critici pronti per iPhone e Apple Watch.',
    },
  ];
  const readyCount = channels.filter((channel) => channel.ready).length;
  const alertReady = readyCount > 0;

  return (
    <div className="card" style={{ marginTop: '1.5rem', border: `1px solid ${alertReady ? 'rgba(16,185,129,0.28)' : 'rgba(239,68,68,0.28)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <div className="card-title">📣 Alert critici</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Verifica rapida dei canali usati per auto-pause, circuit breaker ed emergenze.
          </div>
        </div>
        <div className={`badge ${alertReady ? 'badge-active' : 'badge-danger'}`}>
          {alertReady ? 'PRONTI' : 'NON ARMATI'}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
        {channels.map((channel) => (
          <div key={channel.name} style={{ padding: '0.95rem', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${channel.ready ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.45rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: channel.ready ? '#10b981' : '#ef4444', boxShadow: `0 0 14px ${channel.ready ? '#10b981' : '#ef4444'}` }}></span>
              <div style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 800 }}>{channel.name}</div>
            </div>
            <div style={{ color: channel.ready ? '#10b981' : '#fca5a5', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              {channel.ready ? 'Presente nel Vault' : 'Configurazione incompleta'}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5 }}>{channel.detail}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '0.9rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
        Ultimo aggiornamento Vault: {lastVaultSync || 'non ancora sincronizzato'}
      </div>
      {!!runtimeHealth?.auto_paused && (
        <div style={{ marginTop: '0.9rem', color: '#fca5a5', fontSize: '0.88rem' }}>
          Ultimo evento grave registrato: {runtimeHealth?.auto_pause_reason || 'auto-pause attiva'}
        </div>
      )}
    </div>
  );
};

const OpsActionCard = ({ actions = [] }) => {
  const palette = {
    critical: { tone: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.24)', label: 'Critica' },
    high: { tone: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.24)', label: 'Alta' },
    medium: { tone: '#38bdf8', bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.24)', label: 'Media' },
    good: { tone: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.24)', label: 'OK' },
  };

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <div className="card-title">🎯 Azioni immediate</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Le priorità operative da sistemare per tenere Aureo stabile e pronto.
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
        {actions.map((action, index) => {
          const meta = palette[action.priority] || palette.medium;
          return (
            <div key={`${action.title}-${index}`} style={{ padding: '0.95rem', borderRadius: '14px', background: meta.bg, border: `1px solid ${meta.border}` }}>
              <div style={{ color: meta.tone, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.42rem' }}>
                Priorità {meta.label}
              </div>
              <div style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 800, marginBottom: '0.4rem' }}>{action.title}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5 }}>{action.detail}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BOTTOM_BAR_STORAGE_KEY = 'aureo_bottom_bar_offset';

const BottomReminderBar = ({ status, risk, savedKeys, isBackendOnline, syncLabel, activeTab, onOpenHealth, onOpenSecurity, onOpenTrading }) => {
  const barRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const uiRaw = safeStorageGet(`${BOTTOM_BAR_STORAGE_KEY}:ui`, null);
  const uiParsed = uiRaw ? (() => { try { return JSON.parse(uiRaw); } catch { return null; } })() : null;
  const [isDraggingBar, setIsDraggingBar] = useState(false);
  const [isHoveringBar, setIsHoveringBar] = useState(false);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [showMissionControl, setShowMissionControl] = useState(false);
  const [snapEdge, setSnapEdge] = useState('center');
  const [displayMode, setDisplayMode] = useState(uiParsed?.displayMode === 'compact' ? 'compact' : 'expanded');
  const [isMuted, setIsMuted] = useState(uiParsed?.isMuted === true);
  const [isAutoHideEnabled, setIsAutoHideEnabled] = useState(uiParsed?.isAutoHideEnabled === true);
  const [barOffset, setBarOffset] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    try {
      const raw = safeStorageGet(BOTTOM_BAR_STORAGE_KEY, null);
      if (!raw) return { x: 0, y: 0 };
      const parsed = JSON.parse(raw);
      return {
        x: Number(parsed?.x || 0),
        y: Number(parsed?.y || 0),
      };
    } catch {
      return { x: 0, y: 0 };
    }
  });
  const runtimeHealth = status?.runtime_health || {};
  const marketOpen = !!status?.market_open;
  const tradingOn = !!status?.modules?.trading;
  const riskEnabled = risk?.enabled !== false;
  const riskState = !riskEnabled ? 'Off' : (risk?.can_trade ? 'Ready' : 'Blocked');
  const cryptoCount = Object.entries(status?.positions || {}).filter(([sym, pos]) => String(sym).includes('/') && pos !== 'LIQUID').length;
  const livePnl = Number(status?.profit || 0);
  const alertArmed = (savedKeys?.PUSHOVER_APP_TOKEN && savedKeys?.PUSHOVER_USER_KEY) || (savedKeys?.TELEGRAM_BOT_TOKEN && savedKeys?.TELEGRAM_CHAT_ID);
  const cryptoEngine = deriveCryptoEngineState(status);
  const systemHealthSnapshot = deriveSystemHealthSnapshot({ status, risk, savedKeys, isBackendOnline, cryptoEngine });
  const recentMissionLogs = (Array.isArray(status?.logs) ? status.logs : []).slice(0, 5);
  const focusSymbols = (Array.isArray(status?.symbols) ? status.symbols : []).slice(0, 6);
  const criticalAlerts = [
    !isBackendOnline ? { label: 'Backend offline', tone: '#ef4444', action: onOpenHealth } : null,
    runtimeHealth?.api_status && String(runtimeHealth.api_status).toLowerCase() !== 'online'
      ? { label: 'API unstable', tone: '#ef4444', action: onOpenHealth }
      : null,
    tradingOn && !riskEnabled ? { label: 'Risk off', tone: '#f59e0b', action: onOpenTrading } : null,
    tradingOn && riskEnabled && risk?.can_trade === false ? { label: 'Trading blocked', tone: '#ef4444', action: onOpenTrading } : null,
    !alertArmed ? { label: 'Alerts not armed', tone: '#f59e0b', action: onOpenSecurity } : null,
  ].filter(Boolean);
  const topAlert = criticalAlerts[0] || null;
  const alertCount = criticalAlerts.length;
  const alertLevel = alertCount >= 2 ? 'High Priority' : alertCount === 1 ? 'Attention' : 'Stable';

  const items = [
    { label: 'Backend', value: isBackendOnline ? 'Online' : 'Offline', tone: isBackendOnline ? '#10b981' : '#ef4444' },
    { label: 'Sync', value: syncLabel || '—', tone: '#94a3b8' },
    { label: 'Mercato', value: marketOpen ? 'Aperto' : 'Chiuso', tone: marketOpen ? '#10b981' : '#f59e0b' },
    { label: 'Scanner', value: tradingOn ? 'Attivo' : 'Fermo', tone: tradingOn ? '#10b981' : '#94a3b8' },
    { label: 'Risk', value: riskState, tone: riskState === 'Ready' ? '#10b981' : riskState === 'Blocked' ? '#ef4444' : '#94a3b8' },
    { label: 'Crypto', value: `${cryptoCount} live`, tone: cryptoCount > 0 ? '#38bdf8' : '#94a3b8' },
    { label: 'P&L', value: `${livePnl >= 0 ? '+' : ''}$${livePnl.toFixed(2)}`, tone: livePnl >= 0 ? '#10b981' : '#ef4444' },
    { label: 'Alert', value: alertArmed ? 'Armati' : 'Da armare', tone: alertArmed ? '#10b981' : '#f59e0b' },
    { label: 'Vista', value: TAB_TITLES[activeTab] || 'AUREO', tone: '#a78bfa' },
  ];
  const visibleItems = displayMode === 'compact' ? items.slice(0, 5) : items;
  const isBarPeeked = !isAutoHideEnabled || isHoveringBar || isDraggingBar;

  const clampBarOffset = React.useCallback((candidate) => {
    if (typeof window === 'undefined' || !barRef.current) return candidate;
    const width = barRef.current.offsetWidth;
    const height = barRef.current.offsetHeight;
    const desktopCompact = window.innerWidth <= 1024;
    const baseLeft = desktopCompact ? 256 : 304;
    const minX = 12 - baseLeft;
    const maxX = window.innerWidth - 12 - (baseLeft + width);
    const minY = -Math.max(0, window.innerHeight - height - 88);
    return {
      x: Math.max(minX, Math.min(maxX, candidate.x)),
      y: Math.max(minY, Math.min(0, candidate.y)),
    };
  }, []);

  const resolveSnapEdge = React.useCallback((candidate) => {
    if (typeof window === 'undefined' || !barRef.current) return 'center';
    const width = barRef.current.offsetWidth;
    const desktopCompact = window.innerWidth <= 1024;
    const baseLeft = desktopCompact ? 256 : 304;
    const left = baseLeft + candidate.x;
    const rightGap = window.innerWidth - (left + width);
    const threshold = 72;
    if (left <= threshold) return 'left';
    if (rightGap <= threshold) return 'right';
    return 'center';
  }, []);

  const applySnapEdge = React.useCallback((candidate) => {
    if (typeof window === 'undefined' || !barRef.current) return candidate;
    const width = barRef.current.offsetWidth;
    const desktopCompact = window.innerWidth <= 1024;
    const baseLeft = desktopCompact ? 256 : 304;
    const snapped = clampBarOffset(candidate);
    const edge = resolveSnapEdge(snapped);
    const minX = 12 - baseLeft;
    const maxX = window.innerWidth - 12 - (baseLeft + width);
    if (edge === 'left') {
      return { ...snapped, x: minX };
    }
    if (edge === 'right') {
      return { ...snapped, x: maxX };
    }
    return snapped;
  }, [clampBarOffset, resolveSnapEdge]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    safeStorageSet(BOTTOM_BAR_STORAGE_KEY, JSON.stringify(barOffset));
  }, [barOffset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    safeStorageSet(`${BOTTOM_BAR_STORAGE_KEY}:ui`, JSON.stringify({
      displayMode,
      isMuted,
      isAutoHideEnabled,
    }));
  }, [displayMode, isMuted, isAutoHideEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setBarOffset((prev) => {
        const next = clampBarOffset(prev);
        setSnapEdge(resolveSnapEdge(next));
        return next;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampBarOffset, resolveSnapEdge]);

  useEffect(() => {
    setSnapEdge(resolveSnapEdge(barOffset));
  }, [barOffset, resolveSnapEdge]);

  useEffect(() => {
    if (!showAlertsPanel && !showMissionControl) return;
    const handlePointerDown = (event) => {
      if (barRef.current && !barRef.current.contains(event.target)) {
        setShowAlertsPanel(false);
        setShowMissionControl(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [showAlertsPanel, showMissionControl]);

  const handleDragStart = (event) => {
    if (typeof window === 'undefined') return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startOffset = { ...barOffset };
    setIsDraggingBar(true);
    document.body.style.userSelect = 'none';

    const handleMove = (moveEvent) => {
      const next = clampBarOffset({
        x: startOffset.x + (moveEvent.clientX - startX),
        y: startOffset.y + (moveEvent.clientY - startY),
      });
      setSnapEdge(resolveSnapEdge(next));
      setBarOffset(next);
    };

    const handleUp = () => {
      setIsDraggingBar(false);
      document.body.style.userSelect = '';
      setBarOffset((prev) => {
        const snapped = applySnapEdge(prev);
        setSnapEdge(resolveSnapEdge(snapped));
        return snapped;
      });
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
  };

  const handlePriorityJump = () => {
    if (typeof topAlert?.action === 'function') {
      topAlert.action();
    }
  };

  return (
    <div
      ref={barRef}
      className={`bottom-reminder-bar ${isDraggingBar ? 'is-dragging' : ''} ${displayMode === 'compact' ? 'is-compact' : 'is-expanded'} ${isMuted ? 'is-muted' : ''} ${isAutoHideEnabled ? 'is-auto-hide' : ''} ${isBarPeeked ? 'is-peeked' : 'is-docked'} ${snapEdge === 'left' ? 'snap-left' : snapEdge === 'right' ? 'snap-right' : 'snap-center'}`}
      style={{ transform: `translate3d(${barOffset.x}px, ${barOffset.y}px, 0)` }}
      onMouseEnter={() => setIsHoveringBar(true)}
      onMouseLeave={() => setIsHoveringBar(false)}
      onFocus={() => setIsHoveringBar(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsHoveringBar(false);
        }
      }}
    >
      <div
        ref={dragRef}
        className="bottom-reminder-handle"
        onPointerDown={handleDragStart}
        title="Sposta la Info Bar"
      >
        <span className="bottom-reminder-handle-icon" aria-hidden="true">
          <span className="bottom-reminder-handle-icon-core">◉</span>
        </span>
        <span className="bottom-reminder-handle-text">
          <strong>Info Bar</strong>
          <small>{topAlert ? `${alertLevel} · ${topAlert.label}` : 'Live Status Dock'}</small>
        </span>
        <span
          className={`bottom-reminder-status-dot ${topAlert ? 'is-alert' : 'is-clear'}`}
          title={topAlert ? topAlert.label : 'Tutti i sistemi principali sono stabili'}
          aria-label={topAlert ? topAlert.label : 'Stato stabile'}
          onClick={() => setShowAlertsPanel((prev) => !prev)}
        />
        <span
          className={`bottom-reminder-alert-count ${alertCount > 0 ? 'has-alerts' : 'is-clear'}`}
          title={alertCount > 0 ? `${alertCount} alert attivi` : 'Nessun alert attivo'}
          onClick={() => setShowAlertsPanel((prev) => !prev)}
        >
          {alertCount}
        </span>
        <div className="bottom-reminder-handle-actions">
          <button
            type="button"
            className={`bottom-reminder-chip ${showMissionControl ? 'active' : ''}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              setShowAlertsPanel(false);
              setShowMissionControl((prev) => !prev);
            }}
            title="Apri Mission Control"
          >
            MC
          </button>
          <button
            type="button"
            className={`bottom-reminder-chip ${displayMode === 'compact' ? 'active' : ''}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setDisplayMode((prev) => (prev === 'compact' ? 'expanded' : 'compact'))}
            title={displayMode === 'compact' ? 'Passa a vista completa' : 'Passa a vista compatta'}
          >
            {displayMode === 'compact' ? 'Wide' : 'Mini'}
          </button>
          <button
            type="button"
            className={`bottom-reminder-chip ${isMuted ? 'active' : ''}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setIsMuted((prev) => !prev)}
            title={isMuted ? 'Ripristina intensità normale' : 'Rendi la barra più discreta'}
          >
            {isMuted ? 'Solid' : 'Soft'}
          </button>
          <button
            type="button"
            className={`bottom-reminder-chip ${isAutoHideEnabled ? 'active' : ''}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setIsAutoHideEnabled((prev) => !prev)}
            title={isAutoHideEnabled ? 'Mantieni la barra sempre visibile' : 'Nascondi la barra finché non la sfiori'}
          >
            {isAutoHideEnabled ? 'Pinned' : 'Auto'}
          </button>
        </div>
      </div>
      {showAlertsPanel ? (
        <div className="bottom-reminder-alert-panel">
          <div className="bottom-reminder-alert-panel-title">Alert attivi</div>
          {criticalAlerts.length ? (
            <div className="bottom-reminder-alert-list">
              {criticalAlerts.map((alert, index) => (
                <button
                  key={`${alert.label}-${index}`}
                  type="button"
                  className="bottom-reminder-alert-item"
                  style={{ '--alert-tone': alert.tone }}
                  onClick={() => {
                    setShowAlertsPanel(false);
                    if (typeof alert.action === 'function') alert.action();
                  }}
                >
                  <span className="bottom-reminder-alert-item-dot" />
                  <span className="bottom-reminder-alert-item-text">
                    <strong>{alert.label}</strong>
                    <small>Tocca per aprire la sezione collegata</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="bottom-reminder-alert-empty">
              Nessun alert critico attivo. Il sistema è stabile.
            </div>
          )}
        </div>
      ) : null}
      {showMissionControl ? (
        <div className="bottom-reminder-mission-panel">
          <div className="bottom-reminder-mission-header">
            <div>
              <div className="bottom-reminder-mission-title">Mission Control</div>
              <div className="bottom-reminder-mission-subtitle">Panoramica rapida di salute, runtime e ultimi eventi.</div>
            </div>
            <div className="bottom-reminder-mission-score" style={{ '--mission-tone': systemHealthSnapshot.tone }}>
              <strong>{systemHealthSnapshot.score}</strong>
              <span>{systemHealthSnapshot.label}</span>
            </div>
          </div>
          <div className="bottom-reminder-mission-grid">
            <div className="bottom-reminder-mission-card">
              <div className="bottom-reminder-mission-card-title">Stato live</div>
              <div className="bottom-reminder-mission-checks">
                <div><span>Backend</span><strong style={{ color: isBackendOnline ? '#10b981' : '#ef4444' }}>{isBackendOnline ? 'Online' : 'Offline'}</strong></div>
                <div><span>Risk</span><strong style={{ color: riskState === 'Ready' ? '#10b981' : riskState === 'Blocked' ? '#ef4444' : '#94a3b8' }}>{riskState}</strong></div>
                <div><span>Scanner</span><strong style={{ color: tradingOn ? '#10b981' : '#94a3b8' }}>{tradingOn ? 'Attivo' : 'Fermo'}</strong></div>
                <div><span>Mercato</span><strong style={{ color: marketOpen ? '#10b981' : '#f59e0b' }}>{marketOpen ? 'Aperto' : 'Chiuso'}</strong></div>
                <div><span>Crypto</span><strong style={{ color: cryptoEngine.tone }}>{cryptoEngine.badge}</strong></div>
                <div><span>Alert</span><strong style={{ color: alertArmed ? '#10b981' : '#f59e0b' }}>{alertArmed ? 'Armati' : 'Da armare'}</strong></div>
              </div>
            </div>
            <div className="bottom-reminder-mission-card">
              <div className="bottom-reminder-mission-card-title">Focus operativo</div>
              <div className="bottom-reminder-mission-tags">
                {focusSymbols.length ? focusSymbols.map((symbol) => (
                  <span key={symbol} className="bottom-reminder-mission-tag">{symbol}</span>
                )) : <span className="bottom-reminder-mission-empty">Nessun simbolo in focus.</span>}
              </div>
              <div className="bottom-reminder-mission-note">
                {systemHealthSnapshot.warnings[0] || systemHealthSnapshot.strengths[0] || 'Nessuna nota operativa al momento.'}
              </div>
            </div>
            <div className="bottom-reminder-mission-card">
              <div className="bottom-reminder-mission-card-title">Eventi recenti</div>
              <div className="bottom-reminder-mission-events">
                {recentMissionLogs.length ? recentMissionLogs.map((line, index) => {
                  const meta = classifyTradingLog(line);
                  return (
                    <div key={index} className="bottom-reminder-mission-event" style={{ '--event-tone': meta.tone }}>
                      <span className="bottom-reminder-mission-event-label">{meta.label}</span>
                      <span className="bottom-reminder-mission-event-text">{line}</span>
                    </div>
                  );
                }) : <div className="bottom-reminder-mission-empty">Nessun evento recente disponibile.</div>}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {topAlert ? (
        <button
          type="button"
          className="bottom-reminder-priority"
          style={{ '--priority-tone': topAlert.tone }}
          onClick={handlePriorityJump}
          title={`Apri la sezione per gestire: ${topAlert.label}`}
        >
          <span className="bottom-reminder-priority-dot" />
          <span>{topAlert.label}</span>
        </button>
      ) : null}
      {visibleItems.map((item) => (
        <div key={item.label} className="bottom-reminder-pill">
          <span className="bottom-reminder-label">{item.label}</span>
          <span className="bottom-reminder-value" style={{ color: item.tone }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
};

const RiskStatus = ({ riskSnapshot, status }) => {
  const [risk, setRisk] = useState(riskSnapshot || null);
  const [isTogglingRisk, setIsTogglingRisk] = useState(false);
  const userRole = safeStorageGet('USER_ROLE', 'user');

  useEffect(() => {
    if (riskSnapshot) {
      setRisk(riskSnapshot);
    }
  }, [riskSnapshot]);

  if (!risk || !risk.status) return <div className="card col-span-12" style={{ padding: '2rem', textAlign: 'center', color: '#f59e0b' }}>Caricamento Risk Manager (o Backend Offline)...</div>;
  
  const statusColors = {
    disabled: '#64748B',
    green: '#10B981',
    yellow: '#F59E0B', 
    red: '#EF4444',
    black: '#000000'
  };

  const statusMeta = {
    green: {
      label: 'ACCESO',
      title: 'Protezione attiva',
      description: 'Il controllo rischio è attivo e il trading è consentito.',
      badgeClass: 'badge-active'
    },
    yellow: {
      label: 'ACCESO',
      title: 'Protezione attiva con avviso',
      description: 'Il controllo rischio è attivo, ma siamo vicini a un limite.',
      badgeClass: 'badge-gold'
    },
    red: {
      label: 'SPENTO',
      title: 'Trading bloccato',
      description: 'Il controllo rischio è attivo e ha fermato nuove operazioni.',
      badgeClass: 'badge-danger'
    },
    black: {
      label: 'SPENTO',
      title: 'Circuit breaker attivo',
      description: 'Il controllo rischio ha spento il trading fino a nuovo sblocco.',
      badgeClass: 'badge-danger'
    }
  };

  const riskEnabled = risk.enabled !== false;
  const maxOpenPositions = Number(risk.max_open_positions || 0);
  const openPositions = Number(risk.open_positions || 0);
  const positionsUsagePct = Number(risk.positions_usage_pct || 0);
  const positionsRemaining = Number(risk.positions_remaining || 0);
  const positionsProgressColor = !riskEnabled
    ? '#64748B'
    : openPositions >= maxOpenPositions && maxOpenPositions > 0
      ? '#EF4444'
      : positionsUsagePct >= 80
        ? '#F59E0B'
        : '#10B981';
  const meta = riskEnabled
    ? (statusMeta[risk.status] || statusMeta.red)
    : {
        label: 'SPENTO',
        title: 'Protezione disattivata',
        description: 'Il controllo rischio è spento manualmente: il bot non blocca nuove operazioni.',
        badgeClass: 'badge-idle'
      };
  const statusColor = riskEnabled ? (statusColors[risk.status] || '#555') : statusColors.disabled;

  const handleRiskToggle = async () => {
    if (userRole !== 'admin' || isTogglingRisk || !risk) return;
    setIsTogglingRisk(true);
    try {
      const res = await authFetch('/api/risk/enabled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !riskEnabled })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.message || 'Impossibile aggiornare Risk Management');
      }
      setRisk(data.risk);
    } catch (error) {
      alert(error.message || 'Impossibile aggiornare Risk Management');
    } finally {
      setIsTogglingRisk(false);
    }
  };
  
  return (
    <div className="card col-span-6" style={{ border: `2px solid ${statusColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
        <div>
          <div className="card-title">🛡️ Risk Management</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{meta.title}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className={`badge ${meta.badgeClass}`} style={{ fontSize: '0.9rem', fontWeight: 800 }}>
            {meta.label}
          </div>
          <ToggleSwitch
            checked={riskEnabled}
            onChange={handleRiskToggle}
            disabled={userRole !== 'admin'}
            busy={isTogglingRisk}
            title={userRole === 'admin' ? 'Attiva o disattiva Risk Management' : 'Solo admin'}
          />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
        <span style={{ width: '12px', height: '12px', borderRadius: '999px', background: statusColor, boxShadow: `0 0 12px ${statusColor}` }}></span>
        <div style={{ color: statusColor, fontSize: '1.3rem', fontWeight: 'bold', letterSpacing: '0.04em' }}>
          {!riskEnabled ? 'CONTROLLO OFF' : (risk.can_trade ? 'OPERATIVO' : 'BLOCCATO')}
        </div>
      </div>
      <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div className={`badge ${status.dynamic_atr_stop ? 'badge-active' : 'badge-idle'}`} style={{ fontSize: '0.8rem' }}>
          ATR Trailing {status.dynamic_atr_stop ? 'ON' : 'OFF'}
        </div>
        <div className="badge badge-idle" style={{ fontSize: '0.8rem' }}>
          Stop Fisso {Number(status.trailing_stop_base_pct || 2.5).toFixed(1)}%
        </div>
      </div>
      <div style={{ opacity: 0.92 }}>{meta.description}</div>
      <div style={{ opacity: 0.8, marginTop: 6 }}>{risk.reason}</div>
      <div style={{ marginTop: '1rem', padding: '0.9rem 1rem', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.72)', border: `1px solid ${positionsProgressColor}33` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Capienza posizioni</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 800 }}>
              {openPositions}/{maxOpenPositions || '—'} conteggiate dal Risk Engine
            </div>
          </div>
          <div className={`badge ${positionsRemaining === 0 && riskEnabled ? 'badge-danger' : positionsRemaining <= 1 && riskEnabled ? 'badge-gold' : 'badge-active'}`} style={{ fontSize: '0.82rem' }}>
            {positionsRemaining > 0 ? `${positionsRemaining} slot liberi` : 'Limite raggiunto'}
          </div>
        </div>
        <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(148, 163, 184, 0.16)', overflow: 'hidden', marginBottom: '0.55rem' }}>
          <div style={{ width: `${Math.min(100, positionsUsagePct)}%`, height: '100%', borderRadius: '999px', background: `linear-gradient(90deg, ${positionsProgressColor}, ${positionsProgressColor}CC)`, boxShadow: `0 0 18px ${positionsProgressColor}55` }} />
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
          Questo limite conta solo le posizioni realmente gestite da Aureo. Se il valore arriva al massimo, il bot non apre nuove operazioni finché non si libera uno slot.
        </div>
      </div>
      <div style={{marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem'}}>
        <div className="badge badge-idle" style={{ justifyContent: 'space-between' }}>Equity <strong style={{ color: 'var(--text-primary)' }}>${risk.equity}</strong></div>
        <div className="badge badge-idle" style={{ justifyContent: 'space-between' }}>Daily P&L <strong style={{ color: 'var(--text-primary)' }}>{risk.daily_pnl_pct}%</strong></div>
        <div className="badge badge-idle" style={{ justifyContent: 'space-between' }}>Drawdown <strong style={{ color: 'var(--text-primary)' }}>{risk.max_drawdown_pct}%</strong></div>
        <div className="badge badge-idle" style={{ justifyContent: 'space-between' }}>Trade oggi <strong style={{ color: 'var(--text-primary)' }}>{risk.trades_today}</strong></div>
      </div>
      {risk.status === 'black' && (
        <button 
          onClick={() => authFetch('/api/risk/emergency-stop', {method: 'POST'})}
          style={{ background: '#EF4444', color: 'white', padding: '0.75rem', borderRadius: '8px', marginTop: '1rem', width: '100%', cursor: 'pointer' }}
        >
          🛑 EMERGENCY STOP
        </button>
      )}
    </div>
  );
};

const EnginePulseCard = ({ status, risk, cryptoEngine }) => {
  const runtimeHealth = status?.runtime_health || {};
  const runtimeStatus = runtimeHealth?.status || 'green';
  const riskEnabled = risk?.enabled !== false;
  const riskState = !riskEnabled ? 'disabled' : (risk?.can_trade ? 'ready' : 'blocked');
  const scannerOn = !!status?.modules?.trading;
  const marketOpen = !!status?.market_open;
  const statusMap = {
    green: { label: 'Runtime stabile', tone: '#10b981' },
    yellow: { label: 'Runtime da osservare', tone: '#f59e0b' },
    red: { label: 'Runtime critico', tone: '#ef4444' },
    ready: { label: 'Risk operativo', tone: '#10b981' },
    blocked: { label: 'Risk blocca ingressi', tone: '#ef4444' },
    disabled: { label: 'Risk disattivato', tone: '#94a3b8' },
    on: { label: 'Scanner attivo', tone: '#10b981' },
    off: { label: 'Scanner fermo', tone: '#94a3b8' },
    market_open: { label: 'Mercato aperto', tone: '#10b981' },
    market_closed: { label: 'Mercato chiuso', tone: '#f59e0b' },
  };

  const pulseItems = [
    { title: 'Runtime', value: statusMap[runtimeStatus]?.label || 'Runtime', tone: statusMap[runtimeStatus]?.tone || '#64748b', detail: runtimeHealth?.summary || 'Nessun riepilogo runtime disponibile.' },
    { title: 'Risk Engine', value: statusMap[riskState]?.label || 'Risk', tone: statusMap[riskState]?.tone || '#64748b', detail: risk?.reason || 'Nessun blocco attivo.' },
    { title: 'Scanner', value: scannerOn ? statusMap.on.label : statusMap.off.label, tone: scannerOn ? statusMap.on.tone : statusMap.off.tone, detail: scannerOn ? 'Il motore sta valutando nuovi setup.' : 'Finché resta spento non parte alcuna scansione.' },
    { title: 'Crypto Engine', value: cryptoEngine?.title || 'Crypto Engine', tone: cryptoEngine?.tone || '#64748b', detail: cryptoEngine?.subtitle || 'Nessun dato crypto disponibile.' },
  ];

  return (
    <div className="card col-span-12" style={{ border: '1px solid rgba(56, 189, 248, 0.22)', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(9, 15, 32, 0.92))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div className="card-title">⚙️ Engine Pulse</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Lettura rapida dello stato operativo reale prima di guardare segnali, ordini e performance.
          </div>
        </div>
        <div className={`badge ${marketOpen ? 'badge-active' : 'badge-gold'}`} style={{ fontSize: '0.82rem' }}>
          {marketOpen ? statusMap.market_open.label : statusMap.market_closed.label}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
        {pulseItems.map((item) => (
          <div key={item.title} style={{ padding: '1rem', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${item.tone}33` }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.42rem' }}>{item.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.45rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.tone, boxShadow: `0 0 14px ${item.tone}` }}></span>
              <div style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 800 }}>{item.value}</div>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5 }}>{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SystemHealthCard = ({ snapshot }) => (
  <div className="card col-span-4" style={{ border: `1px solid ${snapshot.tone}33`, background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(9, 15, 32, 0.9))' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', marginBottom: '1rem' }}>
      <div>
        <div className="card-title">Health Score</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Quanto il sistema è pronto a girare bene adesso.</div>
      </div>
      <div className="badge" style={{ borderColor: `${snapshot.tone}55`, color: snapshot.tone, background: `${snapshot.tone}12` }}>
        {snapshot.label}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.85rem' }}>
      <span style={{ color: snapshot.tone, fontSize: '2.3rem', fontWeight: 900, lineHeight: 1 }}>{snapshot.score}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>/100</span>
    </div>
    <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '1rem' }}>
      <div style={{ width: `${snapshot.score}%`, height: '100%', background: `linear-gradient(90deg, ${snapshot.tone}, ${snapshot.tone}CC)`, boxShadow: `0 0 16px ${snapshot.tone}55` }} />
    </div>
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div>
        <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '0.35rem' }}>Punti forti</div>
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {snapshot.strengths.map((item, index) => (
            <div key={index} style={{ color: '#cbd5e1', fontSize: '0.85rem', display: 'flex', gap: '0.45rem' }}>
              <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '0.35rem' }}>Da tenere d’occhio</div>
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {snapshot.warnings.length ? snapshot.warnings.map((item, index) => (
            <div key={index} style={{ color: '#cbd5e1', fontSize: '0.85rem', display: 'flex', gap: '0.45rem' }}>
              <span style={{ color: '#f59e0b', fontWeight: 800 }}>!</span>
              <span>{item}</span>
            </div>
          )) : (
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Nessuna fragilità evidente in questo momento.</div>
          )}
        </div>
      </div>
    </div>
  </div>
);

const EntryReadinessCard = ({ readiness, symbol }) => (
  <div className="card col-span-8" style={{ border: `1px solid ${readiness.tone}33`, background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(9, 15, 32, 0.9))' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
      <div>
        <div className="card-title">Perché non entra</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Diagnosi operativa su {symbol || 'nessun simbolo selezionato'} per capire cosa manca al prossimo ingresso.
        </div>
      </div>
      <div className="badge" style={{ borderColor: `${readiness.tone}55`, color: readiness.tone, background: `${readiness.tone}12` }}>
        {readiness.label} · {readiness.score}/100
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
      <div style={{ padding: '0.9rem', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.18)' }}>
        <div style={{ color: '#fecaca', fontWeight: 800, marginBottom: '0.5rem' }}>Blocker veri</div>
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {readiness.blockers.length ? readiness.blockers.map((item, index) => (
            <div key={index} style={{ color: '#e2e8f0', fontSize: '0.84rem', lineHeight: 1.45 }}>{item}</div>
          )) : <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Nessun blocco duro individuato.</div>}
        </div>
      </div>
      <div style={{ padding: '0.9rem', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.18)' }}>
        <div style={{ color: '#fde68a', fontWeight: 800, marginBottom: '0.5rem' }}>Fattori da maturare</div>
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {readiness.watchItems.length ? readiness.watchItems.map((item, index) => (
            <div key={index} style={{ color: '#e2e8f0', fontSize: '0.84rem', lineHeight: 1.45 }}>{item}</div>
          )) : <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Non emergono segnali intermedi da maturare.</div>}
        </div>
      </div>
      <div style={{ padding: '0.9rem', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.18)' }}>
        <div style={{ color: '#bbf7d0', fontWeight: 800, marginBottom: '0.5rem' }}>Cosa è già allineato</div>
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {readiness.greenLights.length ? readiness.greenLights.map((item, index) => (
            <div key={index} style={{ color: '#e2e8f0', fontSize: '0.84rem', lineHeight: 1.45 }}>{item}</div>
          )) : <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Ancora niente di solido da evidenziare.</div>}
        </div>
      </div>
    </div>
    <div style={{ marginTop: '0.9rem', padding: '0.9rem', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '0.45rem' }}>Ultimi log sul simbolo</div>
      <div style={{ display: 'grid', gap: '0.45rem' }}>
        {readiness.recentLogs.length ? readiness.recentLogs.map((line, index) => (
          <div key={index} style={{ padding: '0.55rem 0.7rem', borderRadius: '10px', background: 'rgba(0,0,0,0.18)', border: `1px solid ${classifyTradingLog(line).border}` }}>
            <div style={{ color: classifyTradingLog(line).tone, fontSize: '0.72rem', fontWeight: 800, marginBottom: '0.18rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {classifyTradingLog(line).label}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.45 }}>{line}</div>
          </div>
        )) : (
          <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Nessun log specifico recente: il motore potrebbe essere in semplice attesa di conferme.</div>
        )}
      </div>
    </div>
  </div>
);

const CapitalPhase = () => {
  const [capital, setCapital] = useState(null);
  
  useEffect(() => {
    const fetchCap = () => authFetch('/api/capital/status').then(r => r.json()).then(setCapital).catch(e => console.error(e));
    fetchCap();
    const interval = setInterval(fetchCap, 5000);
    return () => clearInterval(interval);
  }, []);
  
  if (!capital || !capital.mode) return <div className="card col-span-12" style={{ padding: '2rem', textAlign: 'center', color: '#f59e0b' }}>Caricamento Capital Manager (o Backend Offline)...</div>;

  const modeLabelMap = {
    paper: 'Paper',
    micro_live: 'Micro Live',
    small_live: 'Small Live',
    full_live: 'Full Live',
  };

  const formatChecklistLabel = (key) => {
    const labels = {
      days: 'Track record',
      trades: 'Operazioni',
      win_rate: 'Win rate',
      profit_factor: 'Profit factor',
      drawdown: 'Drawdown',
    };
    return labels[key] || key.replace('_', ' ');
  };

  const formatChecklistProgress = (key, val) => {
    if (key === 'win_rate') {
      const wins = val.wins || 0;
      const closed = val.closed || 0;
      return `${val.current}% / ${val.required}%${closed ? ` · ${wins}/${closed} vincenti` : ''}`;
    }
    if (key === 'drawdown') {
      return `${val.current}% / ${val.required}% max`;
    }
    return `${val.current}/${val.required}`;
  };
  
  return (
    <div className="card col-span-6 capital-phase-card">
      <div className="capital-phase-header">
        <div>
          <div className="card-title">💰 Gestione Capitale</div>
          <div className="capital-phase-subtitle">Controllo progressione, rischio e maturazione del track record.</div>
        </div>
        <div className={`capital-phase-badge capital-phase-badge--${capital.can_advance ? 'ready' : 'building'}`}>
          {capital.can_advance ? 'Pronto al passaggio' : 'In costruzione'}
        </div>
      </div>

      <div className="capital-phase-hero">
        <div>
          <div className="capital-phase-label">Capitale attuale</div>
          <div className="capital-phase-value">€{Number(capital.current_capital || 0).toFixed(2)}</div>
        </div>
        <div className="capital-phase-mode-card">
          <div className="capital-phase-label">Modalità</div>
          <div className="capital-phase-mode">{modeLabelMap[capital.mode] || capital.mode.toUpperCase()}</div>
        </div>
      </div>

      <div className="capital-phase-stats">
        <div className="capital-phase-stat">
          <span>Max per trade</span>
          <strong>{capital.trade_limit_pct}%</strong>
        </div>
        <div className="capital-phase-stat">
          <span>Giorni fase</span>
          <strong>{capital.phase_days || capital.next_checklist?.days?.current || 0}</strong>
        </div>
        <div className="capital-phase-stat">
          <span>Win rate</span>
          <strong>{Number(capital.win_rate || 0).toFixed(1)}%</strong>
          <small>{capital.winning_trades || 0}/{capital.total_trades || 0} vincenti</small>
        </div>
      </div>

      <div className="capital-phase-checklist">
        <div className="capital-phase-section-title">Checklist avanzamento</div>
        {capital.next_checklist && Object.entries(capital.next_checklist).map(([key, val]) => (
          <div key={key} className={`capital-phase-check-item capital-phase-check-item--${val.ok ? 'ok' : 'pending'}`}>
            <div>
              <div className="capital-phase-check-label">{formatChecklistLabel(key)}</div>
              <div className="capital-phase-check-progress">{formatChecklistProgress(key, val)}</div>
            </div>
            <div className="capital-phase-check-icon">{val.ok ? '✓' : '•'}</div>
          </div>
        ))}
      </div>

      {capital.can_advance && (
        <button 
          onClick={() => authFetch('/api/capital/advance', {method: 'POST'})}
          className="capital-phase-advance"
        >
          🚀 Avanza fase
        </button>
      )}
    </div>
  );
};

const RuntimeHealthCard = ({ runtimeHealth = {}, isBackendOnline = true }) => {
  const statusColorMap = {
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
  };
  const runtimeStatus = runtimeHealth?.status || (isBackendOnline ? 'green' : 'red');
  const statusColor = statusColorMap[runtimeStatus] || '#64748b';
  const warnings = Array.isArray(runtimeHealth?.warnings) ? runtimeHealth.warnings : [];

  const formatAge = (seconds) => {
    if (seconds == null) return '—';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    return `${hours}h`;
  };

  return (
    <div className="card col-span-12" style={{ border: `2px solid ${statusColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <div className="card-title">🧭 Runtime Health</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Stato automatico del motore quando lo lasci correre da solo.
          </div>
        </div>
        <div className={`badge ${runtimeStatus === 'green' ? 'badge-active' : runtimeStatus === 'yellow' ? 'badge-gold' : 'badge-danger'}`} style={{ fontSize: '0.9rem', fontWeight: 800 }}>
          {(runtimeStatus || 'unknown').toUpperCase()}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
        <span style={{ width: '12px', height: '12px', borderRadius: '999px', background: statusColor, boxShadow: `0 0 12px ${statusColor}` }}></span>
        <div style={{ color: statusColor, fontSize: '1.1rem', fontWeight: 'bold' }}>
          {runtimeHealth?.summary || (isBackendOnline ? 'Backend online' : 'Backend offline')}
        </div>
      </div>
      <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
        <div className="badge badge-idle" style={{ justifyContent: 'space-between' }}>Trading runtime <strong style={{ color: 'var(--text-primary)' }}>{runtimeHealth?.is_trading_enabled ? 'ARMED' : 'PAUSED'}</strong></div>
        <div className="badge badge-idle" style={{ justifyContent: 'space-between' }}>WebSocket <strong style={{ color: 'var(--text-primary)' }}>{runtimeHealth?.websocket_connected ? 'ON' : 'OFF'}</strong></div>
        <div className="badge badge-idle" style={{ justifyContent: 'space-between' }}>Heartbeat <strong style={{ color: 'var(--text-primary)' }}>{formatAge(runtimeHealth?.heartbeat_age_sec)}</strong></div>
        <div className="badge badge-idle" style={{ justifyContent: 'space-between' }}>Ultimo feed <strong style={{ color: 'var(--text-primary)' }}>{formatAge(runtimeHealth?.last_bar_age_sec)}</strong></div>
        <div className="badge badge-idle" style={{ justifyContent: 'space-between' }}>Ultimo sync <strong style={{ color: 'var(--text-primary)' }}>{formatAge(runtimeHealth?.last_sync_age_sec)}</strong></div>
        <div className="badge badge-idle" style={{ justifyContent: 'space-between' }}>Reconnect <strong style={{ color: 'var(--text-primary)' }}>{Number(runtimeHealth?.reconnect_attempts || 0)}</strong></div>
        <div className="badge badge-idle" style={{ justifyContent: 'space-between' }}>Sync fail <strong style={{ color: 'var(--text-primary)' }}>{Number(runtimeHealth?.sync_failures || 0)}</strong></div>
      </div>
      {!!runtimeHealth?.auto_paused && (
        <div style={{ marginTop: '0.85rem', color: '#ef4444', fontWeight: 'bold' }}>
          Auto-pause attiva: {runtimeHealth?.auto_pause_reason || 'motivo non disponibile'}
        </div>
      )}
      {runtimeHealth?.last_error && (
        <div style={{ marginTop: '0.5rem', color: '#fca5a5' }}>
          Ultimo errore: {runtimeHealth.last_error}
        </div>
      )}
      {warnings.length > 0 && (
        <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.45rem' }}>
          {warnings.slice(0, 3).map((warning, index) => (
            <div key={index} style={{ color: '#fbbf24', fontSize: '0.86rem' }}>
              • {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DevelopView = ({ status, isBackendOnline, savedKeys, lastVaultSync, developSection, setDevelopSection, renderSettingsView, renderGuideView }) => {
  const opsActionPlan = deriveOpsActionPlan({ status, risk: status?.risk || {}, savedKeys, isBackendOnline });

  return (
  <div className="module-content">
    <div className="header" style={{ marginBottom: '2rem' }}>
      <h2>⚙️ Engine Room</h2>
      <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
        Cabina di controllo interna per runtime, alert, sicurezza operativa e setup dell’infrastruttura Aureo.
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.4rem' }}>
      <div style={{ padding: '0.95rem 1rem', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Runtime</div>
        <div style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 800 }}>{(status?.runtime_health?.status || 'green').toUpperCase()}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: '0.35rem' }}>{status?.runtime_health?.summary || 'Nessun riepilogo runtime disponibile.'}</div>
      </div>
      <div style={{ padding: '0.95rem 1rem', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Canali alert</div>
        <div style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 800 }}>
          {savedKeys['PUSHOVER_APP_TOKEN'] && savedKeys['PUSHOVER_USER_KEY'] ? 'Pushover OK' : 'Pushover da verificare'}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: '0.35rem' }}>
          {savedKeys['TELEGRAM_BOT_TOKEN'] && savedKeys['TELEGRAM_CHAT_ID'] ? 'Telegram armato' : 'Telegram opzionale o incompleto'}
        </div>
      </div>
      <div style={{ padding: '0.95rem 1rem', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Sezione attiva</div>
        <div style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 800 }}>
          {developSection === 'health' ? 'Health Console' : developSection === 'security' ? 'Security Vault' : 'Setup Guide'}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: '0.35rem' }}>
          Ultimo sync Vault: {lastVaultSync || 'non ancora sincronizzato'}
        </div>
      </div>
    </div>

    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
      {[
        { id: 'health', label: 'Health Console' },
        { id: 'security', label: 'Security Vault' },
        { id: 'guide', label: 'Setup Guide' },
      ].map((item) => (
        <button
          key={item.id}
          className={`tab-btn ${developSection === item.id ? 'active-tab' : ''}`}
          onClick={() => setDevelopSection(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>

    {developSection === 'health' && (
      <>
        <div className="dashboard-grid">
          <RuntimeHealthCard runtimeHealth={status.runtime_health} isBackendOnline={isBackendOnline} />
        </div>
        <OpsActionCard actions={opsActionPlan} />
        <AlertReadinessCard savedKeys={savedKeys} runtimeHealth={status.runtime_health} lastVaultSync={lastVaultSync} />
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-title">Perché è qui</div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Runtime Health è utile per controllo e debugging, ma non serve stare in primo piano durante l’uso operativo quotidiano.
            Qui concentriamo il lato infrastrutturale: heartbeat, reconnect, alert, canali di emergenza e stato dei watchdog.
          </div>
        </div>
      </>
    )}

    {developSection === 'security' && renderSettingsView()}
    {developSection === 'guide' && renderGuideView()}
  </div>
  );
};

const OnboardingModal = ({ onClose, onGoToSettings }) => {
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
          Benvenuto nel tuo Bot Personale!
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          Prima di attivare l'intelligenza artificiale e iniziare a fare trading, devi collegare i tuoi account. Non preoccuparti, i tuoi fondi restano sempre al sicuro sui tuoi exchange e noi operiamo tramite chiavi API dedicate.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Alpaca */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#fcd34d' }}>1. Trading Azionario (Alpaca)</h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Alpaca è il broker senza commissioni utilizzato per l'azionario USA. <br/>
              <span style={{opacity: 0.8, fontSize: '0.85rem'}}><strong>Guida:</strong> Registrati, conferma l'email e accedi. Clicca su "View API Keys" sulla destra della dashboard per generare la Key ID e la Secret Key.</span>
            </p>
            <a href="https://alpaca.markets" target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-block', background: '#fcd34d', color: '#000', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none'
            }}>Apri un account Alpaca ↗</a>
          </div>

          {/* Groq */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#a78bfa' }}>3. Intelligenza Artificiale (Groq)</h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Il motore AI alla base delle decisioni di trading ultrarapide.<br/>
              <span style={{opacity: 0.8, fontSize: '0.85rem'}}><strong>Guida:</strong> Accedi alla console di Groq, vai su "API Keys" nel menu a sinistra e clicca su "Create API Key". Copiala sùbito perché non potrai visualizzarla di nuovo.</span>
            </p>
            <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-block', background: '#a78bfa', color: '#000', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none'
            }}>Ottieni API Key Groq ↗</a>
          </div>
        </div>

        <button onClick={onGoToSettings} style={{
          width: '100%', padding: '1rem', marginTop: '2rem', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
        }}>
          Vai alle Impostazioni per inserire le chiavi
        </button>
      </div>
    </div>
  );
};

function OmniAppInner() {
  const [status, setStatus] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState('USDT');
  const [txid, setTxid] = useState('');
  const [showCryptoEngineDetails, setShowCryptoEngineDetails] = useState(false);
  
  const [numValueBets, setNumValueBets] = useState(9);
  const [placedBets, setPlacedBets] = useState({});
  const [apiKeys, setApiKeys] = useState({alpaca_key:'', alpaca_secret:'', elevenlabs_key:'', theodds_key:'', groq_key:'', newsapi_key:'', google_cloud_json:'', telegram_bot_token:'', telegram_chat_id:'', pushover_app_token:'', pushover_user_key:'', telegram_alerts_enabled:true, pushover_alerts_enabled:true});
  const [testResults, setTestResults] = useState({});
  const [savedKeys, setSavedKeys] = useState({});
  const [lastVaultSync, setLastVaultSync] = useState('');
  const [timeframe, setTimeframe] = useState('1D');
  const [chartData, setChartData] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [aiIdea, setAiIdea] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [billingOverview, setBillingOverview] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });
  const [billingLead, setBillingLead] = useState({ company: '', contact_name: '', email: '', plan_id: 'pro', seats: 1 });
  const [userIsPaid, setUserIsPaid] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState(true);
  const [lastStatusSync, setLastStatusSync] = useState(null);
  
  // AI Investment Hub state
  const [aiBudget, setAiBudget] = useState(500);
  const [aiProposals, setAiProposals] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [executionMessage, setExecutionMessage] = useState("");

  // High Risk Quick Scalping state
  const [tradeSize, setTradeSize] = useState(100);
  const [tradeResult, setTradeResult] = useState(null);
  const [aiModal, setAiModal] = useState(null); // null | { symbol, price, volatility, change_24h, loading, result, error }

  // Manual Stock Trading state
  const [manualSymbol, setManualSymbol] = useState("");
  const [manualAmount, setManualAmount] = useState(100);
  const [manualQuote, setManualQuote] = useState(null);
  const positionsEntries = useMemo(() => Object.entries(status.positions || {}), [status.positions]);
  const tableDataBySymbol = useMemo(
    () => Object.fromEntries((status.table_data || []).map((row) => [row.symbol, row])),
    [status.table_data]
  );
  const cryptoEngine = useMemo(() => deriveCryptoEngineState(status), [status]);
  const cryptoEngineDetails = useMemo(() => deriveCryptoEngineDetails(status), [status]);
  const cryptoSymbolStates = useMemo(() => deriveCryptoSymbolStates(status), [status]);
  const cryptoSymbolStateMap = useMemo(() => getCryptoSymbolStateMap(status), [status]);
  const tradePerformance = useMemo(() => deriveTradePerformance(status.trade_history || []), [status.trade_history]);
  const topOpportunities = useMemo(
    () => deriveTopOpportunities({ status, risk: status.risk, tableDataBySymbol }),
    [status, tableDataBySymbol]
  );
  const systemHealthSnapshot = useMemo(
    () => deriveSystemHealthSnapshot({ status, risk: status.risk, savedKeys, isBackendOnline, cryptoEngine }),
    [status, savedKeys, isBackendOnline, cryptoEngine]
  );
  const entryReadiness = useMemo(
    () => deriveEntryReadiness({ status, risk: status.risk, symbol: selectedSymbol, row: tableDataBySymbol[selectedSymbol] }),
    [status, selectedSymbol, tableDataBySymbol]
  );
  const sortedSurebets = useMemo(
    () => [...(status.active_surebets || [])].sort((a, b) => Number(b.profit_margin || 0) - Number(a.profit_margin || 0)),
    [status.active_surebets]
  );
  const visibleValueBets = useMemo(
    () => (status.value_bets || []).slice(0, numValueBets),
    [status.value_bets, numValueBets]
  );
  const aiEarnings = useMemo(
    () => (status.ai_videos || []).reduce((acc, video) => acc + (video.earnings || 0), 0),
    [status.ai_videos]
  );
  const [manualLoading, setManualLoading] = useState(false);
  const [manualMessage, setManualMessage] = useState("");

  const handleCryptoSubmit = async () => {
    if (!txid) return alert('Inserisci il TXID');
    try {
      const res = await authFetch('/api/billing/submit-txid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid, amount: 99, currency: selectedCrypto })
      });
      const data = await res.json();
      setBillingMessage(data.message);
    } catch(e) {
      setBillingMessage('Errore di rete');
    }
  };

  const renderCryptoPaywall = () => (
    <div className="module-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%', padding: '2rem' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#e2e8f0' }}>🔐 Account in attesa di sblocco</h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '600px' }}>
          Il tuo account è in modalità Demo. Per sbloccare tutte le funzionalità operative e il Live Trading, è necessario completare il pagamento.
        </p>
        
        <div className="card" style={{ maxWidth: '500px', width: '100%', textAlign: 'left', padding: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>💳</span> Effettua il Pagamento
          </h3>
          <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Seleziona la criptovaluta, invia l'importo all'indirizzo indicato e inserisci qui il Transaction ID (TXID) per la verifica manuale.
          </p>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Metodo di Pagamento</label>
            <select value={selectedCrypto} onChange={(e) => setSelectedCrypto(e.target.value)} style={{ padding: '0.8rem', width: '100%' }}>
              <option value="USDT">USDT (TRC20)</option>
              <option value="USDC">USDC (ERC20)</option>
              <option value="BTC">Bitcoin (BTC)</option>
              <option value="ETH">Ethereum (ETH)</option>
              <option value="SOL">Solana (SOL)</option>
            </select>
          </div>

          <div style={{ background: '#111', padding: '1rem', borderRadius: '8px', border: '1px solid #333', marginBottom: '1.5rem', wordBreak: 'break-all', fontSize: '0.9rem' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Indirizzo di Deposito {selectedCrypto}</div>
            <strong style={{ color: '#e2e8f0', userSelect: 'all' }}>
              {selectedCrypto === 'BTC' ? 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' : 
               selectedCrypto === 'ETH' || selectedCrypto === 'USDC' ? '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' :
               selectedCrypto === 'SOL' ? 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH' :
               'TX9bF1BWeYdG4N6N1eR6fB8B5L6M7P8Q9R'}
            </strong>
          </div>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label>Transaction ID (TXID)</label>
            <input 
              type="text" 
              placeholder="Es. f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16"
              value={txid}
              onChange={(e) => setTxid(e.target.value)}
              style={{ width: '100%', padding: '0.8rem' }}
            />
          </div>

          <button className="btn btn-start" onClick={handleCryptoSubmit} style={{ width: '100%', padding: '1rem' }}>
            Invia per Verifica
          </button>
          
          {billingMessage && (
            <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '4px', textAlign: 'center', fontSize: '0.9rem' }}>
              {billingMessage}
            </div>
          )}
        </div>
      </div>
  );

  const handleQuote = async () => {
    if (!manualSymbol) return;
    setManualLoading(true);
    setManualMessage("");
    try {
      const res = await authFetch(`/api/stock/quote/${manualSymbol}`);
      const data = await res.json();
      if (data.error) {
        setManualMessage(data.error);
        setManualQuote(null);
      } else {
        setManualQuote(data);
      }
    } catch(err) {
      setManualMessage("Errore di connessione");
    }
    setManualLoading(false);
  };

  const handleManualTrade = async (side) => {
    if (!manualSymbol || manualAmount <= 0) return;
    setManualLoading(true);
    try {
      const res = await authFetch('/api/stock/trade/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: manualSymbol, side, amount: manualAmount })
      });
      const data = await res.json();
      if (data.error) {
        setManualMessage(`Errore: ${data.error}`);
      } else {
        setManualMessage(data.message);
        if (side === 'buy') setManualQuote(null);
      }
    } catch(err) {
      setManualMessage("Errore esecuzione ordine");
    }
    setManualLoading(false);
  };

  const openAiSignal = async (asset) => {
    setAiModal({ symbol: asset.symbol, price: asset.price, volatility: asset.volatility, change_24h: asset.change_24h, loading: true, result: null, error: null });
    try {
      const res = await authFetch('/api/high-risk/ai-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: asset.symbol, price: asset.price, volatility: asset.volatility, change_24h: asset.change_24h })
      });
      const data = await res.json();
      if (data.error) {
        setAiModal(prev => ({ ...prev, loading: false, error: data.error }));
      } else {
        setAiModal(prev => ({ ...prev, loading: false, result: data }));
      }
    } catch (e) {
      setAiModal(prev => ({ ...prev, loading: false, error: 'Errore di rete: ' + e.message }));
    }
  };

  const quickTrade = async (symbol, side, amount) => {
    setTradeResult(null);
    try {
      const res = await authFetch('/api/high-risk/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, side, amount })
      });
      const data = await res.json();
      setTradeResult(data);
      // Aggiorna il saldo virtuale nel context locale
      if (!data.error && data.virtual_cash !== undefined) {
        setStatus(prev => ({ ...prev, cash: data.virtual_cash }));
      }
      // Cancella il messaggio dopo 5 secondi
      setTimeout(() => setTradeResult(null), 5000);
    } catch (e) {
      setTradeResult({ error: 'Errore di rete: ' + e.message });
    }
  };

  const checkAuthMemory = () => {
    const authTime = safeStorageGet(AUTH_TIME_KEY, '');
    const authToken = getAuthToken();
    if (!authToken) {
      clearAuthSession();
      return false;
    }
    if (authTime) {
      const elapsed = Date.now() - parseInt(authTime, 10);
      if (elapsed < 24 * 60 * 60 * 1000) {
        return true;
      }
    }
    clearAuthSession();
    return false;
  };
  const [isAuthenticated, setIsAuthenticated] = useState(checkAuthMemory());
  const [showLanding, setShowLanding] = useState(true);
  const [showLandingPlans, setShowLandingPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const TOUR_STEPS = [
    {
      targetTab: 'home',
      title: 'Benvenuto in Aureo OS',
      text: 'Questa è la Dashboard Principale, la tua Control Room. Da qui hai una visione globale del tuo portafoglio, bilanciamento in tempo reale e metriche chiave.'
    },
    {
      targetTab: 'trading',
      title: 'Trading Manuale & AI',
      text: 'Qui puoi seguire i segnali operativi guidati dall\'Intelligenza Artificiale, analizzare i grafici e impostare operazioni sia manuali che ad alta frequenza.'
    },
    {
      targetTab: 'crypto_arb',
      title: 'Arbitraggio DeFi',
      text: 'Il modulo Arbitraggio analizza centinaia di pool di liquidità decentralizzate per farti capitalizzare gli spread in millisecondi.'
    },
    {
      targetTab: 'value_bets',
      title: 'AI Sentiment & Value Bets',
      text: 'L\'AI scandaglia news, tweet e flussi di mercato per prevedere i movimenti istituzionali e suggerirti scommesse di valore altissimo.'
    },
    {
      targetTab: 'develop',
      title: 'Sicurezza Totale',
      text: 'Aureo OS è un vero e proprio caveau. Nessuna password insicura: accesso biometrico Passkey e chiavi API crittografate end-to-end.'
    }
  ];

  const startTour = () => {
    setIsTourActive(true);
    setTourStep(0);
    setShowLanding(false);
    setIsDemoMode(true);
    setIsAuthenticated(true);
    setActiveTab(TOUR_STEPS[0].targetTab);
  };

  const nextTourStep = () => {
    if (tourStep < TOUR_STEPS.length - 1) {
      const nextStep = tourStep + 1;
      setTourStep(nextStep);
      setActiveTab(TOUR_STEPS[nextStep].targetTab);
    } else {
      endTour();
    }
  };

  const prevTourStep = () => {
    if (tourStep > 0) {
      const prevStep = tourStep - 1;
      setTourStep(prevStep);
      setActiveTab(TOUR_STEPS[prevStep].targetTab);
    }
  };

  const endTour = () => {
    setIsTourActive(false);
    setIsDemoMode(false);
    setIsAuthenticated(false);
    setShowLanding(true);
  };
  const [isDemoMode, setIsDemoMode] = useState(isDemoSession());

  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [userRole, setUserRole] = useState(safeStorageGet('USER_ROLE', 'user'));
  const [userStatus, setUserStatus] = useState(safeStorageGet('USER_STATUS', 'active'));
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [developSection, setDevelopSection] = useState('health');
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState({ supported: false, configured: false, credentials_count: 0, credentials: [] });
  const [passkeyMessage, setPasskeyMessage] = useState('');
  const activeTabLabel = TAB_TITLES[activeTab] || 'AUREO';
  const openDevelopSection = (section = 'health') => {
    setDevelopSection(section);
    setActiveTab('develop');
  };
  const demoActionButtonProps = (disabled = false) => (
    isDemoMode
      ? { disabled: true, title: 'Non disponibile in demo mode' }
      : { disabled }
  );
  const demoActionStyle = isDemoMode ? { opacity: 0.5, cursor: 'not-allowed' } : {};
  const syncLabel = isBackendOnline
    ? (lastStatusSync ? `Live • ${lastStatusSync}` : 'Live')
    : 'Offline';

  useEffect(() => {
    if (!BILLING_ENABLED && activeTab === 'saas') {
      setActiveTab('home');
    }
    if (activeTab === 'develop' && userRole !== 'admin') {
      setActiveTab('home');
    }
    if (activeTab === 'saas' && userRole !== 'admin') {
      setActiveTab('home');
    }
  }, [activeTab, userRole]);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
    setPasskeySupported(supported);
  }, []);

  const enterDemoMode = () => {
    safeStorageSet(DEMO_MODE_KEY, '1');
    setIsDemoMode(true);
    setIsAuthenticated(true);
    setLoginError('');
    setPassword('');
    setActiveTab('home');
  };

  useEffect(() => {
    const handleExpired = () => {
      if (isDemoSession()) {
        return;
      }
      setIsAuthenticated(false);
      setLoginError('Sessione scaduta. Fai di nuovo login');
    };
    window.addEventListener('omni-auth-expired', handleExpired);
    return () => window.removeEventListener('omni-auth-expired', handleExpired);
  }, []);

  useEffect(() => {
    const scope = getStatusScope(activeTab);
    const pollingMs = getStatusPollingMs(activeTab);

    const fetchStatus = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await authFetch(`/api/status?scope=${scope}&t=${Date.now()}`);
        const data = await parseJsonSafely(res, null);
        if (!res.ok || !data || typeof data !== 'object') {
          throw new Error('Payload status non valido');
        }
        if (!data.error) {
          setStatus(prev => ({ ...prev, ...data }));
          setIsBackendOnline(true);
          setLastStatusSync(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
          if (data.symbols && data.symbols.length > 0) {
            setSelectedSymbol(prev => (prev && data.symbols.includes(prev) ? prev : data.symbols[0]));
          }
        }
      } catch (err) {
        setIsBackendOnline(false);
        console.error("Backend offline", err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, pollingMs);
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTab]);

  useEffect(() => {
    if (!selectedSymbol || !['trading', 'charts'].includes(activeTab)) return;
    const controller = new AbortController();
    const fetchChart = async () => {
      try {
        const safeSym = encodeURIComponent(selectedSymbol);
        const res = await fetch(`/api/chart-data/${safeSym}?timeframe=${timeframe}`, { signal: controller.signal });
        const data = await res.json();
        if (Array.isArray(data)) {
          setChartData(data);
        } else {
          setChartData([]);
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setChartData([]);
      }
    };
    fetchChart();
    return () => controller.abort();
  }, [selectedSymbol, timeframe, activeTab]);

  const completeAuthenticatedSession = (token, role = 'user', status = 'active') => {
    setIsAuthenticated(true);
    const demo = (status === 'pending');
    setIsDemoMode(demo);
    setUserRole(role);
    setUserStatus(status);
    if (demo) {
      safeStorageSet(DEMO_MODE_KEY, '1');
    } else {
      safeStorageRemove(DEMO_MODE_KEY);
    }
    safeStorageSet(AUTH_TOKEN_KEY, token);
    safeStorageSet(AUTH_TIME_KEY, Date.now().toString());
    safeStorageSet('USER_ROLE', role);
    safeStorageSet('USER_STATUS', status);
    setLoginError('');
    setPasskeyMessage('');
    setActiveTab('home');
    // Fetch payment status and check onboarding for user (non-blocking)
    setTimeout(async () => {
      try {
        const res = await authFetch('/api/user/me');
        if (res.ok) {
          const data = await parseJsonSafely(res, {});
          setUserIsPaid(data.is_paid || data.role === 'admin');
        }
        
        if (role !== 'admin' && !demo) {
          const keysRes = await authFetch('/api/keys');
          if (keysRes.ok) {
            const keysData = await parseJsonSafely(keysRes, {});
            if (!keysData.ALPACA_KEY) {
              setShowOnboarding(true);
            }
          }
        }
      } catch(e) {}
    }, 500);
  };

  const normalizeCreationOptions = (publicKey) => ({
    ...publicKey,
    challenge: base64urlToBuffer(publicKey.challenge),
    user: {
      ...publicKey.user,
      id: base64urlToBuffer(publicKey.user.id),
    },
    excludeCredentials: (publicKey.excludeCredentials || []).map((item) => ({
      ...item,
      id: base64urlToBuffer(item.id),
    })),
  });

  const normalizeRequestOptions = (publicKey) => ({
    ...publicKey,
    challenge: base64urlToBuffer(publicKey.challenge),
    allowCredentials: (publicKey.allowCredentials || []).map((item) => ({
      ...item,
      id: base64urlToBuffer(item.id),
    })),
  });

  const fetchPasskeyStatus = async () => {
    if (userRole !== 'admin') return;
    try {
      const res = await authFetch('/api/passkeys/status?t=' + Date.now());
      const data = await parseJsonSafely(res, {});
      if (res.ok) {
        setPasskeyStatus({ ...data, supported: passkeySupported });
      }
    } catch(e) {}
  };


  const openPricingSection = () => {
    setShowLandingPlans(true);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        const element = document.getElementById('landing-pricing');
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  };

  const continueWithPlan = (planId) => {
    setSelectedPlanId(planId);
    setBillingLead((prev) => ({ ...prev, plan_id: planId }));
    setLoginError('');
    setPassword('');
    setEmail('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      if (isRegistering) {
        const res = await fetch('/api/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          // Auto-login after successful registration
          const loginRes = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const loginData = await loginRes.json();
          if (loginRes.ok) {
            completeAuthenticatedSession(loginData.token, loginData.role, loginData.user_status);
            // Show paywall immediately to prompt payment
            setShowPaymentModal(true);
          } else {
            setLoginError('Registrazione ok, ma login automatico fallito. Riprova.');
          }
        } else {
          setLoginError(data.detail || 'Errore durante la registrazione');
        }
      } else {
        // Modalità Login (se email è vuoto entra come admin)
        const payload = email ? { email, password } : { password };
        const res = await fetch('/api/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          completeAuthenticatedSession(data.token, data.role || 'user', data.user_status || 'active');
        } else {
          clearAuthSession();
          setIsAuthenticated(false);
          setLoginError(data.detail || data.message || 'Accesso negato');
        }
      }
    } catch (err) {
      clearAuthSession();
      setIsAuthenticated(false);
      setLoginError('Errore di connessione al server');
    }
  };

  const handlePasskeyLogin = async () => {
    if (!passkeySupported) {
      setLoginError('Questo dispositivo non supporta il login biometrico via browser');
      return;
    }
    setPasskeyBusy(true);
    setLoginError('');
    try {
      const optionsRes = await fetch('/api/passkeys/auth/options', { method: 'POST' });
      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) {
        setLoginError(optionsData.detail || 'Biometria non disponibile');
        setPasskeyBusy(false);
        return;
      }

      const credential = await navigator.credentials.get({
        publicKey: normalizeRequestOptions(optionsData.publicKey),
      });
      if (!credential) {
        setLoginError('Accesso biometrico annullato');
        setPasskeyBusy(false);
        return;
      }

      const verifyRes = await fetch('/api/passkeys/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: optionsData.request_id,
          id: credential.id,
          raw_id: bufferToBase64url(credential.rawId),
          type: credential.type,
          response: {
            client_data_json: bufferToBase64url(credential.response.clientDataJSON),
            authenticator_data: bufferToBase64url(credential.response.authenticatorData),
            signature: bufferToBase64url(credential.response.signature),
            user_handle: credential.response.userHandle ? bufferToBase64url(credential.response.userHandle) : '',
          },
        }),
      });
      const verifyData = await verifyRes.json();
      if (verifyRes.ok && verifyData.status === 'success') {
        completeAuthenticatedSession(verifyData.token);
      } else {
        clearAuthSession();
        setIsAuthenticated(false);
        setLoginError(verifyData.detail || 'Accesso biometrico non riuscito');
      }
    } catch (err) {
      setLoginError(err?.message || 'Errore di connessione al login biometrico');
    }
    setPasskeyBusy(false);
  };

  const registerCurrentDevicePasskey = async () => {
    if (isDemoMode) {
      setPasskeyMessage('Demo mode: registrazione biometrica disabilitata');
      return;
    }
    if (!passkeySupported) {
      setPasskeyMessage('Questo dispositivo non supporta Passkeys');
      return;
    }
    setPasskeyBusy(true);
    setPasskeyMessage('');
    try {
      const optionsRes = await authFetch('/api/passkeys/register/options', { method: 'POST' });
      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) {
        setPasskeyMessage(optionsData.detail || 'Impossibile avviare la registrazione biometrica');
        setPasskeyBusy(false);
        return;
      }

      const credential = await navigator.credentials.create({
        publicKey: normalizeCreationOptions(optionsData.publicKey),
      });
      if (!credential) {
        setPasskeyMessage('Registrazione biometrica annullata');
        setPasskeyBusy(false);
        return;
      }

      const verifyRes = await authFetch('/api/passkeys/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: optionsData.request_id,
          id: credential.id,
          raw_id: bufferToBase64url(credential.rawId),
          type: credential.type,
          label: navigator.userAgent.includes('iPhone') ? 'iPhone' : navigator.platform || 'Questo dispositivo',
          response: {
            client_data_json: bufferToBase64url(credential.response.clientDataJSON),
            attestation_object: bufferToBase64url(credential.response.attestationObject),
          },
        }),
      });
      const verifyData = await verifyRes.json();
      if (verifyRes.ok) {
        setPasskeyMessage('Biometria attivata su questo dispositivo');
        setPasskeyStatus((prev) => ({
          ...prev,
          configured: true,
          credentials_count: verifyData.credentials_count || 1,
          credentials: verifyData.credential ? [...(prev.credentials || []).filter((item) => item.id !== verifyData.credential.id), verifyData.credential] : prev.credentials,
        }));
      } else {
        setPasskeyMessage(verifyData.detail || 'Registrazione biometrica non riuscita');
      }
    } catch (err) {
      setPasskeyMessage(err?.message || 'Errore durante l’attivazione biometrica');
    }
    setPasskeyBusy(false);
  };

  const handleLogout = async () => {
    try {
      await authFetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      clearAuthSession();
      window.location.href = '/';
    }
  };

  const toggleModule = async (mod_id, isActive) => {
    setStatus(prev => ({
      ...prev,
      modules: { ...(prev.modules || {}), [mod_id]: !isActive }
    }));
    try {
      await authFetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: mod_id, active: !isActive })
      });
      // Il polling da 2 secondi rileverà automaticamente il nuovo stato
    } catch (err) {
      console.error(err);
    }
  };

  const generateAiProposals = async (strategy = 'balanced') => {
    setIsAiLoading(true);
    setExecutionMessage("");
    setAiProposals([]);
    try {
      const res = await authFetch('/api/ai-invest/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget: Number(aiBudget), strategy })
      });
      const data = await res.json();
      if (data.proposals) {
        setAiProposals(data.proposals);
      } else {
        setExecutionMessage(data.detail || "Errore sconosciuto");
      }
    } catch (err) {
      console.error(err);
      setExecutionMessage("Errore di connessione al server.");
    }
    setIsAiLoading(false);
  };

  const cancelAiInvestment = async (index, symbol, platform) => {
    if(!window.confirm(`Vuoi davvero annullare l'ordine su ${symbol}?`)) return;
    try {
      const res = await authFetch('/api/ai-invest/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index, symbol, platform })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        // Forza refresh stato
        fetch('/api/status', {
          headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}
        }).then(r => r.json()).then(d => { if(!d.error) setStatus(d); });
      } else {
        alert(data.detail || 'Errore durante la cancellazione');
      }
    } catch (e) {
      alert('Errore di rete');
    }
  };

  const executeAiProposal = async (proposal) => {
    setExecutionMessage(`Esecuzione in corso per ${proposal.symbol}...`);
    try {
      const res = await authFetch('/api/ai-invest/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: proposal.symbol,
          asset_type: proposal.asset_type,
          amount_usd: Number(aiBudget)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setExecutionMessage(`✅ ${data.message}`);
        // Aggiorna lo stato del portafoglio forzando il refetch (sarà gestito dal polling)
      } else {
        setExecutionMessage(`❌ Errore: ${data.detail}`);
      }
    } catch (err) {
      console.error(err);
      setExecutionMessage("❌ Errore di rete durante l'esecuzione.");
    }
  };

  const placeBet = async (sb) => {
    if (placedBets[sb.id]) return; // già piazzata
    setPlacedBets(prev => ({ ...prev, [sb.id]: 'loading' }));
    try {
      const res = await authFetch('/api/place-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match: sb.match,
          sport: sb.sport,
          p1: sb.p1, book1: sb.book1, odds1: sb.odds1, stake1: sb.stake1,
          p2: sb.p2, book2: sb.book2, odds2: sb.odds2, stake2: sb.stake2,
          profit_margin: sb.profit_margin,
          guaranteed_return: sb.guaranteed_return,
          total_stake: 100.0
        })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setPlacedBets(prev => ({ ...prev, [sb.id]: 'placed' }));
      } else {
        setPlacedBets(prev => ({ ...prev, [sb.id]: 'error' }));
      }
    } catch {
      setPlacedBets(prev => ({ ...prev, [sb.id]: 'error' }));
    }
  };

  const handleReset = async () => {
    if (window.confirm("Sei sicuro di voler resettare la simulazione a $100.0 e cancellare la cronologia?")) {
      try {
        const res = await authFetch('/api/reset', { method: 'POST' });
        const data = await res.json();
        if (!data.error) setStatus(data.state);
      } catch (err) {
        alert("Errore di connessione al backend!");
      }
    }
  };

  // Rendering Helper per Trading
  
  
  const testConnection = async (service) => {
    setTestResults(prev => ({...prev, [service]: 'Test in corso...'}));
    try {
      const res = await authFetch('/api/test-connection', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({service, ...apiKeys})
      });
      const data = await res.json();
      setTestResults(prev => ({...prev, [service]: data.message}));
    } catch(err) {
      setTestResults(prev => ({...prev, [service]: 'Errore di rete'}));
    }
  };

  const saveKeys = async () => {
    try {
      const res = await authFetch('/api/keys', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(apiKeys)
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || 'Errore sconosciuto dal server');
      }
      alert('Chiavi salvate con successo nel Vault Sicuro!');
      // Refetch keys immediately so dots appear
      const refetchRes = await authFetch('/api/keys');
      const data = await refetchRes.json();
      setSavedKeys(data);
      setLastVaultSync(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch(err) {
      alert('Errore durante il salvataggio: ' + err.message);
    }
  };

  const persistAtrSettings = async (nextValues) => {
    try {
      const res = await authFetch('/api/keys', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(nextValues)
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || 'Errore salvataggio impostazioni ATR');
      }
      const refetchRes = await authFetch('/api/keys?t=' + Date.now());
      const data = await refetchRes.json();
      setSavedKeys(data);
      setLastVaultSync(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setApiKeys(prev => ({
        ...prev,
        dynamic_atr_stop: data.DYNAMIC_ATR_STOP ?? nextValues.dynamic_atr_stop,
        trailing_stop_base_pct: data.TRAILING_STOP_BASE_PCT ?? nextValues.trailing_stop_base_pct,
      }));
    } catch (err) {
      alert('Errore durante il salvataggio ATR: ' + err.message);
    }
  };

  
  useEffect(() => {
    if (activeTab === 'develop') {
      if (isDemoMode) {
        setSavedKeys({});
        return;
      }
      const fetchKeys = async () => {
        try {
          const res = await authFetch('/api/keys?t=' + Date.now());
          const data = await res.json();
          if (data.ERROR) {
            alert("Errore critico dal backend nel leggere le chiavi: " + data.ERROR);
          }
          setSavedKeys(data);
          setLastVaultSync(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          // PRE-POPULATE I CAMPI DI TESTO CON I PALLINI (o la stringa mascherata)
          setApiKeys(prev => ({
            ...prev,
            alpaca_key: data.ALPACA_KEY || '',
            alpaca_secret: data.ALPACA_SECRET || '',
            elevenlabs_key: data.ELEVENLABS_KEY || '',
            theodds_key: data.THEODDS_KEY || '',
            groq_key: data.GROQ_KEY || '',
            newsapi_key: data.NEWSAPI_KEY || '',
            telegram_bot_token: data.TELEGRAM_BOT_TOKEN || '',
            telegram_chat_id: data.TELEGRAM_CHAT_ID || '',
            pushover_app_token: data.PUSHOVER_APP_TOKEN || '',
            pushover_user_key: data.PUSHOVER_USER_KEY || '',
            telegram_alerts_enabled: data.TELEGRAM_ALERTS_ENABLED ?? true,
            pushover_alerts_enabled: data.PUSHOVER_ALERTS_ENABLED ?? true,
            dynamic_atr_stop: data.DYNAMIC_ATR_STOP ?? true,
            trailing_stop_base_pct: data.TRAILING_STOP_BASE_PCT ?? 2.5
          }));
        } catch(err) {
          console.error("Error fetching keys", err);
          alert("Errore di rete durante il caricamento delle chiavi dal Vault.");
        }
      };
      fetchKeys();
    }
  }, [activeTab, isDemoMode, developSection]);

  useEffect(() => {
    if (activeTab !== 'saas') return;
    if (isDemoMode) {
      setBillingOverview(DEMO_BILLING_OVERVIEW);
      return;
    }
    const fetchBilling = async () => {
      setBillingLoading(true);
      try {
        const res = await authFetch('/api/saas/overview?t=' + Date.now());
        const data = await parseJsonSafely(res, {});
        if (res.ok) {
          setBillingOverview(data);
        } else {
          setBillingMessage(data.detail || 'Errore caricamento billing');
        }
      } catch (err) {
        setBillingMessage('Errore di connessione area billing');
      }
      setBillingLoading(false);
    };
    fetchBilling();
  }, [activeTab, isDemoMode]);

  useEffect(() => {
    if (!isAuthenticated || isDemoMode || activeTab !== 'develop' || developSection !== 'security') {
      return;
    }
    fetchPasskeyStatus();
  }, [activeTab, isAuthenticated, isDemoMode, developSection]);

  useEffect(() => {
    if (isAuthenticated && !isDemoMode && userRole !== 'admin') {
      const checkOnboarding = async () => {
        try {
          const res = await authFetch('/api/keys');
          if (res.ok) {
            const data = await parseJsonSafely(res, {});
            if (!data.ALPACA_KEY) {
              setShowOnboarding(true);
            }
          }
        } catch(e) {}
      };
      checkOnboarding();
    }
  }, [isAuthenticated, isDemoMode, userRole]);

  const refreshBillingOverview = async () => {
    const res = await authFetch('/api/saas/overview?t=' + Date.now());
    const data = await parseJsonSafely(res, {});
    if (!res.ok) {
      throw new Error(data.detail || 'Errore aggiornamento billing');
    }
    setBillingOverview(data);
    return data;
  };

  const copyCheckoutLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setBillingMessage('Link checkout copiato negli appunti');
    } catch {
      setBillingMessage('Copia non riuscita, copia il link manualmente');
    }
  };

  const createBillingLead = async () => {
    if (isDemoMode) {
      setBillingMessage('Demo mode: creazione lead disabilitata');
      return;
    }
    setBillingMessage('');
    setBillingLoading(true);
    try {
      const res = await authFetch('/api/saas/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billingLead),
      });
      const data = await res.json();
      if (res.ok) {
        setBillingOverview(data.overview);
        setBillingLead({ company: '', contact_name: '', email: '', plan_id: billingLead.plan_id, seats: 1 });
        setBillingMessage('Lead creato con successo');
      } else {
        setBillingMessage(data.detail || 'Errore creazione lead');
      }
    } catch {
      setBillingMessage('Errore di rete durante la creazione del lead');
    }
    setBillingLoading(false);
  };

  const updateBillingStatus = async (recordId, statusValue) => {
    if (isDemoMode) {
      setBillingMessage('Demo mode: aggiornamento stato disabilitato');
      return;
    }
    setBillingLoading(true);
    try {
      const res = await authFetch(`/api/saas/customer/${recordId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setBillingOverview(data.overview);
        setBillingMessage(`Stato aggiornato a ${statusValue.toUpperCase()}`);
      } else {
        setBillingMessage(data.detail || 'Errore aggiornamento stato');
      }
    } catch {
      setBillingMessage('Errore di rete durante l’aggiornamento');
    }
    setBillingLoading(false);
  };

  const extendUserSubscription = async (userId, months) => {
    if (isDemoMode) {
      setBillingMessage('Demo mode: rinnovo disabilitato');
      return;
    }
    setBillingLoading(true);
    try {
      const res = await authFetch('/api/saas/extend-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, months }),
      });
      const data = await res.json();
      if (res.ok) {
        await refreshBillingOverview();
        setBillingMessage(data.message || 'Abbonamento aggiornato');
      } else {
        setBillingMessage(data.detail || 'Errore rinnovo abbonamento');
      }
    } catch {
      setBillingMessage('Errore di rete durante il rinnovo');
    }
    setBillingLoading(false);
  };

  const renderGuideView = () => {
    const platforms = [
      {
        id: 'alpaca',
        name: 'Alpaca',
        subtitle: 'Stock Trading USA (Paper & Live)',
        icon: '🦙',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.08)',
        border: 'rgba(245, 158, 11, 0.25)',
        url: 'https://alpaca.markets',
        keyPresent: savedKeys['ALPACA_KEY'],
        steps: [
          { n: 1, text: 'Vai su alpaca.markets e clicca "Create Account"' },
          { n: 2, text: 'Scegli Paper Trading (gratuito, nessun rischio reale)' },
          { n: 3, text: 'Nella dashboard, clicca "API Keys" in alto a destra' },
          { n: 4, text: 'Genera nuova API Key → copia "API Key ID" e "Secret Key"' },
          { n: 5, text: 'Torna su Aureo OS → Security → incolla in "Alpaca"' },
        ],
        note: 'Il Paper Trading è completamente gratuito e simula operazioni reali senza rischi.',
      },
      {
        id: 'groq',
        name: 'Groq AI',
        subtitle: 'Analisi AI & Sentiment (Gratuito)',
        icon: '🤖',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.08)',
        border: 'rgba(16, 185, 129, 0.25)',
        url: 'https://console.groq.com',
        keyPresent: savedKeys['GROQ_KEY'],
        steps: [
          { n: 1, text: 'Vai su console.groq.com → Sign Up (gratuito)' },
          { n: 2, text: 'Nella dashboard, clicca "API Keys" nel menu a sinistra' },
          { n: 3, text: 'Clicca "Create API Key" → dai un nome (es. "aureo")' },
          { n: 4, text: 'Copia la chiave generata (mostrata una sola volta)' },
          { n: 5, text: 'Torna su Aureo OS → Security → incolla in "Groq"' },
        ],
        note: 'Groq è completamente gratuito e alimenta le analisi AI Sentiment e le proposte di investimento.',
      },
    ];

    return (
      <div className="module-content">
        <div className="header" style={{ marginBottom: '2rem' }}>
          <h2>📖 Guida Setup – Come Configurare Aureo OS</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.6 }}>
            Segui questi passaggi per connettere i tuoi account ai mercati reali. Puoi configurare solo le piattaforme che vuoi usare.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.5rem' }}>
          {platforms.map(platform => (
            <div key={platform.id} className="card" style={{ border: `1px solid ${platform.border}`, background: platform.bg, padding: '1.5rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '2rem' }}>{platform.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#e2e8f0' }}>{platform.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{platform.subtitle}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  {platform.keyPresent
                    ? <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981', borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 600 }}>✓ API Configurata</span>
                    : <span style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid #f87171', borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}>✗ Non configurata</span>
                  }
                  <a href={platform.url} target="_blank" rel="noopener noreferrer" style={{ color: platform.color, fontSize: '0.8rem', textDecoration: 'none' }}>
                    🔗 Vai al sito →
                  </a>
                </div>
              </div>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                {platform.steps.map(step => (
                  <div key={step.n} style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
                    <span style={{ minWidth: '24px', height: '24px', borderRadius: '50%', background: platform.color, color: '#000', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                      {step.n}
                    </span>
                    <span style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5 }}>{step.text}</span>
                  </div>
                ))}
              </div>

              {/* Note */}
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1rem' }}>
                💡 {platform.note}
              </div>

              {/* CTA */}
              <button
                className="btn btn-outline"
                onClick={() => openDevelopSection('security')}
                style={{ width: '100%', padding: '0.6rem', fontSize: '0.9rem', borderColor: platform.color, color: platform.color }}
              >
                🔐 Vai a Security per inserire la chiave →
              </button>
            </div>
          ))}
        </div>

        {/* Bottom tip */}
        <div className="card" style={{ marginTop: '2rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', padding: '1.5rem' }}>
          <h3 style={{ color: '#10b981', marginBottom: '0.8rem' }}>✅ Ordine consigliato per iniziare</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            {[
              { n: 1, icon: '🤖', name: 'Groq AI', desc: 'Prima cosa — gratuito e immediato' },
              { n: 2, icon: '🦙', name: 'Alpaca', desc: 'Paper trading gratuito — zero rischi' },
            ].map(item => (
              <div key={item.n} style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>{item.icon}</div>
                <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>Step {item.n}: {item.name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.3rem' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSettingsView = () => (
    <div className="module-content">
      <div className="header" style={{ marginBottom: '2rem' }}>
        <h2>🔐 Security & API Vault</h2>
        <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Gestione chiavi crittografate per le connessioni ai mercati reali.</div>
      </div>

      {isDemoMode && (
        <div className="card demo-mode-card" style={{ marginBottom: '2rem' }}>
          <div className="card-title">Demo Mode</div>
          <div style={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: '0.6rem' }}>Vault in sola lettura</div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            In demo puoi esplorare dashboard e moduli, ma test connessioni, chiavi API e azioni live restano bloccate.
          </div>
        </div>
      )}

      {userRole === 'admin' && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, color: '#e2e8f0' }}>Accesso biometrico</h3>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.45rem', lineHeight: 1.5 }}>
                Attiva Face ID, Touch ID o biometria del dispositivo come accesso rapido, mantenendo la password come backup.
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{ color: passkeyStatus?.configured ? '#10b981' : 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                {passkeyStatus?.configured ? `✓ Attivo (${passkeyStatus.credentials_count} credenziali)` : 'Disattivato'}
              </span>
              <button className="btn btn-outline" onClick={registerCurrentDevicePasskey} disabled={!passkeySupported || passkeyBusy || isDemoMode}>
                {passkeyBusy ? 'Configurazione...' : 'Aggiungi dispositivo'}
              </button>
            </div>
          </div>
          {passkeyMessage && (
            <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '4px', fontSize: '0.9rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              {passkeyMessage}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>Alpaca (Stock & Options) {savedKeys['ALPACA_KEY'] ? <span style={{ color: '#10b981', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span>Presente</span> : <span style={{ color: '#ef4444', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>Assente</span>}</h3>
          <button onClick={() => testConnection('alpaca')} className="btn" {...demoActionButtonProps()} style={{ padding: '0.5rem 1rem', ...demoActionStyle }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="API Key" value={apiKeys.alpaca_key} onChange={e => setApiKeys({...apiKeys, alpaca_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          <input type="password" placeholder="Secret Key" value={apiKeys.alpaca_secret} onChange={e => setApiKeys({...apiKeys, alpaca_secret: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['alpaca'] && <div style={{ color: testResults['alpaca'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['alpaca']}</div>}
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>
            Telegram Alerts
            {savedKeys['TELEGRAM_BOT_TOKEN'] && savedKeys['TELEGRAM_CHAT_ID']
              ? <span style={{ color: '#10b981', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span>Presente</span>
              : <span style={{ color: '#ef4444', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>Assente</span>}
          </h3>
          <button onClick={() => testConnection('telegram')} className="btn" {...demoActionButtonProps()} style={{ padding: '0.5rem 1rem', ...demoActionStyle }}>Test Telegram</button>
        </div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
          Utile come canale secondario per alert critici e messaggi operativi. Inserisci token del bot e chat id personale.
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#cbd5e1', fontSize: '0.92rem', fontWeight: 600 }}>Invio Telegram</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              Attiva o sospendi gli alert Telegram senza rimuovere token e chat id.
            </div>
          </div>
          <ToggleSwitch
            checked={!!apiKeys.telegram_alerts_enabled}
            onChange={() => setApiKeys({ ...apiKeys, telegram_alerts_enabled: !apiKeys.telegram_alerts_enabled })}
            disabled={isDemoMode}
            labelOn="ON"
            labelOff="OFF"
            title="Attiva o disattiva Telegram"
          />
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input type="password" placeholder="Telegram Bot Token" value={apiKeys.telegram_bot_token} onChange={e => setApiKeys({...apiKeys, telegram_bot_token: e.target.value})} style={{ flex: 1, minWidth: '240px', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          <input type="password" placeholder="Telegram Chat ID" value={apiKeys.telegram_chat_id} onChange={e => setApiKeys({...apiKeys, telegram_chat_id: e.target.value})} style={{ flex: 1, minWidth: '240px', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.86rem', lineHeight: 1.5 }}>
          Dopo aver scritto al bot su Telegram, recupera il tuo chat id da `getUpdates` e incollalo qui.
        </div>
        {testResults['telegram'] && <div style={{ color: testResults['telegram'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['telegram']}</div>}
      </div>

      <div className="card" style={{ marginBottom: '2rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <h3 style={{ margin: 0, color: '#ef4444', marginBottom: '1.5rem', display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: '0.5rem' }}>🛡️</span> Risk Management
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', marginBottom: '0.35rem', fontSize: '0.9rem' }}>Trailing Stop Dinamico (ATR)</label>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                  Regola il trailing stop automaticamente in base alla volatilità del momento.
                </div>
              </div>
              <div className={`badge ${apiKeys.dynamic_atr_stop ? 'badge-active' : 'badge-idle'}`} style={{ fontSize: '0.82rem' }}>
                {apiKeys.dynamic_atr_stop ? 'ACCESO' : 'SPENTO'}
              </div>
            </div>
            <ToggleSwitch
              checked={!!apiKeys.dynamic_atr_stop}
              onChange={() => {
                const nextValues = { ...apiKeys, dynamic_atr_stop: !apiKeys.dynamic_atr_stop };
                setApiKeys(nextValues);
                persistAtrSettings(nextValues);
              }}
              title="Attiva o disattiva il trailing stop dinamico"
            />
            <div style={{ marginTop: '0.75rem', color: apiKeys.dynamic_atr_stop ? '#10b981' : '#94a3b8', fontWeight: 700, letterSpacing: '0.04em' }}>
              {apiKeys.dynamic_atr_stop ? 'PROTEZIONE DINAMICA ATTIVA' : 'PROTEZIONE DINAMICA DISATTIVA'}
            </div>
          </div>
          
          <div style={{ opacity: apiKeys.dynamic_atr_stop ? 0.5 : 1.0, pointerEvents: apiKeys.dynamic_atr_stop ? 'none' : 'auto' }}>
            <label style={{ display: 'block', color: '#cbd5e1', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Trailing Stop Fisso: {apiKeys.trailing_stop_base_pct}%
            </label>
            <input 
              type="range" 
              min="0.5" 
              max="5.0" 
              step="0.1" 
              value={apiKeys.trailing_stop_base_pct || 2.5} 
              onChange={e => setApiKeys({...apiKeys, trailing_stop_base_pct: parseFloat(e.target.value)})}
              onMouseUp={() => persistAtrSettings(apiKeys)}
              onTouchEnd={() => persistAtrSettings(apiKeys)}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#ef4444' }} 
            />
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>Se il dinamico è spento, usa questa percentuale fissa per proteggere i profitti.</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>Groq AI (Sentiment & Investments) {savedKeys['GROQ_KEY'] ? <span style={{ color: '#10b981', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span>Presente</span> : <span style={{ color: '#ef4444', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>Assente</span>}</h3>
          <button onClick={() => testConnection('groq')} className="btn" {...demoActionButtonProps()} style={{ padding: '0.5rem 1rem', ...demoActionStyle }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="Groq API Key" value={apiKeys.groq_key} onChange={e => setApiKeys({...apiKeys, groq_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['groq'] && <div style={{ color: testResults['groq'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['groq']}</div>}
      </div>

      <div className="card" style={{ marginBottom: '2rem', border: '1px solid rgba(16, 185, 129, 0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>
            Pushover (iPhone / Apple Watch)
            {savedKeys['PUSHOVER_APP_TOKEN'] && savedKeys['PUSHOVER_USER_KEY']
              ? <span style={{ color: '#10b981', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span>Presente</span>
              : <span style={{ color: '#ef4444', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>Assente</span>}
          </h3>
          <button onClick={() => testConnection('pushover')} className="btn" {...demoActionButtonProps()} style={{ padding: '0.5rem 1rem', ...demoActionStyle }}>Test Pushover</button>
        </div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
          Per alert critici al polso. Il server invia a Pushover, l’iPhone la riceve e Apple Watch la mostra subito.
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#cbd5e1', fontSize: '0.92rem', fontWeight: 600 }}>Invio Pushover</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              Attiva o sospendi le push critiche mantenendo le chiavi nel Vault.
            </div>
          </div>
          <ToggleSwitch
            checked={!!apiKeys.pushover_alerts_enabled}
            onChange={() => setApiKeys({ ...apiKeys, pushover_alerts_enabled: !apiKeys.pushover_alerts_enabled })}
            disabled={isDemoMode}
            labelOn="ON"
            labelOff="OFF"
            title="Attiva o disattiva Pushover"
          />
        </div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Eventi inviati: auto-pause del bot, circuit breaker, chiusura forzata d’emergenza, disattivazione manuale del Risk Management.
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input type="password" placeholder="Pushover App Token" value={apiKeys.pushover_app_token} onChange={e => setApiKeys({...apiKeys, pushover_app_token: e.target.value})} style={{ flex: 1, minWidth: '240px', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          <input type="password" placeholder="Pushover User Key" value={apiKeys.pushover_user_key} onChange={e => setApiKeys({...apiKeys, pushover_user_key: e.target.value})} style={{ flex: 1, minWidth: '240px', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['pushover'] && <div style={{ color: testResults['pushover'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['pushover']}</div>}
      </div>

      <div style={{ textAlign: 'right' }}>
        <button onClick={saveKeys} className="btn btn-start" {...demoActionButtonProps()} style={{ padding: '1rem 3rem', fontSize: '1.1rem', ...demoActionStyle }}>Salva nel Vault Sicuro</button>
      </div>
    </div>
  );

  const renderHomeView = () => {
    const initialCash = status.initial_cash || 1000;
    const virtualCash = Number(status.portfolio_value || 1000);
    const tradingProfit = virtualCash - initialCash;
    const totalWorth = virtualCash + aiEarnings;
    
    const pieData = [
      { name: 'Liquidità', value: virtualCash, color: 'var(--text-secondary)' },
      { name: 'Azioni (Trading)', value: Math.abs(tradingProfit) || 100, color: '#38bdf8' }
    ].filter(item => item.value > 0);

    return (
      <div className="module-content module-content--home">
        <div className="header module-page-header" style={{ marginBottom: '2rem' }}>
          <h2>Dashboard 📊</h2>
          <div className="page-subtitle" style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Dashboard Aggregata delle Rendite Passive</div>
        </div>

        {status.alpaca_connected === false && (
          <div className="onboarding-banner" style={{ background: 'linear-gradient(90deg, #ef4444, #b91c1c)', color: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>⚠️ Broker non collegato</h3>
              <p style={{ margin: 0, opacity: 0.9 }}>Per operare sui mercati finanziari, devi prima inserire le tue chiavi API di Alpaca.</p>
            </div>
            <button onClick={() => openDevelopSection('security')} className="btn" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>Collega ora ➔</button>
          </div>
        )}

        {/* Big Number */}
        <div className="hero-summary" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(0,0,0,0) 100%)', padding: '3rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center', marginBottom: '2rem' }}>
          <div className="hero-summary-label" style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '1rem' }}>Net Worth Totale Stimato</div>
          <div className="hero-summary-value" style={{ fontSize: '4.5rem', fontWeight: 'bold', color: '#10b981', textShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}>
            ${totalWorth.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </div>
        </div>

        <div className="dashboard-grid">
          {/* Pie Chart Asset Allocation */}
          <div className="card col-span-6">
            <h3 className="card-title">Asset Allocation</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} formatter={(value) => `$${Number(value).toFixed(2)}`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Strategy Board */}
          <div className="card col-span-6">
            <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>🏆 Strategy Board</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🥇</span>
                  <div>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>Algo-Trading</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Trading Quantitativo AI</div>
                  </div>
                </div>
                <div style={{ fontWeight: 'bold', color: tradingProfit >= 0 ? '#10b981' : '#ef4444' }}>
                  {tradingProfit >= 0 ? '+' : ''}${tradingProfit.toFixed(2)}
                </div>
              </div>



              {/* Removed Arbitrage */}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTradingView = () => (
    <div className="module-content module-content--trading">
      {(() => {
        const tradingLogs = Array.isArray(status.logs) ? status.logs : [];
        const logSummary = tradingLogs.reduce((acc, line) => {
          const meta = classifyTradingLog(line);
          acc[meta.category] = (acc[meta.category] || 0) + 1;
          return acc;
        }, {});
        const summaryCards = [
          { key: 'setup', label: 'Setup trovati', value: logSummary.setup || 0, tone: '#22c55e' },
          { key: 'skip', label: 'Setup scartati', value: logSummary.skip || 0, tone: '#f59e0b' },
          { key: 'execution', label: 'Ordini / esecuzioni', value: logSummary.execution || 0, tone: '#10b981' },
          { key: 'exit', label: 'Exit / gestione', value: logSummary.exit || 0, tone: '#38bdf8' },
          { key: 'critical', label: 'Criticità', value: logSummary.critical || 0, tone: '#ef4444' },
        ];
        return (
          <div className="card" style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.025)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div className="card-title">🧾 Trading Timeline</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Lettura rapida di cosa il motore sta trovando, scartando, eseguendo o chiudendo.
                </div>
              </div>
            </div>
            <div style={{ marginTop: '0.9rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
              {summaryCards.map((item) => (
                <div key={item.key} style={{ padding: '0.8rem 0.9rem', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: `1px solid ${item.tone}33` }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>{item.label}</div>
                  <div style={{ color: item.tone, fontSize: '1.35rem', fontWeight: 800 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      <div className="header module-page-header trading-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Trading Command</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: status.market_open ? '#10b981' : '#f59e0b' }}></div>
              Mercato {status.market_open ? 'aperto' : 'chiuso'}
            </span>
            {status.alpaca_info && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid var(--border)', paddingLeft: '1rem' }}>
                <span style={{ 
                  padding: '2px 8px', 
                  borderRadius: '4px', 
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  background: status.alpaca_info.type === 'LIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                  color: status.alpaca_info.type === 'LIVE' ? '#10b981' : '#8b5cf6' 
                }}>
                  {status.alpaca_info.type}
                </span>
                <span>{status.alpaca_info.account_number} ({status.alpaca_info.status})</span>
              </span>
            )}
          </div>
        </div>
        <div className="trading-header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              className={`btn ${status.modules?.trading ? 'btn-stop' : 'btn-start'}`}
              onClick={() => toggleModule('trading', status.modules?.trading)}
              {...demoActionButtonProps()}
              style={demoActionStyle}
            >
              {status.modules?.trading ? 'FERMA SCANNER' : 'AVVIA SCANNER AUTOMATICO'}
            </button>
            <button className="btn btn-stop" style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', ...demoActionStyle }} onClick={handleReset} {...demoActionButtonProps()}>
              RESET SIMULAZIONE
            </button>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
        <EnginePulseCard status={status} risk={status.risk} cryptoEngine={cryptoEngine} />
      </div>

      <div className="dashboard-grid" style={{ marginTop: '1rem' }}>
        <SystemHealthCard snapshot={systemHealthSnapshot} />
        <EntryReadinessCard readiness={entryReadiness} symbol={selectedSymbol} />
      </div>

      <div className="card" style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.025)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div className="card-title">🚀 Top Opportunities</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              I simboli più vicini a un ingresso pulito in questo momento.
            </div>
          </div>
        </div>
        <div style={{ marginTop: '0.9rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
          {topOpportunities.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => setSelectedSymbol(item.symbol)}
              style={{
                textAlign: 'left',
                padding: '0.95rem',
                borderRadius: '14px',
                border: `1px solid ${item.headline.border}`,
                background: item.headline.bg,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.45rem' }}>
                <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '1rem' }}>{item.symbol}</div>
                <div style={{ color: item.headline.tone, fontWeight: 800, fontSize: '0.82rem' }}>
                  {item.headline.label} · {item.readiness.score}
                </div>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.45, marginBottom: '0.55rem' }}>
                {item.headline.detail}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                <span>Sentiment: {item.sentiment}</span>
                <span>{item.rankingScore >= 0 ? `Score ${item.rankingScore.toFixed(3)}` : 'Score n/d'}</span>
              </div>
              {!!item.selectionReason && (
                <div style={{ marginTop: '0.45rem', color: '#94a3b8', fontSize: '0.76rem', lineHeight: 1.4 }}>
                  {item.selectionReason}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedSymbol && (
        <div
          className="card"
          style={{
            marginTop: '1rem',
            border: `1px solid ${deriveEntryHeadline(entryReadiness).border}`,
            background: deriveEntryHeadline(entryReadiness).bg,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div className="card-title">🎯 Focus su {selectedSymbol}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Sintesi rapida di cosa sta trattenendo o favorendo il prossimo ingresso.
              </div>
            </div>
            <div
              className="badge"
              style={{
                color: deriveEntryHeadline(entryReadiness).tone,
                borderColor: deriveEntryHeadline(entryReadiness).border,
                background: 'rgba(0,0,0,0.18)',
              }}
            >
              {deriveEntryHeadline(entryReadiness).label} · {entryReadiness.score}/100
            </div>
          </div>
          <div style={{ marginTop: '0.9rem', color: '#e2e8f0', fontSize: '0.95rem', lineHeight: 1.5 }}>
            {deriveEntryHeadline(entryReadiness).detail}
          </div>
        </div>
      )}

      {cryptoEngine.level !== 'hidden' && (
        <div
          className="card trading-crypto-engine-card"
          style={{
            marginTop: '1.35rem',
            marginBottom: '1rem',
            border: `1px solid ${cryptoEngine.border}`,
            background: cryptoEngine.background,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
            alignItems: 'stretch',
          }}
        >
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: cryptoEngine.tone, boxShadow: `0 0 18px ${cryptoEngine.tone}` }}></span>
                <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.05rem' }}>Crypto Engine</h3>
              </div>
              <span
                style={{
                  padding: '0.3rem 0.7rem',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: cryptoEngine.tone,
                  background: 'rgba(0,0,0,0.18)',
                  border: `1px solid ${cryptoEngine.border}`,
                }}
              >
                {cryptoEngine.badge}
              </span>
              <button
                onClick={() => setShowCryptoEngineDetails((prev) => !prev)}
                style={{
                  marginLeft: 'auto',
                  background: 'rgba(0,0,0,0.18)',
                  border: `1px solid ${cryptoEngine.border}`,
                  color: 'var(--text-muted)',
                  borderRadius: '999px',
                  padding: '0.35rem 0.7rem',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                {showCryptoEngineDetails ? 'Nascondi dettagli ↑' : 'Mostra dettagli ↓'}
              </button>
            </div>
            <div style={{ color: '#f8fafc', fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              {cryptoEngine.title}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5 }}>
              {cryptoEngine.subtitle}
            </div>
            {cryptoSymbolStates.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', marginTop: '0.9rem' }}>
                {cryptoSymbolStates.map((item) => (
                  <div
                    key={item.symbol}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '999px',
                      border: `1px solid ${item.border}`,
                      background: item.bg,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.tone }}></span>
                    <span style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 700 }}>{item.symbol}</span>
                    <span style={{ color: item.tone, fontSize: '0.75rem', fontWeight: 700 }}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '0.85rem',
            }}
          >
            <div style={{ padding: '0.9rem', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Watchlist</div>
              <div style={{ color: '#f8fafc', fontSize: '1.35rem', fontWeight: 800 }}>{cryptoEngine.monitoredCount}</div>
            </div>
            <div style={{ padding: '0.9rem', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Posizioni aperte</div>
              <div style={{ color: cryptoEngine.activeCount > 0 ? '#10b981' : '#e2e8f0', fontSize: '1.35rem', fontWeight: 800 }}>{cryptoEngine.activeCount}</div>
            </div>
            <div style={{ gridColumn: '1 / -1', padding: '0.9rem', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Ultimo segnale</div>
              <div style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.45 }}>
                {cryptoEngine.lastEvent}
              </div>
            </div>
          </div>
          {showCryptoEngineDetails && (
            <div
              style={{
                gridColumn: '1 / -1',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '0.9rem',
                marginTop: '0.15rem',
              }}
            >
              <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '0.65rem' }}>Perché adesso non entra</div>
                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  {cryptoEngineDetails.reasons.map((reason, index) => (
                    <div key={index} style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.45, display: 'flex', gap: '0.55rem' }}>
                      <span style={{ color: cryptoEngine.tone, fontWeight: 700 }}>•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '0.65rem' }}>Ultimi segnali crypto</div>
                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  {cryptoEngineDetails.recentLogs.length > 0 ? cryptoEngineDetails.recentLogs.map((line, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '0.55rem 0.7rem',
                        borderRadius: '10px',
                        border: `1px solid ${classifyCryptoLog(line).border}`,
                        background: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.22rem', flexWrap: 'wrap' }}>
                        <span style={{ color: classifyCryptoLog(line).tone, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {classifyCryptoLog(line).label}
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.45 }}>
                        {line}
                      </div>
                    </div>
                  )) : (
                    <div style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.45 }}>
                      Nessun segnale crypto recente: motore attivo, in attesa di setup validi o di nuovi cicli di analisi.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* MANUAL TRADING TERMINAL */}
      <div className="card trading-manual-card" style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🎯</span> Stock Execution Console
        </h3>
        <div className="trading-manual-row" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Ticker (es. AAPL)"
            value={manualSymbol} 
            onChange={(e) => setManualSymbol(e.target.value.toUpperCase())} 
            className="trading-manual-input"
            style={{ width: '150px', padding: '0.8rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#fff', fontSize: '1.1rem' }} 
          />
          <button className="btn" onClick={handleQuote} {...demoActionButtonProps(manualLoading || !manualSymbol)} style={{ padding: '0.8rem 1.5rem', background: 'rgba(255,255,255,0.1)', ...demoActionStyle }}>
            {manualLoading ? '⏳' : 'Cerca Prezzo'}
          </button>
          
          {manualQuote && (
            <div className="trading-quote-box" style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem' }}>${manualQuote.price.toFixed(2)}</span>
              
              <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.2)' }}></div>
              
              <span style={{ color: 'var(--text-secondary)' }}>Ticket ($)</span>
              <input 
                type="number" 
                value={manualAmount} 
                onChange={(e) => setManualAmount(Number(e.target.value))} 
                className="trading-amount-input"
                style={{ width: '100px', padding: '0.6rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#fff' }} 
              />
              <button className="btn btn-start" onClick={() => handleManualTrade('buy')} {...demoActionButtonProps(manualLoading || manualAmount <= 0)} style={{ padding: '0.6rem 1.5rem', ...demoActionStyle }}>
                COMPRA
              </button>
              <button className="btn btn-stop" onClick={() => handleManualTrade('sell')} {...demoActionButtonProps(manualLoading)} style={{ padding: '0.6rem 1.5rem', ...demoActionStyle }}>
                VENDI
              </button>
            </div>
          )}
        </div>
        {manualMessage && (
          <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', color: manualMessage.includes('Errore') ? '#ef4444' : '#10b981' }}>
            {manualMessage}
          </div>
        )}
      </div>

      {/* AI INVESTMENT HUB */}
      <div className="card trading-ai-card" style={{ marginTop: '2rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(56, 189, 248, 0.1) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
        <div className="trading-ai-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 className="trading-ai-title" style={{ margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🧠</span> AI Guided Investment (One-Click)
            </h3>
            <div className="trading-ai-subtitle" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Lascia che il nostro modello quantitativo scelga le opportunità migliori per il tuo budget.</div>
          </div>
          <div className="trading-ai-controls" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span className="trading-ai-budget-label" style={{ color: 'var(--text-secondary)' }}>Budget ($)</span>
            <input 
              type="number" 
              value={aiBudget} 
              onChange={(e) => setAiBudget(e.target.value)} 
              className="trading-ai-budget-input"
              style={{ width: '120px', padding: '0.8rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#fff', fontSize: '1.1rem' }} 
            />
            <button className="btn btn-start trading-ai-action" onClick={() => generateAiProposals('balanced')} {...demoActionButtonProps(isAiLoading)} style={{ padding: '0.8rem 1.5rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid #38bdf8', ...demoActionStyle }}>
              {isAiLoading ? 'Analisi...' : 'Bilanciate'}
            </button>
            <button className="btn btn-start trading-ai-action" onClick={() => generateAiProposals('momentum')} {...demoActionButtonProps(isAiLoading)} style={{ padding: '0.8rem 1.5rem', background: '#10b981', color: '#000', border: '1px solid #10b981', ...demoActionStyle }}>
              {isAiLoading ? 'Analisi...' : 'Trend / Momentum'}
            </button>
          </div>
        </div>

        {executionMessage && (
          <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', marginBottom: '1.5rem', color: executionMessage.includes('Errore') ? '#ef4444' : '#10b981', textAlign: 'center' }}>
            {executionMessage}
          </div>
        )}

        {aiProposals.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {aiProposals.map(prop => (
              <div key={prop.id} style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ background: prop.risk === 'Conservativo' ? 'rgba(16, 185, 129, 0.2)' : prop.risk === 'Bilanciato' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: prop.risk === 'Conservativo' ? '#10b981' : prop.risk === 'Bilanciato' ? '#38bdf8' : '#f59e0b', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    {prop.risk}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>{prop.asset_type}</span>
                </div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: '#e2e8f0' }}>{prop.title}</h4>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '1rem' }}>{prop.symbol}</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4', flex: 1 }}>{prop.rationale}</p>
                <button className="btn" onClick={() => executeAiProposal(prop)} {...demoActionButtonProps()} style={{ marginTop: '1rem', width: '100%', background: 'transparent', border: '1px solid #10b981', color: '#10b981', ...demoActionStyle }}>
                  Investi ${aiBudget} su {prop.symbol}
                </button>
              </div>
            ))}
          </div>
        )}

        {status.ai_investments && status.ai_investments.length > 0 && (
          <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
            <h4 style={{ color: '#e2e8f0', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <span>📊</span> Registro Investimenti AI Piazzati
            </h4>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)' }}>
              <table className="data-table" style={{ width: '100%', minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: '1rem' }}>Asset</th>
                    <th>Simbolo</th>
                    <th>Importo ($)</th>
                    <th>Piattaforma</th>
                    <th>Orario</th>
                    <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {status.ai_investments.map((inv, idx) => (
                    <tr key={idx} className="data-row" style={{ padding: '0' }}>
                      <td style={{ padding: '1rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{inv.asset_type}</td>
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: '#38bdf8' }}>{inv.symbol}</td>
                      <td style={{ padding: '1rem', color: '#10b981', fontWeight: 'bold' }}>${Number(inv.amount_usd).toFixed(2)}</td>
                      <td style={{ padding: '1rem', color: '#e2e8f0' }}>{inv.platform}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{inv.timestamp}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <button 
                          className="btn btn-outline" 
                          onClick={() => cancelAiInvestment(idx, inv.symbol, inv.platform)}
                          style={{ borderColor: '#ef4444', color: '#ef4444', padding: '0.4rem 0.8rem', fontSize: '0.8rem', minHeight: '0' }}
                        >
                          Annulla Ordine
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-grid" style={{ marginTop: "2rem" }}>
        <div className="card col-span-4">
          <div className="card-title">Equity Snapshot</div>
          <div className="portfolio-value">${Number(status.portfolio_value || 0).toFixed(2)}</div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Capital Deployed</div>
          <div className="portfolio-value">
            ${(Object.values(status.positions || {}).reduce((sum, p) => sum + (p !== "LIQUID" ? Math.abs(p.market_value || 0) : 0), 0)).toFixed(2)}
          </div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Free Cash</div>
          <div className="portfolio-value" style={{ color: '#10b981' }}>${Number(status.cash || 0).toFixed(2)}</div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Live P&L</div>
          <div className="portfolio-value" style={{ color: Number(status.profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
            {Number(status.profit || 0) >= 0 ? '+' : ''}{Number(status.profit || 0).toFixed(2)}
          </div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Strike Rate</div>
          <div className="portfolio-value" style={{ color: '#f59e0b' }}>{Number(status.win_rate || 0).toFixed(1)}%</div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Edge Factor</div>
          <div className="portfolio-value" style={{ color: '#8b5cf6' }}>{Number(status.profit_factor || 0).toFixed(2)}</div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Sharpe Signal</div>
          <div className="portfolio-value" style={{ color: '#00d4aa' }}>{Number(status.sharpe_ratio || 0).toFixed(2)}</div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Risk Depth</div>
          <div className="portfolio-value" style={{ color: '#ef4444' }}>-{Number(status.max_drawdown || 0).toFixed(2)}%</div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
        <div className="card col-span-6">
          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Performance per simbolo</h3>
          {tradePerformance.symbolRows.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ancora nessun trade chiuso: la classifica si popola appena Aureo completa le prime operazioni.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {tradePerformance.symbolRows.slice(0, 6).map((row) => (
                <div key={row.symbol} style={{ padding: '0.8rem 0.9rem', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: '#f8fafc', fontWeight: 800 }}>{row.symbol}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        {row.trades} trade · win rate {row.winRate.toFixed(0)}% · ultimo evento {row.lastSide || 'n/d'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: row.totalPnl >= 0 ? '#10b981' : '#ef4444', fontWeight: 800, fontSize: '1rem' }}>
                        {row.totalPnl >= 0 ? '+' : ''}${row.totalPnl.toFixed(2)}
                      </div>
                      <div style={{ color: row.avgPct >= 0 ? '#38bdf8' : '#f59e0b', fontSize: '0.8rem' }}>
                        avg {row.avgPct >= 0 ? '+' : ''}{row.avgPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card col-span-6">
          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Cronologia trade chiusi</h3>
          {tradePerformance.recentTrades.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nessuna chiusura registrata al momento.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              {tradePerformance.recentTrades.map((trade, index) => (
                <div key={`${trade.symbol}-${trade.date}-${index}`} style={{ padding: '0.75rem 0.85rem', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#f8fafc', fontWeight: 800 }}>{trade.symbol} · {trade.side}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{trade.date || 'Data non disponibile'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: Number(trade.profit_usd || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                        {Number(trade.profit_usd || 0) >= 0 ? '+' : ''}${Number(trade.profit_usd || 0).toFixed(2)}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {Number(trade.profit_pct || 0) >= 0 ? '+' : ''}{Number(trade.profit_pct || 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
        <RiskStatus riskSnapshot={status.risk} status={status} />
        <CapitalPhase />
      </div>

      <div className="chart-controls trading-chart-controls" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
        <div className="trading-symbol-tabs" style={{ display: 'flex', gap: '0.5rem' }}>
          {status.symbols?.map(sym => (
            <SymbolTabButton
              key={sym}
              sym={sym}
              selected={selectedSymbol === sym}
              onClick={() => setSelectedSymbol(sym)}
              cryptoState={cryptoSymbolStateMap[sym]}
            />
          ))}
        </div>
        <div className="trading-timeframe-tabs" style={{ display: 'flex', gap: '0.5rem' }}>
          {['1D', '1W', '1M', '1Y', 'ALL'].map(tf => (
            <button key={tf} className={`tab-btn ${timeframe === tf ? 'active-tab' : ''}`} onClick={() => setTimeframe(tf)}>{tf}</button>
          ))}
        </div>
      </div>

      <div className="chart-container" style={{ height: '300px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', marginTop: '1rem', position: 'relative' }}>
        {!status.modules?.trading ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Bot Offline. Il grafico si popolerà in tempo reale all'avvio.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="dashboard-grid" style={{ marginTop: "2rem" }}>
        <div className="card col-span-6">
          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Portafoglio Corrente</h3>
          {positionsEntries.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nessuna posizione aperta. Il bot sta scansionando...</p>
          ) : (
            positionsEntries.map(([sym, p]) => {
              const symbolTableRow = tableDataBySymbol[sym];
              const cryptoState = cryptoSymbolStateMap[sym];
              const symbolReadiness = deriveEntryReadiness({ status, risk: status.risk, symbol: sym, row: symbolTableRow });
              const symbolHeadline = deriveEntryHeadline(symbolReadiness);
              return <div key={sym} style={{ display: 'flex', flexDirection: 'column', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontWeight: 'bold' }}>
                    <span>{sym} {p.side === 'short' ? '(SHORT)' : ''}</span>
                    {cryptoState && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.18rem 0.5rem',
                          borderRadius: '999px',
                          border: `1px solid ${cryptoState.border}`,
                          background: cryptoState.bg,
                          color: cryptoState.tone,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                        }}
                        title={cryptoState.reason}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: cryptoState.tone, flexShrink: 0 }}></span>
                        {cryptoState.label}
                      </span>
                    )}
                  </span>
                  {p === "LIQUID" ? (
                    <span
                      style={{
                        color: symbolHeadline.tone,
                        border: `1px solid ${symbolHeadline.border}`,
                        background: symbolHeadline.bg,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '999px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                      }}
                      title={symbolHeadline.detail}
                    >
                      {symbolHeadline.label} · {symbolReadiness.score}
                    </span>
                  ) : (
                    <span style={{ color: p.unrealized_pl >= 0 ? '#10b981' : '#ef4444' }}>
                      {p.unrealized_pl >= 0 ? '+' : ''}{Number(p.unrealized_pl || 0).toFixed(2)}$ ({Number(p.unrealized_plpc || 0).toFixed(2)}%)
                    </span>
                  )}
                </div>
                {p === "LIQUID" && (
                  <div style={{ marginBottom: '0.45rem', color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.45 }}>
                    {symbolHeadline.detail}
                  </div>
                )}
                {/* AI Sentiment Integration */}
                {symbolTableRow && (
                  <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
                    {cryptoState && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>⚙️ Stato crypto:</span>
                        <span style={{ color: cryptoState.tone, fontWeight: 'bold' }}>{cryptoState.label} · {cryptoState.reason}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>📊 Indicatori:</span>
                      <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {symbolTableRow.prediction}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>🧠 AI Sentiment:</span>
                      <span>
                        {symbolTableRow.sentiment === 'BULLISH' && <span style={{ color: '#10b981', fontWeight: 'bold' }}>🟢 BULLISH (+15% Boost)</span>}
                        {symbolTableRow.sentiment === 'BEARISH' && <span style={{ color: '#ef4444', fontWeight: 'bold' }}>🔴 BEARISH (VETO Attivo)</span>}
                        {symbolTableRow.sentiment === 'NEUTRAL' && <span style={{ color: 'var(--text-secondary)' }}>⚪ NEUTRAL</span>}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            })
          )}
          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginTop: '2rem' }}>Impostazioni IA</h3>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Soglia Aggressività IA</label>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#06b6d4' }}>{status.aggressiveness || 55}%</span>
            </div>
            <input 
              type="range" min="10" max="90" step="1"
              value={status.aggressiveness || 55}
              disabled={isDemoMode}
              onChange={async (e) => {
                const val = e.target.value;
                setStatus(prev => ({ ...prev, aggressiveness: val }));
                await authFetch('/api/config', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ aggressiveness: val })
                });
              }}
              style={{ width: '100%', accentColor: '#06b6d4', ...demoActionStyle }}
            />
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 'bold' }}>Selezione dinamica titoli</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Ranking su momentum, liquidità e volatilità
                </div>
              </div>
              <button
                className="btn"
                onClick={async (e) => {
                  const res = await authFetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_symbols: true, symbol_count: 7 })
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setStatus(prev => ({ ...prev, symbols: data.symbols, symbol_selection: data.symbol_selection }));
                  }
                }}
                {...demoActionButtonProps()}
                style={demoActionStyle}
              >
                AGGIORNA WATCHLIST
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {status.symbols?.join(' • ') || 'Nessun simbolo disponibile'}
            </div>
            {status.symbol_selection?.ranked?.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                {status.symbol_selection.ranked.map((row) => (
                  <div
                    key={row.symbol}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{row.symbol}</div>
                      <div style={{ color: '#06b6d4', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {row.score == null ? 'crypto core' : `score ${Number(row.score || 0).toFixed(3)}`}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      {row.selection_reason || 'Selezione dinamica attiva'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card col-span-6">
          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Scan Console</h3>
          <div className="terminal-window">
              <>
                {status.logs?.map((l, i) => (
                  (() => {
                    const meta = classifyTradingLog(l);
                    const symbol = extractLogSymbol(l, status.symbols || []);
                    return (
                  <div
                    key={i}
                    style={{
                      marginBottom: '0.45rem',
                      padding: '0.55rem 0.7rem',
                      borderRadius: '10px',
                      border: `1px solid ${meta.border}`,
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                      <span style={{ color: meta.tone, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {meta.label}
                      </span>
                      {symbol && (
                        <span style={{ color: '#cbd5e1', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.18rem 0.45rem', borderRadius: '999px', background: 'rgba(255,255,255,0.06)' }}>
                          {symbol}
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.78)' }}>{l}</div>
                  </div>
                    );
                  })()
                ))}
                {(!status.logs || status.logs.length === 0) && <div style={{ color: 'var(--text-secondary)' }}>Nessun evento registrato. Avvia il motore per iniziare la scansione del mercato.</div>}
              </>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSportsArbitrageView = () => {
    return (
    <div className="module-content module-content--sports">
      <div className="header module-page-header sports-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>Sports SureBets ⚽🎾</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Calcolatore Matematico di Scommesse Sicure</div>
        </div>
        <button 
          className={`btn ${status.modules?.sports_arb ? 'btn-stop' : 'btn-start'}`}
          onClick={() => toggleModule('sports_arb', status.modules?.sports_arb)}
          {...demoActionButtonProps()}
          style={demoActionStyle}
        >
          {status.modules?.sports_arb ? 'FERMA RADAR QUOTE' : 'ATTIVA RADAR QUOTE'}
        </button>
      </div>

      {/* --- Pannello Auto-Bet --- */}
      <div className="sports-auto-bet-panel" style={{
        background: status.auto_bet_enabled
          ? 'rgba(212,175,55,0.08)'
          : 'rgba(255,255,255,0.03)',
        border: status.auto_bet_enabled
          ? '1px solid rgba(212,175,55,0.5)'
          : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '1.2rem 1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
        flexWrap: 'wrap',
        transition: 'all 0.3s'
      }}>
        {/* Toggle on/off */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', color: '#e2e8f0', fontSize: '0.95rem' }}>🤖 Auto-Bet</span>
          <div className={`badge ${status.auto_bet_enabled ? 'badge-gold' : 'badge-idle'}`} style={{ fontSize: '0.82rem' }}>
            {status.auto_bet_enabled ? 'ATTIVO' : 'DISATTIVO'}
          </div>
          <ToggleSwitch
            checked={!!status.auto_bet_enabled}
            disabled={isDemoMode}
            onChange={async () => {
              const newVal = !status.auto_bet_enabled;
              setStatus(prev => ({ ...prev, auto_bet_enabled: newVal }));
              await authFetch('/api/auto-bet-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newVal })
              });
            }}
            title={isDemoMode ? 'Non disponibile in demo mode' : 'Attiva o disattiva Auto-Bet'}
          />
        </div>

        {/* Slider soglia */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, minWidth: '220px' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Soglia minima:</span>
          <input
            id="auto-bet-slider"
            type="range" min="1" max="30" step="0.5"
            value={status.auto_bet_threshold ?? 10}
            disabled={isDemoMode}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setStatus(prev => ({ ...prev, auto_bet_threshold: val }));
            }}
            onMouseUp={async (e) => {
              const val = parseFloat(e.target.value);
              await authFetch('/api/auto-bet-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threshold: val })
              });
            }}
            onTouchEnd={async (e) => {
              const val = parseFloat(e.target.value);
              await authFetch('/api/auto-bet-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threshold: val })
              });
            }}
            style={{ flex: 1, accentColor: '#d4af37', cursor: isDemoMode ? 'not-allowed' : 'pointer', opacity: isDemoMode ? 0.5 : 1 }}
          />
          <span style={{
            fontWeight: 'bold',
            color: '#d4af37',
            minWidth: '42px',
            fontSize: '1rem'
          }}>{Number(status.auto_bet_threshold ?? 10).toFixed(1)}%</span>
        </div>

        {status.auto_bet_enabled && (
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
            Il sistema punta automaticamente €100 su ogni surebet ≥ {Number(status.auto_bet_threshold ?? 10).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        {/* Radar Logs */}
        <div className="card col-span-6">
          <h3 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>Radar Bookmakers Live</h3>
          <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', height: '400px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            {status.sports_logs?.map((l, i) => (
              <div key={i} style={{ marginBottom: '0.5rem', color: l.includes("SUREBET") ? '#10b981' : '#64748b' }}>{l}</div>
            ))}
            {(!status.sports_logs || status.sports_logs.length === 0) && (
              <div style={{ color: '#64748b' }}>In attesa di connessione ai flussi quote...</div>
            )}
          </div>
        </div>

        {/* SureBets Found */}
        <div className="card col-span-6">
          <h3 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>SureBets — ordinate per profitto 📊</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '600px', overflowY: 'auto' }}>
            {sortedSurebets.map((sb, idx) => (
              <div key={sb.id} style={{
                background: idx === 0 ? 'rgba(16,185,129,0.12)' : 'rgba(16, 185, 129, 0.05)',
                padding: '1.5rem', borderRadius: '12px',
                border: Number(sb.profit_margin) >= 10
                  ? '2px solid rgba(212,175,55,0.8)'
                  : idx === 0 ? '1px solid rgba(16,185,129,0.6)' : '1px solid rgba(16, 185, 129, 0.3)',
                boxShadow: Number(sb.profit_margin) >= 10 ? '0 0 12px rgba(212,175,55,0.25)' : 'none'
              }}>
                {/* Header card con sport, rank e profitto */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {idx === 0 && <span style={{ fontSize: '1.1rem' }}>🥇</span>}
                    {idx === 1 && <span style={{ fontSize: '1.1rem' }}>🥈</span>}
                    {idx === 2 && <span style={{ fontSize: '1.1rem' }}>🥉</span>}
                    {idx > 2  && <span style={{ color: '#64748b', fontWeight: 'bold', fontSize: '0.85rem' }}>#{idx + 1}</span>}
                    <span style={{
                      background: 'rgba(59,130,246,0.15)',
                      color: '#60a5fa',
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '20px',
                      border: '1px solid rgba(59,130,246,0.3)',
                      fontWeight: 'bold',
                      letterSpacing: '0.5px'
                    }}>{getSportLabel(sb.sport)}</span>
                    {Number(sb.profit_margin) >= 10 && (
                      <span style={{
                        background: 'linear-gradient(90deg, #d4af37, #f3e5ab)',
                        color: '#000',
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                        letterSpacing: '1px'
                      }}>🤖 AUTO</span>
                    )}
                  </div>
                  <span style={{ color: Number(sb.profit_margin) >= 10 ? '#d4af37' : '#10b981', fontWeight: 'bold', fontSize: '1.1rem' }}>+{Number(sb.profit_margin || 0).toFixed(2)}%</span>
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{sb.match}</div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div className="card col-span-6">
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>PUNTA SU {sb.p1.toUpperCase()}</div>
                    <div style={{ fontWeight: 'bold' }}>{sb.book1} (@{Number(sb.odds1 || 0).toFixed(2)})</div>
                    <div style={{ color: '#f59e0b', fontSize: '1.1rem', marginTop: '0.2rem' }}>Stake: €{Number(sb.stake1 || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>PUNTA SU {sb.p2.toUpperCase()}</div>
                    <div style={{ fontWeight: 'bold' }}>{sb.book2} (@{Number(sb.odds2 || 0).toFixed(2)})</div>
                    <div style={{ color: '#f59e0b', fontSize: '1.1rem', marginTop: '0.2rem' }}>Stake: €{Number(sb.stake2 || 0).toFixed(2)}</div>
                  </div>
                </div>
                
                <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.5)', padding: '0.8rem', borderRadius: '6px', textAlign: 'center', color: '#e2e8f0', marginBottom: '1rem' }}>
                  Investimento Totale: <strong>€100.00</strong> ➔ Ritorno Garantito: <strong style={{ color: '#10b981' }}>€{Number(sb.guaranteed_return || 0).toFixed(2)}</strong>
                </div>

                {/* Bottone piazza scommessa */}
                {(() => {
                  const betState = placedBets[sb.id];
                  if (betState === 'placed') return (
                    <div style={{ textAlign: 'center', padding: '0.8rem', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#10b981', fontWeight: 'bold', fontSize: '0.95rem' }}>
                      ✅ Scommessa piazzata! In attesa del risultato...
                    </div>
                  );
                  if (betState === 'error') return (
                    <div style={{ textAlign: 'center', padding: '0.8rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', fontWeight: 'bold' }}>
                      ❌ Errore nel piazzare la scommessa.
                    </div>
                  );
                  return (
                    <button
                      onClick={() => placeBet(sb)}
                      {...demoActionButtonProps(betState === 'loading')}
                      style={{
                        width: '100%',
                        padding: '0.9rem',
                        background: betState === 'loading'
                          ? 'rgba(212,175,55,0.3)'
                          : 'linear-gradient(90deg, #d4af37, #f3e5ab)',
                        color: '#000',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: isDemoMode ? 'not-allowed' : (betState === 'loading' ? 'wait' : 'pointer'),
                        letterSpacing: '1px',
                        transition: 'all 0.2s',
                        opacity: isDemoMode ? 0.5 : 1,
                      }}
                    >
                      {betState === 'loading' ? '⏳ Piazzando...' : '⚡ PIAZZA SCOMMESSA (€100)'}
                    </button>
                  );
                })()}
              </div>
            ))}
            
            {sortedSurebets.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                Nessuna SureBet attiva al momento. Il Radar è in scansione...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    );
  };

  const renderValueBetsView = () => (
      <div className="module-content module-content--sentiment">
      <div className="header module-page-header sentiment-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            🤖 AI Sentiment Radar
            <span style={{ fontSize: '0.75rem', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              powered by NewsAPI & NLP
            </span>
          </h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Segnali di mercato dall'analisi del sentiment globale (Crypto & Stock)</div>
        </div>
        
        <div className="sentiment-header-controls" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className={`badge ${status.modules?.ai_sports_sentiment ? 'badge-ai' : 'badge-idle'}`} style={{ fontSize: '0.82rem' }}>
              {status.modules?.ai_sports_sentiment ? 'RADAR ATTIVO' : 'RADAR SPENTO'}
            </div>
            <ToggleSwitch
              checked={!!status.modules?.ai_sports_sentiment}
              disabled={isDemoMode}
              onChange={() => toggleModule('ai_sports_sentiment')}
              labelOn="ON"
              labelOff="OFF"
              title={isDemoMode ? 'Non disponibile in demo mode' : 'Attiva o disattiva il radar sentiment'}
            />
          </div>
        
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.8rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Mostra:</span>
          <input 
            type="range" min="3" max="50" step="3" 
            value={numValueBets} 
            onChange={(e) => setNumValueBets(parseInt(e.target.value))} 
            style={{ accentColor: '#8b5cf6', cursor: 'pointer' }}
          />
          <span style={{ fontWeight: 'bold', color: '#a78bfa', minWidth: '24px' }}>{numValueBets}</span>
        </div>
        </div>
      </div>

      <div className="sentiment-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {visibleValueBets.length > 0 ? (
          visibleValueBets.map(vb => (
            <div key={vb.id} style={{
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 4px 20px rgba(139, 92, 246, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="card col-span-6">
                  <div style={{ color: '#a78bfa', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.3rem' }}>
                    {vb.sport}
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#f8fafc' }}>{vb.match}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: '80px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '2px' }}>CONFIDENCE</div>
                  <div style={{ 
                    display: 'inline-block',
                    background: vb.compound > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: vb.compound > 0 ? '#10b981' : '#ef4444',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '20px',
                    fontWeight: 'bold'
                  }}>
                    {vb.confidence}%
                  </div>
                </div>
              </div>

              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '1rem',
                borderRadius: '10px',
                borderLeft: vb.compound > 0 ? '4px solid #10b981' : '4px solid #ef4444'
              }}>
                <a href={vb.url || '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <div style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📰 {vb.title || "Notizia Sensibile Rilevata"}
                    <span style={{ fontSize: '0.7rem', color: '#8b5cf6' }}>↗️</span>
                  </div>
                </a>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontStyle: 'italic', lineHeight: '1.5' }}>
                  "{vb.analysis}"
                </div>
              </div>

              {/* Progress bar sentiment */}
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${vb.confidence}%`, 
                  height: '100%', 
                  background: vb.compound > 0 ? 'linear-gradient(90deg, #047857, #10b981)' : 'linear-gradient(90deg, #b91c1c, #ef4444)',
                  float: vb.compound > 0 ? 'right' : 'left' 
                }}></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>CONSIGLIO AI</div>
                  <div style={{ fontWeight: 'bold', color: vb.compound > 0 ? '#10b981' : '#ef4444' }}>{vb.prediction}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>MOLTIPLICATORE</div>
                  <div style={{ fontWeight: 'bold', color: '#8b5cf6', fontSize: '1.2rem' }}>{vb.odds.toFixed(2)}x</div>
                </div>
              </div>
              <button
                onClick={async (e) => {
                  setPlacedBets(prev => ({ ...prev, [vb.id]: 'loading' }));
                  await new Promise(r => setTimeout(r, 1500));
                  if (Math.random() > 0.1) {
                    setPlacedBets(prev => ({ ...prev, [vb.id]: 'placed' }));
                  } else {
                    setPlacedBets(prev => ({ ...prev, [vb.id]: 'error' }));
                  }
                }}
                disabled={placedBets[vb.id] === 'loading' || placedBets[vb.id] === 'placed'}
                style={{
                  width: '100%',
                  marginTop: '1rem',
                  padding: '0.8rem',
                  background: placedBets[vb.id] === 'placed' 
                    ? 'rgba(16, 185, 129, 0.15)' 
                    : placedBets[vb.id] === 'error'
                      ? 'rgba(239, 68, 68, 0.1)'
                      : placedBets[vb.id] === 'loading'
                        ? 'rgba(139, 92, 246, 0.3)'
                        : 'linear-gradient(90deg, #8b5cf6, #c084fc)',
                  border: placedBets[vb.id] === 'placed' 
                    ? '1px solid #10b981' 
                    : placedBets[vb.id] === 'error'
                      ? '1px solid #ef4444'
                      : 'none',
                  color: placedBets[vb.id] === 'placed' 
                    ? '#10b981' 
                    : placedBets[vb.id] === 'error'
                      ? '#ef4444'
                      : '#fff',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  borderRadius: '8px',
                  cursor: (placedBets[vb.id] === 'loading' || placedBets[vb.id] === 'placed') ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {placedBets[vb.id] === 'loading' ? '⏳ Piazzando...' : 
                 placedBets[vb.id] === 'placed' ? '✅ Scommessa piazzata!' : 
                 placedBets[vb.id] === 'error' ? '❌ Errore' : 
                 '⚡ PIAZZA SCOMMESSA (€50)'}
              </button>
            </div>
          ))
        ) : (
          <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', color: '#64748b' }}>
            Nessuna anomalia statistica rilevata al momento. L'intelligenza artificiale sta analizzando le quote...
          </div>
        )}
      </div>
    </div>
  );

  const generateAiIdea = async () => {
    setAiLoading(true);
    try {
      const payload = { groq_key: apiKeys.groq_key || savedKeys.GROQ_KEY || "" };
      const res = await fetch('/api/ai/generate-idea', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if(data.topic) {
        setAiIdea(data);
      } else {
        const errorMsg = typeof data.detail === 'object' ? JSON.stringify(data.detail) : (data.detail || "Errore sconosciuto");
        alert("Errore API: " + errorMsg);
      }
    } catch(e) {
      alert("Errore di rete o server non raggiungibile: " + e.message);
    }
    setAiLoading(false);
  };

  const handleVideoUpload = async (e) => {
    if(!e.target.files[0] || !aiIdea) return;
    setUploadingVideo(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    formData.append('topic', aiIdea.topic);
    formData.append('prompt', aiIdea.prompt);
    formData.append('description', aiIdea.description || "");
    formData.append('hashtags', aiIdea.hashtags || "");
    
    try {
      const res = await authFetch('/api/ai/upload-video', {
        method: 'POST', body: formData
      });
      const data = await res.json();
      if(data.status === 'success') {
        setAiIdea(null);
        alert('Video caricato con successo! Aureo lo distribuirà presto.');
      } else {
        alert(data.detail || "Errore upload");
      }
    } catch(e) {
      alert("Errore caricamento video.");
    }
    setUploadingVideo(false);
  };

  const handleCopyPrompt = () => {
    if (!aiIdea?.prompt) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(aiIdea.prompt);
      alert("Prompt copiato!");
    } else {
      // Fallback per HTTP non sicuro
      const textArea = document.createElement("textarea");
      textArea.value = aiIdea.prompt;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        alert("Prompt copiato!");
      } catch (err) {
        alert("Errore copia, fallo manualmente.");
      }
      document.body.removeChild(textArea);
    }
  };

  const renderAIContentView = () => (
    <div className="module-content module-content--aicontent">
      <div className="header module-page-header ai-content-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>AI Content Spammer 🤖🔥</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Ti diamo l'idea, tu crei il video, Aureo lo spamma ovunque!</div>
        </div>
        <button 
          className={`btn ${status.modules?.ai_content ? 'btn-stop' : 'btn-start'}`}
          onClick={() => toggleModule('ai_content', status.modules?.ai_content)}
          {...demoActionButtonProps()}
          style={demoActionStyle}
        >
          {status.modules?.ai_content ? 'FERMA DISTRIBUZIONE (PAUSA CODA)' : 'AVVIA DISTRIBUZIONE (ELABORA CODA)'}
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="card col-span-5" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>1. Generatore di Argomenti</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Lascia che l'algoritmo scelga l'argomento più caldo per il tuo prossimo video.</p>
            <button 
              onClick={generateAiIdea}
              disabled={aiLoading}
              style={{ background: '#a855f7', color: '#fff', width: '100%', padding: '1rem', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', opacity: aiLoading ? 0.7 : 1 }}
            >
              {aiLoading ? '💡 Generazione in corso...' : '💡 Genera Idea Virale'}
            </button>
            {aiIdea && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#000', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                <h4 style={{ color: '#a855f7', margin: '0 0 0.5rem 0' }}>Titolo: {aiIdea.topic}</h4>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>SCRIPT DA LEGGERE:</span>
                  <p style={{ color: '#e2e8f0', fontSize: '0.9rem', margin: '0.2rem 0', fontStyle: 'italic' }}>{aiIdea.script}</p>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>PROMPT VEO / SORA:</span>
                    <button onClick={handleCopyPrompt} style={{ background: 'transparent', border: '1px solid #a855f7', color: '#a855f7', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>Copia</button>
                  </div>
                  <p style={{ color: '#e2e8f0', fontSize: '0.9rem', margin: '0.2rem 0', fontFamily: 'monospace' }}>{aiIdea.prompt}</p>
                </div>
              </div>
            )}
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>2. Integrazione API Social (Opzionale)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>Collega gli account per la pubblicazione automatica dei video generati.</p>
            <input type="text" placeholder="YouTube Data API Key" value={apiKeys.youtube_key || ''} onChange={e => setApiKeys({...apiKeys, youtube_key: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '0.5rem' }} />
            <input type="text" placeholder="TikTok Access Token" value={apiKeys.tiktok_key || ''} onChange={e => setApiKeys({...apiKeys, tiktok_key: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          </div>
        </div>

        <div className="card col-span-7" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', opacity: aiIdea ? 1 : 0.5, pointerEvents: aiIdea ? 'auto' : 'none' }}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>3. Carica Video Generato</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Genera il video gratuitamente su Veo incollando il prompt, scarica l'MP4 e caricalo qui.</p>
            <input type="file" id="video-upload" accept="video/mp4" style={{ display: 'none' }} onChange={handleVideoUpload} />
            <button 
              onClick={() => document.getElementById('video-upload').click()}
              {...demoActionButtonProps(uploadingVideo)}
              style={{ background: '#10b981', color: '#000', width: '100%', padding: '1rem', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', opacity: uploadingVideo ? 0.7 : 1 }}
            >
              {uploadingVideo ? '⏳ Caricamento in coda...' : '📤 Carica MP4'}
            </button>
          </div>

          <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#e2e8f0' }}>Logs di Distribuzione</h4>
            {status.ai_logs?.map((l, i) => (
              <div key={i} style={{ marginBottom: '0.5rem', color: l.includes("✅") || l.includes("💰") ? '#10b981' : l.includes("Upload") ? '#f59e0b' : '#c084fc' }}>{l}</div>
            ))}
            {(!status.ai_logs || status.ai_logs.length === 0) && (
              <div style={{ color: '#64748b' }}>In attesa di video in coda...</div>
            )}
          </div>
          <div className="card col-span-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#e2e8f0', margin: 0 }}>Coda e Pubblicazioni</h3>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold' }}>
                Totale Generato (Oggi): +${Number(aiEarnings || 0).toFixed(2)}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {status.ai_videos?.map(video => (
                <div key={video.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', padding: '1rem', gap: '1rem' }}>
                    <img src={video.thumbnail} alt="thumb" style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '6px' }} />
                    <div className="card col-span-6">
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', lineHeight: '1.2' }}>{video.title}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>👀 {video.views?.toLocaleString()} views</div>
                      <div style={{ color: '#10b981', fontWeight: 'bold' }}>+${video.earnings?.toFixed(2)}</div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Pubblicato {video.timestamp}</span>
                    <span style={{ color: '#a855f7' }}>TikTok / Shorts</span>
                  </div>
                </div>
              ))}
            </div>
            {(!status.ai_videos || status.ai_videos.length === 0) && (
              <div style={{ gridColumn: '1 / -1', padding: '3rem', margin: '1rem 0', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                Nessun video generato.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderComingSoon = (title, mod_id, description) => (
    <div className="module-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center' }}>
      <h2>{title}</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px', marginBottom: '2rem' }}>{description}</p>
      
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>Stato Modulo</h3>
        <button 
          className={`btn ${status.modules?.[mod_id] ? 'btn-stop' : 'btn-start'}`}
          onClick={() => toggleModule(mod_id, status.modules?.[mod_id])}
          {...demoActionButtonProps()}
          style={{ fontSize: '1.2rem', padding: '1rem 3rem', ...demoActionStyle }}
        >
          {status.modules?.[mod_id] ? 'DISATTIVA MOTORE' : 'ATTIVA MOTORE'}
        </button>
        <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
          {status.modules?.[mod_id] ? 'Il motore è attivo e gira in background.' : 'Attualmente in pausa.'}
        </p>
      </div>
    </div>
  );

  const renderSaaSView = () => {
    const overview = billingOverview || DEMO_BILLING_OVERVIEW;
    const metrics = overview.metrics || {};
    const plans = overview.plans || [];
    const customers = overview.customers || [];
    const leads = overview.leads || [];
    const activity = overview.recent_activity || [];

    return (
      <div className="module-content module-content--billing">
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2>💳 SaaS & Billing Control Room</h2>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
              Gestisci piani, lead, clienti e monetizzazione dell’ecosistema Aureo.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
            {isDemoMode && <div className="demo-mode-pill">READ ONLY</div>}
            <div className={`sync-pill ${billingLoading ? 'offline' : 'online'}`}>{billingLoading ? 'Sync…' : 'Billing Ready'}</div>
          </div>
        </div>

        {billingMessage && (
          <div className="card" style={{ marginBottom: '1rem', borderColor: 'rgba(245, 166, 35, 0.2)' }}>
            <div style={{ color: '#f8e7bf' }}>{billingMessage}</div>
          </div>
        )}

        <div className="dashboard-grid">
          <div className="card col-span-3">
            <div className="card-title">MRR</div>
            <div className="portfolio-value" style={{ color: '#10b981' }}>€{Number(metrics.monthly_recurring_revenue || 0).toFixed(0)}</div>
          </div>
          <div className="card col-span-3">
            <div className="card-title">ARR</div>
            <div className="portfolio-value" style={{ color: '#38bdf8' }}>€{Number(metrics.annual_run_rate || 0).toFixed(0)}</div>
          </div>
          <div className="card col-span-3">
            <div className="card-title">Clienti Attivi</div>
            <div className="portfolio-value">{Number(metrics.active_customers || 0)}</div>
          </div>
          <div className="card col-span-3">
            <div className="card-title">Trial / Lead</div>
            <div className="portfolio-value" style={{ color: '#f59e0b' }}>
              {Number(metrics.trialing_customers || 0)} / {Number(metrics.leads_count || 0)}
            </div>
          </div>
        </div>

        <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
          <div className="card col-span-12">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#e2e8f0' }}>Clienti Iscritti</h3>
              <button 
                className="btn" 
                onClick={() => setShowCreateUser(!showCreateUser)}
                style={{ background: 'var(--primary-color)', color: 'white', padding: '0.4rem 1rem', fontSize: '0.9rem' }}
              >
                {showCreateUser ? 'Annulla' : '+ Crea Utente'}
              </button>
            </div>

            {showCreateUser && (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h4 style={{ margin: '0 0 1rem 0' }}>Nuovo Utente</h4>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Email</label>
                    <input type="email" className="settings-input" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="email@esempio.com" />
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Password Temporanea</label>
                    <input type="text" className="settings-input" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="Pass123!" />
                  </div>
                  <div style={{ width: '120px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Ruolo</label>
                    <select className="settings-input" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button 
                    className="btn btn-start" 
                    onClick={async (e) => {
                      if (!newUser.email || !newUser.password) { alert('Compila email e password'); return; }
                      try {
                        const res = await authFetch('/api/saas/create-user', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(newUser)
                        });
                        const data = await res.json();
                        if (res.ok) {
                          alert(data.message);
                          setShowCreateUser(false);
                          setNewUser({email:'', password:'', role:'user'});
                          const res2 = await authFetch('/api/saas/overview?t=' + Date.now());
                          setBillingOverview(await res2.json());
                        } else {
                          alert(data.detail || 'Errore creazione utente');
                        }
                      } catch(e) { alert('Errore di connessione'); }
                    }}
                    style={{ minHeight: '42px', padding: '0 1.5rem' }}
                  >
                    Salva
                  </button>
                </div>
              </div>
            )}

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Pagamento</th>
                    <th>Scadenza</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {customers?.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700 }}>{user.email}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>registrato: {user.created_at ? user.created_at.slice(0,10) : '-'}</div>
                      </td>
                      <td>
                        {user.status === 'active' && user.is_paid && <span className="badge badge-active" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981' }}>ATTIVO</span>}
                        {user.status === 'active' && !user.is_paid && <span className="badge badge-idle" style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: '1px solid #475569' }}>ATTIVATO GRATIS</span>}
                        {user.status === 'pending' && <span className="badge badge-idle" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid #f59e0b' }}>IN ATTESA</span>}
                      </td>
                      <td>
                        {user.is_paid
                          ? <span style={{ color: '#10b981', fontWeight: 600 }}>✅ Pagato<br/><span style={{color:'#64748b', fontSize:'0.75rem', fontWeight:400}}>{user.paid_at ? user.paid_at.slice(0,10) : ''}</span></span>
                          : <span style={{ color: '#94a3b8' }}>🎁 Gratis</span>
                        }
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{user.next_billing_at !== 'N/A' ? user.next_billing_at?.slice(0,10) : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {user.status !== 'active' && (
                            <>
                            <button className="btn btn-start" onClick={async (e) => {
                              if(!window.confirm('Vuoi attivare manualmente questo utente (GRATIS)?')) return;
                              try {
                                const res = await authFetch('/api/saas/activate-user', {
                                  method: 'POST', headers: {'Content-Type': 'application/json'},
                                  body: JSON.stringify({ user_id: user.id })
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  await refreshBillingOverview();
                                  setBillingMessage(data.message || 'Utente attivato');
                                } else {
                                  setBillingMessage(data.detail || 'Errore attivazione utente');
                                }
                              } catch(e) {
                                setBillingMessage('Errore di rete durante l’attivazione');
                              }
                            }} style={{ width: 'auto', minHeight: 0, padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}>
                              Attiva (Gratis)
                            </button>
                            <button className="btn btn-start" onClick={async (e) => {
                              if(!window.confirm('Vuoi attivare manualmente questo utente (PAGATO)?')) return;
                              try {
                                const res = await authFetch('/api/saas/activate-paid', {
                                  method: 'POST', headers: {'Content-Type': 'application/json'},
                                  body: JSON.stringify({ user_id: user.id })
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  await refreshBillingOverview();
                                  setBillingMessage(data.message || 'Utente attivato come pagato');
                                } else {
                                  setBillingMessage(data.detail || 'Errore attivazione pagata');
                                }
                              } catch(e) {
                                setBillingMessage('Errore di rete durante l’attivazione pagata');
                              }
                            }} style={{ width: 'auto', minHeight: 0, padding: '0.3rem 0.6rem', fontSize: '0.78rem', background: '#d4af37', color: 'black' }}>
                              Attiva (Pagato)
                            </button>
                            </>
                          )}
                          {user.status === 'active' && (
                            <>
                            <button className="btn btn-outline" onClick={() => extendUserSubscription(user.id, 1)} style={{ width: 'auto', minHeight: 0, padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}>
                              +30g
                            </button>
                            <button className="btn btn-outline" onClick={() => extendUserSubscription(user.id, 3)} style={{ width: 'auto', minHeight: 0, padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}>
                              +90g
                            </button>
                            </>
                          )}
                          <button className="btn btn-outline" onClick={async (e) => {
                            if(!window.confirm('Eliminare definitivamente questo utente?')) return;
                            try {
                              await authFetch('/api/saas/delete-user', {
                                method: 'POST', headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ user_id: user.id })
                              });
                              await refreshBillingOverview();
                              setBillingMessage('Utente eliminato');
                            } catch(e) {
                              setBillingMessage('Errore durante eliminazione utente');
                            }
                          }} style={{ width: 'auto', minHeight: 0, padding: '0.3rem 0.6rem', fontSize: '0.78rem', borderColor: '#ef4444', color: '#ef4444' }}>
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!customers?.length && <tr><td colSpan="5" style={{textAlign:'center', color:'#888'}}>Nessun cliente registrato</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card col-span-12">
            <h3 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>Verifica Pagamenti Crypto</h3>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Importo</th>
                    <th>TXID</th>
                    <th>Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {billingOverview?.recent_activity?.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.user_email}</td>
                      <td>{payment.amount} {payment.currency}</td>
                      <td style={{fontFamily:'monospace', fontSize:'0.8rem', maxWidth:'150px', overflow:'hidden', textOverflow:'ellipsis'}} title={payment.txid}>{payment.txid}</td>
                      <td>
                        {payment.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-start" onClick={async (e) => {
                              try {
                                const res = await authFetch('/api/billing/verify-payment', {
                                  method: 'POST', headers: {'Content-Type': 'application/json'},
                                  body: JSON.stringify({ payment_id: payment.id, action: 'approve', months: 1 })
                                });
                                const data = await res.json();
                                setBillingMessage(data.message);
                                const res2 = await authFetch('/api/saas/overview?t=' + Date.now());
                                setBillingOverview(await res2.json());
                              } catch(e) {}
                            }} style={{ width: 'auto', minHeight: 0, padding: '0.45rem 0.7rem' }}>
                              Verifica (1 Mese)
                            </button>
                            <button className="btn btn-outline" onClick={async (e) => {
                              try {
                                const res = await authFetch('/api/billing/verify-payment', {
                                  method: 'POST', headers: {'Content-Type': 'application/json'},
                                  body: JSON.stringify({ payment_id: payment.id, action: 'reject' })
                                });
                                const data = await res.json();
                                setBillingMessage(data.message);
                                const res2 = await authFetch('/api/saas/overview?t=' + Date.now());
                                setBillingOverview(await res2.json());
                              } catch(e) {}
                            }} style={{ width: 'auto', minHeight: 0, padding: '0.45rem 0.7rem' }}>
                              Rifiuta
                            </button>
                          </div>
                        ) : (
                          <span style={{color: payment.status === 'verified' ? '#10b981' : '#f43f5e'}}>{(payment.status || 'unknown').toUpperCase()}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!billingOverview?.recent_activity?.length && <tr><td colSpan="4" style={{textAlign:'center', color:'#888'}}>Nessun pagamento in coda</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card col-span-4">
            <h3 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>Attività Recenti</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {activity.map((item) => (
                <div key={item.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.85rem 0.9rem' }}>
                  <div style={{ color: '#e2e8f0', lineHeight: 1.35 }}>{item.label}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginTop: '0.4rem' }}>{item.created_at}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  
  if (!isAuthenticated) {

    const landingPlans = DEMO_BILLING_OVERVIEW.plans || [];
    const selectedPlan = landingPlans.find((plan) => plan.id === selectedPlanId);
    const landingTicker = [
      { market: 'BTC/USD', price: '$118,420', change: '+2.6%', direction: 'up' },
      { market: 'ETH/USD', price: '$6,180', change: '+1.9%', direction: 'up' },
      { market: 'SOL/USD', price: '$242', change: '+4.2%', direction: 'up' },
      { market: 'GOLD', price: '$2,612', change: '-0.4%', direction: 'down' },
      { market: 'NASDAQ', price: '21,440', change: '+0.8%', direction: 'up' },
      { market: 'EUR/USD', price: '1.11', change: '+0.2%', direction: 'up' },
    ];
    const landingStats = [
      { value: '24/7', label: 'visibilità continua su capitale, segnali, accessi e rischio' },
      { value: 'Executive UX', label: 'esperienza premium coerente su iPhone, Android, tablet e desktop' },
      { value: '3 step', label: 'attivazioni pensate per profili operativi, advisory e high-ticket' },
    ];
    const landingEnterpriseSignals = [
      'Governance-ready onboarding',
      'Manual approval control',
      'Passkey & secure access',
      'Multi-device executive experience',
    ];
    const landingEnterpriseBlocks = [
      {
        title: 'Governance',
        text: 'Attivazione controllata, percorsi separati e onboarding assistito per una percezione più matura del prodotto.',
      },
      {
        title: 'Security',
        text: 'Passkey, vault chiavi e accessi protetti aiutano Aureo a presentarsi come piattaforma seria e non improvvisata.',
      },
      {
        title: 'Readiness',
        text: 'Interfaccia premium, controllo dei moduli e struttura multi-step preparano meglio demo, trattative e clienti high-ticket.',
      },
    ];
    const landingExecutiveMetrics = [
      { label: 'Enterprise posture', value: 'Boardroom-ready' },
      { label: 'Access model', value: 'Private & controlled' },
      { label: 'Security layer', value: 'Passkey / Vault' },
      { label: 'Commercial motion', value: 'High-ticket guided' },
    ];
    const landingAssuranceBlocks = [
      {
        title: 'Security',
        text: 'Accessi protetti, credenziali custodite e una presentazione che comunica subito controllo e serietà.',
      },
      {
        title: 'Governance',
        text: 'Percorsi guidati, attivazione controllata e separazione tra area riservata e percorso cliente.',
      },
      {
        title: 'Compliance Posture',
        text: 'Una base più credibile per future conversazioni su privacy, governance operativa e procurement.',
      },
    ];
    const landingFeatures = [
      {
        icon: '🧠',
        title: 'AI Assistita per decisioni',
        text: 'Algoritmi e letture assistite supportano la lettura del contesto operativo e dei segnali senza appesantire l’esperienza.',
      },
      {
        icon: '🏛️',
        title: 'Immagine enterprise-grade',
        text: 'Ogni sezione è progettata per trasmettere ordine, solidità e controllo, qualità essenziali in trattative high-ticket.',
      },
      {
        icon: '🛡️',
        title: 'Sicurezza premium',
        text: 'Passkey, gestione chiavi, login separati e percorsi protetti costruiscono una base credibile per clienti premium ed enterprise.',
      },
      {
        icon: '📊',
        title: 'Control room unificata',
        text: 'Dashboard, trading, DeFi, segnali e security convivono in un’unica interfaccia leggibile, forte e pronta per demo commerciali.',
      },
      {
        icon: '📱',
        title: 'Multi-device reale',
        text: 'L’esperienza resta pulita e autorevole su iPhone, Android, tablet e desktop, senza perdere presenza visiva.',
      },
      {
        icon: '🧭',
        title: 'Percorso commerciale guidato',
        text: 'Dalla prima impressione fino all’attivazione, ogni passaggio accompagna l’utente con meno attrito e più fiducia percepita.',
      },
    ];
    const landingFlow = [
      {
        number: '1',
        title: 'Valuta il posizionamento',
        text: 'La pagina iniziale presenta subito il prodotto come una control room premium, non come una semplice dashboard tecnica.',
      },
      {
        number: '2',
        title: 'Scegli lo step operativo',
        text: 'L’utente comprende quale accesso è coerente con il proprio livello operativo, senza dispersione o confusione.',
      },
      {
        number: '3',
        title: 'Attiva con continuità',
        text: 'La registrazione e l’attivazione restano dentro la stessa esperienza, preservando qualità percepita e slancio commerciale.',
      },
    ];
    const landingTestimonials = [
      {
        initials: 'MQ',
        name: 'Marco',
        role: 'Private investor',
        quote: 'La prima impressione è forte: sembra un ambiente serio, ordinato e costruito per chi vuole controllo vero.',
      },
      {
        initials: 'GV',
        name: 'Giulia',
        role: 'Consulente indipendente',
        quote: 'Non comunica solo funzionalità, comunica posizionamento. Questo cambia molto la percezione del prodotto.',
      },
      {
        initials: 'LD',
        name: 'Luca',
        role: 'Trader attivo',
        quote: 'Finalmente una presentazione che accompagna bene alla scelta, senza buttarti subito dentro un login freddo.',
      },
    ];
    const landingTrustPillars = [
      'Presenza executive-grade',
      'Percorso commerciale lineare',
      'Coerenza piena tra presentazione e utilizzo',
    ];
    if (showLanding) {
      return (
        <div className="sales-landing">
          <div className="sales-bg-animation" />
          <div className="sales-bg-animation sales-bg-animation--second" />
          <div className="sales-topbar">
            <span className="sales-topbar-label">Enterprise Preview</span>
            <span className="sales-topbar-text">Aureo OS evolve da dashboard premium a control room executive per percorsi high-ticket.</span>
          </div>

          <nav className="sales-nav">
            <a href="#landing-top" className="sales-logo">
              <img src="/aureoos-logo.png" alt="Aureo OS" />
            </a>
            <div className="sales-nav-links">
              <a href="#landing-features">Funzionalità</a>
              <a href="#landing-assurance">Assurance</a>
              <a href="#landing-flow">Operating Model</a>
              <a href="#landing-pricing">Step</a>
              <a href="#landing-proof">Impatto</a>
            </div>
            <div className="sales-nav-actions">
              <button className="btn btn-outline" onClick={() => setShowLanding(false)}>Area Riservata</button>
              <button className="btn btn-start" onClick={openPricingSection}>Request Private Demo</button>
            </div>
          </nav>

          <div className="sales-ticker">
            <div className="sales-ticker-track">
              {[...landingTicker, ...landingTicker].map((item, index) => (
                <div key={`${item.market}-${index}`} className="sales-ticker-item">
                  <span className="sales-ticker-market">{item.market}</span>
                  <span className="sales-ticker-price">{item.price}</span>
                  <span className={`sales-ticker-change sales-ticker-change--${item.direction}`}>{item.change}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sales-page" id="landing-top">
            <section className="sales-hero">
              <div className="sales-hero-content">
                <div className="sales-badge">⚡ Executive Trading Experience</div>
                <h1>
                  La <span>Control Room Operativa</span> che fa sembrare Aureo un prodotto enterprise
                </h1>
                <p>
                  AUREO OS è un ambiente premium che unisce dashboard, AI, trading, DeFi e sicurezza in un’esperienza autorevole, pensata per clienti ad alto valore, demo commerciali forti e percorsi enterprise assistiti.
                </p>
                <div className="sales-hero-buttons">
                  <button className="btn btn-start btn-large" onClick={openPricingSection}>
                    Request Private Demo
                  </button>
                  <button className="btn btn-outline btn-large" onClick={startTour}>
                    Executive Tour
                  </button>
                </div>
                <div className="sales-enterprise-strip">
                  {landingEnterpriseSignals.map((item) => (
                    <div key={item} className="sales-enterprise-pill">{item}</div>
                  ))}
                </div>
                <div className="sales-stats-row">
                  {landingStats.map((item) => (
                    <div key={item.value} className="sales-stat-item">
                      <div className="sales-stat-value">{item.value}</div>
                      <div className="sales-stat-label">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sales-hero-visual">
                <div className="sales-boardroom-shell">
                  <div className="sales-boardroom-header">
                    <div>
                      <div className="sales-boardroom-kicker">Enterprise Control Surface</div>
                      <div className="sales-boardroom-title">AUREO OS / Executive Overview</div>
                    </div>
                    <div className="sales-boardroom-status">Private Demo</div>
                  </div>

                  <div className="sales-boardroom-grid">
                    {landingExecutiveMetrics.map((item) => (
                      <div key={item.label} className="sales-boardroom-metric">
                        <div className="sales-boardroom-metric-label">{item.label}</div>
                        <div className="sales-boardroom-metric-value">{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="sales-phone-mockup">
                    <div className="sales-phone-notch" />
                    <div className="sales-phone-screen">
                      <div className="sales-app-header">
                        <div>
                          <div className="sales-app-title">AUREO OS</div>
                          <div className="sales-app-subtitle">Premium Control Room</div>
                        </div>
                        <div className="sales-app-balance">$100,900</div>
                      </div>
                      <div className="sales-balance-chart">
                        <div className="sales-chart-line" />
                      </div>
                      <div className="sales-bot-status">
                        <span className="sales-status-dot" />
                        <span>Sistema attivo • dashboard, AI e security sincronizzati</span>
                      </div>
                      {[
                        { label: 'AI Guided Investment', meta: 'Segnale live • Budget allocato', value: '+$1,240' },
                        { label: 'DeFi Arbitrage', meta: 'Spread monitorato • 4 venue', value: '+$420' },
                        { label: 'Security Vault', meta: 'Chiavi protette • accesso biometrico', value: 'SAFE' },
                      ].map((item) => (
                        <div key={item.label} className="sales-trade-card">
                          <div className="sales-trade-info">
                            <h4>{item.label}</h4>
                            <span>{item.meta}</span>
                          </div>
                          <div className={`sales-trade-profit ${item.value === 'SAFE' ? 'sales-trade-profit--neutral' : ''}`}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="sales-boardroom-footer">
                    <div className="sales-boardroom-chip">Governance-ready</div>
                    <div className="sales-boardroom-chip">Security-first</div>
                    <div className="sales-boardroom-chip">Executive UX</div>
                  </div>
                </div>
                <div className="sales-float-card sales-float-card--top">
                  <div className="sales-float-card-header">Signal confidence</div>
                  <div className="sales-float-card-value">98.2%</div>
                </div>
                <div className="sales-float-card sales-float-card--bottom">
                  <div className="sales-float-card-header">Passkey & secure access</div>
                  <div className="sales-float-card-value sales-float-card-value--alt">Ready</div>
                </div>
                <img src={heroAsset} alt="" className="sales-hero-orb" />
              </div>
            </section>

            <section className="sales-section" id="landing-features">
              <div className="sales-section-header">
                <h2>Un’esperienza che valorizza davvero il prodotto</h2>
                <p>La landing parla il linguaggio di una piattaforma premium: più controllo percepito, più autorevolezza, più forza commerciale.</p>
              </div>
              <div className="sales-features-grid">
                {landingFeatures.map((item) => (
                  <article key={item.title} className="sales-feature-card">
                    <div className="sales-feature-icon">{item.icon}</div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="sales-section sales-section--assurance" id="landing-assurance">
              <div className="sales-section-header">
                <h2>Security, governance, compliance posture</h2>
                <p>Il messaggio non è solo “bello da vedere”: è “solido da presentare” davanti a clienti più grandi e trattative più serie.</p>
              </div>
              <div className="sales-assurance-grid">
                {landingAssuranceBlocks.map((item) => (
                  <article key={item.title} className="sales-assurance-card">
                    <div className="sales-assurance-title">{item.title}</div>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="sales-section sales-section--enterprise">
              <div className="sales-section-header">
                <h2>Executive posture per clienti più grandi</h2>
                <p>Aureo non deve sembrare soltanto bello: deve sembrare governabile, sicuro e pronto a una conversazione enterprise.</p>
              </div>
              <div className="sales-enterprise-grid">
                {landingEnterpriseBlocks.map((item) => (
                  <article key={item.title} className="sales-enterprise-card">
                    <div className="sales-enterprise-card-kicker">{item.title}</div>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="sales-section sales-section--soft" id="landing-flow">
              <div className="sales-section-header">
                <h2>Operating model in 3 step</h2>
                <p>Prima posizionamento, poi scelta, poi attivazione: tutto dentro la stessa esperienza commerciale.</p>
              </div>
              <div className="sales-steps-container">
                {landingFlow.map((step) => (
                  <article key={step.number} className="sales-step">
                    <div className="sales-step-number">{step.number}</div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="sales-section" id="landing-pricing">
              <div className="sales-section-header">
                <h2>Seleziona il percorso di accesso</h2>
                <p>Tre step chiari, utili per strutturare demo, attivazioni e percorsi commerciali ad alto valore senza perdere controllo.</p>
              </div>
              <div className="sales-pricing-grid">
                {landingPlans.map((plan) => (
                  <article key={plan.id} className={`sales-pricing-card ${plan.id === 'pro' ? 'sales-pricing-card--popular' : ''}`}>
                    {plan.id === 'pro' && <div className="sales-popular-badge">Più richiesto</div>}
                    <div className="sales-pricing-header">
                      <h3>{plan.name}</h3>
                      <div className="sales-price">€{plan.price_monthly}<span>/mese</span></div>
                      <p>{plan.description}</p>
                    </div>
                    <div className="sales-pricing-features">
                      {plan.features.map((feature) => (
                        <div key={feature} className="sales-pricing-feature">✓ {feature}</div>
                      ))}
                    </div>
                    <button className="btn btn-start sales-pricing-button" onClick={() => continueWithPlan(plan.id)}>
                      Richiedi {plan.name}
                    </button>
                  </article>
                ))}
              </div>
            </section>

            {selectedPlan && (
              <section className="sales-section sales-section--onboarding" id="landing-plan-onboarding">
                <div className="sales-inline-plan">
                  <div className="sales-inline-plan-badge">Percorso selezionato</div>
                  <h3>{selectedPlan.name}</h3>
                  <p>{selectedPlan.description}</p>
                  <div className="sales-inline-plan-price">€{selectedPlan.price_monthly}<span>/mese</span></div>
                  <div className="sales-inline-plan-features">
                    {selectedPlan.features.map((feature) => (
                      <div key={feature} className="sales-inline-plan-feature">✓ {feature}</div>
                    ))}
                  </div>
                </div>

                <form className="sales-inline-form" onSubmit={handleLogin}>
                  <div className="sales-inline-form-head">
                    <div className="sales-badge sales-badge--small">Attivazione guidata</div>
                    <h3>{isRegistering ? `Crea il tuo accesso per ${selectedPlan.name}` : `Accedi per proseguire con ${selectedPlan.name}`}</h3>
                    <p>
                      {isRegistering
                        ? 'Completa qui la registrazione e continua senza uscire dalla pagina.'
                        : 'Se hai già un account, entra qui sotto e prosegui direttamente con lo step scelto.'}
                    </p>
                  </div>
                  <input
                    type="email"
                    placeholder="La tua email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="sales-input"
                  />
                  <input
                    type="password"
                    placeholder={isRegistering ? 'Crea una password' : 'Inserisci la tua password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="sales-input"
                  />
                  {loginError && (
                    <div className={`sales-form-message ${loginError.toLowerCase().includes('successo') || loginError.toLowerCase().includes('creato') ? 'sales-form-message--success' : ''}`}>
                      {loginError}
                    </div>
                  )}
                  <button type="submit" className="btn btn-start sales-submit-button">
                    {isRegistering ? `Crea accesso e continua con ${selectedPlan.name}` : `Accedi e continua con ${selectedPlan.name}`}
                  </button>
                  {/*
                  <button type="button" className="btn btn-outline sales-alt-button" onClick={() => setIsRegistering(!isRegistering)}>
                    {isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
                  </button>
                  */}
                  <button
                    type="button"
                    className="btn sales-ghost-button"
                    onClick={() => {
                      setSelectedPlanId('');
                      setIsRegistering(false);
                      setLoginError('');
                      setPassword('');
                      setEmail('');
                    }}
                  >
                    Cambia step
                  </button>
                </form>
              </section>
            )}

            <section className="sales-section sales-section--proof" id="landing-proof">
              <div className="sales-section-header">
                <h2>Impatto percepito</h2>
                <p>Prova sociale, autorevolezza e qualità percepita: elementi chiave quando il prodotto vuole salire di fascia.</p>
              </div>
              <div className="sales-testimonials-grid">
                {landingTestimonials.map((item) => (
                  <article key={item.name} className="sales-testimonial-card">
                    <div className="sales-testimonial-header">
                      <div className="sales-testimonial-avatar">{item.initials}</div>
                      <div>
                        <h4>{item.name}</h4>
                        <span>{item.role}</span>
                      </div>
                    </div>
                    <div className="sales-stars">★★★★★</div>
                    <p>{item.quote}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="sales-cta">
              <div className="sales-cta-box">
                <div className="sales-cta-content">
                  <img src="/aureoos-logo.png" alt="Aureo OS" className="sales-cta-logo" />
                  <h2>Presenta Aureo come una private operating interface, non come una semplice webapp</h2>
                  <p>Questa direzione rende più chiaro il salto: meno sensazione retail, più percezione di piattaforma executive per demo private e clienti high-ticket.</p>
                  <div className="sales-trust-row">
                    {landingTrustPillars.map((item) => (
                      <div key={item} className="sales-trust-pill">{item}</div>
                    ))}
                  </div>
                  <div className="sales-hero-buttons sales-hero-buttons--center">
                    <button className="btn btn-start btn-large" onClick={openPricingSection}>Request Private Demo</button>
                    <button className="btn btn-outline btn-large" onClick={startTour}>Apri executive tour</button>
                  </div>
                </div>
              </div>
            </section>

            <footer className="sales-footer">
              <div className="sales-footer-grid">
                <div className="sales-footer-brand">
                  <a href="#landing-top" className="sales-logo">
                    <img src="/aureoos-logo.png" alt="Aureo OS" />
                  </a>
                  <p>Dashboard, AI, trading, DeFi e security in un’unica esperienza premium pensata per controllo, chiarezza e presenza.</p>
                </div>
                <div className="sales-footer-links">
                  <h4>Prodotto</h4>
                  <a href="#landing-features">Funzionalità</a>
                  <a href="#landing-assurance">Assurance</a>
                  <a href="#landing-pricing">Step</a>
                </div>
                <div className="sales-footer-links">
                  <h4>Esperienza</h4>
                  <a href="#landing-flow">Operating Model</a>
                  <a href="#landing-proof">Impatto</a>
                </div>
                <div className="sales-footer-links">
                  <h4>Accesso</h4>
                  <button type="button" className="sales-footer-button" onClick={() => setShowLanding(false)}>Accedi</button>
                  <button type="button" className="sales-footer-button" onClick={openPricingSection}>Request demo</button>
                </div>
              </div>
              <div className="sales-footer-bottom">
                <span>© 2026 AUREO OS</span>
                <span>Premium crypto & investment experience</span>
              </div>
            </footer>
          </div>
        </div>
      );
    }

    return (
      <div className="omni-app" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', width: '400px', padding: '3rem 2rem' }}>
          <img src="/aureoos-logo.png" alt="Aureo OS" style={{ maxWidth: '100%', maxHeight: '140px', marginBottom: '1.5rem', objectFit: 'contain' }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>Ponte di Comando Autenticato</p>
          <form onSubmit={handleLogin}>
            <input 
              type="email" 
              placeholder={isRegistering ? "La tua Email" : "Email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}
            />
            <input 
              type="password" 
              placeholder={isRegistering ? "Crea una Password" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}
            />
            {loginError && <div style={{ color: 'var(--accent-red)', marginBottom: '1rem', fontSize: '0.9rem' }}>{loginError}</div>}
            <button type="submit" className="btn btn-start" style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>
              {isRegistering ? 'CREA ACCOUNT' : 'ACCEDI'}
            </button>
          </form>
          {/* <button
            type="button"
            className="btn btn-outline"
            onClick={() => setIsRegistering(!isRegistering)}
            style={{ width: '100%', marginTop: '0.9rem', padding: '0.95rem', fontSize: '0.95rem' }}
          >
            {isRegistering ? 'HAI GIÀ UN ACCOUNT? ACCEDI' : 'NON HAI UN ACCOUNT? REGISTRATI'}
          </button> */}
          <button
            type="button"
            className="btn"
            onClick={handlePasskeyLogin}
            disabled={!passkeySupported || passkeyBusy || isRegistering}
            style={{ width: '100%', marginTop: '0.9rem', padding: '0.95rem', fontSize: '0.95rem', opacity: (passkeySupported && !isRegistering) ? 1 : 0.3 }}
          >
            {passkeyBusy ? 'Accesso biometrico…' : 'ACCEDI CON FACE ID / TOUCH ID'}
          </button>
          <button type="button" className="btn btn-outline" onClick={enterDemoMode} style={{ width: '100%', marginTop: '0.9rem', padding: '0.95rem', fontSize: '0.95rem', opacity: isRegistering ? 0.3 : 1 }}>
            ENTRA IN DEMO MODE
          </button>
          <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#64748b' }}>
            🔒 Protetto da Crittografia<br/>
          </div>
        </div>
      </div>
    );
  }

  // --- INTERFACCIA AUTENTICATA (ADMIN O USER ATTIVO) ---
  return (
    <>
    <div className="omni-app">
      <div className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="sidebar-brand-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <img src="/aureoos-logo.png" alt="Aureo OS" style={{ width: '200px', maxWidth: '100%', height: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="sidebar-brand-tagline" style={{ width: '200px', maxWidth: '100%', fontSize: '0.7rem', color: '#888', marginTop: '0.5rem', letterSpacing: '1px', textAlign: 'center' }}>CRYPTO & INVESTMENT TRADING</div>
        </div>
        
        <div className="sidebar-menu">
          <div className={`menu-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            <span className="menu-icon">📊</span>
            <span className="menu-label">Dashboard</span>
          </div>
          <div className={`menu-item ${activeTab === 'trading' ? 'active' : ''}`} onClick={() => setActiveTab('trading')}>
            <span className="menu-icon">📈</span>
            <span className="menu-label">Trading</span>
            {status.modules?.trading && <div className="active-dot"></div>}
          </div>
          <div className={`menu-item ${activeTab === 'charts' ? 'active' : ''}`} onClick={() => setActiveTab('charts')}>
            <span className="menu-icon">📉</span>
            <span className="menu-label">Charts</span>
          </div>
          {userRole === 'admin' && (
            <div className={`menu-item ${activeTab === 'develop' ? 'active' : ''}`} onClick={() => openDevelopSection('health')}>
              <span className="menu-icon">⚙️</span>
              <span className="menu-label">Engine Room</span>
            </div>
          )}
          {BILLING_ENABLED && userRole === 'admin' && (
            <div className={`menu-item ${activeTab === 'saas' ? 'active' : ''}`} onClick={() => setActiveTab('saas')}>
              <span className="menu-icon">💳</span>
              <span className="menu-label">Billing</span>
            </div>
          )}
        </div>
        
        <div className="sidebar-footer">
          <div>Connesso a server sicuro</div>
          <div style={{ color: '#10b981', marginTop: '0.2rem' }}>All Systems Nominal</div>
          <div className={`sync-pill ${isBackendOnline ? 'online' : 'offline'}`}>{syncLabel}</div>
          
          {userRole === 'user' && (
            <button className="btn btn-start" onClick={() => setShowPaymentModal(true)} style={{ width: '100%', marginTop: '1rem', fontSize: '1rem', padding: '0.8rem', background: userIsPaid ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f59e0b, #d97706)', border: 'none', boxShadow: userIsPaid ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(245, 158, 11, 0.3)' }}>
              {userIsPaid ? '♻️ Rinnova Abbonamento' : '💎 Sblocca Pro / Paga'}
            </button>
          )}

          <div className="sidebar-user-pill" style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            👤 {email}
          </div>

          <button
            onClick={handleLogout}
            className="btn"
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
          >
            LOGOUT
          </button>
        </div>
        

      </div>
      
      <div className="main-content">
        {/* Onboarding Modal */}
        {showOnboarding && (
          <OnboardingModal 
            onClose={() => setShowOnboarding(false)} 
            onGoToSettings={() => {
              setShowOnboarding(false);
              openDevelopSection('security');
            }}
          />
        )}

        {/* Missing Keys Banner */}
        {(!apiKeys.alpaca_key && userRole !== 'admin' && !isDemoMode) && (
          <div className="setup-banner" style={{
            background: 'linear-gradient(90deg, #f59e0b, #d97706)',
            color: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)'
          }}>
            <div>
              <strong>Azione Richiesta:</strong> Configura le tue API Key per iniziare a operare sui mercati.
            </div>
            <button 
              onClick={() => openDevelopSection('security')}
              className="setup-banner-button"
              style={{
                background: '#fff', color: '#d97706', border: 'none', padding: '0.5rem 1rem',
                borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              Vai alle Impostazioni →
            </button>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '600px', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
              <button onClick={() => setShowPaymentModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
              {renderCryptoPaywall()}
            </div>
          </div>
        )}

        {isDemoMode && (
          <div className="demo-mode-banner">
            Demo mode attiva — puoi esplorare il prodotto, ma le azioni live sono bloccate.
          </div>
        )}
        <div className="mobile-shell-header">
          <div>
            <div className="mobile-shell-kicker">AUREO OS</div>
            <div className="mobile-shell-title">{activeTabLabel}</div>
            {isDemoMode && <div className="demo-mode-pill">DEMO MODE</div>}
            <div className={`sync-pill ${isBackendOnline ? 'online' : 'offline'}`}>{syncLabel}</div>
          </div>
          <button onClick={handleLogout} className="btn mobile-shell-action">
            Logout
          </button>
        </div>
        {activeTab === 'home' && renderHomeView()}
        {activeTab === 'trading' && renderTradingView()}
        {activeTab === 'charts' && (
          <ChartsStudio
            chartData={chartData}
            selectedSymbol={selectedSymbol}
            setSelectedSymbol={setSelectedSymbol}
            status={status}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
          />
        )}
        {activeTab === 'develop' && userRole === 'admin' && (
          <DevelopView
            status={status}
            isBackendOnline={isBackendOnline}
            savedKeys={savedKeys}
            lastVaultSync={lastVaultSync}
            developSection={developSection}
            setDevelopSection={setDevelopSection}
            renderSettingsView={renderSettingsView}
            renderGuideView={renderGuideView}
          />
        )}
        {activeTab === 'sports_arb' && renderSportsArbitrageView()}
        {activeTab === 'value_bets' && renderValueBetsView()}
        {activeTab === 'ai_content' && renderAIContentView()}
        {BILLING_ENABLED && activeTab === 'saas' && renderSaaSView()}
        <BottomReminderBar
          status={status}
          risk={status.risk}
          savedKeys={savedKeys}
          isBackendOnline={isBackendOnline}
          syncLabel={syncLabel}
          activeTab={activeTab}
          onOpenHealth={() => openDevelopSection('health')}
          onOpenSecurity={() => openDevelopSection('security')}
          onOpenTrading={() => setActiveTab('trading')}
        />
      </div>
    </div>

    {/* ===== AI SIGNAL MODAL ===== */}
    {aiModal && (
      <div
        onClick={() => setAiModal(null)}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '20px', padding: '2rem', width: '420px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)', position: 'relative'
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setAiModal(null)}
            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}
          >×</button>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2rem' }}>🤖</div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.3rem', color: '#f59e0b' }}>{aiModal.symbol}</div>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Analisi AI – Groq LLaMA</div>
            </div>
          </div>

          {/* Context row */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.7rem', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Prezzo</div>
              <div style={{ color: '#e2e8f0', fontFamily: 'monospace', fontWeight: 'bold' }}>
                ${aiModal.price < 0.01 ? aiModal.price.toFixed(8) : aiModal.price < 1 ? aiModal.price.toFixed(6) : aiModal.price.toFixed(4)}
              </div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.7rem', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Var 24h</div>
              <div style={{ color: aiModal.change_24h >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace', fontWeight: 'bold' }}>
                {aiModal.change_24h >= 0 ? '+' : ''}{aiModal.change_24h?.toFixed(2)}%
              </div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.7rem', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Volatilità</div>
              <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontWeight: 'bold' }}>{aiModal.volatility?.toFixed(1)}%</div>
            </div>
          </div>

          {/* Loading state */}
          {aiModal.loading && (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#f59e0b' }}>
              <div style={{ fontSize: '2rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
              <div style={{ marginTop: '0.8rem', color: '#94a3b8' }}>LLaMA sta analizzando il mercato...</div>
            </div>
          )}

          {/* Error state */}
          {!aiModal.loading && aiModal.error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '10px', padding: '1rem', color: '#f87171', textAlign: 'center' }}>
              ❌ {aiModal.error}
            </div>
          )}

          {/* Result state */}
          {!aiModal.loading && aiModal.result && (() => {
            const r = aiModal.result;
            const signalColor = r.signal === 'BUY' ? '#10b981' : r.signal === 'SELL' ? '#ef4444' : '#f59e0b';
            const signalBg = r.signal === 'BUY' ? 'rgba(16,185,129,0.15)' : r.signal === 'SELL' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
            const signalEmoji = r.signal === 'BUY' ? '📈' : r.signal === 'SELL' ? '📉' : '⏸️';
            return (
              <>
                {/* Signal badge */}
                <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
                  <div style={{ background: signalBg, border: `2px solid ${signalColor}`, borderRadius: '14px', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 2rem' }}>
                    <span style={{ fontSize: '1.8rem' }}>{signalEmoji}</span>
                    <span style={{ fontSize: '1.6rem', fontWeight: '900', color: signalColor, letterSpacing: '2px' }}>{r.signal}</span>
                  </div>
                  <div style={{ color: r.confidence >= 80 ? '#10b981' : r.confidence >= 50 ? '#f59e0b' : '#ef4444', marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {r.confidence}%
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Confidence Score AI</div>
                </div>

                {/* Reasoning */}
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '1rem', marginBottom: '1.2rem', color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.6' }}>
                  💡 {r.reasoning}
                </div>

                {/* Price targets */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem', marginBottom: '1.2rem' }}>
                  <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '0.7rem', textAlign: 'center' }}>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>🎯 Target</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <HighRiskPnLSparkline history={r.price_history} />
                      <div style={{ color: '#10b981', fontFamily: 'monospace', fontWeight: 'bold' }}>${Number(r.target_price).toFixed(r.target_price < 0.01 ? 8 : r.target_price < 1 ? 6 : 4)}</div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.7rem', textAlign: 'center' }}>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>🛡️ Stop Loss</div>
                    <div style={{ color: '#ef4444', fontFamily: 'monospace', fontWeight: 'bold' }}>${Number(r.stop_loss).toFixed(r.stop_loss < 0.01 ? 8 : r.stop_loss < 1 ? 6 : 4)}</div>
                  </div>
                </div>

                {/* Quick trade from modal */}
                <div style={{ display: 'flex', gap: '0.7rem' }}>
                  <button
                    onClick={() => { quickTrade(aiModal.symbol, 'buy', tradeSize); setAiModal(null); }}
                    disabled={isDemoMode}
                    style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: '#10b981', cursor: isDemoMode ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isDemoMode ? 0.5 : 1 }}
                  >⬆ BUY ${tradeSize}</button>
                  <button
                    onClick={() => { quickTrade(aiModal.symbol, 'sell', tradeSize); setAiModal(null); }}
                    disabled={isDemoMode}
                    style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', cursor: isDemoMode ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isDemoMode ? 0.5 : 1 }}
                  >⬇ SELL ${tradeSize}</button>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    )}
    </>
  );
}

export default function OmniApp() {
  return (
    <ErrorBoundary>
      <OmniAppInner />
    </ErrorBoundary>
  );
}
