# LogiWMS-Pro

Sistema WMS completo para operacao de armazem, com frontend React + TypeScript e backend Node.js + PostgreSQL (com fallback JSON).

## Stack
- Frontend: React, TypeScript, Vite, Recharts, XLSX
- Backend: Node.js, Express, PostgreSQL
- Testes:
  - Frontend: `typecheck`
  - Backend: testes de integracao (`node --test`)
  - E2E: Playwright

## Requisitos
- Node.js 18+
- npm
- PostgreSQL (opcional em dev; backend pode usar fallback JSON)

## Instalacao
```bash
npm install
cd api-backend
npm install
cd ..
```

## Variaveis de ambiente
Use `.env.example` como base.

Frontend (raiz):
- `VITE_API_URL` (opcional)
- `VITE_API_TIMEOUT_MS` (opcional, default `15000`)
- `VITE_API_GET_RETRIES` (opcional, default `2`)

Backend (`api-backend`):
- `PORT` (default `3001`)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `DB_HEALTHCHECK_INTERVAL_MS` (default `10000`)
- `JWT_SECRET`

Arquivo recomendado para backend:
- `api-backend/.env.example`

## Executar localmente
Forma recomendada (limpa portas 3000/3001 e sobe API + frontend):
```bash
npm run dev:local:clean
```

Forma manual:
Terminal 1 (backend):
```bash
cd api-backend
npm run dev
```

Terminal 2 (frontend):
```bash
npm run dev
```

Aplicacao: `http://localhost:3000`

Health backend: `http://localhost:3001/health`

### Troubleshooting rapido (ECONNREFUSED 127.0.0.1:3001)
Se aparecer erro de proxy do Vite para `/login`, o backend local nao esta ativo na porta `3001`.

Checklist:
1. Limpar ambiente local:
```bash
npm run local:reset
```
2. Subir API:
```bash
npm run dev:backend
```
3. Validar health:
```bash
curl http://localhost:3001/health
```
4. Em outro terminal, subir frontend:
```bash
npm run dev:frontend
```

## Ativar PostgreSQL (sair do modo contingencia JSON)
1. Suba o banco local com Docker:
```bash
docker compose up -d db
```
2. Verifique conexao do backend com o banco:
```bash
cd api-backend
npm run db:health
```
3. Aplique a migracao:
```bash
cd api-backend
npm run db:migrate
```
4. Reinicie o backend:
```bash
cd api-backend
npm run dev
```
5. Confirme status:
```bash
curl http://localhost:3001/health
```
Esperado no retorno:
- `"database": "connected"`
- `"mode": "production"`

### Setup automatizado (Windows / PowerShell)
```powershell
npm run local:backend:setup
```

## Modo Híbrido (Backend Local + Frontend EC2)
- Guia completo: `docs/hybrid-local-backend-ec2-frontend.md`
- Script EC2 (frontend-only): `deploy-ec2-frontend-only.sh`
- Script Windows via AWS SSM: `npm run deploy:hybrid:ec2 -- -InstanceId ... -ApiUpstream ...`
- Template local backend: `api-backend/.env.local.postgres.example`

## Credenciais seed
- `admin@nortetech.com` / `admin`
- `MATIAS@G.COM` / `matias`

## Testes
Frontend:
```bash
npm run test
```

Backend:
```bash
cd api-backend
npm test
npm run db:health
npm run db:migrate
```

E2E:
```bash
npm run e2e
```

## Scripts de dados e carga
Em `api-backend`:
```bash
npm run seed:bigdata
npm run seed:bigdata:xlarge
npm run test:stress
```

## Banco de dados
- `schema.sql`: schema base recomendado para ambientes novos
- `migration.sql`: migracao idempotente para ambientes existentes, com:
  - conversao segura para `TIMESTAMPTZ`
  - conversao segura para `JSONB`
  - indices operacionais e GIN

## Auditoria central
O sistema possui trilha de auditoria unificada em:
- PostgreSQL: tabela `audit_logs`
- Modo contingencia JSON: `api-backend/data/audit_logs.json`

Eventos auditados:
- criacao, atualizacao e exclusao em tabelas operacionais
- finalizacao de recebimento (`/receipts/finalize`)

Campos-chave do log:
- `module`, `entity`, `entity_id`, `action`
- `actor`, `actor_id`, `warehouse_id`
- `before_data`, `after_data`, `meta`, `created_at`

### Tela Auditoria Geral
- Módulo frontend: `Auditoria Geral` no menu lateral
- Endpoint backend: `GET /audit_logs/search`
- Filtros suportados: `module`, `entity`, `action`, `actor`, `warehouse_id`, `from`, `to`, `q`, `limit`, `offset`
- Comportamento de escopo:
  - `warehouse_id=ARMZ28` + `include_global=true` inclui registros globais (sem armazém)
  - `warehouse_id=all` consulta todos os armazéns

## Deploy
- Frontend pode ser publicado separadamente (Vite build)
- Backend pode rodar em EC2/RDS
- Nginx/proxy recomendado para expor `/api`

### Deploy AWS rapido (EC2 + RDS)
Arquivos adicionados para acelerar publicacao:
- `infra/aws/provision-ec2-rds.sh`: provisiona EC2 + RDS + SGs no default VPC (via AWS CLI)
- `deploy-ec2.sh`: deploy no host EC2 (pull, install, migrate, build, pm2, nginx)
- `api-backend/.env.production.rds.example`: template de ambiente para producao com RDS
- `docs/deploy-aws-ec2-rds.md`: passo a passo completo
