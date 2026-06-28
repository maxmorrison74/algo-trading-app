import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { ArrowRight, Activity, Shield, Zap } from 'lucide-react';

const mockData = Array.from({length: 20}).map((_, i) => ({
  val: 1000 + Math.random() * 500 + (i * 100)
}));

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans selection:bg-amber-500/30 overflow-x-hidden">
      
      {/* Header */}
      <header className="fixed top-0 w-full p-6 flex justify-between items-center z-50 bg-[#050505]/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-[0_0_15px_rgba(217,119,6,0.5)]">
            <Activity className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-xl font-bold tracking-wider text-white">AUREO <span className="text-amber-500 font-light">QUANT</span></h1>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/login')}
            className="px-5 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Login
          </button>
          <button 
            onClick={() => navigate('/login')}
            className="px-5 py-2 text-sm font-medium bg-white text-black rounded-full hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(251,191,36,0.3)]"
          >
            Inizia Ora
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          
          <div className="flex-1 space-y-8 text-center lg:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Algoritmo v2.0 Attivo
            </div>
            
            <h2 className="text-5xl lg:text-7xl font-bold text-white tracking-tight leading-tight">
              L'Hedge Fund <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-600">
                Personale
              </span>
            </h2>
            
            <p className="text-lg lg:text-xl text-slate-400 max-w-2xl font-light leading-relaxed">
              Collega le tue API, imposta l'aggressività e lascia che l'Intelligenza Artificiale operi simultaneamente su Azioni, Criptovalute e Arbitraggio. I tuoi fondi non lasciano mai il tuo wallet.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
              <button 
                onClick={() => navigate('/login')}
                className="group relative px-8 py-4 bg-gradient-to-r from-amber-600 to-amber-500 rounded-full text-black font-bold text-lg hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all overflow-hidden flex items-center justify-center gap-2"
              >
                <span className="relative z-10">Ottieni Accesso</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="flex-1 w-full relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-transparent blur-3xl rounded-full" />
            <div className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Live Performance</div>
                  <div className="text-3xl font-bold text-white mt-1">+24.5%</div>
                </div>
                <div className="px-3 py-1 rounded bg-green-500/20 text-green-400 text-sm font-medium">
                  Attivo
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockData}>
                    <YAxis domain={['auto', 'auto']} hide />
                    <Line 
                      type="monotone" 
                      dataKey="val" 
                      stroke="#f59e0b" 
                      strokeWidth={3}
                      dot={false}
                      animationDuration={2000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-32">
          {[
            {
              icon: <Zap className="w-6 h-6 text-amber-400" />,
              title: "Arbitraggio Simultaneo",
              desc: "Esegue ordini di acquisto e vendita in millisecondi tra Binance e Kraken catturando lo spread netto."
            },
            {
              icon: <Activity className="w-6 h-6 text-amber-400" />,
              title: "Trading Quantitativo",
              desc: "Modelli predittivi ML scansionano il mercato azionario H24 identificando breakout e inversioni di trend."
            },
            {
              icon: <Shield className="w-6 h-6 text-amber-400" />,
              title: "Fondi al Sicuro",
              desc: "Non depositare mai. Connetti solo le tue API in sola lettura e trading. Il controllo resta sempre a te."
            }
          ].map((feat, i) => (
            <div key={i} className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {feat.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feat.title}</h3>
              <p className="text-slate-400 leading-relaxed font-light">{feat.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
