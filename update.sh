#!/bin/bash
set -e

QUIET_MODE=1
for arg in "$@"; do
    case "$arg" in
        --verbose|-v)
            QUIET_MODE=0
            ;;
        --quiet|-q)
            QUIET_MODE=1
            ;;
    esac
done

run_npm_install() {
    if [ "$QUIET_MODE" -eq 1 ]; then
        npm install --silent
    else
        npm install
    fi
}

run_pip_upgrade() {
    if [ "$QUIET_MODE" -eq 1 ]; then
        ./venv/bin/python -m pip install --disable-pip-version-check --quiet --upgrade pip
    else
        ./venv/bin/python -m pip install --disable-pip-version-check --upgrade pip
    fi
}

run_pip_requirements() {
    if [ "$QUIET_MODE" -eq 1 ]; then
        ./venv/bin/python -m pip install --disable-pip-version-check --quiet -r requirements.txt
    else
        ./venv/bin/python -m pip install --disable-pip-version-check -r requirements.txt
    fi
}

print_disk_snapshot() {
    local label="$1"
    echo "💽 Spazio disco ${label}:"
    df -h . | awk 'NR==1 || NR==2 { print "   " $0 }'
}

start_disk_guard() {
    echo "🛡️ Avvio demone controllo spazio disco..."

    mkdir -p logs

    if [ -f "disk-guard.pid" ]; then
        local old_pid
        old_pid="$(cat disk-guard.pid 2>/dev/null || true)"
        if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
            kill "$old_pid" 2>/dev/null || true
            sleep 1
        fi
        rm -f disk-guard.pid
    fi

    pkill -f '/disk_guard.sh' 2>/dev/null || true

    nohup ./disk_guard.sh >> logs/disk-guard-launch.log 2>&1 &
    sleep 1

    if [ -f "disk-guard.pid" ]; then
        echo "   • Disk guard attivo con PID $(cat disk-guard.pid)"
    else
        echo "   • Avvio disk guard richiesto"
    fi
}

cleanup_safe_artifacts() {
    echo "🧹 Pulizia safe lato server di cache, log e artefatti temporanei..."

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

    if [ -d "$HOME/.npm" ]; then
        rm -rf "$HOME/.npm/_cacache" 2>/dev/null || true
        echo "   • Ripulita cache npm utente"
    fi

    if [ -d "$HOME/.cache/pip" ]; then
        rm -rf "$HOME/.cache/pip" 2>/dev/null || true
        echo "   • Ripulita cache pip utente"
    fi

    if [ -d "$HOME/.cache" ]; then
        find "$HOME/.cache" -mindepth 1 -maxdepth 1 \
            ! -name "huggingface" \
            ! -name "codex-runtimes" \
            -exec rm -rf {} + 2>/dev/null || true
        echo "   • Ripulite cache utente non critiche"
    fi

    if [ -d "logs" ]; then
        find logs -type f -name "*.log" -size +50M -exec sh -c '> "$1"' _ {} \; 2>/dev/null || true
        find logs -type f \( -name "*.log.*" -o -name "*.gz" \) -delete 2>/dev/null || true
        echo "   • Ripuliti log applicativi pesanti"
    fi

    if [ -d "$HOME/.pm2/logs" ]; then
        find "$HOME/.pm2/logs" -type f -name "*.log" -size +20M -exec sh -c '> "$1"' _ {} \; 2>/dev/null || true
        echo "   • Alleggeriti log PM2"
    fi

    find . -type f \( -name "*.tmp" -o -name "*.temp" \) -mtime +7 -delete 2>/dev/null || true
    echo "   • Rimossi temporanei vecchi"

    if [ "$reclaimed_targets" -eq 0 ]; then
        echo "   • Nessun artefatto grosso da eliminare in workspace"
    fi
}

echo "🔄 Avviando aggiornamento del bot..."
if [ "$QUIET_MODE" -eq 1 ]; then
    echo "🔇 Modalità output: quiet"
else
    echo "📣 Modalità output: verbose"
fi

print_disk_snapshot "prima della pulizia"

echo "0) Pulizia preventiva..."
cleanup_safe_artifacts

print_disk_snapshot "dopo la pulizia"

echo "1) Aggiornamento codice da GitHub..."
git pull origin main

echo "2) Compilazione Frontend (React)..."
cd frontend
run_npm_install
npm run build
cd ..

echo "3) Aggiornamento dipendenze Python (potrebbe volerci qualche minuto)..."
cd backend
run_pip_upgrade
run_pip_requirements
cd ..

# Riavvio del server
echo "4) Riavvio backend via PM2..."
mkdir -p logs

if pm2 describe algotrading-api >/dev/null 2>&1; then
    echo "   • Processo PM2 esistente trovato: riavvio con ricarica variabili ambiente"
    pm2 restart algotrading-api --update-env
else
    echo "   • Processo PM2 non presente: avvio da ecosystem con ambiente aggiornato"
    pm2 start ecosystem.config.js --update-env
fi

echo "5) Verifica avvio backend su 127.0.0.1:8000..."
BACKEND_OK=0
for i in {1..60}; do
    if curl -fsS http://127.0.0.1:8000/api/status >/dev/null 2>&1; then
        BACKEND_OK=1
        break
    fi
    sleep 2
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

echo "6) Avvio monitor spazio disco..."
start_disk_guard

echo "✅ Update complete! Server gestito da PM2."
echo "ℹ️  Usa 'pm2 monit' per vedere i log e le risorse in tempo reale."
