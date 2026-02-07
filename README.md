<div align="center">
  
  # ðŸ“¦ LogiWMS-Pro
  ### GestÃ£o Inteligente de ArmazÃ©m - Sistema WMS Completo
  
  [![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-24.x-339933?logo=node.js)](https://nodejs.org/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
</div>

---

## ðŸš€ Sobre o Projeto

**LogiWMS-Pro** Ã© um sistema completo de **Warehouse Management System (WMS)** desenvolvido para otimizar operaÃ§Ãµes logÃ­sticas em centros de distribuiÃ§Ã£o. Com foco em **usabilidade**, **seguranÃ§a** e **performance**, o sistema oferece controle total sobre:

- ðŸ“¥ **Recebimento de Mercadorias**
- ðŸ“¦ **GestÃ£o de Estoque** com classificaÃ§Ã£o ABC
- ðŸ”„ **MovimentaÃ§Ãµes Internas**
- ðŸ“¤ **ExpediÃ§Ã£o e SolicitaÃ§Ãµes SA**
- ðŸ” **InventÃ¡rio CÃ­clico**
- ðŸ›’ **GestÃ£o de Compras** com cotaÃ§Ãµes e aprovaÃ§Ãµes
- ðŸ“Š **RelatÃ³rios AnalÃ­ticos**
- ðŸ‘¥ **Controle de UsuÃ¡rios e PermissÃµes**

---

## âœ¨ Principais Funcionalidades

### ðŸŽ¯ Dashboard Inteligente
- KPIs em tempo real (volume, ocupaÃ§Ã£o, alertas)
- GrÃ¡ficos de produtividade
- Atividades recentes do sistema

### ðŸ” SeguranÃ§a OWASP
- AutenticaÃ§Ã£o server-side
- SanitizaÃ§Ã£o automÃ¡tica de dados
- ProteÃ§Ã£o contra SQL Injection
- Whitelist de tabelas

### ðŸ“± Interface Moderna
- Design responsivo (desktop, tablet, mobile)
- Dark mode nativo
- AnimaÃ§Ãµes fluidas
- Sidebar colapsÃ¡vel

### ðŸ”„ PersistÃªncia HÃ­brida
- Suporte a PostgreSQL/SQLite
- Fallback automÃ¡tico para JSON
- SincronizaÃ§Ã£o de dados

---

## ðŸ› ï¸ Tecnologias Utilizadas

### Frontend
- **React 18.3** - Biblioteca UI
- **TypeScript 5.6** - Tipagem estÃ¡tica
- **Vite** - Build tool ultrarrÃ¡pido
- **Recharts** - GrÃ¡ficos e visualizaÃ§Ãµes
- **XLSX** - ImportaÃ§Ã£o/exportaÃ§Ã£o Excel

### Backend
- **Node.js 24.x** - Runtime JavaScript
- **Express** - Framework web
- **PostgreSQL** - Banco de dados principal
- **SQLite** - Banco alternativo local

### SeguranÃ§a
- **OWASP Guard** - Auditoria automÃ¡tica
- **TDD Mastery** - Desenvolvimento orientado a testes
- **Agent Manager** - OtimizaÃ§Ã£o de tarefas

---

## ðŸ“‹ PrÃ©-requisitos

- **Node.js** >= 18.0.0
- **npm** ou **yarn**
- **PostgreSQL** (opcional - usa JSON como fallback)

---

## âš™ï¸ InstalaÃ§Ã£o

### 1. Clone o repositÃ³rio
```bash
git clone https://github.com/seu-usuario/logiwms-pro.git
cd logiwms-pro
```

### 2. Instale as dependÃªncias

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd api-backend
npm install
cd ..
```

### 3. Configure as variÃ¡veis de ambiente (opcional)

Crie um arquivo `.env.local` na raiz do projeto:
```env
VITE_API_URL=http://localhost:3001
GEMINI_API_KEY=sua_chave_aqui
```

### 4. Inicie o sistema

**Terminal 1 - Backend:**
```bash
cd api-backend
npm start
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### 5. Acesse o sistema
Abra seu navegador em: **http://localhost:3000**

---

## ?? Acesso ao Sistema

- Credenciais locais de teste (seed):
  - `admin@nortetech.com` / `admin`
  - `MATIAS@G.COM` / `matias`
- Usuários podem ser ajustados no banco (`users`) ou no fallback JSON (`api-backend/data/users.json`).
- Não mantenha credenciais padrão em produção.

### Troubleshooting rápido

- Erro `Failed to fetch` na tela de login:
  - Confirme backend ativo em `http://localhost:3001/health`
  - Reinicie os dois serviços:
    - Backend: `cd api-backend && npm run dev`
    - Frontend: `npm run dev`

---

## ðŸ“ Estrutura do Projeto

```
logiwms-pro/
â”œâ”€â”€ api-backend/          # Backend Node.js + Express
â”‚   â”œâ”€â”€ data/            # Dados JSON (fallback)
â”‚   â”œâ”€â”€ tests/           # Testes automatizados
â”‚   â””â”€â”€ index.js         # Servidor principal
â”œâ”€â”€ components/          # Componentes React reutilizÃ¡veis
â”œâ”€â”€ pages/              # PÃ¡ginas/MÃ³dulos do sistema
â”œâ”€â”€ public/             # Assets estÃ¡ticos
â”œâ”€â”€ types.ts            # DefiniÃ§Ãµes TypeScript
â”œâ”€â”€ App.tsx             # Componente principal
â””â”€â”€ schema.sql          # Schema do banco de dados

```

---

## ?? Testes

```bash
# Frontend (typecheck)
npm test

# Backend (integração + auth + fluxo)
cd api-backend
npm test

# Popular massa Big Data (gera backup automático em api-backend/data-backups/)
npm run seed:bigdata

# Stress test automatizado (login, leitura, escrita e fluxo misto)
npm run test:stress
```

---

## ðŸš¢ Deploy

### OpÃ§Ã£o 1: Vercel (Frontend) + Railway (Backend)
1. Deploy frontend no Vercel
2. Deploy backend no Railway
3. Configure variÃ¡veis de ambiente

### OpÃ§Ã£o 2: Docker
```bash
docker-compose up -d
```

---

## ðŸ“¸ Screenshots

<div align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard" width="45%"/>
  <img src="docs/screenshots/inventory.png" alt="Estoque" width="45%"/>
</div>

---

## ðŸ¤ Contribuindo

ContribuiÃ§Ãµes sÃ£o bem-vindas! Para contribuir:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanÃ§as (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## ðŸ“ LicenÃ§a

Este projeto estÃ¡ sob a licenÃ§a MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## ðŸ‘¨â€ðŸ’» Autor

**Norte Tech Solutions**
- Website: [nortetech.com](https://nortetech.com)
- Email: contato@nortetech.com

---

## ðŸ™ Agradecimentos

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Recharts](https://recharts.org/)
- [OWASP](https://owasp.org/)

---

<div align="center">
  Feito com â¤ï¸ por <strong>Norte Tech</strong>
  
  â­ Se este projeto te ajudou, considere dar uma estrela!
</div>


