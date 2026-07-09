#!/bin/bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
LOG_FILE="$LOG_DIR/disk-guard.log"
PID_FILE="$ROOT_DIR/disk-guard.pid"

DISK_GUARD_INTERVAL_MINUTES="${DISK_GUARD_INTERVAL_MINUTES:-10}"
DISK_GUARD_WARN_PERCENT="${DISK_GUARD_WARN_PERCENT:-85}"
DISK_GUARD_CLEAN_PERCENT="${DISK_GUARD_CLEAN_PERCENT:-90}"
DISK_GUARD_CRITICAL_PERCENT="${DISK_GUARD_CRITICAL_PERCENT:-95}"

mkdir -p "$LOG_DIR"
echo "$$" > "$PID_FILE"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" | tee -a "$LOG_FILE"
}

disk_usage_percent() {
  df -P "$ROOT_DIR" | awk 'NR==2 { gsub("%", "", $5); print $5 }'
}

cleanup_safe_server_artifacts() {
  local cleaned=0

  if [ -d "$ROOT_DIR/frontend/dist" ]; then
    rm -rf "$ROOT_DIR/frontend/dist"
    cleaned=1
    log "Rimossa build frontend precedente"
  fi

  find "$ROOT_DIR/backend" -type d -name "__pycache__" -prune -exec rm -rf {} + 2>/dev/null || true
  find "$ROOT_DIR/backend" -type f -name "*.pyc" -delete 2>/dev/null || true

  if [ -d "$ROOT_DIR/frontend/node_modules/.vite" ]; then
    rm -rf "$ROOT_DIR/frontend/node_modules/.vite"
    cleaned=1
    log "Rimossa cache Vite locale"
  fi

  if [ -d "$HOME/.npm/_cacache" ]; then
    rm -rf "$HOME/.npm/_cacache" 2>/dev/null || true
    cleaned=1
    log "Ripulita cache npm utente"
  fi

  if [ -d "$HOME/.cache/pip" ]; then
    rm -rf "$HOME/.cache/pip" 2>/dev/null || true
    cleaned=1
    log "Ripulita cache pip utente"
  fi

  if [ -d "$HOME/.cache" ]; then
    find "$HOME/.cache" -mindepth 1 -maxdepth 1 \
      ! -name "huggingface" \
      ! -name "codex-runtimes" \
      -exec rm -rf {} + 2>/dev/null || true
    cleaned=1
    log "Ripulite cache utente non critiche"
  fi

  if [ -d "$ROOT_DIR/logs" ]; then
    find "$ROOT_DIR/logs" -type f -name "*.log" -size +50M -exec sh -c '> "$1"' _ {} \; 2>/dev/null || true
    find "$ROOT_DIR/logs" -type f \( -name "*.log.*" -o -name "*.gz" \) -delete 2>/dev/null || true
    log "Ripuliti log applicativi pesanti"
  fi

  if [ -d "$HOME/.pm2/logs" ]; then
    find "$HOME/.pm2/logs" -type f -name "*.log" -size +20M -exec sh -c '> "$1"' _ {} \; 2>/dev/null || true
    log "Alleggeriti log PM2"
  fi

  find "$ROOT_DIR" -type f \( -name "*.tmp" -o -name "*.temp" \) -mtime +7 -delete 2>/dev/null || true

  if [ "$cleaned" -eq 0 ]; then
    log "Nessun artefatto grande da rimuovere nel progetto"
  fi
}

cleanup_more_aggressive_logs() {
  if [ -d "$ROOT_DIR/logs" ]; then
    find "$ROOT_DIR/logs" -type f -name "*.log" -exec sh -c '> "$1"' _ {} \; 2>/dev/null || true
  fi

  if [ -d "$HOME/.pm2/logs" ]; then
    find "$HOME/.pm2/logs" -type f -name "*.log" -exec sh -c '> "$1"' _ {} \; 2>/dev/null || true
  fi

  log "Pulizia log aggressiva eseguita in soglia critica"
}

trap 'rm -f "$PID_FILE"; exit 0' INT TERM EXIT

log "Disk guard avviato (ogni ${DISK_GUARD_INTERVAL_MINUTES} min, warn ${DISK_GUARD_WARN_PERCENT}%, clean ${DISK_GUARD_CLEAN_PERCENT}%, critical ${DISK_GUARD_CRITICAL_PERCENT}%)"

while true; do
  usage="$(disk_usage_percent)"

  if [ "$usage" -ge "$DISK_GUARD_CRITICAL_PERCENT" ]; then
    log "Spazio disco critico: ${usage}% usato. Avvio pulizia completa."
    cleanup_safe_server_artifacts
    cleanup_more_aggressive_logs
    log "Spazio disco dopo pulizia critica: $(disk_usage_percent)% usato"
  elif [ "$usage" -ge "$DISK_GUARD_CLEAN_PERCENT" ]; then
    log "Spazio disco alto: ${usage}% usato. Avvio pulizia safe."
    cleanup_safe_server_artifacts
    log "Spazio disco dopo pulizia safe: $(disk_usage_percent)% usato"
  elif [ "$usage" -ge "$DISK_GUARD_WARN_PERCENT" ]; then
    log "Avviso spazio disco: ${usage}% usato"
  fi

  sleep "$((DISK_GUARD_INTERVAL_MINUTES * 60))"
done
