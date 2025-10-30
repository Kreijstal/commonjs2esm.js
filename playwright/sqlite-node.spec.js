import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import initSqlJs from 'sql.js';

import { sqliteToJson } from '../src/runtime.js';

const locateFile = (file) =>
  fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url));

async function createSqlModule() {
  return await initSqlJs({ locateFile });
}

test('sqliteToJson reads SQLite files from disk in Node.js', async () => {
  const SQL = await createSqlModule();
  const db = new SQL.Database();
  db.run('CREATE TABLE messages (id INTEGER, text TEXT);');
  db.run("INSERT INTO messages VALUES (1, 'hello'), (2, 'world');");

  const binary = db.export();
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'sqlite-json-'));
  const databasePath = path.join(tempDir, 'messages.db');
  await fs.writeFile(databasePath, binary);

  const json = await sqliteToJson(databasePath, {
    moduleLoader: async () => SQL,
  });

  expect(json).toEqual({
    messages: [
      { id: 1, text: 'hello' },
      { id: 2, text: 'world' },
    ],
  });
});
