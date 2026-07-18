const Database = require('better-sqlite3');
const db = new Database('data/tucromi.sqlite', { readonly: true });
const row = db.prepare("SELECT * FROM version_metadata ORDER BY created_at DESC LIMIT 1").get();
console.log('Row:', JSON.stringify(row, null, 2));
