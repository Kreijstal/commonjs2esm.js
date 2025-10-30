#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { promises as fs } from 'node:fs';

import { transformCommonJsToEsm } from '../src/transformer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repositoryRoot = resolve(__dirname, '..');

const destinations = [
  { source: 'src/index.js', output: 'commonjs2esm.js', transform: 'transformer' },
  { source: 'src/runtime.js', output: 'runtime.js', transform: false },
  { source: 'src/transformer.js', output: 'transformer.js', transform: false },
  { source: 'node_modules/sql.js/dist/sql-wasm.js', output: 'sql-wasm.mjs', transform: 'wrap-sqljs' },
  { source: 'node_modules/sql.js/dist/sql-wasm.wasm', output: 'sql-wasm.wasm', transform: false },
];

async function buildBrowserEntry(targetDir) {
  await fs.mkdir(targetDir, { recursive: true });

  for (const entry of destinations) {
    const sourcePath = resolve(repositoryRoot, entry.source);
    const outputPath = resolve(targetDir, entry.output);

    if (entry.transform === 'transformer') {
      const source = await fs.readFile(sourcePath, 'utf-8');
      const transformed = transformCommonJsToEsm(source, {
        filename: entry.source,
        includeRuntime: true,
      });
      await fs.writeFile(outputPath, transformed, 'utf-8');
      console.log(`Generated ${entry.output}`);
      continue;
    }

    if (entry.transform === 'wrap-sqljs') {
      const source = await fs.readFile(sourcePath, 'utf-8');
      const wrapped = [
        'const __commonjsModule = { exports: {} };',
        'const __commonjsExports = __commonjsModule.exports;',
        '(function (module, exports) {',
        '  const process = undefined;',
        '  const require = undefined;',
        source,
        '})(__commonjsModule, __commonjsExports);',
        'const initSqlJs = __commonjsModule.exports.default ?? __commonjsModule.exports;',
        'if (typeof initSqlJs !== "function") {',
        '  throw new Error("sql.js wrapper did not expose an initializer");',
        '}',
        'export default initSqlJs;',
        '',
      ].join('\n');
      await fs.writeFile(outputPath, wrapped, 'utf-8');
      console.log(`Wrapped ${entry.output}`);
      continue;
    }

    await fs.copyFile(sourcePath, outputPath);
    console.log(`Copied ${entry.output}`);
  }

  console.log(`Browser entry files are available in ${targetDir}`);
}

async function main() {
  const targetDir = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : process.cwd();

  try {
    await buildBrowserEntry(targetDir);
  } catch (error) {
    console.error(`Failed to build browser entry: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
