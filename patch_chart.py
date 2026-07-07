import re

with open("frontend/src/OmniApp.jsx", "r") as f:
    content = f.read()

# Replace the button onClick to include the SVG generation
new_onClick = """onClick={async () => {
                  const ticker = document.getElementById('backtest-ticker').value;
                  const btn = e.currentTarget;
                  const originalText = btn.innerText;
                  btn.innerText = "Simulazione in corso...";
                  btn.disabled = true;
                  try {
                      const res = await authFetch('/api/backtest', 'POST', { ticker, period: '4y' });
                      if (res && res.status === 'success') {
                        const data = res.data;
                        document.getElementById('backtest-results-container').style.display = 'block';
                        document.getElementById('bh-return').innerText = data.stats.market_return_pct + '%';
                        document.getElementById('ai-return').innerText = data.stats.strategy_return_pct + '%';
                        document.getElementById('ai-winrate').innerText = data.stats.win_rate_pct + '%';
                        
                        // Generazione grafico SVG leggero
                        const svg = document.getElementById('backtest-chart');
                        svg.innerHTML = ''; // pulisci
                        const width = 100; const height = 100;
                        const m_curve = data.market_curve;
                        const s_curve = data.strategy_curve;
                        const minVal = Math.min(...m_curve, ...s_curve);
                        const maxVal = Math.max(...m_curve, ...s_curve);
                        const range = maxVal - minVal || 1;
                        
                        const getPts = (curve) => curve.map((v, i) => {
                            const x = (i / (curve.length - 1)) * width;
                            const y = height - ((v - minVal) / range) * height;
                            return `${x},${y}`;
                        }).join(' ');
                        
                        const pathM = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
                        pathM.setAttribute("points", getPts(m_curve));
                        pathM.setAttribute("fill", "none");
                        pathM.setAttribute("stroke", "#94a3b8");
                        pathM.setAttribute("stroke-width", "0.5");
                        
                        const pathS = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
                        pathS.setAttribute("points", getPts(s_curve));
                        pathS.setAttribute("fill", "none");
                        pathS.setAttribute("stroke", "#10b981");
                        pathS.setAttribute("stroke-width", "0.8");
                        
                        svg.appendChild(pathM);
                        svg.appendChild(pathS);
                      } else {
                        alert("Errore nel backtest: " + (res?.message || 'Sconosciuto'));
                      }
                  } catch(err) {
                      alert("Errore di rete");
                  } finally {
                      btn.innerText = originalText;
                      btn.disabled = false;
                  }
                }}"""
content = re.sub(r"onClick=\{async \(\) => \{\n\s*const ticker = document\.getElementById\('backtest-ticker'\)\.value;\n\s*const res = await authFetch\('/api/backtest', 'POST', \{ ticker, period: '4y' \}\);\n\s*if \(res && res\.status === 'success'\) \{\n\s*const data = res\.data;\n\s*document\.getElementById\('backtest-results-container'\)\.style\.display = 'block';\n\s*document\.getElementById\('bh-return'\)\.innerText = data\.stats\.market_return_pct \+ '%';\n\s*document\.getElementById\('ai-return'\)\.innerText = data\.stats\.strategy_return_pct \+ '%';\n\s*document\.getElementById\('ai-winrate'\)\.innerText = data\.stats\.win_rate_pct \+ '%';\n\s*\} else \{\n\s*alert\(\"Errore nel backtest\"\);\n\s*\}\n\s*\}\}", new_onClick, content, flags=re.DOTALL)

# Add (e) parameter to onClick
content = content.replace("onClick={async () => {", "onClick={async (e) => {")

with open("frontend/src/OmniApp.jsx", "w") as f:
    f.write(content)
