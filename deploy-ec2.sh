#!/bin/bash
# ========================================
# SCRIPT DE DEPLOY - LogiWMS-Pro no EC2
# ========================================
# Execute este script no servidor EC2 (100.27.33.178)

set -e  # Parar em caso de erro

echo "ðŸš€ Iniciando deploy do LogiWMS-Pro..."

# ========================================
# 1. ATUALIZAR CÃ“DIGO
# ========================================
echo "ðŸ“¥ Atualizando cÃ³digo do GitHub..."
cd ~/logiwms-pro || cd /var/www/logiwms-pro || cd /home/ubuntu/logiwms-pro
git pull origin main

# ========================================
# 2. INSTALAR DEPENDÃŠNCIAS
# ========================================
echo "ðŸ“¦ Instalando dependÃªncias do backend..."
cd api-backend
npm install

echo "ðŸ“¦ Instalando dependÃªncias do frontend..."
cd ..
npm install

# ========================================
# 3. EXECUTAR MIGRATION DO BANCO
# ========================================
echo "ðŸ—„ï¸  Executando migrations no banco de dados..."
psql -U dmitry -d armazem -f migration.sql

# ========================================
# 4. BUILD DO FRONTEND
# ========================================
echo "ðŸ—ï¸  Fazendo build do frontend..."
npm run build

# ========================================
# 5. COPIAR BUILD PARA NGINX
# ========================================
echo "ðŸ“‹ Copiando build para Nginx..."
sudo cp -r dist/* /var/www/html/

# ========================================
# 6. REINICIAR BACKEND (PM2)
# ========================================
echo "ðŸ”„ Reiniciando backend..."
cd api-backend
pm2 restart logiwms-api || pm2 start index.js --name logiwms-api

# ========================================
# 7. REINICIAR NGINX
# ========================================
echo "ðŸ”„ Reiniciando Nginx..."
sudo systemctl restart nginx

# ========================================
# 8. VERIFICAR STATUS
# ========================================
echo ""
echo "âœ… Deploy concluÃ­do!"
echo ""
echo "ðŸ“Š Status dos serviÃ§os:"
pm2 status
echo ""
sudo systemctl status nginx --no-pager
echo ""
echo "ðŸŒ Acesse: http://100.27.33.178"
echo ""
echo "ðŸ“ Logs:"
echo "  Backend: pm2 logs logiwms-api"
echo "  Nginx: sudo journalctl -u nginx -f"


