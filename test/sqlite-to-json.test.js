import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
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

test('sqliteToJson fetches SQLite files by path in browser environments', async () => {
  const SQL = await createSqlModule();
  const db = new SQL.Database();
  db.run('CREATE TABLE logs (id INTEGER, message TEXT);');
  db.run("INSERT INTO logs VALUES (1, 'Boot'), (2, 'Ready');");

  const binary = db.export();
  db.close();

  const previousEnv = globalThis.__COMMONJS2ESM_ENVIRONMENT;
  const requested = [];

  let port;

  const server = createServer((req, res) => {
    if (req.url === '/logs.db') {
      const payload = Buffer.from(
        binary.buffer,
        binary.byteOffset,
        binary.byteLength,
      );
      requested.push(`http://127.0.0.1:${port}${req.url}`);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': payload.length,
      });
      res.end(payload);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  if (!address || typeof address !== 'object') {
    throw new Error('Failed to obtain test server address');
  }
  port = address.port;

  let browserSqliteToJson;

  try {
    globalThis.__COMMONJS2ESM_ENVIRONMENT = 'browser';
    ({ sqliteToJson: browserSqliteToJson } = await import(
      `../src/runtime.js?browser-test=${Date.now()}-${Math.random()}`
    ));

    const databaseUrl = `http://127.0.0.1:${port}/logs.db`;
    const json = await browserSqliteToJson(databaseUrl, {
      moduleLoader: async () => SQL,
    });

    assert.deepEqual(json, {
      logs: [
        { id: 1, message: 'Boot' },
        { id: 2, message: 'Ready' },
      ],
    });
    assert.deepEqual(requested, [`http://127.0.0.1:${port}/logs.db`]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previousEnv === undefined) {
      delete globalThis.__COMMONJS2ESM_ENVIRONMENT;
    } else {
      globalThis.__COMMONJS2ESM_ENVIRONMENT = previousEnv;
    }
  }
});
