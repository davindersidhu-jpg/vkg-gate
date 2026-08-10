require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

// TURSO_DATABASE_URL / TURSO_AUTH_TOKEN point at your hosted Turso database.
// For local testing without a Turso account yet, you can instead leave these
// unset and it will fall back to a local file next to this module.
const localDbPath = path.join(__dirname, 'vkg_gate.local.db');

const isNetlify = process.env.NETLIFY === 'true';

const url = isNetlify
  ? process.env.TURSO_DATABASE_URL
  : (process.env.TURSO_DATABASE_URL || `file:${localDbPath}`);

const authToken = process.env.TURSO_AUTH_TOKEN;

if (isNetlify && !url) {
  throw new Error('TURSO_DATABASE_URL is not configured in Netlify.');
}

const client = createClient(
  authToken ? { url, authToken } : { url }
);

let schemaReady = null;

function ensureSchema() {
  if (!schemaReady) {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    schemaReady = client.executeMultiple(schema);
  }
  return schemaReady;
}

function sanitize(params) {
  return params.map((p) => (p === undefined ? null : p));
}

async function run(sql, params = []) {
  await ensureSchema();
  const result = await client.execute({ sql, args: sanitize(params) });
  return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.rowsAffected };
}

async function get(sql, params = []) {
  await ensureSchema();
  const result = await client.execute({ sql, args: sanitize(params) });
  return result.rows[0];
}

async function all(sql, params = []) {
  await ensureSchema();
  const result = await client.execute({ sql, args: sanitize(params) });
  return result.rows;
}

async function exec(sql) {
  await ensureSchema();
  return client.executeMultiple(sql);
}

module.exports = { run, get, all, exec, ensureSchema, client };