import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import heroAsset from './assets/hero.png';
import ChartsStudio from './ChartsStudio';
const AUTH_TOKEN_KEY = 'omni_auth_token';
const AUTH_TIME_KEY = 'omni_auth_time';
const DEMO_MODE_KEY = 'omni_demo_mode';
const BILLING_ENABLED = true;
const SYMBOL_REVIEW_HASH_PREFIX = '#review=';
const TAB_TITLES = {
  home: 'Dashboard',
  trading: 'Stock Market',
  charts: 'Charts',
  security: 'Security Vault',
  symbol_review: 'Symbol Review',
  develop: 'Engine Room',
  sports_arb: 'Sports SureBets',
  value_bets: 'AI Sentiment',
  ai_content: 'AI Content',
  saas: 'SaaS & Billing',
};

const DEMO_BILLING_OVERVIEW = {
  metrics: {
    active_customers: 2,
    trialing_customers: 1,
    monthly_recurring_revenue: 203,
    annual_run_rate: 2440,
    leads_count: 4,
    collection_rate: 82,
  },
  plans: [
    {
      id: 'week_pass',
      name: 'Aureo Access Week',
      price_monthly: 25,
      price_label: '€25',
      cadence_label: '/prima settimana',
      currency: 'EUR',
      tagline: 'Ingresso rapido, esperienza completa',
      ideal_for: 'Ideale per chi vuole entrare subito in Aureo, vivere l’esperienza completa e capire in pochi giorni se è il proprio ambiente operativo.',
      description: 'Sette giorni di accesso pieno per provare Aureo nella sua forma completa, con la stessa qualità dell’esperienza continuativa.',
      features: ['Accesso completo a tutti i moduli', 'Esperienza premium riservata', 'Alert e controllo inclusi', 'Attivazione guidata'],
      modules: ['dashboard', 'trading', 'sentiment', 'ai_content', 'billing'],
      checkout_url: 'https://buy.stripe.com/test_week',
    },
    {
      id: 'monthly',
      name: 'Aureo Monthly',
      price_monthly: 120,
      price_label: '€120',
      cadence_label: '/mese',
      currency: 'EUR',
      tagline: 'La scelta più naturale per l’uso continuativo',
      ideal_for: 'Ideale per chi vuole mantenere Aureo attivo ogni mese con accesso pieno, continuità e presidio costante.',
      description: 'L’abbonamento mensile pensato per chi usa Aureo con regolarità e vuole una formula forte, semplice e sempre attiva.',
      features: ['Accesso completo continuativo', 'Tutti i moduli Aureo inclusi', 'Supporto operativo', 'Esperienza multi-device'],
      modules: ['dashboard', 'trading', 'sentiment', 'ai_content', 'billing'],
      checkout_url: 'https://buy.stripe.com/test_monthly',
    },
    {
      id: 'annual',
      name: 'Aureo Annual',
      price_monthly: 1000,
      price_label: '€1000',
      cadence_label: '/anno',
      monthly_equivalent: 83.33,
      currency: 'EUR',
      tagline: 'Il modo più solido di restare dentro Aureo',
      ideal_for: 'Ideale per chi vuole continuità totale, costo ottimizzato e una presenza stabile di Aureo nel proprio setup operativo.',
      description: 'La formula annuale per chi vuole il massimo della continuità con il miglior rapporto tra accesso, stabilità e valore.',
      features: ['Accesso completo per 12 mesi', 'Costo medio mensile ridotto', 'Tutti i moduli inclusi', 'Priorità sul rinnovo'],
      modules: ['dashboard', 'trading', 'sentiment', 'ai_content', 'billing'],
      checkout_url: 'https://buy.stripe.com/test_annual',
    },
  ],
  customers: [
    { id: 'cus_demo_alpha', company: 'Alpha Quant Studio', contact_name: 'Marco Rossi', email: 'marco@alphaquant.studio', plan_id: 'monthly', status: 'active', seats: 3, monthly_amount: 120, next_billing_at: '2026-08-12' },
    { id: 'cus_demo_beta', company: 'Beta Capital Lab', contact_name: 'Giulia Bianchi', email: 'giulia@betacapitallab.com', plan_id: 'annual', status: 'active', seats: 1, monthly_amount: 83.33, next_billing_at: '2027-07-08' },
  ],
  leads: [
    { id: 'lead_demo_1', company: 'Omega Signals', contact_name: 'Luca Verdi', email: 'luca@omegasignals.io', plan_id: 'week_pass', status: 'lead', created_at: '2026-07-02' },
  ],
  recent_activity: [
    { id: 'act_1', user_email: 'marco@alphaquant.studio', amount: 120, currency: 'USDT', txid: 'T...X8Y9', status: 'verified' },
    { id: 'act_2', user_email: 'giulia@betacapitallab.com', amount: 1000, currency: 'USDT', txid: 'T...J3K4', status: 'pending' },
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
const sanitizeSymbolCode = (value = '') => String(value || '').trim().toUpperCase();
const buildSymbolReviewHash = (symbol = '') => `${SYMBOL_REVIEW_HASH_PREFIX}${encodeURIComponent(sanitizeSymbolCode(symbol))}`;
const getSymbolFromHash = (hash = '') => {
  const value = String(hash || '').trim();
  if (!value.startsWith(SYMBOL_REVIEW_HASH_PREFIX)) return '';
  try {
    return sanitizeSymbolCode(decodeURIComponent(value.slice(SYMBOL_REVIEW_HASH_PREFIX.length)));
  } catch {
    return sanitizeSymbolCode(value.slice(SYMBOL_REVIEW_HASH_PREFIX.length));
  }
};

const formatAccountAccessMeta = (profile = {}, fallbackStatus = 'active') => {
  const status = String(profile?.status || fallbackStatus || 'active').toLowerCase();
  const expiresAt = profile?.subscription_expires_at || null;
  const isPaid = !!profile?.is_paid;
  if (!expiresAt) {
    if (status === 'pending') {
      return {
        title: 'Demo attiva',
        detail: 'Accesso demo in attesa di attivazione completa',
        tone: '#f59e0b',
        isExpired: false,
        isExpiringSoon: false,
        daysRemaining: null,
        actionLabel: 'Completa attivazione',
      };
    }
    return {
      title: isPaid ? 'Accesso attivo' : 'Accesso attivo',
      detail: isPaid ? 'Abbonamento attivo senza scadenza visibile' : 'Attivazione manuale presente',
      tone: '#10b981',
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null,
      actionLabel: '',
    };
  }

  const expDate = new Date(expiresAt.replace(' ', 'T'));
  if (Number.isNaN(expDate.getTime())) {
    return {
      title: 'Accesso attivo',
      detail: `Scadenza registrata: ${expiresAt}`,
      tone: '#10b981',
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null,
      actionLabel: '',
    };
  }

  const diffMs = expDate.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const formattedDate = expDate.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  if (diffMs < 0) {
    return {
      title: 'Accesso scaduto',
      detail: `Scaduto il ${formattedDate}`,
      tone: '#ef4444',
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: diffDays,
      actionLabel: 'Tocca per rinnovare',
    };
  }

  const durationLabel = diffDays === 0
    ? 'Scade oggi'
    : diffDays === 1
      ? '1 giorno residuo'
      : `${diffDays} giorni residui`;

  return {
    title: isPaid ? 'Abbonamento attivo' : 'Accesso attivo',
    detail: `${durationLabel} • fino al ${formattedDate}`,
    tone: diffDays <= 3 ? '#f59e0b' : '#10b981',
    isExpired: false,
    isExpiringSoon: diffDays <= 3,
    daysRemaining: diffDays,
    actionLabel: diffDays <= 3 ? 'Tocca per rinnovare' : '',
  };
};

const deriveMissingSetupItems = (savedKeys = {}) => {
  const missing = [];
  if (!(savedKeys?.ALPACA_KEY && savedKeys?.ALPACA_SECRET)) missing.push('Broker Alpaca');
  if (!savedKeys?.GROQ_KEY) missing.push('AI Groq');
  if (!((savedKeys?.TELEGRAM_BOT_TOKEN && savedKeys?.TELEGRAM_CHAT_ID) || (savedKeys?.PUSHOVER_APP_TOKEN && savedKeys?.PUSHOVER_USER_KEY))) {
    missing.push('Alert esterni');
  }
  return missing;
};

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
    case 'symbol_review':
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

const normalizeAssetTypeLabel = (assetType = '', symbol = '') => {
  const value = String(assetType || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  const rawSymbol = String(symbol || '').trim().toUpperCase();
  if (['stock', 'stocks', 'equity', 'equities', 'azione', 'azioni'].includes(value)) return 'stock';
  if (['crypto', 'cryptocurrency', 'cryptocurrencies', 'coin', 'coins', 'token', 'tokens', 'cripto'].includes(value)) return 'crypto';
  if (rawSymbol.includes('/') || rawSymbol.endsWith('-USD') || rawSymbol.endsWith('-USDT') || rawSymbol.endsWith('USD') || rawSymbol.endsWith('USDT')) return 'crypto';
  return value || 'stock';
};

const normalizeCryptoDisplaySymbol = (symbol = '') => {
  let value = String(symbol || '').trim().toUpperCase();
  if (!value) return '';
  value = value.replace('-USD', '/USD').replace('-USDT', '/USD');
  if (!value.includes('/')) {
    if (value.endsWith('USDT')) return `${value.slice(0, -4)}/USD`;
    if (value.endsWith('USD')) return `${value.slice(0, -3)}/USD`;
  }
  return value.replace('/USDT', '/USD');
};

const normalizeInvestmentSymbol = (symbol = '', assetType = '') => {
  const normalizedAssetType = normalizeAssetTypeLabel(assetType, symbol);
  return normalizedAssetType === 'crypto'
    ? normalizeCryptoDisplaySymbol(symbol)
    : String(symbol || '').trim().toUpperCase();
};

const sanitizeInvestmentProposal = (proposal = {}, index = 0) => {
  const symbol = normalizeInvestmentSymbol(proposal.symbol, proposal.asset_type);
  const assetType = normalizeAssetTypeLabel(proposal.asset_type, symbol);
  if (!symbol) return null;
  return {
    id: proposal.id ?? `proposal-${index + 1}`,
    risk: proposal.risk || 'Bilanciato',
    symbol,
    asset_type: assetType,
    title: proposal.title || symbol,
    rationale: proposal.rationale || 'Proposta generata dal motore AI di Aureo.',
  };
};

const hasArmedAlertChannel = (savedKeys = {}) => !!(
  (savedKeys?.PUSHOVER_APP_TOKEN && savedKeys?.PUSHOVER_USER_KEY && savedKeys?.PUSHOVER_ALERTS_ENABLED !== false) ||
  (savedKeys?.TELEGRAM_BOT_TOKEN && savedKeys?.TELEGRAM_CHAT_ID && savedKeys?.TELEGRAM_ALERTS_ENABLED !== false)
);

const deriveSystemHealthSnapshot = ({ status = {}, risk = {}, savedKeys = {}, isBackendOnline = true, cryptoEngine = null }) => {
  const runtimeHealth = status?.runtime_health || {};
  const alertArmed = hasArmedAlertChannel(savedKeys);
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
  const alertReady = hasArmedAlertChannel(savedKeys);

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

const deriveOpportunitySpotlight = (opportunities = []) => {
  const ready = opportunities.filter((item) => item.readiness?.score >= 78 && item.headline?.label === 'Pronto');
  const warming = opportunities.filter((item) => item.readiness?.score >= 58 && item.readiness?.score < 78);
  const spotlight = ready[0] || opportunities[0] || null;

  return {
    spotlight,
    readyCount: ready.length,
    warmingCount: warming.length,
  };
};

const deriveSymbolDrilldown = ({ symbol = '', status = {}, row = null, readiness = null, tradePerformance = null, cryptoState = null }) => {
  const currentPosition = status?.positions?.[symbol];
  const isOpen = currentPosition && currentPosition !== 'LIQUID';
  const tradeRow = tradePerformance?.symbolRows?.find((item) => item.symbol === symbol) || null;
  const recentTrades = (tradePerformance?.recentTrades || []).filter((item) => item.symbol === symbol).slice(0, 4);
  const metrics = parsePredictionMetrics(row?.prediction || '');
  const headline = deriveEntryHeadline(readiness);

  return {
    symbol,
    headline,
    isOpen,
    currentPosition,
    sentiment: row?.sentiment || 'NEUTRAL',
    metrics,
    tradeRow,
    recentTrades,
    cryptoState,
  };
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
  componentDidCatch(error, errorInfo) {
    console.error('Aureo frontend crash', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="frontend-crash-shell">
          <div className="frontend-crash-card">
            <div className="frontend-crash-badge">AUREO OS · Safe Recovery</div>
            <h2>Interfaccia momentaneamente interrotta</h2>
            <p>
              Nessun problema: il motore può continuare a girare, ma questa schermata ha bisogno di essere riallineata.
            </p>
            <div className="frontend-crash-actions">
              <button
                type="button"
                className="btn btn-start"
                onClick={() => window.location.reload()}
              >
                Ricarica interfaccia
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  window.history.replaceState(null, '', window.location.pathname);
                  window.location.reload();
                }}
              >
                Riparti pulito
              </button>
            </div>
            <div className="frontend-crash-meta">
              <strong>Dettaglio tecnico</strong>
              <span>{this.state.error?.toString?.() || 'Errore non specificato'}</span>
            </div>
          </div>
        </div>
      );
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

const BottomReminderBar = ({ status, risk, savedKeys, isBackendOnline, syncLabel, activeTab, onOpenHealth, onOpenSecurity, onOpenTrading, onOpenSymbolReview }) => {
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
  const alertArmed = hasArmedAlertChannel(savedKeys);
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
                  <SymbolLinkButton
                    key={symbol}
                    symbol={symbol}
                    onOpen={(sym) => onOpenSymbolReview?.(sym, activeTab)}
                    variant="pill"
                    style={{ margin: 0 }}
                  >
                    {symbol}
                  </SymbolLinkButton>
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
  const pressureLevel = !riskEnabled
    ? { label: 'Protezione spenta', tone: '#64748B', detail: 'Il motore non sta più filtrando nuove operazioni.' }
    : positionsRemaining === 0
      ? { label: 'Satura', tone: '#EF4444', detail: 'Prima di entrare serve liberare almeno una posizione.' }
      : positionsRemaining === 1
        ? { label: 'Tesa', tone: '#F59E0B', detail: 'Resta un solo slot operativo prima del limite.' }
        : { label: 'Libera', tone: '#10B981', detail: 'C’è ancora spazio per nuove operazioni filtrate.' };
  const alertFeed = Array.isArray(risk.alerts) ? risk.alerts.slice(0, 4) : [];

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
      pushNotice('success', 'Risk Management aggiornato', data?.risk?.reason || 'Stato operativo sincronizzato.');
    } catch (error) {
      pushNotice('error', 'Risk Management non aggiornato', error.message || 'Impossibile aggiornare Risk Management');
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

      <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
        <div style={{ padding: '0.85rem 0.95rem', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: `1px solid ${statusColor}33` }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Postura rischio</div>
          <div style={{ color: statusColor, fontWeight: 800, fontSize: '1rem', marginBottom: '0.28rem' }}>{meta.title}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.4 }}>{meta.description}</div>
        </div>
        <div style={{ padding: '0.85rem 0.95rem', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: `1px solid ${pressureLevel.tone}33` }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Pressione capacità</div>
          <div style={{ color: pressureLevel.tone, fontWeight: 800, fontSize: '1rem', marginBottom: '0.28rem' }}>{pressureLevel.label}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.4 }}>{pressureLevel.detail}</div>
        </div>
        <div style={{ padding: '0.85rem 0.95rem', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(56,189,248,0.2)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Drawdown guard</div>
          <div style={{ color: Number(risk.max_drawdown_pct || 0) >= 8 ? '#EF4444' : Number(risk.max_drawdown_pct || 0) >= 5 ? '#F59E0B' : '#38BDF8', fontWeight: 800, fontSize: '1rem', marginBottom: '0.28rem' }}>
            {Number(risk.max_drawdown_pct || 0).toFixed(1)}%
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.4 }}>
            {Number(risk.max_drawdown_pct || 0) >= 8 ? 'Vicino alla soglia critica.' : 'Sotto controllo rispetto ai limiti attuali.'}
          </div>
        </div>
      </div>

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
      <div style={{ marginTop: '1rem', padding: '0.95rem', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, marginBottom: '0.55rem' }}>Ultimi alert del Risk Engine</div>
        {alertFeed.length ? (
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            {alertFeed.map((line, index) => (
              <div key={index} style={{ padding: '0.6rem 0.7rem', borderRadius: '10px', background: 'rgba(0,0,0,0.18)', color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.45 }}>
                {line}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>Nessun alert recente registrato dal risk engine.</div>
        )}
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
  const risk = status?.risk || {};
  const runtimeHealth = status?.runtime_health || {};
  const cryptoEngine = deriveCryptoEngineState(status);
  const opsActionPlan = deriveOpsActionPlan({ status, risk, savedKeys, isBackendOnline });
  const systemHealthSnapshot = deriveSystemHealthSnapshot({ status, risk, savedKeys, isBackendOnline, cryptoEngine });
  const alertArmed = hasArmedAlertChannel(savedKeys);
  const channelSummary = [
    savedKeys['PUSHOVER_APP_TOKEN'] && savedKeys['PUSHOVER_USER_KEY'] && savedKeys['PUSHOVER_ALERTS_ENABLED'] !== false ? 'Pushover live' : null,
    savedKeys['TELEGRAM_BOT_TOKEN'] && savedKeys['TELEGRAM_CHAT_ID'] && savedKeys['TELEGRAM_ALERTS_ENABLED'] !== false ? 'Telegram live' : null,
  ].filter(Boolean);
  const runtimeTone = runtimeHealth?.status === 'red' ? '#ef4444' : runtimeHealth?.status === 'yellow' ? '#f59e0b' : '#10b981';
  const activeSectionLabel = developSection === 'health' ? 'Health Console' : developSection === 'security' ? 'Security Vault' : 'Setup Guide';

  return (
  <div className="module-content module-content--develop">
    <div className="card develop-hero-card" style={{ marginBottom: '1.6rem' }}>
      <div className="develop-hero-top">
        <div>
          <h2 style={{ margin: 0 }}>⚙️ Engine Room</h2>
          <div className="develop-hero-subtitle">
            Cabina di controllo interna per runtime, alert, sicurezza operativa e setup dell’infrastruttura Aureo.
          </div>
        </div>
        <div className="develop-hero-badges">
          <div className="badge" style={{ borderColor: `${systemHealthSnapshot.tone}55`, color: systemHealthSnapshot.tone, background: `${systemHealthSnapshot.tone}12` }}>
            Health {systemHealthSnapshot.score}/100
          </div>
          <div className={`badge ${isBackendOnline ? 'badge-active' : 'badge-danger'}`}>
            {isBackendOnline ? 'Backend online' : 'Backend offline'}
          </div>
        </div>
      </div>

      <div className="develop-summary-grid">
        <div className="develop-summary-card" style={{ borderColor: `${runtimeTone}33` }}>
          <span>Runtime</span>
          <strong style={{ color: runtimeTone }}>{(runtimeHealth?.status || 'green').toUpperCase()}</strong>
          <small>{runtimeHealth?.summary || 'Nessun riepilogo runtime disponibile.'}</small>
        </div>
        <div className="develop-summary-card" style={{ borderColor: `${alertArmed ? '#10b981' : '#f59e0b'}33` }}>
          <span>Canali alert</span>
          <strong style={{ color: alertArmed ? '#10b981' : '#f59e0b' }}>{alertArmed ? 'Armati' : 'Da armare'}</strong>
          <small>{channelSummary.length ? channelSummary.join(' · ') : 'Serve almeno un canale attivo per gli eventi critici.'}</small>
        </div>
        <div className="develop-summary-card" style={{ borderColor: `${cryptoEngine?.tone || '#a78bfa'}33` }}>
          <span>Crypto engine</span>
          <strong style={{ color: cryptoEngine?.tone || '#a78bfa' }}>{cryptoEngine?.badge || 'SYNC'}</strong>
          <small>{cryptoEngine?.subtitle || 'Nessun dato crypto disponibile.'}</small>
        </div>
        <div className="develop-summary-card" style={{ borderColor: 'rgba(167, 139, 250, 0.28)' }}>
          <span>Sezione attiva</span>
          <strong style={{ color: '#f8fafc' }}>{activeSectionLabel}</strong>
          <small>Ultimo sync Vault: {lastVaultSync || 'non ancora sincronizzato'}</small>
        </div>
      </div>
    </div>

    <div className="develop-tabbar">
      {[
        { id: 'health', label: 'Health Console', note: 'Runtime, watchdog e alert' },
        { id: 'security', label: 'Security Vault', note: 'Chiavi, switch e canali' },
        { id: 'guide', label: 'Setup Guide', note: 'Checklist e messa in opera' },
      ].map((item) => (
        <button
          key={item.id}
          className={`develop-tab ${developSection === item.id ? 'is-active' : ''}`}
          onClick={() => setDevelopSection(item.id)}
        >
          <strong>{item.label}</strong>
          <span>{item.note}</span>
        </button>
      ))}
    </div>

    {developSection === 'health' && (
      <>
        <div className="dashboard-grid">
          <EnginePulseCard status={status} risk={risk} cryptoEngine={cryptoEngine} />
        </div>
        <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
          <SystemHealthCard snapshot={systemHealthSnapshot} />
          <div className="col-span-8">
            <RuntimeHealthCard runtimeHealth={runtimeHealth} isBackendOnline={isBackendOnline} />
          </div>
        </div>
        <OpsActionCard actions={opsActionPlan} />
        <AlertReadinessCard savedKeys={savedKeys} runtimeHealth={runtimeHealth} lastVaultSync={lastVaultSync} />
        <div className="card develop-explainer-card" style={{ marginTop: '1.5rem' }}>
          <div className="card-title">Perché questa sezione conta</div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            Qui vivono heartbeat, reconnect, auto-pause, alert di emergenza e salute dei watchdog. In pratica:
            è il posto giusto da controllare quando vuoi lasciare Aureo girare da solo con più serenità.
          </div>
        </div>
      </>
    )}

    {developSection === 'security' && renderSettingsView()}
    {developSection === 'guide' && renderGuideView()}
  </div>
  );
};

const OnboardingModal = ({ onClose, onGoToSettings, savedKeys = {} }) => {
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
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '10px',
                  background: 'rgba(56,189,248,0.14)',
                  border: '1px solid rgba(56,189,248,0.28)',
                  color: '#38bdf8',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  textDecoration: 'none'
                }}
              >
                Apri BotFather ↗
              </a>
              {savedKeys['TELEGRAM_BOT_TOKEN'] && (
                <a
                  href={`https://api.telegram.org/bot${savedKeys['TELEGRAM_BOT_TOKEN']}/getUpdates`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.55rem 0.95rem',
                    borderRadius: '10px',
                    background: 'rgba(99,102,241,0.14)',
                    border: '1px solid rgba(99,102,241,0.28)',
                    color: '#a5b4fc',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    textDecoration: 'none'
                  }}
                >
                  Apri getUpdates ↗
                </a>
              )}
              <a
                href="https://pushover.net"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '10px',
                  background: 'rgba(16,185,129,0.14)',
                  border: '1px solid rgba(16,185,129,0.28)',
                  color: '#34d399',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  textDecoration: 'none'
                }}
              >
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

const SymbolLinkButton = ({ symbol, onOpen, children, variant = 'inline', style = {}, title }) => (
  <button
    type="button"
    className={`symbol-link-btn symbol-link-btn--${variant}`}
    onClick={() => onOpen?.(symbol)}
    title={title || `Apri review ${symbol}`}
    style={style}
  >
    {children || symbol}
  </button>
);

const NoticeTray = ({ notices = [], onDismiss }) => (
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

const ConfirmDialog = ({ config, onCancel, onConfirm }) => {
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

const SystemStatusBanner = ({ status = {}, isBackendOnline = true, onOpenHealth, onOpenTrading }) => {
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
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [symbolReviewReturnTab, setSymbolReviewReturnTab] = useState('trading');
  const [tradingViewFilter, setTradingViewFilter] = useState('all');
  const [tradingAlerts, setTradingAlerts] = useState([]);
  const [aiIdea, setAiIdea] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [billingOverview, setBillingOverview] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });
  const [billingLead, setBillingLead] = useState({ company: '', contact_name: '', email: '', plan_id: 'monthly', seats: 1 });
  const [userIsPaid, setUserIsPaid] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [isBackendOnline, setIsBackendOnline] = useState(true);
  const [lastStatusSync, setLastStatusSync] = useState(null);
  const [notices, setNotices] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  
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
  const opportunitySpotlight = useMemo(() => deriveOpportunitySpotlight(topOpportunities), [topOpportunities]);
  const systemHealthSnapshot = useMemo(
    () => deriveSystemHealthSnapshot({ status, risk: status.risk, savedKeys, isBackendOnline, cryptoEngine }),
    [status, savedKeys, isBackendOnline, cryptoEngine]
  );
  const entryReadiness = useMemo(
    () => deriveEntryReadiness({ status, risk: status.risk, symbol: selectedSymbol, row: tableDataBySymbol[selectedSymbol] }),
    [status, selectedSymbol, tableDataBySymbol]
  );
  const symbolDrilldown = useMemo(
    () => deriveSymbolDrilldown({
      symbol: selectedSymbol,
      status,
      row: tableDataBySymbol[selectedSymbol],
      readiness: entryReadiness,
      tradePerformance,
      cryptoState: cryptoSymbolStateMap[selectedSymbol],
    }),
    [selectedSymbol, status, tableDataBySymbol, entryReadiness, tradePerformance, cryptoSymbolStateMap]
  );
  const filteredTradingSymbols = useMemo(() => {
    const symbols = Array.isArray(status.symbols) ? status.symbols : [];
    return symbols.filter((symbol) => {
      if (tradingViewFilter === 'all') return true;
      const row = tableDataBySymbol[symbol];
      const readiness = deriveEntryReadiness({ status, risk: status.risk, symbol, row });
      const isCrypto = String(symbol).includes('/');
      if (tradingViewFilter === 'ready') return readiness.score >= 78;
      if (tradingViewFilter === 'watch') return readiness.score >= 58 && readiness.score < 78;
      if (tradingViewFilter === 'blocked') return readiness.score < 58;
      if (tradingViewFilter === 'crypto') return isCrypto;
      return true;
    });
  }, [status, tableDataBySymbol, tradingViewFilter]);
  const readinessSnapshotRef = React.useRef({});
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
    if (!txid) {
      pushNotice('warning', 'TXID mancante', 'Inserisci il TXID prima di inviare il pagamento.');
      return;
    }
    try {
      const res = await authFetch('/api/billing/submit-txid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid, amount: 99, currency: selectedCrypto })
      });
      const data = await res.json();
      setBillingMessage(data.message);
      pushNotice(res.ok ? 'success' : 'warning', res.ok ? 'Pagamento inviato' : 'Pagamento da verificare', data.message || 'Richiesta registrata.');
    } catch(e) {
      setBillingMessage('Errore di rete');
      pushNotice('error', 'Invio fallito', 'Errore di rete durante l’invio del TXID.');
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
      kicker: 'Step 1 · Overview',
      title: 'Benvenuto nella control room privata',
      text: 'Qui il cliente percepisce subito ordine, presidio e qualità. La dashboard non è presentata come una semplice home, ma come il centro operativo da cui tutto viene governato.'
    },
    {
      targetTab: 'trading',
      kicker: 'Step 2 · Trading',
      title: 'Operatività guidata, non caos tecnico',
      text: 'La sezione trading mostra segnali, priorità e azioni in un ambiente leggibile. L’obiettivo non è stupire con rumore, ma trasmettere padronanza e controllo.'
    },
    {
      targetTab: 'charts',
      kicker: 'Step 3 · Market View',
      title: 'I grafici servono a confermare autorevolezza',
      text: 'Charts e lettura visiva aiutano Aureo a sembrare una piattaforma completa: non solo execution, ma anche interpretazione del mercato e contesto operativo.'
    },
    {
      targetTab: 'develop',
      kicker: 'Step 4 · Control',
      title: 'Sicurezza, chiavi e governance sono parte del valore',
      text: 'Accessi protetti, passkey, vault e controlli fanno capire che Aureo non è solo un bot: è un ambiente presidiato, adatto a clienti più esigenti.'
    },
    {
      targetTab: 'develop',
      kicker: 'Step 5 · Activation',
      title: 'L’accesso resta selettivo fino alla fine',
      text: 'Anche nel tour la promessa resta coerente: Aureo è una piattaforma privata, con attivazione guidata e abilitazione sotto controllo manuale.'
    }
  ];

  const startTour = () => {
    setIsTourActive(true);
    setTourStep(0);
    setShowLanding(false);
    setIsDemoMode(true);
    setIsAuthenticated(true);
    setIsRegistering(false);
    setLoginError('');
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
    if (userRole === 'admin') {
      setActiveTab('develop');
      return;
    }
    if (section === 'security') {
      setActiveTab('security');
      return;
    }
    setActiveTab('home');
  };
  const openSymbolReview = React.useCallback((symbol, returnTab = activeTab) => {
    const safeSymbol = sanitizeSymbolCode(symbol);
    if (!safeSymbol) return;
    setSelectedSymbol(safeSymbol);
    if (returnTab && returnTab !== 'symbol_review') {
      setSymbolReviewReturnTab(returnTab);
    }
    setActiveTab('symbol_review');
  }, [activeTab]);
  const closeSymbolReview = React.useCallback(() => {
    setActiveTab(symbolReviewReturnTab || 'trading');
  }, [symbolReviewReturnTab]);
  const demoActionButtonProps = (disabled = false) => (
    isDemoMode
      ? { disabled: true, title: 'Non disponibile in demo mode' }
      : { disabled }
  );
  const demoActionStyle = isDemoMode ? { opacity: 0.5, cursor: 'not-allowed' } : {};
  const syncLabel = isBackendOnline
    ? (lastStatusSync ? `Live • ${lastStatusSync}` : 'Live')
    : 'Offline';
  const accountAccessMeta = useMemo(
    () => formatAccountAccessMeta(userProfile, userStatus),
    [userProfile, userStatus]
  );
  const missingSetupItems = useMemo(
    () => deriveMissingSetupItems(savedKeys),
    [savedKeys]
  );
  const dismissNotice = React.useCallback((id) => {
    setNotices((prev) => prev.filter((item) => item.id !== id));
  }, []);
  const pushNotice = React.useCallback((type, title, message = '', duration = 4200) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setNotices((prev) => [...prev, { id, type, title, message }].slice(-5));
    if (duration > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => {
        setNotices((prev) => prev.filter((item) => item.id !== id));
      }, duration);
    }
    return id;
  }, []);
  const loadUserProfile = React.useCallback(async () => {
    try {
      const res = await authFetch('/api/user/me');
      if (!res.ok) return null;
      const data = await parseJsonSafely(res, {});
      setUserProfile(data);
      setUserIsPaid(!!data.is_paid || data.role === 'admin');
      if (data?.status) {
        setUserStatus(data.status);
        safeStorageSet('USER_STATUS', data.status);
      }
      return data;
    } catch {
      return null;
    }
  }, []);
  const closeConfirmDialog = React.useCallback(() => setConfirmDialog(null), []);
  const openConfirmDialog = React.useCallback((config) => setConfirmDialog({ open: true, ...config }), []);
  const runConfirmedAction = React.useCallback(async () => {
    if (!confirmDialog?.onConfirmAction) {
      setConfirmDialog(null);
      return;
    }
    const action = confirmDialog.onConfirmAction;
    setConfirmDialog(null);
    await action();
  }, [confirmDialog]);

  useEffect(() => {
    if (!BILLING_ENABLED && activeTab === 'saas') {
      setActiveTab('home');
    }
    if (activeTab === 'develop' && userRole !== 'admin') {
      if (developSection === 'security') {
        setActiveTab('security');
      } else {
        setActiveTab('home');
      }
    }
    if (activeTab === 'saas' && userRole !== 'admin') {
      setActiveTab('home');
    }
  }, [activeTab, userRole, developSection]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromHash = () => {
      const hashSymbol = getSymbolFromHash(window.location.hash);
      if (hashSymbol) {
        setSelectedSymbol(hashSymbol);
        setActiveTab('symbol_review');
      }
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextHash = activeTab === 'symbol_review' && selectedSymbol
      ? buildSymbolReviewHash(selectedSymbol)
      : '';
    if (nextHash) {
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', nextHash);
      }
      return;
    }
    if (window.location.hash.startsWith(SYMBOL_REVIEW_HASH_PREFIX)) {
      const cleanUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, '', cleanUrl);
    }
  }, [activeTab, selectedSymbol]);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
    setPasskeySupported(supported);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isDemoMode) {
      if (!isAuthenticated) setUserProfile(null);
      return;
    }
    loadUserProfile();
  }, [isAuthenticated, isDemoMode, loadUserProfile]);

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
            setSelectedSymbol(prev => {
              const hashSymbol = typeof window !== 'undefined' ? getSymbolFromHash(window.location.hash) : '';
              if (hashSymbol && data.symbols.includes(hashSymbol)) return hashSymbol;
              return prev && data.symbols.includes(prev) ? prev : data.symbols[0];
            });
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
    if (!selectedSymbol || !['trading', 'charts', 'symbol_review'].includes(activeTab)) return;
    const controller = new AbortController();
    const fetchChart = async () => {
      setChartLoading(true);
      setChartError('');
      try {
        const safeSym = encodeURIComponent(selectedSymbol);
        const res = await fetch(`/api/chart-data/${safeSym}?timeframe=${timeframe}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Chart API ${res.status}`);
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setChartData(data);
        } else {
          setChartData([]);
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setChartData([]);
        setChartError('Stream grafico non disponibile al momento.');
      } finally {
        setChartLoading(false);
      }
    };
    fetchChart();
    return () => controller.abort();
  }, [selectedSymbol, timeframe, activeTab]);

  useEffect(() => {
    const symbols = Array.isArray(status.symbols) ? status.symbols : [];
    if (!symbols.length) return;

    const nextSnapshot = {};
    const newAlerts = [];

    symbols.forEach((symbol) => {
      const row = tableDataBySymbol[symbol];
      const readiness = deriveEntryReadiness({ status, risk: status.risk, symbol, row });
      const headline = deriveEntryHeadline(readiness);
      const prev = readinessSnapshotRef.current[symbol];
      nextSnapshot[symbol] = { score: readiness.score, label: headline.label };

      if (!prev) return;

      const becameReady = prev.score < 78 && readiness.score >= 78;
      const recovered = prev.label === 'Frenato' && headline.label !== 'Frenato';
      const becameBlocked = prev.label !== 'Frenato' && headline.label === 'Frenato';

      if (becameReady) {
        newAlerts.push({
          id: `${symbol}-ready-${Date.now()}`,
          symbol,
          type: 'ready',
          tone: '#10b981',
          title: `${symbol} pronto`,
          detail: headline.detail,
          createdAt: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        });
      } else if (recovered) {
        newAlerts.push({
          id: `${symbol}-recovered-${Date.now()}`,
          symbol,
          type: 'recovered',
          tone: '#38bdf8',
          title: `${symbol} recupera trazione`,
          detail: headline.detail,
          createdAt: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        });
      } else if (becameBlocked) {
        newAlerts.push({
          id: `${symbol}-blocked-${Date.now()}`,
          symbol,
          type: 'blocked',
          tone: '#ef4444',
          title: `${symbol} frenato`,
          detail: headline.detail,
          createdAt: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    });

    readinessSnapshotRef.current = nextSnapshot;
    if (newAlerts.length) {
      setTradingAlerts((prev) => [...newAlerts, ...prev].slice(0, 12));
    }
  }, [status, tableDataBySymbol]);

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
        await loadUserProfile();
        
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
      setUserProfile(null);
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
        const normalized = (Array.isArray(data.proposals) ? data.proposals : [])
          .map((proposal, index) => sanitizeInvestmentProposal(proposal, index))
          .filter(Boolean);
        if (normalized.length) {
          setAiProposals(normalized);
        } else {
          setExecutionMessage("❌ Errore: il motore AI ha restituito proposte incomplete.");
        }
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
    openConfirmDialog({
      tone: 'danger',
      kicker: 'Annullamento ordine',
      title: `Annullare ${symbol}?`,
      message: 'L’ordine AI verrà rimosso dal registro operativo.',
      confirmLabel: 'Annulla ordine',
      onConfirmAction: async () => {
        try {
          const res = await authFetch('/api/ai-invest/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index, symbol, platform })
          });
          const data = await res.json();
          if (res.ok) {
            pushNotice('success', 'Ordine AI annullato', data.message || `${symbol} rimosso correttamente.`);
            fetch('/api/status', {
              headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}
            }).then(r => r.json()).then(d => { if(!d.error) setStatus(d); });
          } else {
            pushNotice('error', 'Annullamento fallito', data.detail || 'Errore durante la cancellazione');
          }
        } catch (e) {
          pushNotice('error', 'Rete non disponibile', 'Errore di rete durante l’annullamento.');
        }
      }
    });
  };

  const executeAiProposal = async (proposal) => {
    const safeProposal = sanitizeInvestmentProposal(proposal);
    if (!safeProposal) {
      setExecutionMessage("❌ Errore: proposta AI non valida o incompleta.");
      return;
    }
    setExecutionMessage(`Esecuzione in corso per ${safeProposal.symbol}...`);
    try {
      const res = await authFetch('/api/ai-invest/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: safeProposal.symbol,
          asset_type: safeProposal.asset_type,
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
    openConfirmDialog({
      tone: 'danger',
      kicker: 'Reset simulazione',
      title: 'Azzerare stato e cronologia?',
      message: 'La simulazione tornerà al capitale iniziale e lo storico operativo verrà cancellato.',
      confirmLabel: 'Resetta simulazione',
      onConfirmAction: async () => {
        try {
          const res = await authFetch('/api/reset', { method: 'POST' });
          const data = await res.json();
          if (!data.error) {
            setStatus(data.state);
            pushNotice('success', 'Simulazione resettata', 'Stato e cronologia sono stati azzerati correttamente.');
          }
        } catch (err) {
          pushNotice('error', 'Reset non riuscito', 'Errore di connessione al backend.');
        }
      }
    });
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

  const refreshVaultKeys = React.useCallback(async ({ populateInputs = false, silent = false } = {}) => {
    if (isDemoMode) {
      setSavedKeys({});
      return null;
    }
    try {
      const res = await authFetch('/api/keys?t=' + Date.now());
      const data = await res.json();
      if (data.ERROR && !silent) {
        pushNotice('error', 'Errore lettura Vault', data.ERROR);
      }
      setSavedKeys(data);
      setLastVaultSync(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (populateInputs) {
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
      }
      return data;
    } catch (err) {
      if (!silent) {
        console.error("Error fetching keys", err);
        pushNotice('error', 'Vault non raggiungibile', 'Errore di rete durante il caricamento delle chiavi.');
      }
      return null;
    }
  }, [isDemoMode]);

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
      pushNotice('success', 'Vault aggiornato', 'Chiavi salvate con successo nel Vault sicuro.');
      await refreshVaultKeys({ populateInputs: true, silent: true });
    } catch(err) {
      pushNotice('error', 'Salvataggio fallito', err.message);
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
      const data = await refreshVaultKeys({ populateInputs: true, silent: true });
      setApiKeys(prev => ({
        ...prev,
        dynamic_atr_stop: data.DYNAMIC_ATR_STOP ?? nextValues.dynamic_atr_stop,
        trailing_stop_base_pct: data.TRAILING_STOP_BASE_PCT ?? nextValues.trailing_stop_base_pct,
      }));
      pushNotice('success', 'ATR aggiornato', 'Le impostazioni trailing stop sono state salvate.');
    } catch (err) {
      pushNotice('error', 'ATR non salvato', err.message);
    }
  };

  
  useEffect(() => {
    if (!isAuthenticated || isDemoMode) {
      if (isDemoMode) setSavedKeys({});
      return;
    }
    const isVaultView = activeTab === 'develop' || activeTab === 'security';
    refreshVaultKeys({ populateInputs: isVaultView, silent: !isVaultView });
  }, [isAuthenticated, isDemoMode, activeTab, refreshVaultKeys]);

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
      {
        id: 'telegram',
        name: 'Telegram',
        subtitle: 'Alert esterni via bot',
        icon: '📨',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.08)',
        border: 'rgba(56, 189, 248, 0.25)',
        url: 'https://t.me/BotFather',
        keyPresent: savedKeys['TELEGRAM_BOT_TOKEN'] && savedKeys['TELEGRAM_CHAT_ID'],
        steps: [
          { n: 1, text: 'Apri Telegram e cerca @BotFather' },
          { n: 2, text: 'Invia /newbot e crea il tuo bot seguendo le istruzioni' },
          { n: 3, text: 'Copia il Bot Token generato da BotFather' },
          { n: 4, text: 'Scrivi un messaggio al tuo bot per attivare la chat' },
          { n: 5, text: 'Apri l’URL getUpdates per recuperare il tuo chat id e incollalo in Aureo' },
        ],
        note: 'Telegram è ottimo come canale secondario per ricevere eventi e warning fuori piattaforma.',
      },
      {
        id: 'pushover',
        name: 'Pushover',
        subtitle: 'Push critiche su iPhone / Apple Watch',
        icon: '⌚',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.08)',
        border: 'rgba(16, 185, 129, 0.25)',
        url: 'https://pushover.net',
        keyPresent: savedKeys['PUSHOVER_APP_TOKEN'] && savedKeys['PUSHOVER_USER_KEY'],
        steps: [
          { n: 1, text: 'Vai su pushover.net e crea il tuo account' },
          { n: 2, text: 'Installa l’app Pushover su iPhone' },
          { n: 3, text: 'Nel pannello Pushover copia la tua User Key personale' },
          { n: 4, text: 'Crea una nuova Application/API Token per Aureo' },
          { n: 5, text: 'Torna in Aureo e incolla App Token + User Key nella sezione Pushover' },
        ],
        note: 'Pushover è il canale migliore per notifiche critiche immediate anche su Apple Watch.',
      },
    ];

    const readyCount = platforms.filter((platform) => platform.keyPresent).length;
    const guideCards = [
      {
        label: 'Connessioni pronte',
        value: `${readyCount}/${platforms.length}`,
        detail: readyCount === platforms.length ? 'Base operativa completa.' : 'Completa i collegamenti per sbloccare tutto il potenziale.',
        tone: readyCount === platforms.length ? '#10b981' : '#f59e0b',
      },
      {
        label: 'Primo step consigliato',
        value: 'Groq AI',
        detail: 'Gratis, rapido e utile per arricchire subito i segnali.',
        tone: '#10b981',
      },
      {
        label: 'Secondo step',
        value: 'Alpaca Paper',
        detail: 'Ti fa testare Aureo sui mercati senza rischio reale.',
        tone: '#38bdf8',
      },
      {
        label: 'Destinazione finale',
        value: 'Security Vault',
        detail: 'Tutte le chiavi vanno inserite e testate lì.',
        tone: '#a78bfa',
      },
    ];

    return (
      <div className="module-content module-content--guide">
        <div className="card guide-hero-card" style={{ marginBottom: '1.6rem' }}>
          <div className="guide-hero-top">
            <div>
              <h2 style={{ margin: 0 }}>📖 Setup Guide</h2>
              <div className="guide-hero-subtitle">
                Segui questi passaggi per connettere Aureo ai mercati reali. Parti dal gratuito, valida il flusso, poi collega il broker.
              </div>
            </div>
            <div className="guide-hero-badges">
              <div className={`badge ${readyCount === platforms.length ? 'badge-active' : 'badge-gold'}`}>
                {readyCount === platforms.length ? 'Setup completo' : 'Setup in corso'}
              </div>
              <div className="badge badge-ai">Percorso guidato</div>
            </div>
          </div>

          <div className="guide-summary-grid">
            {guideCards.map((card) => (
              <div key={card.label} className="guide-summary-card" style={{ borderColor: `${card.tone}33` }}>
                <span>{card.label}</span>
                <strong style={{ color: card.tone }}>{card.value}</strong>
                <small>{card.detail}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="card guide-order-card" style={{ marginBottom: '1.6rem' }}>
          <h3 style={{ color: '#10b981', marginBottom: '0.8rem' }}>✅ Ordine consigliato per iniziare</h3>
          <div className="guide-order-grid">
            {[
              { n: 1, icon: '🤖', name: 'Groq AI', desc: 'Prima cosa — gratuito e immediato' },
              { n: 2, icon: '🦙', name: 'Alpaca Paper', desc: 'Paper trading gratuito — zero rischi' },
              { n: 3, icon: '🔐', name: 'Security Vault', desc: 'Inserisci, testa e salva le chiavi' },
            ].map(item => (
              <div key={item.n} className="guide-order-tile">
                <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>{item.icon}</div>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>Step {item.n}: {item.name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.45 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="guide-platform-grid">
          {platforms.map(platform => (
            <div key={platform.id} className="card guide-platform-card" style={{ border: `1px solid ${platform.border}`, background: platform.bg, padding: '1.5rem' }}>
              <div className="guide-platform-header">
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

              <div className="guide-step-stack">
                {platform.steps.map(step => (
                  <div key={step.n} className="guide-step-row">
                    <span style={{ minWidth: '24px', height: '24px', borderRadius: '50%', background: platform.color, color: '#000', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                      {step.n}
                    </span>
                    <span style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5 }}>{step.text}</span>
                  </div>
                ))}
              </div>

              <div className="guide-note-box">
                💡 {platform.note}
              </div>

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
      </div>
    );
  };

  const renderSettingsView = () => {
    const vaultCards = [
      {
        label: 'Broker live',
        value: savedKeys['ALPACA_KEY'] ? 'Alpaca armato' : 'Alpaca da collegare',
        detail: savedKeys['ALPACA_KEY'] ? 'Chiavi broker presenti nel Vault.' : 'Manca il collegamento per operare sui mercati.',
        tone: savedKeys['ALPACA_KEY'] ? '#10b981' : '#f59e0b',
      },
      {
        label: 'Canali alert',
        value: hasArmedAlertChannel(savedKeys) ? 'Attivi' : 'Da armare',
        detail: hasArmedAlertChannel(savedKeys) ? 'Almeno un canale esterno è pronto per gli eventi critici.' : 'Completa Telegram o Pushover per ricevere eventi fuori piattaforma.',
        tone: hasArmedAlertChannel(savedKeys) ? '#10b981' : '#f59e0b',
      },
      {
        label: 'AI core',
        value: savedKeys['GROQ_KEY'] ? 'Groq presente' : 'Groq assente',
        detail: savedKeys['GROQ_KEY'] ? 'L’engine AI può arricchire segnali e analisi.' : 'Senza chiave Groq il layer AI resta limitato.',
        tone: savedKeys['GROQ_KEY'] ? '#38bdf8' : '#94a3b8',
      },
      {
        label: 'Vault sync',
        value: lastVaultSync || 'Non sincronizzato',
        detail: 'Ultimo allineamento locale con il Vault sicuro.',
        tone: '#a78bfa',
      },
    ];

    return (
    <div className="module-content module-content--security">
      <div className="card security-hero-card" style={{ marginBottom: '1.6rem' }}>
        <div className="security-hero-top">
          <div>
            <h2 style={{ margin: 0 }}>🔐 Security & API Vault</h2>
            <div className="security-hero-subtitle">Gestione chiavi crittografate per broker, alert, AI e protezioni operative di Aureo.</div>
          </div>
          <div className="security-hero-badges">
            <div className={`badge ${hasArmedAlertChannel(savedKeys) ? 'badge-active' : 'badge-gold'}`}>
              {hasArmedAlertChannel(savedKeys) ? 'Alert armati' : 'Alert da armare'}
            </div>
            <div className={`badge ${savedKeys['ALPACA_KEY'] ? 'badge-active' : 'badge-danger'}`}>
              {savedKeys['ALPACA_KEY'] ? 'Broker connesso' : 'Broker mancante'}
            </div>
          </div>
        </div>

        <div className="security-summary-grid">
          {vaultCards.map((card) => (
            <div key={card.label} className="security-summary-card" style={{ borderColor: `${card.tone}33` }}>
              <span>{card.label}</span>
              <strong style={{ color: card.tone }}>{card.value}</strong>
              <small>{card.detail}</small>
            </div>
          ))}
        </div>
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
        <div className="card security-section-card" style={{ marginBottom: '2rem', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
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

      <div className="card security-section-card" style={{ marginBottom: '2rem' }}>
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

      <div className="card security-section-card" style={{ marginBottom: '2rem' }}>
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
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.52rem 0.9rem',
              borderRadius: '10px',
              background: 'rgba(56,189,248,0.14)',
              border: '1px solid rgba(56,189,248,0.28)',
              color: '#38bdf8',
              fontWeight: 700,
              fontSize: '0.84rem',
              textDecoration: 'none'
            }}
          >
            Apri BotFather ↗
          </a>
          {apiKeys.telegram_bot_token && (
            <a
              href={`https://api.telegram.org/bot${apiKeys.telegram_bot_token}/getUpdates`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.52rem 0.9rem',
                borderRadius: '10px',
                background: 'rgba(99,102,241,0.14)',
                border: '1px solid rgba(99,102,241,0.28)',
                color: '#a5b4fc',
                fontWeight: 700,
                fontSize: '0.84rem',
                textDecoration: 'none'
              }}
            >
              Apri getUpdates ↗
            </a>
          )}
        </div>
        <div style={{ marginBottom: '1rem', padding: '0.95rem 1rem', borderRadius: '12px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '0.45rem' }}>Mini tutorial Telegram</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.55, display: 'grid', gap: '0.3rem' }}>
            <div>1. Apri <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>BotFather ↗</a> e crea il bot con <strong>/newbot</strong>.</div>
            <div>2. Copia il <strong>Bot Token</strong> che BotFather ti restituisce.</div>
            <div>3. Scrivi un messaggio al tuo bot, poi apri <a href={`https://api.telegram.org/bot${apiKeys.telegram_bot_token || 'YOUR_BOT_TOKEN'}/getUpdates`} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>getUpdates ↗</a> per leggere il <strong>Chat ID</strong>.</div>
          </div>
        </div>
        {testResults['telegram'] && <div style={{ color: testResults['telegram'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['telegram']}</div>}
      </div>

      <div className="card security-section-card" style={{ marginBottom: '2rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
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

      <div className="card security-section-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>Groq AI (Sentiment & Investments) {savedKeys['GROQ_KEY'] ? <span style={{ color: '#10b981', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span>Presente</span> : <span style={{ color: '#ef4444', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>Assente</span>}</h3>
          <button onClick={() => testConnection('groq')} className="btn" {...demoActionButtonProps()} style={{ padding: '0.5rem 1rem', ...demoActionStyle }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="Groq API Key" value={apiKeys.groq_key} onChange={e => setApiKeys({...apiKeys, groq_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['groq'] && <div style={{ color: testResults['groq'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['groq']}</div>}
      </div>

      <div className="card security-section-card" style={{ marginBottom: '2rem', border: '1px solid rgba(16, 185, 129, 0.22)' }}>
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
        <div style={{ marginBottom: '1rem', padding: '0.95rem 1rem', borderRadius: '12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '0.45rem' }}>Mini tutorial Pushover</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.55, display: 'grid', gap: '0.3rem' }}>
            <div>1. Vai su <a href="https://pushover.net" target="_blank" rel="noopener noreferrer" style={{ color: '#10b981' }}>pushover.net ↗</a> e crea il tuo account.</div>
            <div>2. Copia la tua <strong>User Key</strong> dalla dashboard personale.</div>
            <div>3. Crea una nuova <strong>Application/API Token</strong> dedicata ad Aureo e incolla entrambe le chiavi qui.</div>
          </div>
        </div>
        {testResults['pushover'] && <div style={{ color: testResults['pushover'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['pushover']}</div>}
      </div>

      <div style={{ textAlign: 'right' }}>
        <button onClick={saveKeys} className="btn btn-start" {...demoActionButtonProps()} style={{ padding: '1rem 3rem', fontSize: '1.1rem', ...demoActionStyle }}>Salva nel Vault Sicuro</button>
      </div>
    </div>
  );
  };

  const renderHomeView = () => {
    const initialCash = status.initial_cash || 1000;
    const virtualCash = Number(status.portfolio_value || 1000);
    const tradingProfit = virtualCash - initialCash;
    const totalWorth = virtualCash + aiEarnings;
    const runtimeStatus = String(status.runtime_health?.status || (isBackendOnline ? 'green' : 'red')).toLowerCase();
    const runtimeTone = runtimeStatus === 'green' ? '#10b981' : runtimeStatus === 'yellow' ? '#f59e0b' : '#ef4444';
    const riskStatusLabel = status.risk?.enabled === false ? 'Risk OFF' : status.risk?.can_trade === false ? 'Risk in blocco' : 'Risk pronto';
    const healthSnapshot = deriveSystemHealthSnapshot({ status, risk: status.risk || {}, savedKeys, isBackendOnline, cryptoEngine });
    const alertArmed = hasArmedAlertChannel(savedKeys);
    const marketTone = status.market_open ? '#10b981' : '#f59e0b';
    const heroBadges = [
      { label: `Runtime ${runtimeStatus.toUpperCase()}`, tone: runtimeTone, bg: `${runtimeTone}14` },
      { label: status.market_open ? 'Mercato aperto' : 'Mercato chiuso', tone: marketTone, bg: `${marketTone}14` },
      { label: alertArmed ? 'Alert armati' : 'Alert da armare', tone: alertArmed ? '#10b981' : '#f59e0b', bg: `${alertArmed ? '#10b981' : '#f59e0b'}14` },
      { label: `Health ${healthSnapshot.score}/100`, tone: healthSnapshot.tone, bg: `${healthSnapshot.tone}14` },
    ];
    const executiveCards = [
      {
        label: 'Capitale live',
        value: `$${Number(status.portfolio_value || 0).toFixed(2)}`,
        detail: `Cash disponibile $${Number(status.cash || 0).toFixed(2)}`,
        tone: '#10b981',
      },
      {
        label: 'P&L trading',
        value: `${tradingProfit >= 0 ? '+' : ''}$${Number(tradingProfit || 0).toFixed(2)}`,
        detail: `${Number(status.win_rate || 0).toFixed(1)}% win rate · PF ${Number(status.profit_factor || 0).toFixed(2)}`,
        tone: tradingProfit >= 0 ? '#10b981' : '#ef4444',
      },
      {
        label: 'Runtime',
        value: (status.runtime_health?.summary || (isBackendOnline ? 'Operativo' : 'Offline')).slice(0, 42),
        detail: isBackendOnline ? 'Telemetria attiva' : 'Serve riallineare backend',
        tone: runtimeTone,
      },
      {
        label: 'Risk posture',
        value: riskStatusLabel,
        detail: `${status.risk?.open_positions || 0}/${status.risk?.max_open_positions || 5} posizioni · ${status.risk?.trades_today || 0} trade oggi`,
        tone: status.risk?.enabled === false ? '#ef4444' : status.risk?.can_trade === false ? '#f59e0b' : '#38bdf8',
      },
    ];
    const spotlightItems = [
      {
        title: 'Missione corrente',
        tone: runtimeTone,
        text: status.risk?.can_trade === false
          ? (status.risk?.reason || 'Il risk engine sta proteggendo il capitale e blocca nuovi ingressi.')
          : `Aureo sta monitorando ${status.symbols?.[0] || 'la watchlist'} per il prossimo ingresso ad alta qualità.`,
      },
      {
        title: 'Postura operativa',
        tone: '#38bdf8',
        text: status.alpaca_connected === false
          ? 'Broker non collegato: il sistema è in vetrina ma non ancora pronto a eseguire davvero.'
          : `${status.alpaca_info?.type || 'PAPER'} mode attiva · ${status.risk?.open_positions || 0} posizioni aperte · ${status.risk?.positions_remaining || 0} slot residui.`,
      },
      {
        title: 'Alert esterni',
        tone: alertArmed ? '#10b981' : '#f59e0b',
        text: alertArmed
          ? 'I canali esterni sono pronti: puoi ricevere eventi critici anche fuori dalla piattaforma.'
          : 'Manca ancora un canale alert pienamente armato per il monitoraggio fuori piattaforma.',
      },
    ];
    const priorityItems = [
      {
        title: 'Trading engine',
        detail: status.modules?.trading ? 'Attivo: il motore sta scandagliando i mercati.' : 'In pausa: riattivalo per generare nuovi setup.',
        tone: status.modules?.trading ? '#10b981' : '#94a3b8',
      },
      {
        title: 'Runtime & sicurezza',
        detail: status.runtime_health?.summary || (isBackendOnline ? 'Telemetria attiva e sotto controllo.' : 'Serve riallineare il backend.'),
        tone: runtimeTone,
      },
      {
        title: 'Capacità residua',
        detail: `${status.risk?.positions_remaining || 0} slot ancora disponibili prima del limite operativo.`,
        tone: (status.risk?.positions_remaining || 0) > 1 ? '#38bdf8' : '#f59e0b',
      },
    ];
    
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
        <div className="hero-summary home-hero-card" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(0,0,0,0) 100%)', padding: '3rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '2rem' }}>
          <div className="home-hero-top">
            <div>
              <div className="hero-summary-label" style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '1rem' }}>Net Worth Totale Stimato</div>
              <div className="hero-summary-value" style={{ fontSize: '4.5rem', fontWeight: 'bold', color: '#10b981', textShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}>
                ${totalWorth.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
            </div>
            <div className="home-hero-badges">
              {heroBadges.map((badge) => (
                <div key={badge.label} className="badge" style={{ color: badge.tone, borderColor: `${badge.tone}55`, background: badge.bg }}>
                  {badge.label}
                </div>
              ))}
            </div>
          </div>
          <div className="home-hero-strip">
            {spotlightItems.map((item) => (
              <div key={item.title} className="home-hero-spotlight" style={{ borderColor: `${item.tone}33` }}>
                <span>{item.title}</span>
                <strong style={{ color: item.tone }}>{item.text}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
          {executiveCards.map((item) => (
            <div key={item.label} className="card col-span-3 home-executive-card" style={{ border: `1px solid ${item.tone}33`, background: 'rgba(255,255,255,0.025)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
                {item.label}
              </div>
              <div style={{ color: item.tone, fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.15, marginBottom: '0.45rem' }}>
                {item.value}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                {item.detail}
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          <div className="card col-span-6 home-overview-card" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>🧭 Executive Overview</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {spotlightItems.map((item) => (
                <div key={item.title} style={{ padding: '0.95rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${item.tone}33` }}>
                  <div style={{ color: item.tone, fontWeight: 800, marginBottom: '0.3rem' }}>{item.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.45 }}>
                    {item.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

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

          <div className="card col-span-6 home-priority-card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>🎯 Priorità operative</h3>
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {priorityItems.map((item) => (
                <div key={item.title} style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${item.tone}22` }}>
                  <div style={{ color: item.tone, fontWeight: 700, marginBottom: '0.2rem' }}>{item.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSymbolReviewView = () => {
    if (!selectedSymbol) {
      return (
        <div className="module-content module-content--symbol-review">
          <div className="card symbol-review-card">
            <div className="card-title">Nessun simbolo selezionato</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.6rem' }}>
              Seleziona un simbolo dalla dashboard, dal trading o dai grafici per aprire la sua review dedicata.
            </div>
          </div>
        </div>
      );
    }

    const headline = deriveEntryHeadline(entryReadiness);
    const currentRow = tableDataBySymbol[selectedSymbol] || null;
    const currentPosition = status.positions?.[selectedSymbol];
    const safeSymbols = Array.isArray(status.symbols) ? status.symbols : [];
    const symbolIndex = safeSymbols.indexOf(selectedSymbol);
    const prevSymbol = symbolIndex > 0 ? safeSymbols[symbolIndex - 1] : null;
    const nextSymbol = symbolIndex >= 0 && symbolIndex < safeSymbols.length - 1 ? safeSymbols[symbolIndex + 1] : null;
    const relatedSymbols = safeSymbols.filter((symbol) => symbol !== selectedSymbol).slice(0, 5);
    const actionHeadline = currentPosition && currentPosition !== 'LIQUID'
      ? 'Posizione già aperta: qui la priorità è gestione, non ingresso.'
      : entryReadiness.score >= 78
        ? 'Setup vicino all’ingresso: il simbolo è maturo per una lettura finale.'
        : entryReadiness.score >= 58
          ? 'Simbolo in maturazione: serve ancora conferma prima di forzare un trade.'
          : 'Setup frenato: meglio aspettare che il quadro si riallinei.';
    const convictionTone = entryReadiness.score >= 78 ? '#10b981' : entryReadiness.score >= 58 ? '#38bdf8' : '#f59e0b';
    const symbolStatusKpis = [
      { label: 'Green lights', value: entryReadiness.greenLights.length, tone: '#10b981' },
      { label: 'Watch items', value: entryReadiness.watchItems.length, tone: '#38bdf8' },
      { label: 'Blockers', value: entryReadiness.blockers.length, tone: '#f59e0b' },
    ];
    const reviewMetrics = [
      { label: 'Readiness', value: `${entryReadiness.score}/100`, tone: headline.tone },
      { label: 'Sentiment', value: symbolDrilldown.sentiment || 'NEUTRAL', tone: symbolDrilldown.sentiment === 'BULLISH' ? '#10b981' : symbolDrilldown.sentiment === 'BEARISH' ? '#ef4444' : '#94a3b8' },
      { label: 'P&L storico', value: symbolDrilldown.tradeRow ? `${symbolDrilldown.tradeRow.totalPnl >= 0 ? '+' : ''}$${symbolDrilldown.tradeRow.totalPnl.toFixed(2)}` : 'Nessun trade chiuso', tone: symbolDrilldown.tradeRow ? (symbolDrilldown.tradeRow.totalPnl >= 0 ? '#10b981' : '#ef4444') : '#94a3b8' },
      { label: 'Posizione', value: currentPosition && currentPosition !== 'LIQUID' ? (currentPosition.side === 'short' ? 'Short live' : 'Long live') : 'Flat / Watch', tone: currentPosition && currentPosition !== 'LIQUID' ? '#10b981' : '#38bdf8' },
    ];

    return (
      <div className="module-content module-content--symbol-review">
        <div className="header module-page-header symbol-review-header" style={{ marginBottom: '1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2>Review · {selectedSymbol}</h2>
            <div className="page-subtitle" style={{ color: 'var(--text-secondary)', marginTop: '0.45rem' }}>
              Scheda dedicata del simbolo con chart, diagnosi, segnali e storico operativo.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.06)' }} onClick={closeSymbolReview}>
              ← Torna
            </button>
            <button type="button" className="btn" style={{ background: 'rgba(56,189,248,0.14)', border: '1px solid rgba(56,189,248,0.35)', color: '#38bdf8' }} onClick={() => setActiveTab('charts')}>
              Apri in Charts
            </button>
            <button type="button" className="btn" style={{ background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981' }} onClick={() => setActiveTab('trading')}>
              Vai al Trading
            </button>
          </div>
        </div>

        <div className="card symbol-review-card symbol-review-hero" style={{ marginBottom: '1.2rem', border: `1px solid ${headline.border}`, background: headline.bg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div className="card-title">Signal Story</div>
              <div style={{ color: '#f8fafc', fontSize: '2rem', fontWeight: 900, marginTop: '0.4rem', letterSpacing: '-0.04em' }}>
                {selectedSymbol}
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.45rem', maxWidth: '760px', lineHeight: 1.55 }}>
                {headline.detail}
              </div>
            </div>
            <div className="badge" style={{ color: headline.tone, borderColor: headline.border, background: 'rgba(0,0,0,0.18)' }}>
              {headline.label}
            </div>
          </div>

          <div className="symbol-review-metrics">
            {reviewMetrics.map((item) => (
              <div key={item.label} className="symbol-review-metric">
                <span>{item.label}</span>
                <strong style={{ color: item.tone }}>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-grid" style={{ marginBottom: '1.2rem' }}>
          <div className="card col-span-8 symbol-review-card">
            <div className="card-title">Decision compass</div>
            <div style={{ color: convictionTone, fontSize: '1.08rem', fontWeight: 800, marginTop: '0.55rem', marginBottom: '0.5rem' }}>
              {actionHeadline}
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {headline.detail}
            </div>
            <div className="symbol-review-metrics" style={{ marginTop: '1rem' }}>
              {symbolStatusKpis.map((item) => (
                <div key={item.label} className="symbol-review-metric">
                  <span>{item.label}</span>
                  <strong style={{ color: item.tone }}>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="card col-span-4 symbol-review-card">
            <div className="card-title">Navigator</div>
            <div className="symbol-review-nav-stack">
              <button type="button" className="symbol-review-nav-btn" onClick={() => prevSymbol && openSymbolReview(prevSymbol, symbolReviewReturnTab)} disabled={!prevSymbol}>
                <span>← Precedente</span>
                <strong>{prevSymbol || 'Nessuno'}</strong>
              </button>
              <button type="button" className="symbol-review-nav-btn" onClick={() => nextSymbol && openSymbolReview(nextSymbol, symbolReviewReturnTab)} disabled={!nextSymbol}>
                <span>Successivo →</span>
                <strong>{nextSymbol || 'Nessuno'}</strong>
              </button>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.95rem', marginBottom: '0.55rem' }}>
              Simboli correlati
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
              {relatedSymbols.length ? relatedSymbols.map((symbol) => (
                <SymbolLinkButton key={symbol} symbol={symbol} onOpen={() => openSymbolReview(symbol, symbolReviewReturnTab)} variant="pill">
                  {symbol}
                </SymbolLinkButton>
              )) : <div className="symbol-review-empty">Nessun altro simbolo disponibile.</div>}
            </div>
          </div>
        </div>

        <div className="dashboard-grid" style={{ marginBottom: '1.2rem' }}>
          <div className="card col-span-8 symbol-review-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
              <div>
                <div className="card-title">Live price action</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Andamento {timeframe} con fallback live già pronto per la review.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['1D', '1W', '1M', '1Y', 'ALL'].map((tf) => (
                  <button key={tf} type="button" className={`tab-btn ${timeframe === tf ? 'active-tab' : ''}`} onClick={() => setTimeframe(tf)}>
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-container" style={{ height: '320px', background: 'rgba(0,0,0,0.22)', borderRadius: '14px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              {chartLoading ? (
                <div className="charts-empty-state">
                  Caricamento stream grafico in corso…
                </div>
              ) : chartError ? (
                <div className="charts-empty-state">
                  {chartError}
                </div>
              ) : chartData.length === 0 ? (
                <div className="charts-empty-state">Nessun dato grafico disponibile per questo simbolo.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="symbolReviewFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={headline.tone} stopOpacity={0.45} />
                        <stop offset="95%" stopColor={headline.tone} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="price" stroke={headline.tone} fill="url(#symbolReviewFill)" strokeWidth={2.4} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card col-span-4 symbol-review-card">
            <div className="card-title">Fast diagnosis</div>
            <div className="symbol-review-diagnosis-list">
              <div className="symbol-review-diagnosis-item">
                <span>LSTM</span>
                <strong>{symbolDrilldown.metrics.lstm == null ? 'n/d' : `${symbolDrilldown.metrics.lstm.toFixed(1)}%`}</strong>
              </div>
              <div className="symbol-review-diagnosis-item">
                <span>RSI</span>
                <strong>{symbolDrilldown.metrics.rsi == null ? 'n/d' : symbolDrilldown.metrics.rsi.toFixed(1)}</strong>
              </div>
              <div className="symbol-review-diagnosis-item">
                <span>MACD</span>
                <strong>{symbolDrilldown.metrics.macd == null ? 'n/d' : symbolDrilldown.metrics.macd.toFixed(2)}</strong>
              </div>
              <div className="symbol-review-diagnosis-item">
                <span>VWAP</span>
                <strong>{symbolDrilldown.metrics.vwap == null ? 'n/d' : symbolDrilldown.metrics.vwap.toFixed(2)}</strong>
              </div>
              <div className="symbol-review-diagnosis-item">
                <span>Prediction</span>
                <strong>{currentRow?.prediction || 'n/d'}</strong>
              </div>
              {symbolDrilldown.cryptoState && (
                <div className="symbol-review-diagnosis-item">
                  <span>Crypto state</span>
                  <strong>{symbolDrilldown.cryptoState.label} · {symbolDrilldown.cryptoState.reason}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="card col-span-6 symbol-review-card">
            <div className="card-title">Readiness breakdown</div>
            <div className="symbol-review-checklist">
              <div>
                <h4>Green lights</h4>
                {entryReadiness.greenLights.length ? entryReadiness.greenLights.map((item, index) => <div key={`g-${index}`}>{item}</div>) : <div>Nessun segnale forte ancora acceso.</div>}
              </div>
              <div>
                <h4>Watch items</h4>
                {entryReadiness.watchItems.length ? entryReadiness.watchItems.map((item, index) => <div key={`w-${index}`}>{item}</div>) : <div>Nessun warning in evidenza.</div>}
              </div>
              <div>
                <h4>Blockers</h4>
                {entryReadiness.blockers.length ? entryReadiness.blockers.map((item, index) => <div key={`b-${index}`}>{item}</div>) : <div>Nessun blocco operativo rilevato.</div>}
              </div>
            </div>
          </div>

          <div className="card col-span-6 symbol-review-card">
            <div className="card-title">Recent trades & logs</div>
            <div className="symbol-review-activity-grid">
              <div>
                <h4>Trade recenti</h4>
                {symbolDrilldown.recentTrades.length ? symbolDrilldown.recentTrades.map((trade, index) => (
                  <div key={`${trade.symbol}-${trade.date}-${index}`} className="symbol-review-activity-row">
                    <strong>{trade.side}</strong>
                    <span>{trade.date || 'Data non disponibile'}</span>
                    <span style={{ color: Number(trade.profit_usd || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                      {Number(trade.profit_usd || 0) >= 0 ? '+' : ''}${Number(trade.profit_usd || 0).toFixed(2)}
                    </span>
                  </div>
                )) : <div className="symbol-review-empty">Ancora nessun trade chiuso sul simbolo.</div>}
              </div>
              <div>
                <h4>Log recenti</h4>
                {entryReadiness.recentLogs.length ? entryReadiness.recentLogs.map((line, index) => (
                  <div key={`log-${index}`} className="symbol-review-activity-row">
                    <span>{line}</span>
                  </div>
                )) : <div className="symbol-review-empty">Nessun log recente filtrato su questo simbolo.</div>}
              </div>
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

      {opportunitySpotlight.spotlight && (
        <div
          className="card trading-spotlight-card"
          style={{
            marginTop: '1rem',
            border: `1px solid ${opportunitySpotlight.spotlight.headline.border}`,
            background: opportunitySpotlight.spotlight.headline.bg,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="card-title">✨ Opportunity Spotlight</div>
              <div style={{ color: '#e2e8f0', marginTop: '0.3rem', fontSize: '0.95rem' }}>
                {opportunitySpotlight.readyCount > 0
                  ? `${opportunitySpotlight.readyCount} setup pronti: il simbolo più caldo ora è ${opportunitySpotlight.spotlight.symbol}.`
                  : `${opportunitySpotlight.warmingCount} setup in maturazione: il focus migliore ora è ${opportunitySpotlight.spotlight.symbol}.`}
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.84rem' }}>
                {opportunitySpotlight.spotlight.headline.detail}
              </div>
            </div>
            <button
              className="btn"
              type="button"
              onClick={() => openSymbolReview(opportunitySpotlight.spotlight.symbol, 'trading')}
              style={{
                background: 'rgba(0,0,0,0.18)',
                border: `1px solid ${opportunitySpotlight.spotlight.headline.border}`,
                color: opportunitySpotlight.spotlight.headline.tone,
              }}
            >
              Apri {opportunitySpotlight.spotlight.symbol}
            </button>
          </div>
        </div>
      )}

      <div className="card trading-alert-center-card" style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.025)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div className="card-title">🔔 Alert Center</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Movimenti recenti dei setup: chi diventa pronto, chi recupera, chi si blocca.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="badge badge-idle">{tradingAlerts.length} eventi</span>
            {tradingAlerts.length > 0 && (
              <button
                type="button"
                className="btn"
                onClick={() => setTradingAlerts([])}
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                Pulisci
              </button>
            )}
          </div>
        </div>
        <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.65rem' }}>
          {tradingAlerts.length ? tradingAlerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => openSymbolReview(alert.symbol, 'trading')}
              style={{
                textAlign: 'left',
                padding: '0.8rem 0.9rem',
                borderRadius: '12px',
                border: `1px solid ${alert.tone}44`,
                background: 'rgba(0,0,0,0.16)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: alert.tone, boxShadow: `0 0 12px ${alert.tone}` }}></span>
                  <span style={{ color: alert.tone, fontWeight: 800 }}>{alert.title}</span>
                  <span style={{ color: '#cbd5e1', fontSize: '0.78rem', padding: '0.16rem 0.45rem', borderRadius: '999px', background: 'rgba(255,255,255,0.06)' }}>
                    {alert.symbol}
                  </span>
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>{alert.createdAt}</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.35rem', lineHeight: 1.45 }}>
                {alert.detail}
              </div>
            </button>
          )) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Nessun cambio di stato rilevato in questa sessione. Gli alert compariranno quando un simbolo passa a pronto, recupera o si blocca.
            </div>
          )}
        </div>
      </div>

      <div className="card trading-opportunities-card" style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.025)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div className="card-title">🚀 Top Opportunities</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              I simboli più vicini a un ingresso pulito in questo momento.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Tutti' },
              { id: 'ready', label: 'Pronti' },
              { id: 'watch', label: 'In maturazione' },
              { id: 'blocked', label: 'Frenati' },
              { id: 'crypto', label: 'Crypto' },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`tab-btn ${tradingViewFilter === filter.id ? 'active-tab' : ''}`}
                onClick={() => setTradingViewFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <div className="trading-opportunities-grid" style={{ marginTop: '0.9rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
          {topOpportunities.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => openSymbolReview(item.symbol, 'trading')}
              className="trading-opportunity-tile"
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
                <SymbolLinkButton symbol={item.symbol} onOpen={() => openSymbolReview(item.symbol, 'trading')} variant="inline" style={{ color: '#f8fafc', fontWeight: 800, fontSize: '1rem', padding: 0 }}>
                  {item.symbol}
                </SymbolLinkButton>
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
          className="card trading-focus-card"
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

      {selectedSymbol && (
        <div className="card trading-drilldown-card" style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <div className="card-title">🛰️ Symbol Drill-Down · {selectedSymbol}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Scheda completa del simbolo: stato operativo, segnali, storico e contesto.
              </div>
            </div>
            <div className="badge" style={{ color: symbolDrilldown.headline.tone, borderColor: symbolDrilldown.headline.border, background: symbolDrilldown.headline.bg }}>
              {symbolDrilldown.headline.label}
            </div>
          </div>

          <div className="trading-drilldown-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.85rem', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Stato live</div>
              <div style={{ color: symbolDrilldown.isOpen ? '#10b981' : symbolDrilldown.headline.tone, fontWeight: 800 }}>
                {symbolDrilldown.isOpen ? 'Posizione aperta' : symbolDrilldown.headline.label}
              </div>
            </div>
            <div style={{ padding: '0.85rem', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Sentiment</div>
              <div style={{ color: symbolDrilldown.sentiment === 'BULLISH' ? '#10b981' : symbolDrilldown.sentiment === 'BEARISH' ? '#ef4444' : '#94a3b8', fontWeight: 800 }}>
                {symbolDrilldown.sentiment}
              </div>
            </div>
            <div style={{ padding: '0.85rem', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Storico P&L</div>
              <div style={{ color: symbolDrilldown.tradeRow ? (symbolDrilldown.tradeRow.totalPnl >= 0 ? '#10b981' : '#ef4444') : '#94a3b8', fontWeight: 800 }}>
                {symbolDrilldown.tradeRow ? `${symbolDrilldown.tradeRow.totalPnl >= 0 ? '+' : ''}$${symbolDrilldown.tradeRow.totalPnl.toFixed(2)}` : 'Nessun trade chiuso'}
              </div>
            </div>
            <div style={{ padding: '0.85rem', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Readiness</div>
              <div style={{ color: symbolDrilldown.headline.tone, fontWeight: 800 }}>{entryReadiness.score}/100</div>
            </div>
            <div style={{ padding: '0.85rem', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Segnali</div>
              <div style={{ color: '#f8fafc', fontWeight: 800 }}>
                {entryReadiness.greenLights.length} ok · {entryReadiness.watchItems.length} watch · {entryReadiness.blockers.length} block
              </div>
            </div>
          </div>

          <div className="trading-drilldown-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
            <div className="trading-drilldown-panel" style={{ padding: '0.95rem', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: '#e2e8f0', fontWeight: 800, marginBottom: '0.55rem' }}>Indicatori chiave</div>
              <div style={{ display: 'grid', gap: '0.35rem', color: '#cbd5e1', fontSize: '0.84rem' }}>
                <div>LSTM: {symbolDrilldown.metrics.lstm == null ? 'n/d' : `${symbolDrilldown.metrics.lstm.toFixed(1)}%`}</div>
                <div>RSI: {symbolDrilldown.metrics.rsi == null ? 'n/d' : symbolDrilldown.metrics.rsi.toFixed(1)}</div>
                <div>MACD: {symbolDrilldown.metrics.macd == null ? 'n/d' : symbolDrilldown.metrics.macd.toFixed(2)}</div>
                <div>VWAP: {symbolDrilldown.metrics.vwap == null ? 'n/d' : symbolDrilldown.metrics.vwap.toFixed(2)}</div>
                {symbolDrilldown.cryptoState && <div>Crypto state: {symbolDrilldown.cryptoState.label} · {symbolDrilldown.cryptoState.reason}</div>}
              </div>
            </div>

            <div className="trading-drilldown-panel" style={{ padding: '0.95rem', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: '#e2e8f0', fontWeight: 800, marginBottom: '0.55rem' }}>Storico recente del simbolo</div>
              {symbolDrilldown.recentTrades.length ? (
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {symbolDrilldown.recentTrades.map((trade, index) => (
                    <div key={`${trade.symbol}-${trade.date}-${index}`} style={{ padding: '0.55rem 0.65rem', borderRadius: '10px', background: 'rgba(0,0,0,0.18)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ color: '#f8fafc', fontWeight: 700 }}>{trade.side}</span>
                        <span style={{ color: Number(trade.profit_usd || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                          {Number(trade.profit_usd || 0) >= 0 ? '+' : ''}${Number(trade.profit_usd || 0).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '0.22rem' }}>{trade.date || 'Data non disponibile'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Ancora nessun trade chiuso su questo simbolo.</div>
              )}
            </div>
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
                <SymbolLinkButton symbol={prop.symbol} onOpen={() => openSymbolReview(prop.symbol, 'trading')} variant="inline" style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '1rem', padding: 0 }}>
                  {prop.symbol}
                </SymbolLinkButton>
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
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: '#38bdf8' }}>
                        <SymbolLinkButton symbol={inv.symbol} onOpen={() => openSymbolReview(inv.symbol, 'trading')} variant="inline" style={{ color: '#38bdf8', padding: 0, fontWeight: 'bold' }}>
                          {inv.symbol}
                        </SymbolLinkButton>
                      </td>
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
        <div className="card col-span-6 trading-performance-card">
          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Performance per simbolo</h3>
          {tradePerformance.symbolRows.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ancora nessun trade chiuso: la classifica si popola appena Aureo completa le prime operazioni.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {tradePerformance.symbolRows.slice(0, 6).map((row) => (
                <div key={row.symbol} style={{ padding: '0.8rem 0.9rem', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <SymbolLinkButton symbol={row.symbol} onOpen={() => openSymbolReview(row.symbol, 'trading')} variant="inline" style={{ color: '#f8fafc', fontWeight: 800, padding: 0 }}>
                        {row.symbol}
                      </SymbolLinkButton>
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

        <div className="card col-span-6 trading-history-card">
          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Cronologia trade chiusi</h3>
          {tradePerformance.recentTrades.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nessuna chiusura registrata al momento.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              {tradePerformance.recentTrades.map((trade, index) => (
                <div key={`${trade.symbol}-${trade.date}-${index}`} style={{ padding: '0.75rem 0.85rem', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#f8fafc', fontWeight: 800 }}>
                        <SymbolLinkButton symbol={trade.symbol} onOpen={() => openSymbolReview(trade.symbol, 'trading')} variant="inline" style={{ color: '#f8fafc', fontWeight: 800, padding: 0 }}>
                          {trade.symbol}
                        </SymbolLinkButton>{' '}· {trade.side}
                      </div>
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
          {filteredTradingSymbols.map(sym => (
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
      {filteredTradingSymbols.length === 0 && (
        <div style={{ marginTop: '0.9rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Nessun simbolo corrisponde al filtro attivo.
        </div>
      )}

      <div className="chart-container" style={{ height: '300px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', marginTop: '1rem', position: 'relative' }}>
        {!status.modules?.trading ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Bot Offline. Il grafico si popolerà in tempo reale all'avvio.
          </div>
        ) : chartLoading ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Caricamento grafico live…
          </div>
        ) : chartError ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', textAlign: 'center', padding: '1rem' }}>
            {chartError}
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
                    <SymbolLinkButton symbol={sym} onOpen={() => openSymbolReview(sym, 'trading')} variant="inline" style={{ color: 'inherit', fontWeight: 'bold', padding: 0 }}>
                      {sym} {p.side === 'short' ? '(SHORT)' : ''}
                    </SymbolLinkButton>
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
              {status.symbols?.length
                ? status.symbols.map((symbol, index) => (
                    <React.Fragment key={symbol}>
                      {index > 0 ? <span style={{ color: '#64748b' }}> • </span> : null}
                      <SymbolLinkButton symbol={symbol} onOpen={() => openSymbolReview(symbol, 'trading')} variant="inline" style={{ color: '#94a3b8', padding: 0 }}>
                        {symbol}
                      </SymbolLinkButton>
                    </React.Fragment>
                  ))
                : 'Nessun simbolo disponibile'}
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
                      <SymbolLinkButton symbol={row.symbol} onOpen={() => openSymbolReview(row.symbol, 'trading')} variant="inline" style={{ color: '#e2e8f0', fontWeight: 'bold', padding: 0 }}>
                        {row.symbol}
                      </SymbolLinkButton>
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
                        <SymbolLinkButton
                          symbol={symbol}
                          onOpen={() => openSymbolReview(symbol, 'trading')}
                          variant="pill"
                          style={{ color: '#cbd5e1', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.18rem 0.45rem', borderRadius: '999px', background: 'rgba(255,255,255,0.06)' }}
                        >
                          {symbol}
                        </SymbolLinkButton>
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
        pushNotice('error', 'Generazione idea fallita', errorMsg);
      }
    } catch(e) {
      pushNotice('error', 'Server AI non raggiungibile', e.message);
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
        pushNotice('success', 'Video caricato', 'Aureo lo distribuirà presto.');
      } else {
        pushNotice('error', 'Upload fallito', data.detail || 'Errore upload');
      }
    } catch(e) {
      pushNotice('error', 'Upload non riuscito', 'Errore durante il caricamento video.');
    }
    setUploadingVideo(false);
  };

  const handleCopyPrompt = () => {
    if (!aiIdea?.prompt) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(aiIdea.prompt);
      pushNotice('success', 'Prompt copiato', 'Il prompt è pronto da incollare dove vuoi.');
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
        pushNotice('success', 'Prompt copiato', 'Il prompt è stato copiato con il fallback locale.');
      } catch (err) {
        pushNotice('warning', 'Copia non riuscita', 'Fai copia manuale del prompt.');
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
                      if (!newUser.email || !newUser.password) { pushNotice('warning', 'Campi mancanti', 'Compila email e password prima di salvare.'); return; }
                      try {
                        const res = await authFetch('/api/saas/create-user', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(newUser)
                        });
                        const data = await res.json();
                        if (res.ok) {
                          pushNotice('success', 'Utente creato', data.message || 'Nuovo utente salvato correttamente.');
                          setShowCreateUser(false);
                          setNewUser({email:'', password:'', role:'user'});
                          const res2 = await authFetch('/api/saas/overview?t=' + Date.now());
                          setBillingOverview(await res2.json());
                        } else {
                          pushNotice('error', 'Creazione utente fallita', data.detail || 'Errore creazione utente');
                        }
                      } catch(e) { pushNotice('error', 'Connessione assente', 'Errore di connessione durante la creazione utente.'); }
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
                              openConfirmDialog({
                                tone: 'info',
                                kicker: 'Attivazione manuale',
                                title: 'Attivare utente gratis?',
                                message: `L’utente ${user.email} verrà attivato manualmente senza pagamento registrato.`,
                                confirmLabel: 'Attiva gratis',
                                onConfirmAction: async () => {
                                  try {
                                    const res = await authFetch('/api/saas/activate-user', {
                                      method: 'POST', headers: {'Content-Type': 'application/json'},
                                      body: JSON.stringify({ user_id: user.id })
                                    });
                                    const data = await res.json();
                                    if (res.ok) {
                                      await refreshBillingOverview();
                                      setBillingMessage(data.message || 'Utente attivato');
                                      pushNotice('success', 'Utente attivato', data.message || `${user.email} è ora attivo.`);
                                    } else {
                                      setBillingMessage(data.detail || 'Errore attivazione utente');
                                      pushNotice('error', 'Attivazione non riuscita', data.detail || 'Errore attivazione utente');
                                    }
                                  } catch(e) {
                                    setBillingMessage('Errore di rete durante l’attivazione');
                                    pushNotice('error', 'Rete non disponibile', 'Errore di rete durante l’attivazione.');
                                  }
                                }
                              });
                            }} style={{ width: 'auto', minHeight: 0, padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}>
                              Attiva (Gratis)
                            </button>
                            <button className="btn btn-start" onClick={async (e) => {
                              openConfirmDialog({
                                tone: 'warning',
                                kicker: 'Attivazione pagata',
                                title: 'Attivare utente come pagato?',
                                message: `L’utente ${user.email} verrà marcato come pagato e attivo.`,
                                confirmLabel: 'Attiva come pagato',
                                onConfirmAction: async () => {
                                  try {
                                    const res = await authFetch('/api/saas/activate-paid', {
                                      method: 'POST', headers: {'Content-Type': 'application/json'},
                                      body: JSON.stringify({ user_id: user.id })
                                    });
                                    const data = await res.json();
                                    if (res.ok) {
                                      await refreshBillingOverview();
                                      setBillingMessage(data.message || 'Utente attivato come pagato');
                                      pushNotice('success', 'Utente attivato come pagato', data.message || `${user.email} è stato aggiornato.`);
                                    } else {
                                      setBillingMessage(data.detail || 'Errore attivazione pagata');
                                      pushNotice('error', 'Attivazione pagata fallita', data.detail || 'Errore attivazione pagata');
                                    }
                                  } catch(e) {
                                    setBillingMessage('Errore di rete durante l’attivazione pagata');
                                    pushNotice('error', 'Rete non disponibile', 'Errore di rete durante l’attivazione pagata.');
                                  }
                                }
                              });
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
                            openConfirmDialog({
                              tone: 'danger',
                              kicker: 'Eliminazione utente',
                              title: 'Eliminare definitivamente questo utente?',
                              message: `L’utente ${user.email} verrà rimosso in modo definitivo.`,
                              confirmLabel: 'Elimina utente',
                              onConfirmAction: async () => {
                                try {
                                  await authFetch('/api/saas/delete-user', {
                                    method: 'POST', headers: {'Content-Type': 'application/json'},
                                    body: JSON.stringify({ user_id: user.id })
                                  });
                                  await refreshBillingOverview();
                                  setBillingMessage('Utente eliminato');
                                  pushNotice('success', 'Utente eliminato', `${user.email} è stato rimosso.`);
                                } catch(e) {
                                  setBillingMessage('Errore durante eliminazione utente');
                                  pushNotice('error', 'Eliminazione fallita', 'Errore durante eliminazione utente.');
                                }
                              }
                            });
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
      { value: '24/7', label: 'visibilità continua su operatività, accessi e protezioni' },
      { value: 'Private UX', label: 'una presenza riservata che comunica subito livello e controllo' },
      { value: '3 step', label: 'un percorso lineare che accompagna scelta, richiesta e attivazione' },
    ];
    const landingEnterpriseSignals = [
      'Accesso su richiesta',
      'Abilitazione verificata',
      'Passkey e credenziali protette',
      'Esperienza premium su ogni device',
    ];
    const landingHeroHighlights = [
      'Ogni dettaglio comunica controllo, discrezione e qualità.',
      'Il percorso accompagna senza creare attrito o rumore.',
      'Tu mantieni il pieno presidio su accesso e attivazione.',
    ];
    const landingEnterpriseBlocks = [
      {
        title: 'Accesso presidiato',
        text: 'L’ingresso non è casuale né impersonale: ogni richiesta passa dentro un percorso ordinato, verificato e sotto il tuo controllo.',
      },
      {
        title: 'Protezione visibile',
        text: 'Passkey, vault chiavi e credenziali protette trasformano la sicurezza in una parte tangibile dell’esperienza.',
      },
      {
        title: 'Valore più forte',
        text: 'Quando la cornice è giusta, anche il canone, la trattativa e la qualità percepita diventano più facili da sostenere.',
      },
    ];
    const landingExecutiveMetrics = [
      { label: 'Posizionamento', value: 'Executive-ready' },
      { label: 'Accesso', value: 'Privato e controllato' },
      { label: 'Protezione', value: 'Passkey + Vault' },
      { label: 'Attivazione', value: 'Guidata step-by-step' },
    ];
    const landingAssuranceBlocks = [
      {
        title: 'Accessi protetti',
        text: 'La prima impressione racconta rigore: credenziali custodite, accessi protetti e un ambiente che comunica subito disciplina.',
      },
      {
        title: 'Percorso governato',
        text: 'Non entri in un login freddo: vieni accompagnato dentro un flusso guidato, verificabile e perfettamente coerente.',
      },
      {
        title: 'Tono più alto',
        text: 'Tutto appare più maturo, più credibile e più adatto a sostenere conversazioni su continuità, qualità e gestione nel tempo.',
      },
    ];
    const landingFeatures = [
      {
        icon: '🎯',
        title: 'Capisci subito a cosa stai accedendo',
        text: 'Aureo si presenta come un ambiente operativo privato, ordinato e ad alto valore percepito, non come un software generico.',
      },
      {
        icon: '🪙',
        title: 'Percepisci subito perché questo accesso ha valore',
        text: 'Quando l’esperienza appare curata, protetta e presidiata, anche il canone appare più coerente, più credibile e più facile da accogliere.',
      },
      {
        icon: '🛡️',
        title: 'Tu resti in controllo fino alla fine',
        text: 'Il funnel non ti porta fuori dal presidio: richiesta, verifica e attivazione restano sempre allineate al tuo modello di controllo.',
      },
    ];
    const landingAudience = [
      {
        title: 'Private investor',
        text: 'Per chi cerca una control room personale che trasmetta subito ordine, qualità e accesso selettivo.',
      },
      {
        title: 'Advisory / consulenza',
        text: 'Per chi deve mostrare un ambiente credibile a clienti o partner, senza sembrare retail, rumoroso o improvvisato.',
      },
      {
        title: 'High-ticket operator',
        text: 'Per chi vende esperienza, controllo e continuità, non semplici funzioni sparse dentro una webapp.',
      },
    ];
    const landingDecisionStrip = [
      { value: 'Riservato', label: 'l’accesso si percepisce come selettivo, non disponibile a chiunque' },
      { value: 'Curato', label: 'ogni passaggio accompagna con naturalezza, senza spezzare il desiderio' },
      { value: 'Autorevole', label: 'tono, ritmo e presenza visiva sostengono subito un canone più alto' },
    ];
    const landingModuleShowcase = [
      {
        title: 'AI Guided Allocation',
        text: 'Per leggere le opportunità con supporto intelligente, senza dover mettere insieme strumenti esterni e flussi separati.',
        badge: 'AI',
      },
      {
        title: 'Signal & Market Monitoring',
        text: 'Per avere watchlist, momentum, operatività e contesto dentro un unico ambiente chiaro e leggibile.',
        badge: 'Signals',
      },
      {
        title: 'Risk & Security Control',
        text: 'Per far percepire che Aureo non è solo execution: è anche protezione, disciplina e controllo degli accessi.',
        badge: 'Control',
      },
      {
        title: 'Private Access Workflow',
        text: 'Per trasformare il passaggio da visitatore ad abbonato in un processo più ordinato, fluido e ad alto valore percepito.',
        badge: 'Access',
      },
    ];
    const landingMarketProof = [
      { value: 'Control room', label: 'AI, monitoring, risk e security convivono nello stesso spazio con eleganza' },
      { value: 'Approval', label: 'l’abilitazione finale resta sempre nelle tue mani, senza perdere fluidità' },
      { value: 'High-ticket', label: 'la struttura sostiene con naturalezza accessi premium e clienti più esigenti' },
      { value: 'Everywhere', label: 'la presenza resta coerente e raffinata su desktop, tablet e mobile' },
    ];
    const landingFlow = [
      {
        number: '1',
        title: 'Entri nella giusta percezione',
        text: 'La prima parte della pagina costruisce subito il tono corretto: accesso riservato, controllo alto, esperienza premium.',
      },
      {
        number: '2',
        title: 'Scegli lo step',
        text: 'I tre accessi sono chiari, ordinati e facili da comprendere, così la scelta appare naturale e non forzata.',
      },
      {
        number: '3',
        title: 'Attivi la richiesta',
        text: 'La richiesta parte nello stesso flusso, mentre l’abilitazione finale resta nelle tue mani: più fiducia per chi entra, più controllo per te.',
      },
    ];
    const landingTestimonials = [
      {
        initials: 'PI',
        name: 'Private Investor',
        role: 'Cliente early access',
        quote: 'L’impatto è immediato: trasmette controllo, pulizia e la sensazione di un servizio privato curato nei dettagli.',
      },
      {
        initials: 'CI',
        name: 'Consulente indipendente',
        role: 'Profilo advisory',
        quote: 'Qui non stai mostrando semplici schermate: stai comunicando metodo, posizionamento e una percezione di valore più alta.',
      },
      {
        initials: 'TA',
        name: 'Trader attivo',
        role: 'Utente operativo',
        quote: 'Il percorso accompagna bene la scelta e non rompe il ritmo: sembra un accesso curato, non un form improvvisato.',
      },
    ];
    const landingProofPoints = [
      { value: 'Premium', label: 'impatto percepito fin dal primo scroll' },
      { value: 'Guidato', label: 'percorso chiaro dalla scelta alla richiesta' },
      { value: 'Controllato', label: 'abilitazione verificata prima dell’accesso pieno' },
    ];
    const landingTrustPillars = [
      'Presenza privata ad alto valore percepito',
      'Percorso commerciale pulito e guidato',
      'Coerenza piena tra promessa, canone e accesso',
    ];
    const landingFaq = [
      {
        question: 'Come avviene l’attivazione di un cliente?',
        answer: 'Scegli la formula più adatta, invii la richiesta e ricevi l’attivazione dopo la verifica finale. Un percorso semplice, guidato e sempre sotto controllo.',
      },
      {
        question: 'Aureo è pensato per uso pubblico o privato?',
        answer: 'Aureo nasce con un’impostazione chiaramente privata: tono, funnel e accesso selettivo raccontano un ambiente riservato, non una piattaforma aperta a tutti.',
      },
      {
        question: 'Perché questa struttura aiuta a vendere meglio?',
        answer: 'Perché fa percepire subito una differenza: tutto appare più curato, più solido e più credibile. E quando la sensazione è quella giusta, anche la scelta diventa più naturale.',
      },
      {
        question: 'Cosa differenzia gli step di accesso?',
        answer: 'Cambiano il ritmo, la durata e il livello di continuità con cui entri in Aureo. L’esperienza resta coerente; cambia il modo in cui scegli di viverla.',
      },
    ];
    if (showLanding) {
      return (
        <div className="sales-landing">
          <div className="sales-bg-animation" />
          <div className="sales-bg-animation sales-bg-animation--second" />
          <div className="sales-topbar">
            <span className="sales-topbar-label">Private Preview</span>
            <span className="sales-topbar-text">Un accesso in abbonamento a una control room privata, premium e attivata con cura.</span>
          </div>

          <nav className="sales-nav">
            <a href="#landing-top" className="sales-logo">
              <img src="/aureoos-logo.png" alt="Aureo OS" />
            </a>
            <div className="sales-nav-links">
              <a href="#landing-features">Funzionalità</a>
              <a href="#landing-assurance">Garanzie</a>
              <a href="#landing-flow">Percorso</a>
              <a href="#landing-pricing">Step</a>
              <a href="#landing-proof">Impatto</a>
            </div>
            <div className="sales-nav-actions">
              <button className="btn btn-outline" onClick={() => setShowLanding(false)}>Area riservata</button>
              <button className="btn btn-start" onClick={openPricingSection}>Scopri gli accessi</button>
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
                <div className="sales-badge">⚡ Private Access Operating System</div>
                <h1>
                  Accedi a una <span>control room privata</span> pensata per chi pretende controllo, ordine e discrezione
                </h1>
                <p>
                  Un ambiente operativo riservato, guidato e continuativo, dove ogni dettaglio comunica qualità, presidio e valore percepito.
                </p>
                <div className="sales-hero-buttons">
                  <button className="btn btn-start btn-large" onClick={openPricingSection}>
                    Scegli il tuo accesso
                  </button>
                  <button className="btn btn-outline btn-large" onClick={startTour}>
                    Guarda il tour privato
                  </button>
                </div>
                <div className="sales-hero-proof-list">
                  {landingHeroHighlights.map((item) => (
                    <div key={item} className="sales-hero-proof-item">✓ {item}</div>
                  ))}
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
                      <div className="sales-boardroom-kicker">Private Control Surface</div>
                      <div className="sales-boardroom-title">AUREO OS / Executive Overview</div>
                    </div>
                    <div className="sales-boardroom-status">Access by request</div>
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
                          <div className="sales-app-subtitle">Private Operating Interface</div>
                        </div>
                        <div className="sales-app-balance">$100,900</div>
                      </div>
                      <div className="sales-balance-chart">
                        <div className="sales-chart-line" />
                      </div>
                      <div className="sales-bot-status">
                        <span className="sales-status-dot" />
                        <span>Ambiente pronto • accesso guidato, segnali leggibili, protezioni attive</span>
                      </div>
                      {[
                        { label: 'AI Guided Investment', meta: 'Allocazione assistita • priorità già filtrate', value: '+$1,240' },
                        { label: 'Market Monitoring', meta: 'Opportunità presidiate • watchlist attiva', value: '+$420' },
                        { label: 'Security Vault', meta: 'Chiavi protette • accesso verificato', value: 'SAFE' },
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
                    <div className="sales-boardroom-chip">Percorso guidato</div>
                    <div className="sales-boardroom-chip">Security-first</div>
                    <div className="sales-boardroom-chip">Executive UX</div>
                  </div>
                </div>
                <div className="sales-float-card sales-float-card--top">
                  <div className="sales-float-card-header">Private posture</div>
                  <div className="sales-float-card-value">High</div>
                </div>
                <div className="sales-float-card sales-float-card--bottom">
                  <div className="sales-float-card-header">Approval model</div>
                  <div className="sales-float-card-value sales-float-card-value--alt">Ready</div>
                </div>
                <img src={heroAsset} alt="" className="sales-hero-orb" />
              </div>
            </section>

            <section className="sales-section" id="landing-features">
              <div className="sales-section-header">
                <div className="sales-section-eyebrow">Cosa acquista davvero il cliente</div>
                <h2>Un accesso riservato a un ambiente operativo che trasmette ordine, controllo e valore</h2>
                <p>Non un software da esplorare distrattamente, ma un’esperienza premium da attivare e mantenere nel tempo.</p>
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
                <div className="sales-section-eyebrow">Perché appare più serio</div>
                <h2>Ogni dettaglio racconta rigore, selezione e governo del processo</h2>
                <p>Qui tutto deve trasmettere una sensazione precisa: Aureo non è aperto a tutti, non è improvvisato e non lascia nulla al caso.</p>
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
                <div className="sales-section-eyebrow">Per chi è pensato</div>
                <h2>Una proposta adatta a chi compra qualità, ordine e continuità</h2>
                <p>Un accesso pensato per chi vuole sentirsi dentro un ambiente privato, ben governato e costruito per durare.</p>
              </div>
              <div className="sales-enterprise-grid">
                {landingAudience.map((item) => (
                  <article key={item.title} className="sales-enterprise-card">
                    <div className="sales-enterprise-card-kicker">{item.title}</div>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="sales-section">
              <div className="sales-section-header">
                <div className="sales-section-eyebrow">Cosa c’è dentro Aureo</div>
                <h2>I moduli chiave sono comprensibili subito, senza dover spiegare tutto a voce</h2>
                <p>I servizi migliori si capiscono in pochi istanti. Qui Aureo racconta i suoi pilastri in modo chiaro, ordinato e convincente.</p>
              </div>
              <div className="sales-module-grid">
                {landingModuleShowcase.map((item) => (
                  <article key={item.title} className="sales-module-card">
                    <div className="sales-module-badge">{item.badge}</div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="sales-section sales-section--soft">
              <div className="sales-section-header">
                <div className="sales-section-eyebrow">Cosa cambia davvero</div>
                <h2>La sensazione cambia subito: Aureo appare più esclusivo, più credibile, più desiderabile</h2>
                <p>Non è solo una questione visiva. È il modo in cui tutto si allinea — tono, accesso, ritmo e presenza — fino a far sembrare Aureo esattamente ciò che deve essere: un ambiente a cui vale la pena accedere.</p>
              </div>
              <div className="sales-stats-row sales-stats-row--proof">
                {landingDecisionStrip.map((item) => (
                  <div key={item.label} className="sales-stat-item">
                    <div className="sales-stat-value">{item.value}</div>
                    <div className="sales-stat-label">{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="sales-stats-row sales-stats-row--proof sales-stats-row--market">
                {landingMarketProof.map((item) => (
                  <div key={item.label} className="sales-stat-item">
                    <div className="sales-stat-value">{item.value}</div>
                    <div className="sales-stat-label">{item.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="sales-section sales-section--soft" id="landing-flow">
              <div className="sales-section-header">
                <div className="sales-section-eyebrow">Come si entra in Aureo</div>
                <h2>Un percorso pulito in 3 passaggi, senza spezzare il ritmo</h2>
                <p>Dalla prima impressione alla richiesta finale, il flusso accompagna verso l’attivazione senza perdere controllo né qualità percepita.</p>
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
                <div className="sales-section-eyebrow">Step di accesso</div>
                <h2>Scegli la formula di accesso più adatta al tuo profilo</h2>
                <p>Ogni formula definisce un diverso ritmo di accesso ad Aureo, con il giusto livello di accompagnamento e continuità.</p>
              </div>
              <div className="sales-pricing-grid">
                {landingPlans.map((plan) => (
                  <article key={plan.id} className={`sales-pricing-card ${plan.id === 'monthly' ? 'sales-pricing-card--popular' : ''}`}>
                    {plan.id === 'monthly' && <div className="sales-popular-badge">Scelta più richiesta</div>}
                    <div className="sales-pricing-header">
                      <h3>{plan.name}</h3>
                      <div className="sales-pricing-kicker">{plan.tagline || 'Percorso Aureo'}</div>
                      <div className="sales-price">{plan.price_label || `€${plan.price_monthly}`}<span>{plan.cadence_label || '/mese'}</span></div>
                      <p>{plan.description}</p>
                    </div>
                    <div className="sales-pricing-ideal-for">{plan.ideal_for}</div>
                    <div className="sales-pricing-features">
                      {plan.features.map((feature) => (
                        <div key={feature} className="sales-pricing-feature">✓ {feature}</div>
                      ))}
                    </div>
                    <button className="btn btn-start sales-pricing-button" onClick={() => continueWithPlan(plan.id)}>
                      Attiva {plan.name}
                    </button>
                    <div className="sales-pricing-footnote">Attivazione finale verificata manualmente</div>
                  </article>
                ))}
              </div>
            </section>

            {selectedPlan && (
              <section className="sales-section sales-section--onboarding" id="landing-plan-onboarding">
                <div className="sales-inline-plan">
                  <div className="sales-inline-plan-badge">Step selezionato</div>
                  <h3>{selectedPlan.name}</h3>
                  <div className="sales-pricing-kicker">{selectedPlan.tagline || 'Percorso Aureo'}</div>
                  <p>{selectedPlan.description}</p>
                  <div className="sales-inline-plan-price">{selectedPlan.price_label || `€${selectedPlan.price_monthly}`}<span>{selectedPlan.cadence_label || '/mese'}</span></div>
                  <div className="sales-pricing-ideal-for">{selectedPlan.ideal_for}</div>
                  <div className="sales-inline-plan-features">
                    {selectedPlan.features.map((feature) => (
                      <div key={feature} className="sales-inline-plan-feature">✓ {feature}</div>
                    ))}
                  </div>
                </div>

                <form className="sales-inline-form" onSubmit={handleLogin}>
                  <div className="sales-inline-form-head">
                    <div className="sales-badge sales-badge--small">Attivazione guidata</div>
                    <h3>{isRegistering ? `Invia la richiesta per ${selectedPlan.name}` : `Accedi per riprendere il percorso ${selectedPlan.name}`}</h3>
                    <p>
                      {isRegistering
                        ? 'Compila i dati essenziali e invia la tua richiesta senza uscire da questo percorso.'
                        : 'Se hai già ricevuto il tuo accesso, rientra qui e prosegui senza perdere il filo.'}
                    </p>
                    <div className="sales-inline-form-note">Ogni richiesta viene verificata e allineata allo step selezionato prima dell’attivazione completa.</div>
                  </div>
                  <input
                    type="email"
                    placeholder="Email di riferimento"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="sales-input"
                  />
                  <input
                    type="password"
                    placeholder={isRegistering ? 'Imposta una password riservata' : 'Inserisci la tua password'}
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
                    {isRegistering ? `Richiedi attivazione ${selectedPlan.name}` : `Accedi e prosegui`}
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
                    Torna agli step
                  </button>
                </form>
              </section>
            )}

            <section className="sales-section sales-section--proof" id="landing-proof">
              <div className="sales-section-header">
                <div className="sales-section-eyebrow">Impatto percepito</div>
                <h2>Quando la cornice è giusta, tutto il prodotto sale di livello</h2>
                <p>Un’offerta più ordinata e più privata rende Aureo più desiderabile, più difendibile e più memorabile.</p>
              </div>
              <div className="sales-stats-row sales-stats-row--proof">
                {landingProofPoints.map((item) => (
                  <div key={item.label} className="sales-stat-item">
                    <div className="sales-stat-value">{item.value}</div>
                    <div className="sales-stat-label">{item.label}</div>
                  </div>
                ))}
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

            <section className="sales-section sales-section--soft">
              <div className="sales-section-header">
                <div className="sales-section-eyebrow">Domande che chiudono le obiezioni</div>
                <h2>Le informazioni importanti sono già lì, senza costringerti a spiegarle ogni volta</h2>
                <p>Le migliori esperienze riducono l’attrito rispondendo subito ai dubbi principali. Qui succede con un tono più esclusivo.</p>
              </div>
              <div className="sales-faq-grid">
                {landingFaq.map((item) => (
                  <article key={item.question} className="sales-faq-card">
                    <h3>{item.question}</h3>
                    <p>{item.answer}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="sales-cta">
              <div className="sales-cta-box">
                <div className="sales-cta-content">
                  <img src="/aureoos-logo.png" alt="Aureo OS" className="sales-cta-logo" />
                  <div className="sales-section-eyebrow">Call to action finale</div>
                  <h2>Entra in Aureo come si entra in un ambiente riservato, non in una semplice app</h2>
                  <p>Non l’idea di un software da usare al volo, ma quella di un accesso selettivo a un ambiente di valore, curato e continuativo.</p>
                  <div className="sales-trust-row">
                    {landingTrustPillars.map((item) => (
                      <div key={item} className="sales-trust-pill">{item}</div>
                    ))}
                  </div>
                  <div className="sales-hero-buttons sales-hero-buttons--center">
                    <button className="btn btn-start btn-large" onClick={openPricingSection}>Scegli il tuo accesso</button>
                    <button className="btn btn-outline btn-large" onClick={startTour}>Guarda il tour privato</button>
                  </div>
                  <div className="sales-cta-note">Accesso finale sempre verificato e abilitato in modo controllato.</div>
                </div>
              </div>
            </section>

            <footer className="sales-footer">
              <div className="sales-footer-grid">
                <div className="sales-footer-brand">
                  <a href="#landing-top" className="sales-logo">
                    <img src="/aureoos-logo.png" alt="Aureo OS" />
                  </a>
                  <p>Un’esperienza privata e premium pensata per controllo, chiarezza, protezione e accessi guidati.</p>
                </div>
                <div className="sales-footer-links">
                  <h4>Prodotto</h4>
                  <a href="#landing-features">Funzionalità</a>
                  <a href="#landing-assurance">Garanzie</a>
                  <a href="#landing-pricing">Step</a>
                </div>
                <div className="sales-footer-links">
                  <h4>Esperienza</h4>
                  <a href="#landing-flow">Percorso</a>
                  <a href="#landing-proof">Impatto</a>
                </div>
                <div className="sales-footer-links">
                  <h4>Accesso</h4>
                  <button type="button" className="sales-footer-button" onClick={() => setShowLanding(false)}>Area riservata</button>
                  <button type="button" className="sales-footer-button" onClick={openPricingSection}>Scopri gli step</button>
                </div>
              </div>
              <div className="sales-footer-bottom">
                <span>© 2026 AUREO OS</span>
                <span>Private crypto & investment operating experience</span>
              </div>
            </footer>
          </div>
        </div>
      );
    }

    return (
      <div className="omni-app" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card private-access-card" style={{ textAlign: 'center', width: '440px', padding: '3rem 2rem' }}>
          <img src="/aureoos-logo.png" alt="Aureo OS" style={{ maxWidth: '100%', maxHeight: '140px', marginBottom: '1.5rem', objectFit: 'contain' }} />
          <div className="private-access-badge">Private Access</div>
          <h2 className="private-access-title">Ingresso riservato alla control room Aureo</h2>
          <p className="private-access-text">Accedi con le tue credenziali per entrare nell’ambiente operativo, oppure apri il tour privato per mostrare l’esperienza senza attivare funzioni live.</p>
          <form onSubmit={handleLogin}>
            <input 
              type="email" 
              placeholder={isRegistering ? "Email di riferimento" : "Email riservata"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}
            />
            <input 
              type="password" 
              placeholder={isRegistering ? "Crea una password riservata" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}
            />
            {loginError && <div style={{ color: 'var(--accent-red)', marginBottom: '1rem', fontSize: '0.9rem' }}>{loginError}</div>}
            <button type="submit" className="btn btn-start" style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>
              {isRegistering ? 'INVIA RICHIESTA DI ACCESSO' : 'ACCEDI ALLA CONTROL ROOM'}
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
            APRI TOUR PRIVATO (DEMO)
          </button>
          <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#64748b' }}>
            🔒 Accesso protetto e ambiente riservato<br/>
          </div>
        </div>
      </div>
    );
  }

  // --- INTERFACCIA AUTENTICATA (ADMIN O USER ATTIVO) ---
  return (
    <>
    <NoticeTray notices={notices} onDismiss={dismissNotice} />
    <ConfirmDialog config={confirmDialog} onCancel={closeConfirmDialog} onConfirm={runConfirmedAction} />
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
          {userRole !== 'admin' && (
            <div className={`menu-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
              <span className="menu-icon">🔐</span>
              <span className="menu-label">Security</span>
            </div>
          )}
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
          {userRole !== 'admin' && (
            <div style={{
              marginTop: '0.65rem',
              padding: '0.8rem 0.9rem',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.035)',
              border: `1px solid ${accountAccessMeta.tone}33`,
              textAlign: 'center',
              cursor: (accountAccessMeta.isExpired || accountAccessMeta.isExpiringSoon) ? 'pointer' : 'default'
            }}
            onClick={() => {
              if (accountAccessMeta.isExpired || accountAccessMeta.isExpiringSoon) {
                setShowPaymentModal(true);
              }
            }}>
              <div style={{ color: accountAccessMeta.tone, fontWeight: 800, fontSize: '0.84rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {accountAccessMeta.title}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.32rem', lineHeight: 1.45 }}>
                {accountAccessMeta.detail}
              </div>
              {(accountAccessMeta.isExpired || accountAccessMeta.isExpiringSoon) && (
                <div style={{
                  marginTop: '0.7rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  background: accountAccessMeta.isExpired ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                  border: `1px solid ${accountAccessMeta.isExpired ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.28)'}`,
                  color: accountAccessMeta.isExpired ? '#fca5a5' : '#fcd34d',
                  fontSize: '0.8rem',
                  lineHeight: 1.4
                }}>
                  {accountAccessMeta.isExpired
                    ? 'Il tuo accesso è scaduto: rinnova per continuare senza interruzioni.'
                    : 'Scadenza vicina: ti conviene rinnovare adesso per non perdere continuità.'}
                </div>
              )}
              {accountAccessMeta.actionLabel && (
                <div style={{
                  marginTop: '0.6rem',
                  color: accountAccessMeta.tone,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.03em'
                }}>
                  {accountAccessMeta.actionLabel} →
                </div>
              )}
            </div>
          )}

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
            savedKeys={savedKeys}
          />
        )}

        {/* Missing Keys Banner */}
        {(!apiKeys.alpaca_key && userRole !== 'admin' && !isDemoMode) && (
          <div className="setup-banner" style={{
            background: 'linear-gradient(90deg, #f59e0b, #d97706)',
            color: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: '1rem', flexWrap: 'wrap',
            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)'
          }}>
            <div>
              <strong>Azione richiesta:</strong> completa il setup per iniziare a operare sui mercati.
              {missingSetupItems.length > 0 && (
                <div style={{ marginTop: '0.35rem', opacity: 0.92, fontSize: '0.88rem', lineHeight: 1.45 }}>
                  Mancano: {missingSetupItems.join(' • ')}
                </div>
              )}
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
        {isTourActive && (
          <div className="tour-guide-shell">
            <div className="tour-guide-card">
              <div className="tour-guide-top">
                <div>
                  <div className="tour-guide-kicker">{TOUR_STEPS[tourStep].kicker}</div>
                  <h3>{TOUR_STEPS[tourStep].title}</h3>
                </div>
                <div className="tour-guide-counter">{tourStep + 1}/{TOUR_STEPS.length}</div>
              </div>
              <p>{TOUR_STEPS[tourStep].text}</p>
              <div className="tour-guide-progress">
                {TOUR_STEPS.map((step, index) => (
                  <span
                    key={step.title}
                    className={`tour-guide-dot ${index === tourStep ? 'active' : ''} ${index < tourStep ? 'done' : ''}`}
                  />
                ))}
              </div>
              <div className="tour-guide-actions">
                <button type="button" className="btn sales-ghost-button" onClick={endTour}>
                  Chiudi tour
                </button>
                <div className="tour-guide-nav">
                  <button type="button" className="btn btn-outline" onClick={prevTourStep} disabled={tourStep === 0}>
                    Indietro
                  </button>
                  <button type="button" className="btn btn-start" onClick={nextTourStep}>
                    {tourStep === TOUR_STEPS.length - 1 ? 'Fine tour' : 'Continua'}
                  </button>
                </div>
              </div>
            </div>
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
        <SystemStatusBanner
          status={status}
          isBackendOnline={isBackendOnline}
          onOpenHealth={() => openDevelopSection('health')}
          onOpenTrading={() => setActiveTab('trading')}
        />
        {activeTab === 'home' && renderHomeView()}
        {activeTab === 'trading' && renderTradingView()}
        {activeTab === 'symbol_review' && renderSymbolReviewView()}
        {activeTab === 'charts' && (
          <ChartsStudio
            chartData={chartData}
            chartLoading={chartLoading}
            chartError={chartError}
            selectedSymbol={selectedSymbol}
            setSelectedSymbol={setSelectedSymbol}
            status={status}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            onOpenSymbolReview={(symbol) => openSymbolReview(symbol, 'charts')}
          />
        )}
        {activeTab === 'security' && userRole !== 'admin' && renderSettingsView()}
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
          onOpenSymbolReview={openSymbolReview}
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
