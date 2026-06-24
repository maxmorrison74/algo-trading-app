#!/bin/bash
# Script di Setup per Google Cloud Compute Engine
echo "Inizializzazione del Bot di Trading IA su GCP..."

# 1. Aggiornamento sistema
sudo apt-get update && sudo apt-get upgrade -y

# 2. Installazione dipendenze Python e strumenti
sudo apt-get install -y python3-pip python3-venv tmux unzip

# 3. Creazione Virtual Environment
cd backend
python3 -m venv venv
source venv/bin/activate

# 4. Installazione librerie Python
pip install -r requirements.txt

# 5. Configurazione completata
echo "-----------------------------------"
echo "Installazione completata con successo!"
echo ""
echo "Per avviare il server sulla tua VM pubblica (porta 80):"
echo "sudo ~/algo-trading-app/backend/venv/bin/uvicorn api:app --host 0.0.0.0 --port 80"
echo "-----------------------------------"
