#!/bin/bash

# Entra automaticamente nella cartella dove si trova questo script
cd "$(dirname "$0")"

echo "🔄 Stopping Uvicorn..."
sudo pkill -f uvicorn || true

echo "📥 Pulling latest code..."
git pull

echo "🚀 Restarting API Server in background..."
cd backend
sudo ./venv/bin/python -m uvicorn api:app --host 0.0.0.0 --port 80 > /dev/null 2>&1 &

echo "✅ Update complete! Server is running."
