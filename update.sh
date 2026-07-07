#!/bin/bash
set -e

echo "🔄 Avviando aggiornamento del bot..."

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

# Riavvio PM2 come utente corrente
echo "4) Controllo PM2..."
# Usa PM2 locale (senza sudo)
if ! command -v pm2 &> /dev/null
then
    echo "PM2 non trovato globalmente, uso versione locale..."
    npm install pm2 --prefix ./node_pm2 --save 2>/dev/null || true
    PM2_CMD="./node_pm2/node_modules/.bin/pm2"
else
    PM2_CMD="pm2"
fi

mkdir -p logs

echo "🚀 Riavvio del Server tramite PM2 come utente corrente..."
$PM2_CMD delete algotrading-api || true
$PM2_CMD start ecosystem.config.js --update-env
$PM2_CMD save

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
