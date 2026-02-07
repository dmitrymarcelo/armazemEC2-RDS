import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const DATA_DIR = path.join(process.cwd(), 'data');

// Garantir diretório de dados existe
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Configuração do Banco de Dados
let dbConnected = false;
const pool = new pg.Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '5432'),
    connectionTimeoutMillis: 2000,
});

// Testar conexão inicial
pool.connect((err, client, release) => {
    if (err) {
        console.warn('⚠️ AVISO: Falha na conexão com PostgreSQL. Entrando em MODO CONTINGÊNCIA (JSON).');
        dbConnected = false;
    } else {
        console.log('✅ Conectado ao PostgreSQL com sucesso.');
        dbConnected = true;
        release();
    }
});

app.use(cors());
app.use(express.json());

// --- Camada de Persistência JSON (Fallback) ---
const getJsonPath = (table) => path.join(DATA_DIR, `${table}.json`);

const readJson = (table) => {
    const filePath = getJsonPath(table);
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return [];
    }
};

const writeJson = (table, data) => {
    fs.writeFileSync(getJsonPath(table), JSON.stringify(data, null, 2));
};

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        database: dbConnected ? 'connected' : 'disconnected',
        mode: dbConnected ? 'production' : 'contingency (JSON)'
    });
});

// Helper para construir queries SQL
const buildQuery = (table, queryParams) => {
    let text = `SELECT * FROM ${table}`;
    let values = [];
    let whereClauses = [];
    let paramIndex = 1;

    Object.keys(queryParams).forEach(key => {
        if (key !== 'select' && key !== 'order' && key !== 'limit') {
            whereClauses.push(`${key} = $${paramIndex}`);
            values.push(queryParams[key]);
            paramIndex++;
        }
    });

    if (whereClauses.length > 0) text += ` WHERE ${whereClauses.join(' AND ')}`;
    if (queryParams.order) {
        const [col, dir] = queryParams.order.split(':');
        text += ` ORDER BY ${col} ${dir === 'desc' ? 'DESC' : 'ASC'}`;
    }
    if (queryParams.limit) text += ` LIMIT ${parseInt(queryParams.limit)}`;
    return { text, values };
};

// --- Segurança e Auditoria (OWASP Guard) ---
const TABLE_WHITELIST = [
    'users', 'warehouses', 'inventory', 'cyclic_batches',
    'vendors', 'vehicles', 'purchase_orders', 'movements',
    'notifications', 'material_requests'
];

const validateTable = (table) => TABLE_WHITELIST.includes(table);

const sanitizeResponse = (data) => {
    if (Array.isArray(data)) {
        return data.map(item => {
            const { password, ...safeItem } = item;
            return safeItem;
        });
    }
    if (data && typeof data === 'object') {
        const { password, ...safeData } = data;
        return safeData;
    }
    return data;
};

// --- AUTHENTICATION ---
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ data: null, error: 'Email e senha são obrigatórios' });
    }

    if (!dbConnected) {
        const users = readJson('users');
        const user = users.find(u => u.email === email || u.name === email);

        if (user && user.password === password) {
            if (user.status !== 'Ativo') {
                return res.status(403).json({ data: null, error: 'Usuário inativo' });
            }
            return res.json({ data: sanitizeResponse(user), error: null });
        }
        return res.status(401).json({ data: null, error: 'Credenciais inválidas' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1 OR name = $1', [email]);
        const user = result.rows[0];

        if (user && user.password === password) {
            if (user.status !== 'Ativo') {
                return res.status(403).json({ data: null, error: 'Usuário inativo' });
            }
            return res.json({ data: sanitizeResponse(user), error: null });
        }
        res.status(401).json({ data: null, error: 'Credenciais inválidas' });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ data: null, error: 'Erro interno no servidor' });
    }
});

// --- ROTAS GENÉRICAS ---

// GET (Select)
app.get('/:table', async (req, res) => {
    const { table } = req.params;

    if (!validateTable(table)) {
        return res.status(403).json({ data: null, error: 'Acesso negado: Tabela não permitida' });
    }

    if (!dbConnected) {
        // Modo JSON
        let data = readJson(table);
        // Filtros simples (eq)
        Object.keys(req.query).forEach(key => {
            if (key !== 'select' && key !== 'order' && key !== 'limit') {
                data = data.filter(item => String(item[key]) === String(req.query[key]));
            }
        });
        return res.json({ data: sanitizeResponse(data), error: null });
    }

    try {
        const { text, values } = buildQuery(table, req.query);
        const result = await pool.query(text, values);

        const processedRows = result.rows.map(row => {
            const newRow = { ...row };
            if (table === 'users') {
                if (typeof newRow.modules === 'string') try { newRow.modules = JSON.parse(newRow.modules); } catch (e) { }
                if (typeof newRow.allowed_warehouses === 'string') try { newRow.allowed_warehouses = JSON.parse(newRow.allowed_warehouses); } catch (e) { }
            }
            return newRow;
        });

        res.json({ data: sanitizeResponse(processedRows), error: null });
    } catch (err) {
        res.status(500).json({ data: null, error: err.message });
    }
});

// POST (Insert)
app.post('/:table', async (req, res) => {
    const { table } = req.params;
    if (!validateTable(table)) {
        return res.status(403).json({ data: null, error: 'Acesso negado' });
    }
    const data = req.body;
    const rows = Array.isArray(data) ? data : [data];

    if (!dbConnected) {
        let currentData = readJson(table);
        currentData.push(...rows);
        writeJson(table, currentData);
        return res.json({ data: sanitizeResponse(data), error: null });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const row of rows) {
                const cols = Object.keys(row);
                const vals = Object.values(row);
                const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
                const queryText = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
                const resQuery = await client.query(queryText, vals);
                results.push(resQuery.rows[0]);
            }
            await client.query('COMMIT');
            res.json({ data: sanitizeResponse(Array.isArray(data) ? results : results[0]), error: null });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ data: null, error: err.message });
    }
});

// PATCH (Update)
app.patch('/:table', async (req, res) => {
    const { table } = req.params;
    if (!validateTable(table)) {
        return res.status(403).json({ data: null, error: 'Acesso negado' });
    }
    const updates = req.body;
    const { id } = req.query;

    if (!dbConnected) {
        let currentData = readJson(table);
        const index = currentData.findIndex(item =>
            String(item.id) === String(id) ||
            String(item.sku) === String(id) ||
            String(item.plate) === String(id)
        );

        if (index > -1) {
            currentData[index] = { ...currentData[index], ...updates };
            writeJson(table, currentData);
            return res.json({ data: sanitizeResponse([currentData[index]]), error: null });
        } else {
            return res.status(404).json({ data: null, error: 'Item não encontrado' });
        }
    }

    try {
        const cols = Object.keys(updates);
        const vals = Object.values(updates);
        const setClause = cols.map((col, i) => `${col} = $${i + 1}`).join(', ');
        vals.push(id);
        const queryText = `UPDATE ${table} SET ${setClause} WHERE id = $${vals.length} OR sku = $${vals.length} RETURNING *`;
        const result = await pool.query(queryText, vals);
        res.json({ data: sanitizeResponse(result.rows), error: null });
    } catch (err) {
        res.status(500).json({ data: null, error: err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
    if (!dbConnected) console.log('📁 ATENÇÃO: Usando persistência JSON (Backup)');
});
