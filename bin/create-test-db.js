#!/usr/bin/env node

/**
 * Helper CLI that creates a sample SQLite database in the current directory.
 * The generated database is used for browser/Playwright tests and manual QA.
 */

import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

function printUsage() {
  console.log(`
Usage: commonjs2esm-create-db [output-file]

Creates a SQLite database in the current working directory that mirrors the
schema our tests expect. The default output file is logs.db.

Examples:
  commonjs2esm-create-db
  commonjs2esm-create-db my-fixture.db
`);
}

async function loadSqlJs() {
  const imported = await import('sql.js');
  const initSqlJs = imported.default ?? imported;

  if (initSqlJs && typeof initSqlJs.Database === 'function') {
    return initSqlJs;
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const distDir = join(__dirname, '../node_modules/sql.js/dist');

  const locateFile = (file) => join(distDir, file);

  const module = await initSqlJs({ locateFile });
  if (module && typeof module.Database === 'function') {
    return module;
  }

  throw new Error('Unable to initialise sql.js Database constructor');
}

async function createDatabase(outputPath) {
  const SQL = await loadSqlJs();
  const db = new SQL.Database();

  try {
    db.exec(`
      CREATE TABLE logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    const now = new Date().toISOString();

    const insert = db.prepare('INSERT INTO logs (level, message, created_at) VALUES (?, ?, ?)');
    insert.run(['info', 'Bootstrap complete', now]);
    insert.run(['warn', 'Cache miss observed', now]);
    insert.run(['error', 'Unhandled rejection captured', now]);
    insert.free();

    const binary = db.export();
    await writeFile(outputPath, Buffer.from(binary));
  } finally {
    db.close();
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    printUsage();
    return;
  }

  const outputFile = args[0] ?? 'logs.db';
  const targetPath = resolve(process.cwd(), outputFile);

  try {
    await createDatabase(targetPath);
    console.log(`✓ Created SQLite database at ${targetPath}`);
  } catch (error) {
    console.error(`Failed to create database: ${error.message}`);
    process.exit(1);
  }
}

main();
