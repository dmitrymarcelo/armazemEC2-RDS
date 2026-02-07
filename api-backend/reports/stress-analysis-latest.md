# Relatorio de Stress - Big Data (JSON contingency)

Data do teste: 2026-02-07

## Massa de dados gerada

- inventory: 60.000
- movements: 240.000
- purchase_orders: 42.000
- material_requests: 90.178
- notifications: 85.000
- vendors: 9.000
- vehicles: 5.000
- users: 401

Arquivos grandes:

- movements.json: ~77.79 MB
- purchase_orders.json: ~38.74 MB
- material_requests.json: ~27.40 MB
- inventory.json: ~24.68 MB
- notifications.json: ~20.22 MB

## Melhorias aplicadas neste ciclo

1. Cache JSON por `mtime` para leituras repetidas.
2. Compressao HTTP (`compression`) nas respostas.
3. `sanitizeResponse` sem clone desnecessario para tabelas sem senha.
4. Normalizacao condicional (users/purchase_orders) para evitar map em massa quando nao necessario.
5. `verifyPassword` assíncrono (PBKDF2 não bloqueante).
6. Suporte a paginacao com `offset` no backend.
7. Frontend com carga inicial leve e lazy-load de módulos pesados.

## Resultado de carga atual

Relatorio atual: `stress-report-1770490948682.json`

- login_burst (70 conc): success 100%, 6.74 req/s, p95 10.51s
- read_inventory_limited (120 conc): success 100%, 129.05 req/s, p95 1.20s
- read_inventory_full_payload (16 conc): success 100%, 2.20 req/s, p95 9.65s
- write_material_requests (55 conc): success 76.77%, 6.13 req/s, p95 16.79s
- mixed_flow_login_read_write (24 conc): success 85.42%, 1.33 req/s, p95 18.56s

## Comparativo de evolucao (3 rodadas)

Baseline: `stress-report-1770489027410.json`
Intermediario: `stress-report-1770489353839.json`
Atual: `stress-report-1770490948682.json`

Ganhos relevantes do baseline para o atual:

- login_burst:
  - success: 77.44% -> 100%
  - req/s: 2.95 -> 6.74 (+128%)
  - p95: 33.39s -> 10.51s (-68.5%)
- read_inventory_limited:
  - success: 75.94% -> 100%
  - req/s: 3.73 -> 129.05 (+3359%)
  - p95: 45.95s -> 1.20s (-97.4%)
- write_material_requests:
  - success: 67.9% -> 76.77%
  - req/s: 1.61 -> 6.13 (+281%)
  - p95: 47.14s -> 16.79s (-64.4%)
- mixed_flow_login_read_write:
  - success: 0% -> 85.42%
  - req/s: 0.73 -> 1.33 (+82%)
  - p95: 46.82s -> 18.56s (-60.4%)

## Gargalos tecnicos remanescentes

1. Escrita concorrente em modo JSON ainda é limitada (regrava arquivo completo em cada escrita).
2. Fluxo full payload continua caro em tabelas de dezenas de MB por resposta.
3. Frontend ainda carrega datasets grandes para algumas telas sem paginação visual.

## Melhorias recomendadas (prioridade)

1. Implementar paginação funcional nas telas de movimentos/pedidos/requisições (UI + API com `offset`).
2. Criar endpoints de resumo/KPI para dashboard sem transportar massa bruta.
3. Introduzir fila assíncrona de escrita no fallback JSON (batch por janela curta).
4. Adicionar rate limit em `/login` (proteção e previsibilidade sob pico).
5. Em produção real de alta carga, usar PostgreSQL como modo principal (contingency JSON apenas fallback).
