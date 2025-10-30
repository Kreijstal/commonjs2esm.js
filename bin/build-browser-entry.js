#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { promises as fs } from 'node:fs';

import { transformCommonJsToEsm } from '../src/transformer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repositoryRoot = resolve(__dirname, '..');

const destinations = [
  { source: 'src/index.js', output: 'commonjs2esm.js', transform: true },
  { source: 'src/runtime.js', output: 'runtime.js', transform: false },
  { source: 'src/transformer.js', output: 'transformer.js', transform: false },
];

async function buildBrowserEntry(targetDir) {
  await fs.mkdir(targetDir, { recursive: true });

  for (const entry of destinations) {
    const sourcePath = resolve(repositoryRoot, entry.source);
    const outputPath = resolve(targetDir, entry.output);

    if (entry.transform) {
      const source = await fs.readFile(sourcePath, 'utf-8');
      const transformed = transformCommonJsToEsm(source, {
        filename: entry.source,
        includeRuntime: true,
      });
      await fs.writeFile(outputPath, transformed, 'utf-8');
      console.log(`Generated ${entry.output}`);
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
