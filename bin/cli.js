#!/usr/bin/env node

/**
 * CLI tool for converting CommonJS files to ESM
 */

import { readFile, writeFile } from '../src/runtime.js';
import { transformCommonJsToEsm } from '../src/transformer.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function printUsage() {
  console.log(`
Usage: commonjs2esm <input-file> [output-file]

Convert CommonJS modules to ESM for browser use.

Arguments:
  input-file   Path to the CommonJS file to convert
  output-file  Path for the output ESM file (optional, defaults to input-file.esm.js)

Options:
  -h, --help   Show this help message

Examples:
  commonjs2esm mymodule.js
  commonjs2esm mymodule.js mymodule.esm.js
  `);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }
  
  const inputFile = args[0];
  let outputFile = args[1];
  
  if (!outputFile) {
    // Generate output filename
    if (inputFile.endsWith('.cjs')) {
      outputFile = inputFile.replace(/\.cjs$/, '.esm.js');
    } else if (inputFile.endsWith('.js')) {
      outputFile = inputFile.replace(/\.js$/, '.esm.js');
    } else {
      outputFile = inputFile + '.esm.js';
    }
  }
  
  try {
    console.log(`Converting ${inputFile} to ESM...`);
    
    const code = await readFile(inputFile);
    const transformed = transformCommonJsToEsm(code, {
      filename: inputFile,
      includeRuntime: true
    });
    
    await writeFile(outputFile, transformed);
    
    console.log(`✓ Successfully converted to ${outputFile}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
