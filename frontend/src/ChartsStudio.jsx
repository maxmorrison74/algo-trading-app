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

export default function ChartsStudio({
  chartData = [],
  selectedSymbol,
  setSelectedSymbol,
  status = {},
  timeframe,
  setTimeframe,
}) {
  const tradeHistory = status.trade_history || [];
  const liveChartData = Array.isArray(chartData) ? chartData.slice(-36) : [];
  const positions = Object.entries(status.positions || {})
    .filter(([_, position]) => position && position !== 'LIQUID');
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

  return (
    <div className="module-content module-content--charts">
      <div className="header module-page-header" style={{ marginBottom: '2rem' }}>
        <h2>Charts Studio 📈</h2>
        <div className="page-subtitle" style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Sala grafici premium per performance, allocazione e momentum operativo.
        </div>
      </div>

      <div className="card charts-hero-card" style={{ marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(56,189,248,0.16) 0%, rgba(139,92,246,0.08) 50%, rgba(0,0,0,0) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div>
            <div className="card-title">Live Market Canvas</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Stream operativo su {selectedSymbol || 'watchlist'} con timeframe selezionabile.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {status.symbols?.slice(0, 8).map((sym) => (
              <button key={sym} className={`tab-btn ${selectedSymbol === sym ? 'active-tab' : ''}`} onClick={() => setSelectedSymbol(sym)}>
                {sym}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['1D', '1W', '1M', '1Y', 'ALL'].map((tf) => (
              <button key={tf} className={`tab-btn ${timeframe === tf ? 'active-tab' : ''}`} onClick={() => setTimeframe(tf)}>
                {tf}
              </button>
            ))}
          </div>
          <div className="badge badge-ai">{status.modules?.trading ? 'Stream live attivo' : 'Stream in attesa'}</div>
        </div>
        <div className="charts-canvas-frame" style={{ height: '340px', background: 'rgba(0,0,0,0.28)', borderRadius: '14px', padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
          {liveChartData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
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
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
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
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
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
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
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
