import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const deriveCryptoSymbolStates = (status = {}) => {
  const symbols = Array.isArray(status.symbols) ? status.symbols : [];
  const logs = Array.isArray(status.logs) ? status.logs : [];
  const positions = status.positions || {};
  const cryptoSymbols = symbols.filter((sym) => String(sym).includes('/'));

  return Object.fromEntries(
    cryptoSymbols.map((symbol) => {
      const symbolLogs = logs.filter((line) => String(line || '').includes(symbol));
      const latest = symbolLogs[0] || '';
      const hasOpenPosition = positions[symbol] && positions[symbol] !== 'LIQUID';

      if (!status.modules?.trading) {
        return [symbol, { label: 'Pausa', tone: '#94a3b8', border: 'rgba(148, 163, 184, 0.35)', reason: 'Scanner spento' }];
      }
      if (hasOpenPosition) {
        return [symbol, { label: 'Open', tone: '#10b981', border: 'rgba(16, 185, 129, 0.35)', reason: 'Posizione aperta' }];
      }
      if (latest.includes('ORDINE') || latest.includes('FAST SCALP')) {
        return [symbol, { label: 'Ready', tone: '#10b981', border: 'rgba(16, 185, 129, 0.35)', reason: 'Attività recente' }];
      }
      if (latest.includes('volatilità troppo bassa')) {
        return [symbol, { label: 'Flat', tone: '#38bdf8', border: 'rgba(56, 189, 248, 0.35)', reason: 'Mercato piatto' }];
      }
      if (latest.includes('nessun setup tecnico valido')) {
        return [symbol, { label: 'Watch', tone: '#a78bfa', border: 'rgba(167, 139, 250, 0.35)', reason: 'In osservazione' }];
      }
      if (latest.includes('AI VETO') || latest.includes('LSTM VETO') || latest.includes('RISK FILTER') || latest.includes('SKIP SHORT')) {
        return [symbol, { label: 'Veto', tone: '#f59e0b', border: 'rgba(245, 158, 11, 0.35)', reason: 'Filtro attivo' }];
      }
      return [symbol, { label: 'Sync', tone: '#64748b', border: 'rgba(100, 116, 139, 0.35)', reason: 'In attesa dati' }];
    })
  );
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

const parseMetricValue = (prediction = '', label) => {
  const match = String(prediction || '').match(new RegExp(`${label}:\\s*(-?\\d+(?:\\.\\d+)?)`, 'i'));
  return match ? Number(match[1]) : null;
};

export default function ChartsStudio({
  chartData = [],
  selectedSymbol,
  setSelectedSymbol,
  status = {},
  timeframe,
  setTimeframe,
  onOpenSymbolReview,
}) {
  const cryptoSymbolStateMap = deriveCryptoSymbolStates(status);
  const tradeHistory = status.trade_history || [];
  const liveChartData = Array.isArray(chartData) ? chartData.slice(-36) : [];
  const safeSymbols = Array.isArray(status.symbols) ? status.symbols : [];
  const currentSymbol = selectedSymbol || safeSymbols[0] || null;
  const positions = Object.entries(status.positions || {})
    .filter(([_, position]) => position && position !== 'LIQUID');
  const currentRow = (status.table_data || []).find((row) => row.symbol === currentSymbol) || null;
  const currentPosition = currentSymbol ? positions.find(([symbol]) => symbol === currentSymbol)?.[1] : null;
  const currentCryptoState = currentSymbol ? cryptoSymbolStateMap[currentSymbol] : null;
  const currentLogs = (status.logs || []).filter((line) => currentSymbol && String(line || '').includes(currentSymbol)).slice(0, 4);
  const currentPrice = liveChartData.length ? Number(liveChartData[liveChartData.length - 1]?.price || 0) : 0;
  const openingPrice = liveChartData.length ? Number(liveChartData[0]?.price || 0) : currentPrice;
  const chartDelta = Number((currentPrice - openingPrice).toFixed(2));
  const chartDeltaPct = openingPrice ? Number((((currentPrice - openingPrice) / openingPrice) * 100).toFixed(2)) : 0;
  const chartHigh = liveChartData.length ? Math.max(...liveChartData.map((point) => Number(point.price || 0))) : currentPrice;
  const chartLow = liveChartData.length ? Math.min(...liveChartData.map((point) => Number(point.price || 0))) : currentPrice;
  const currentExposure = currentPosition ? Math.abs(Number(currentPosition.market_value || 0)) : 0;
  const currentUnrealized = currentPosition ? Number(currentPosition.unrealized_pl || 0) : 0;
  const symbolRsi = parseMetricValue(currentRow?.prediction, 'RSI\\(1M\\)');
  const symbolMacd = parseMetricValue(currentRow?.prediction, 'MACD');
  const symbolVwap = parseMetricValue(currentRow?.prediction, 'VWAP');
  const symbolLstm = parseMetricValue(currentRow?.prediction, 'LSTM');
  const momentumTone = chartDelta >= 0 ? '#10b981' : '#ef4444';
  const readinessLabel = currentPosition
    ? currentPosition.side === 'short'
      ? 'Short live'
      : 'Long live'
    : currentCryptoState
      ? `${currentCryptoState.label} · ${currentCryptoState.reason}`
      : currentRow?.sentiment === 'BULLISH'
        ? 'Bias rialzista'
        : currentRow?.sentiment === 'BEARISH'
          ? 'Bias prudente'
          : 'In osservazione';

  const overviewMetrics = [
    { label: 'Prezzo live', value: currentPrice ? `$${currentPrice.toFixed(2)}` : '—', tone: '#f8fafc' },
    { label: 'Move frame', value: `${chartDelta >= 0 ? '+' : ''}$${chartDelta.toFixed(2)} · ${chartDeltaPct >= 0 ? '+' : ''}${chartDeltaPct.toFixed(2)}%`, tone: momentumTone },
    { label: 'Range', value: chartHigh && chartLow ? `$${chartLow.toFixed(2)} → $${chartHigh.toFixed(2)}` : '—', tone: '#38bdf8' },
    { label: 'Setup', value: readinessLabel, tone: currentCryptoState?.tone || '#a78bfa' },
  ];

  const allocationData = [
    { name: 'Liquidità', value: Number(status.cash || 0), color: '#94a3b8' },
    ...positions.map(([symbol, position], index) => ({
      name: symbol,
      value: Math.abs(Number(position.market_value || 0)),
      color: ['#38bdf8', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#06b6d4'][index % 6]
    }))
  ].filter((item) => item.value > 0);

  const performanceData = (() => {
    const seed = Number(status.initial_cash || 1000);
    let equity = seed;
    const rows = tradeHistory.slice(-12).map((trade, index) => {
      equity += Number(trade.profit_usd || 0);
      return {
        name: trade.symbol || `T${index + 1}`,
        equity: Number(equity.toFixed(2)),
        pnl: Number(trade.profit_usd || 0),
      };
    });
    return rows.length ? rows : [{ name: 'Start', equity: Number(status.portfolio_value || seed), pnl: 0 }];
  })();

  const positionBars = positions.map(([symbol, position]) => ({
    symbol,
    pnl: Number(position.unrealized_pl || 0),
    exposure: Math.abs(Number(position.market_value || 0)),
  })).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

  const rankedRows = (status.symbol_selection?.ranked || []).filter((row) => row.score != null).slice(0, 6);
  const watchlistBars = rankedRows.map((row) => ({
    symbol: row.symbol,
    score: Number(row.score || 0),
  }));

  const tradeMixData = [
    { name: 'Vincenti', value: tradeHistory.filter((trade) => Number(trade.profit_usd || 0) > 0).length, color: '#10b981' },
    { name: 'Flat/Loss', value: tradeHistory.filter((trade) => Number(trade.profit_usd || 0) <= 0).length, color: '#ef4444' },
  ].filter((item) => item.value > 0);

  const recentClosedForSymbol = tradeHistory
    .filter((trade) => !currentSymbol || trade.symbol === currentSymbol)
    .slice(-4)
    .reverse();

  const insightMetrics = [
    { label: 'LSTM', value: symbolLstm != null ? `${symbolLstm.toFixed(1)}%` : '—' },
    { label: 'RSI', value: symbolRsi != null ? symbolRsi.toFixed(1) : '—' },
    { label: 'MACD', value: symbolMacd != null ? symbolMacd.toFixed(2) : '—' },
    { label: 'VWAP', value: symbolVwap != null ? symbolVwap.toFixed(2) : '—' },
  ];

  return (
    <div className="module-content module-content--charts">
      <div className="header module-page-header" style={{ marginBottom: '2rem' }}>
        <h2>Charts Studio 📈</h2>
        <div className="page-subtitle" style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Sala grafici premium per performance, allocazione e momentum operativo.
        </div>
      </div>

      <div className="card charts-hero-card" style={{ marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(56,189,248,0.16) 0%, rgba(139,92,246,0.08) 50%, rgba(0,0,0,0) 100%)' }}>
        <div className="charts-hero-top">
          <div>
            <div className="card-title">Live Market Canvas</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Stream operativo su {currentSymbol || 'watchlist'} con timeframe selezionabile.
            </div>
          </div>
          <div className="charts-hero-actions">
            <div className="badge badge-ai">{status.modules?.trading ? 'Stream live attivo' : 'Stream in attesa'}</div>
            <div className="badge badge-gold">{currentSymbol || 'No symbol'}</div>
            {currentSymbol && (
              <button
                type="button"
                className="symbol-link-btn symbol-link-btn--pill"
                onClick={() => onOpenSymbolReview?.(currentSymbol)}
              >
                Review {currentSymbol}
              </button>
            )}
          </div>
        </div>

        <div className="charts-overview-strip">
          {overviewMetrics.map((metric) => (
            <div key={metric.label} className="charts-overview-pill">
              <span>{metric.label}</span>
              <strong style={{ color: metric.tone }}>{metric.value}</strong>
            </div>
          ))}
        </div>

        <div className="charts-hero-layout">
          <div className="charts-hero-main">
            <div className="charts-toolbar">
              <div className="charts-symbol-tabs">
                {safeSymbols.slice(0, 8).map((sym) => (
                  <SymbolTabButton
                    key={sym}
                    sym={sym}
                    selected={currentSymbol === sym}
                    onClick={() => setSelectedSymbol(sym)}
                    cryptoState={cryptoSymbolStateMap[sym]}
                  />
                ))}
              </div>
              <div className="charts-timeframe-tabs">
                {['1D', '1W', '1M', '1Y', 'ALL'].map((tf) => (
                  <button key={tf} className={`tab-btn ${timeframe === tf ? 'active-tab' : ''}`} onClick={() => setTimeframe(tf)}>
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="charts-canvas-frame" style={{ height: '340px', background: 'rgba(0,0,0,0.28)', borderRadius: '14px', padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              {liveChartData.length === 0 ? (
                <div className="charts-empty-state">
                  Nessun dato grafico disponibile per il simbolo selezionato.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={liveChartData}>
                    <defs>
                      <linearGradient id="chartsLiveFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }} />
                    <Area type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2.5} fill="url(#chartsLiveFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="charts-insight-rail">
            <div className="charts-insight-card">
              <div className="card-title">Symbol Intel</div>
              <div className="charts-insight-symbol-row">
                <div>
                  <button
                    type="button"
                    className="symbol-link-btn symbol-link-btn--inline charts-insight-symbol-button"
                    onClick={() => currentSymbol && onOpenSymbolReview?.(currentSymbol)}
                  >
                    <span className="charts-insight-symbol">{currentSymbol || '—'}</span>
                  </button>
                  <div className="charts-insight-sentiment">{currentRow?.sentiment || 'NEUTRAL'}</div>
                </div>
                {currentCryptoState && (
                  <div
                    className="charts-insight-chip"
                    style={{
                      color: currentCryptoState.tone,
                      borderColor: currentCryptoState.border,
                    }}
                  >
                    {currentCryptoState.label}
                  </div>
                )}
              </div>

              <div className="charts-insight-grid">
                {insightMetrics.map((metric) => (
                  <div key={metric.label} className="charts-insight-metric">
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>

              <div className="charts-insight-summary">
                {currentPosition ? (
                  <>
                    <div>Exposure <strong>${currentExposure.toFixed(2)}</strong></div>
                    <div>P&L live <strong style={{ color: currentUnrealized >= 0 ? '#10b981' : '#ef4444' }}>{currentUnrealized >= 0 ? '+' : ''}${currentUnrealized.toFixed(2)}</strong></div>
                  </>
                ) : (
                  <div>{currentRow?.prediction || 'Indicatori in sincronizzazione.'}</div>
                )}
              </div>
            </div>

            <div className="charts-insight-card">
              <div className="card-title">Signal Trace</div>
              {currentLogs.length === 0 ? (
                <div className="charts-empty-state charts-empty-state--compact">
                  Nessun evento recente per {currentSymbol || 'questo simbolo'}.
                </div>
              ) : (
                <div className="charts-log-stack">
                  {currentLogs.map((log, index) => (
                    <div key={`${currentSymbol}-log-${index}`} className="charts-log-row">{log}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="charts-insight-card">
              <div className="card-title">Recent Closings</div>
              {recentClosedForSymbol.length === 0 ? (
                <div className="charts-empty-state charts-empty-state--compact">
                  Nessun trade chiuso recente su {currentSymbol || 'questo simbolo'}.
                </div>
              ) : (
                <div className="charts-log-stack">
                  {recentClosedForSymbol.map((trade, index) => (
                    <div key={`${trade.symbol}-${trade.date}-${index}`} className="charts-trade-row">
                      <div>
                        <strong>{trade.side || 'Trade'}</strong>
                        <span>{trade.date || 'Data non disponibile'}</span>
                      </div>
                      <strong style={{ color: Number(trade.profit_usd || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                        {Number(trade.profit_usd || 0) >= 0 ? '+' : ''}${Number(trade.profit_usd || 0).toFixed(2)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card col-span-6 charts-card">
          <div className="card-title">Equity Progression</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Ultimi trade chiusi trasformati in curva equity.</div>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }} />
                <Line type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card col-span-6 charts-card">
          <div className="card-title">Capital Allocation</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Mix attuale tra cash e posizioni aperte.</div>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocationData} cx="50%" cy="50%" innerRadius={58} outerRadius={100} paddingAngle={4} dataKey="value">
                  {allocationData.map((entry, index) => (
                    <Cell key={`alloc-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }} formatter={(value) => `$${Number(value).toFixed(2)}`} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card col-span-6 charts-card">
          <div className="card-title">Watchlist Momentum Scores</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Titoli selezionati dal ranking dinamico.</div>
          <div style={{ height: '280px' }}>
            {watchlistBars.length === 0 ? (
              <div className="charts-empty-state">
                Ranking non ancora disponibile.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={watchlistBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="symbol" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }} />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]} fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card col-span-6 charts-card">
          <div className="card-title">Open Positions Heat</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>P/L non realizzato sulle posizioni correnti.</div>
          <div style={{ height: '280px' }}>
            {positionBars.length === 0 ? (
              <div className="charts-empty-state">
                Nessuna posizione aperta in questo momento.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={positionBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="symbol" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }} />
                  <Bar dataKey="pnl" radius={[8, 8, 0, 0]}>
                    {positionBars.map((entry, index) => (
                      <Cell key={`pnl-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card col-span-12 charts-card charts-summary-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <div className="card-title">Trade Flow Summary</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>Distribuzione dei trade chiusi e snapshot delle metriche chiave.</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div className="badge badge-active">Win Rate {Number(status.win_rate || 0).toFixed(1)}%</div>
              <div className="badge badge-ai">Sharpe {Number(status.sharpe_ratio || 0).toFixed(2)}</div>
              <div className="badge badge-gold">PF {Number(status.profit_factor || 0).toFixed(2)}</div>
              <div className="badge badge-danger">DD {Number(status.max_drawdown || 0).toFixed(2)}%</div>
            </div>
          </div>
          <div className="dashboard-grid">
            <div className="card col-span-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="card-title">Trade Mix</div>
              <div style={{ height: '240px' }}>
                {tradeMixData.length === 0 ? (
                  <div className="charts-empty-state">
                    Storico trade non ancora popolato.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={tradeMixData} cx="50%" cy="50%" innerRadius={50} outerRadius={88} dataKey="value">
                        {tradeMixData.map((entry, index) => (
                          <Cell key={`mix-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="card col-span-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="card-title">Quick Metrics</div>
              <div className="charts-quick-metrics">
                <div className="badge badge-idle" style={{ justifyContent: 'space-between', padding: '1rem 1.1rem' }}>Trades <strong style={{ color: 'var(--text-primary)' }}>{tradeHistory.length}</strong></div>
                <div className="badge badge-idle" style={{ justifyContent: 'space-between', padding: '1rem 1.1rem' }}>Posizioni <strong style={{ color: 'var(--text-primary)' }}>{positions.length}</strong></div>
                <div className="badge badge-idle" style={{ justifyContent: 'space-between', padding: '1rem 1.1rem' }}>Cash <strong style={{ color: 'var(--text-primary)' }}>${Number(status.cash || 0).toFixed(2)}</strong></div>
                <div className="badge badge-idle" style={{ justifyContent: 'space-between', padding: '1rem 1.1rem' }}>Portfolio <strong style={{ color: 'var(--text-primary)' }}>${Number(status.portfolio_value || 0).toFixed(2)}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
