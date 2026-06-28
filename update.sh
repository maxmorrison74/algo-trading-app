#!/bin/bash

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
sudo ./venv/bin/python -m pip install -r requirements.txt
cd ..

echo "4) Controllo PM2..."
if ! command -v pm2 &> /dev/null
then
    echo "PM2 non trovato, installazione globale in corso..."
    sudo npm install -g pm2
fi

echo "🚀 Avvio/Riavvio del Server tramite PM2..."
mkdir -p logs

# Uccidiamo eventuali istanze orfane non gestite da PM2
sudo pkill -f "uvicorn api:app" || true

# Avviamo o ricarichiamo l'app con PM2 senza downtime
sudo pm2 start ecosystem.config.js || sudo pm2 reload algotrading-api

# Salviamo la configurazione per riavviare PM2 al boot del server
sudo pm2 save

echo "✅ Update complete! Server gestito da PM2."
echo "ℹ️  Usa 'sudo pm2 monit' per vedere i log e le risorse in tempo reale."
