import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Activity } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleLogin = (e) => {
    e.preventDefault();
    // Simulate login for now
    localStorage.setItem('token', 'mock_jwt_token');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 font-sans selection:bg-amber-500/30">
      
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/10 via-[#050505] to-[#050505] -z-10" />

      <div className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/20 blur-3xl rounded-full" />
        
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-[0_0_15px_rgba(217,119,6,0.5)] cursor-pointer" onClick={() => navigate('/')}>
            <Activity className="w-6 h-6 text-black" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-white text-center mb-2">Accedi al Vault</h2>
        <p className="text-slate-400 text-center text-sm mb-8">Gestisci il tuo Hedge Fund Personale</p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
                placeholder="m.morrison@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full py-3 mt-4 bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold rounded-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-shadow"
          >
            Sblocca Terminale
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Non hai un account? <span className="text-amber-500 hover:text-amber-400 cursor-pointer">Richiedi Invito</span>
        </div>
      </div>
    </div>
  );
}
