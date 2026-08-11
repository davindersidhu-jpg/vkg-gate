require('dotenv').config();

const path = require('path');
const fs = require('fs');

const TURSO_URL = process.env.TURSO_DATABASE_URL;

let run, get, all, exec;

if (TURSO_URL) {
  // ---- Remote mode: Turso (used on Netlify, which has no persistent disk) ----
  const { createClient } = require('@libsql/client');
  const client = createClient(
    process.env.TURSO_AUTH_TOKEN
      ? { url: TURSO_URL, authToken: process.env.TURSO_AUTH_TOKEN }
      : { url: TURSO_URL }
  );

  let schemaReady = null;
  function ensureSchema() {
    if (!schemaReady) {
      const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      schemaReady = client.executeMultiple(schema);
    }
    return schemaReady;
  }

  // libsql rejects `undefined` as a bound parameter — normalize to null.
  function sanitize(params) {
    return params.map((p) => (p === undefined ? null : p));
  }

  run = async (sql, params = []) => {
    await ensureSchema();
    const result = await client.execute({ sql, args: sanitize(params) });
    return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.rowsAffected };
  };
  get = async (sql, params = []) => {
    await ensureSchema();
    const result = await client.execute({ sql, args: sanitize(params) });
    return result.rows[0];
  };
  all = async (sql, params = []) => {
    await ensureSchema();
    const result = await client.execute({ sql, args: sanitize(params) });
    return result.rows;
  };
  exec = async (sql) => {
    await ensureSchema();
    return client.executeMultiple(sql);
  };

} else {
  // ---- Local mode: a real SQLite file on disk, via Node's built-in SQLite ----
  // No external service, no tokens, no usage limits. Used automatically
  // whenever TURSO_DATABASE_URL isn't set — e.g. on a persistent host like
  // cPanel that has real disk storage (Netlify Functions don't, hence Turso
  // being used there instead).
  const { DatabaseSync } = require('node:sqlite');

  const dbPath = process.env.DB_PATH || path.join(__dirname, 'vkg_gate.db');
  const raw = new DatabaseSync(dbPath);
  raw.exec('PRAGMA journal_mode = WAL;');
  raw.exec('PRAGMA foreign_keys = ON;');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  raw.exec(schema);

  run = async (sql, params = []) => {
    const result = raw.prepare(sql).run(...params);
    return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.changes };
  };
  get = async (sql, params = []) => raw.prepare(sql).get(...params);
  all = async (sql, params = []) => raw.prepare(sql).all(...params);
  exec = async (sql) => raw.exec(sql);
}

module.exports = { run, get, all, exec };