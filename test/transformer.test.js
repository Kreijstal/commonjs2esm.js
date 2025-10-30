/**
 * Tests for the transformer
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { transformCommonJsToEsm } from '../src/transformer.js';

describe('transformCommonJsToEsm', () => {
  it('should convert simple require to import', () => {
    const input = `const fs = require('fs');`;
    const output = transformCommonJsToEsm(input, { includeRuntime: false });
    
    assert.match(output, /import fs from 'https:\/\/esm\.sh\/fs';/);
  });
  
  it('should convert destructured require to named import', () => {
    const input = `const { readFile, writeFile } = require('fs/promises');`;
    const output = transformCommonJsToEsm(input, { includeRuntime: false });
    
    assert.match(output, /import \{ readFile, writeFile \} from 'https:\/\/esm\.sh\/fs\/promises';/);
  });
  
  it('should convert local require to relative import', () => {
    const input = `const utils = require('./utils');`;
    const output = transformCommonJsToEsm(input, { includeRuntime: false });
    
    assert.match(output, /import utils from '\.\/utils';/);
  });
  
  it('should convert module.exports object to named exports', () => {
    const input = `
function greet() { return 'hello'; }
module.exports = { greet };
`;
    const output = transformCommonJsToEsm(input, { includeRuntime: false });
    
    assert.match(output, /export \{ greet \};/);
  });
  
  it('should convert exports.name to export const', () => {
    const input = `exports.myFunction = function() { return 42; };`;
    const output = transformCommonJsToEsm(input, { includeRuntime: false });
    
    assert.match(output, /export const myFunction =/);
  });
  
  it('should convert module.exports.name to export const', () => {
    const input = `module.exports.myValue = 123;`;
    const output = transformCommonJsToEsm(input, { includeRuntime: false });
    
    assert.match(output, /export const myValue =/);
  });
  
  it('should include runtime imports when needed', () => {
    const input = `
async function load() {
  const data = await readFile('./data.txt');
  return data;
}
exports.load = load;
`;
    const output = transformCommonJsToEsm(input, { includeRuntime: true });
    
    assert.match(output, /import \{ readFile, writeFile, fileExists, loadSqliteModule \} from '\.\/runtime\.js';/);
  });
  
  it('should handle multiple require statements', () => {
    const input = `
const fs = require('fs');
const path = require('path');
const util = require('util');
`;
    const output = transformCommonJsToEsm(input, { includeRuntime: false });
    
    assert.match(output, /import fs from 'https:\/\/esm\.sh\/fs';/);
    assert.match(output, /import path from 'https:\/\/esm\.sh\/path';/);
    assert.match(output, /import util from 'https:\/\/esm\.sh\/util';/);
  });
  
  it('should convert module.exports = function to default export', () => {
    const input = `module.exports = function myFunc() { return true; }`;
    const output = transformCommonJsToEsm(input, { includeRuntime: false });

    assert.match(output, /export default function myFunc/);
  });

  it('should include runtime import when loadSqliteModule is used', () => {
    const input = `
async function openDb() {
  const sqlite = await loadSqliteModule();
  return sqlite.driver;
}

exports.openDb = openDb;
`;
    const output = transformCommonJsToEsm(input, { includeRuntime: true });

    assert.match(output, /import \{ readFile, writeFile, fileExists, loadSqliteModule \} from '\.\/runtime\.js';/);
    assert.match(output, /export const openDb = openDb;/);
  });
});
