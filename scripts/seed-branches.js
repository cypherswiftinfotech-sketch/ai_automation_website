require('dotenv').config();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const { seedBranchesIfEmpty } = require('../lib/branch-db');
const count = seedBranchesIfEmpty();
console.log(`Branch seed complete: ${count} locations in database.`);
