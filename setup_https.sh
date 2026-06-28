#!/bin/bash

echo "==========================================="
echo "  Configurazione Automatica HTTPS e NGINX  "
echo "==========================================="

read -p "Inserisci il dominio che hai acquistato (es. app.miosito.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "Errore: Devi inserire un dominio valido."
    exit 1
fi

echo ""
echo "⏳ Assicurati che i record DNS di $DOMAIN puntino già all'IP di questo server."
read -p "Premi INVIO per continuare o CTRL+C per annullare..."

echo "1) Aggiornamento pacchetti e installazione NGINX e Certbot..."
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "2) Sposto il bot dalla porta 80 alla porta 8000 interna..."
sed -i 's/--port 80/--port 8000/g' ecosystem.config.js
sudo pm2 restart ecosystem.config.js
sudo pm2 save

echo "3) Creazione configurazione NGINX per $DOMAIN..."
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
sudo bash -c "cat > $NGINX_CONF <<INNER_EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }
}
INNER_EOF"

echo "4) Attivazione configurazione NGINX..."
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

echo "5) Richiesta Certificato SSL a Let's Encrypt (Certbot)..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect

echo ""
echo "✅ TUTTO PRONTO!"
echo "Il tuo bot è ora protetto crittograficamente."
echo "Vai su https://$DOMAIN per accedere alla Dashboard."
