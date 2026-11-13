docker ps
sudo nginx -T 2>&1 | grep -E "server_name|listen|ssl_certificate" | head -n 30
