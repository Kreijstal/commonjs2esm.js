import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import initSqlJs from 'sql.js';

import { sqliteToJson } from '../src/runtime.js';

const locateFile = (file) =>
  fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url));

async function createSqlModule() {
  return await initSqlJs({ locateFile });
}

test('sqliteToJson converts a Uint8Array database to JSON', async () => {
  const SQL = await createSqlModule();
  const db = new SQL.Database();
  db.run('CREATE TABLE users (id INTEGER, name TEXT);');
  db.run("INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob');");

  const binary = db.export();
  db.close();

  const json = await sqliteToJson(binary, {
    moduleLoader: async () => SQL,
  });

  assert.deepEqual(json, {
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ],
  });
});

test('sqliteToJson filters tables when requested', async () => {
  const SQL = await createSqlModule();
  const db = new SQL.Database();
  db.run('CREATE TABLE users (id INTEGER, name TEXT);');
  db.run('CREATE TABLE posts (id INTEGER, title TEXT);');
  db.run("INSERT INTO users VALUES (1, 'Alice');");
  db.run("INSERT INTO posts VALUES (1, 'First Post');");

  const binary = db.export();
  db.close();

  const json = await sqliteToJson(binary, {
    tables: ['posts'],
    moduleLoader: async () => SQL,
  });

  assert.deepEqual(json, {
    posts: [{ id: 1, title: 'First Post' }],
  });
});

test('sqliteToJson loads sql.js defaults in Node.js', async () => {
  const SQL = await createSqlModule();
  const db = new SQL.Database();
  db.run('CREATE TABLE settings (key TEXT, value TEXT);');
  db.run("INSERT INTO settings VALUES ('theme', 'dark');");

  const binary = db.export();
  db.close();

  const json = await sqliteToJson(binary);

  assert.deepEqual(json, {
    settings: [{ key: 'theme', value: 'dark' }],
  });
});
