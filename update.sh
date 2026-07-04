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
if ! command -v pm2 &> /dev/null
then
    echo "PM2 non trovato, installazione globale in corso..."
    sudo npm install -g pm2
fi

mkdir -p logs

echo "🚀 Riavvio del Server tramite PM2 come utente corrente..."
pm2 delete algotrading-api || true
pm2 start ecosystem.config.js --update-env
pm2 save

echo "✅ Update complete! Server gestito da PM2."
echo "ℹ️  Usa 'pm2 monit' per vedere i log e le risorse in tempo reale."
