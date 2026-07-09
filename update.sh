#!/bin/bash
set -e

cleanup_safe_artifacts() {
    echo "🧹 Pulizia safe di cache e artefatti temporanei..."

    local reclaimed_targets=0

    if [ -d "frontend/dist" ]; then
        rm -rf frontend/dist
        echo "   • Rimossa build frontend precedente"
        reclaimed_targets=$((reclaimed_targets + 1))
    fi

    find backend -type d -name "__pycache__" -prune -exec rm -rf {} + 2>/dev/null || true
    find backend -type f -name "*.pyc" -delete 2>/dev/null || true
    echo "   • Ripuliti cache Python"

    if [ -d "frontend/node_modules/.vite" ]; then
        rm -rf frontend/node_modules/.vite
        echo "   • Rimossa cache Vite locale"
        reclaimed_targets=$((reclaimed_targets + 1))
    fi

    if command -v npm >/dev/null 2>&1; then
        npm cache clean --force >/dev/null 2>&1 || true
        echo "   • Ripulita cache npm"
    fi

    if [ -x "backend/venv/bin/python" ]; then
        backend/venv/bin/python -m pip cache purge >/dev/null 2>&1 || true
        echo "   • Ripulita cache pip"
    fi

    find . -type f \( -name "*.tmp" -o -name "*.temp" \) -mtime +7 -delete 2>/dev/null || true
    echo "   • Rimossi temporanei vecchi"

    if [ "$reclaimed_targets" -eq 0 ]; then
        echo "   • Nessun artefatto grosso da eliminare in workspace"
    fi
}

echo "🔄 Avviando aggiornamento del bot..."

echo "0) Pulizia preventiva..."
cleanup_safe_artifacts

echo "1) Aggiornamento codice da GitHub..."
git pull origin main

echo "2) Compilazione Frontend (React)..."
cd frontend
npm install
npm run build
cd ..

echo "3) Aggiornamento dipendenze Python (potrebbe volerci qualche minuto)..."
cd backend
./venv/bin/python -m pip install --upgrade pip
./venv/bin/python -m pip install -r requirements.txt
cd ..

# Riavvio del server
echo "4) Riavvio backend..."
pkill -f 'uvicorn api:app' || true
sleep 2

mkdir -p logs

echo "🚀 Avvio backend con nohup..."
cd backend
nohup ./venv/bin/python -m uvicorn api:app --host 0.0.0.0 --port 8000 >> ../logs/api-out.log 2>> ../logs/api-error.log &
cd ..

echo "5) Verifica avvio backend su 127.0.0.1:8000..."
BACKEND_OK=0
for i in {1..20}; do
    if curl -fsS http://127.0.0.1:8000/api/status >/dev/null 2>&1; then
        BACKEND_OK=1
        break
    fi
    sleep 1
done

if [ "$BACKEND_OK" -ne 1 ]; then
    echo "❌ Backend non raggiungibile su http://127.0.0.1:8000/api/status"
    echo "📋 Stato PM2:"
    pm2 status || true
    echo "📋 Ultimi log PM2:"
    pm2 logs algotrading-api --lines 80 --nostream || true
    exit 1
fi

echo "✅ Backend raggiungibile su 127.0.0.1:8000"

echo "✅ Update complete! Server gestito da PM2."
echo "ℹ️  Usa 'pm2 monit' per vedere i log e le risorse in tempo reale."
