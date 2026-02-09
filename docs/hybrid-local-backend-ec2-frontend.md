# Arquitetura Hibrida: Backend Local + Frontend no EC2

Objetivo deste modo:
- Frontend publicado no EC2 (Nginx)
- Backend + PostgreSQL rodando localmente no seu computador

## 1) Preparar backend local com PostgreSQL

Na raiz do projeto:

```powershell
npm run local:backend:setup
```

Esse setup:
- sobe o PostgreSQL local (`docker compose up -d db`)
- prepara `api-backend/.env`
- valida conexao (`db:health`)
- aplica migracao (`db:migrate`) quando o banco estiver acessivel

Depois, suba a API local:

```powershell
npm run dev:backend
```

Health check local:

```powershell
curl http://localhost:3001/health
```

## 2) Expor backend local para acesso externo (obrigatorio)

Como o frontend vai rodar no EC2, ele precisa de uma URL publica para chamar a API.

Voce pode usar:
- IP publico + port-forward no roteador
- Cloudflare Tunnel
- tunel corporativo/VPN

Exemplo de URL publica:

```text
https://api-seu-tunel.exemplo.com
```

## 3) Ajustar CORS no backend local

No arquivo `api-backend/.env`, inclua as origens do frontend:

```env
CORS_ORIGIN=http://localhost:3000,http://3.83.164.82
```

Se usar dominio no EC2, inclua tambem o dominio:

```env
CORS_ORIGIN=http://localhost:3000,http://3.83.164.82,https://wms.seudominio.com
```

Reinicie o backend local apos alterar `.env`.

## 4) Publicar frontend no EC2 apontando para API local

### Opcao A (recomendada): AWS SSM direto do seu Windows

Use o script:

```powershell
npm run deploy:hybrid:ec2 -- `
  -InstanceId i-xxxxxxxxxxxxxxxxx `
  -ApiUpstream https://api-seu-tunel.exemplo.com `
  -Region us-east-1 `
  -Profile 389364614518 `
  -Branch main
```

O script atualiza o codigo no EC2 e executa `deploy-ec2-frontend-only.sh` com:
- `API_UPSTREAM=<sua-url-publica>`
- `DISABLE_EC2_BACKEND=true`

### Opcao B: rodar manualmente na EC2

```bash
cd ~/logiwms-pro
chmod +x deploy-ec2-frontend-only.sh
API_UPSTREAM=https://api-seu-tunel.exemplo.com DISABLE_EC2_BACKEND=true ./deploy-ec2-frontend-only.sh
```

## 5) Checklist de validacao

- Frontend no EC2 abre normalmente (`http://3.83.164.82` ou dominio)
- `http://localhost:3001/health` responde localmente
- Login no frontend EC2 funciona
- Criacao/edicao de dados funciona (ex.: Cadastro Geral)
- Sem erro de CORS nem erro de conexao em `/api/*`

