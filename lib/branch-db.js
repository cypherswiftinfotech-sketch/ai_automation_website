const path = require('path');
const { defaultBranches } = require('./branch-seed');

let db = null;
let memoryBranches = defaultBranches.map(b => ({ ...b }));

function getDb() {
    if (db !== null) return db;
    try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '..', 'data', 'branches.db');
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.exec(`
            CREATE TABLE IF NOT EXISTS branches (
                id INTEGER PRIMARY KEY,
                slug TEXT UNIQUE NOT NULL,
                data TEXT NOT NULL
            )
        `);
        return db;
    } catch (err) {
        console.warn('SQLite unavailable, using in-memory branch store:', err.message);
        db = false;
        return null;
    }
}

function rowToBranch(row) {
    if (!row) return null;
    try {
        return typeof row.data === 'string' ? JSON.parse(row.data) : row;
    } catch {
        return null;
    }
}

function getBranchBySlug(slug) {
    const sqlite = getDb();
    if (sqlite) {
        const row = sqlite.prepare('SELECT data FROM branches WHERE slug = ?').get(slug);
        return rowToBranch(row ? { data: row.data } : null);
    }
    return memoryBranches.find(b => b.slug === slug) || null;
}

function getAllBranches() {
    const sqlite = getDb();
    if (sqlite) {
        const rows = sqlite.prepare('SELECT data FROM branches ORDER BY id ASC').all();
        return rows.map(r => rowToBranch({ data: r.data })).filter(Boolean);
    }
    return [...memoryBranches];
}

function upsertBranch(branch) {
    const payload = { ...branch };
    const sqlite = getDb();
    if (sqlite) {
        const existing = sqlite.prepare('SELECT id FROM branches WHERE slug = ?').get(branch.slug);
        const data = JSON.stringify(payload);
        if (existing) {
            sqlite.prepare('UPDATE branches SET data = ? WHERE slug = ?').run(data, branch.slug);
            payload.id = existing.id;
        } else {
            const result = sqlite.prepare('INSERT INTO branches (slug, data) VALUES (?, ?)').run(branch.slug, data);
            payload.id = result.lastInsertRowid;
        }
    } else {
        const idx = memoryBranches.findIndex(b => b.slug === branch.slug);
        if (idx !== -1) {
            memoryBranches[idx] = { ...memoryBranches[idx], ...payload };
            return memoryBranches[idx];
        }
        payload.id = memoryBranches.length + 1;
        memoryBranches.push(payload);
    }
    return payload;
}

function seedBranchesIfEmpty() {
    const branches = getAllBranches();
    if (branches.length > 0) return branches.length;

    for (const branch of defaultBranches) {
        upsertBranch(branch);
    }
    console.log(`✅ Seeded ${defaultBranches.length} location branches`);
    return defaultBranches.length;
}

function getSlimBranches() {
    return getAllBranches().map(b => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        city: b.city,
        rating: b.rating
    }));
}

module.exports = {
    getBranchBySlug,
    getAllBranches,
    upsertBranch,
    seedBranchesIfEmpty,
    getSlimBranches
};
