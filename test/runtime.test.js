/**
 * Tests for runtime helpers
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFile, writeFile, fileExists, isNode } from '../src/runtime.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('runtime helpers', () => {
  it('should detect Node.js environment', () => {
    assert.strictEqual(isNode, true);
  });
  
  describe('readFile', () => {
    it('should read a file in Node.js', async () => {
      const content = await readFile('package.json');
      assert.ok(content.includes('commonjs2esm'));
    });
  });
  
  describe('writeFile and fileExists', () => {
    it('should write and check file existence', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'test-'));
      const testFile = join(testDir, 'test.txt');
      
      try {
        // File should not exist initially
        assert.strictEqual(await fileExists(testFile), false);
        
        // Write file
        await writeFile(testFile, 'test content');
        
        // File should exist now
        assert.strictEqual(await fileExists(testFile), true);
        
        // Read back the content
        const content = await readFile(testFile);
        assert.strictEqual(content, 'test content');
      } finally {
        // Cleanup
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });
});
