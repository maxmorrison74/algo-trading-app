import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

ai_view = """
  const renderAIContentView = () => (
    <div className="module-content">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#f8fafc' }}>Studio di Produzione IA 🎥🤖</h2>
          <div style={{ color: '#94a3b8', marginTop: '0.5rem', fontSize: '0.9rem' }}>Macchina Autonoma per TikTok / YouTube Shorts</div>
        </div>
        <button 
          className={`btn ${status.modules?.ai_content ? 'btn-stop' : 'btn-start'}`}
          onClick={() => toggleModule('ai_content', status.modules?.ai_content)}
        >
          {status.modules?.ai_content ? 'SPEGNI FABBRICA VIDEO' : 'ACCENDI FABBRICA VIDEO'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Radar Logs */}
        <div style={{ flex: 1 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>Terminale Pipeline AI</h3>
          <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', height: '500px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            {status.ai_logs?.map((l, i) => (
              <div key={i} style={{ marginBottom: '0.5rem', color: l.includes("✅") || l.includes("💰") ? '#10b981' : l.includes("Rendering") ? '#f59e0b' : '#c084fc' }}>{l}</div>
            ))}
            {(!status.ai_logs || status.ai_logs.length === 0) && (
              <div style={{ color: '#64748b' }}>In attesa di istruzioni. Clicca su Accendi Fabbrica Video per iniziare a generare profitti AdSense.</div>
            )}
          </div>
        </div>

        {/* Video Gallery */}
        <div style={{ flex: 1.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#e2e8f0', margin: 0 }}>Galleria Upload Automatici</h3>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold' }}>
              Totale Generato (Oggi): +${Number(status.ai_videos?.reduce((acc, v) => acc + (v.earnings || 0), 0) || 0).toFixed(2)}
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {status.ai_videos?.map(video => (
              <div key={video.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '140px', backgroundImage: `url(${video.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    0:45
                  </div>
                  <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: '#ef4444', color: '#fff', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                    YOUTUBE SHORTS
                  </div>
                </div>
                <div style={{ padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '0.9rem', lineHeight: '1.4' }}>{video.title}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>👀 {video.views.toLocaleString()} views</div>
                    <div style={{ color: '#10b981', fontWeight: 'bold' }}>+${Number(video.earnings || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
            
            {(!status.ai_videos || status.ai_videos.length === 0) && (
              <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', color: '#94a3b8' }}>
                Nessun video generato.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
"""

if "const renderAIContentView = () => (" not in content:
    content = content.replace("const renderComingSoon", ai_view + "\n  const renderComingSoon")

# Replace activeTab logic
old_render = "{activeTab === 'ai_content' && renderComingSoon('AI Faceless Content Creator', 'ai_content', 'Un motore autonomo che legge le news, genera script, registra la voce e carica video virali su TikTok e YouTube Shorts.')}"
new_render = "{activeTab === 'ai_content' && renderAIContentView()}"
content = content.replace(old_render, new_render)

with open(file_path, 'w') as f:
    f.write(content)

print("AI Content UI added to OmniApp.")
