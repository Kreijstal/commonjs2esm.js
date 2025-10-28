/**
 * Runtime helpers for cross-platform compatibility
 * Works in both Node.js and browser environments
 */

// Detect environment
const isNode = typeof process !== 'undefined' && 
               process.versions != null && 
               process.versions.node != null;

const isBrowser = typeof window !== 'undefined' && 
                  typeof window.document !== 'undefined';

/**
 * Read a file from the filesystem (Node.js) or fetch from network (browser)
 * @param {string} filepath - Path to the file
 * @returns {Promise<string>} File contents
 */
export async function readFile(filepath) {
  if (isNode) {
    // In Node.js, read from filesystem
    const fs = await import('fs/promises');
    return await fs.readFile(filepath, 'utf-8');
  } else if (isBrowser) {
    // In browser, fetch from network
    const response = await fetch(filepath);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${filepath}: ${response.statusText}`);
    }
    return await response.text();
  } else {
    throw new Error('Unsupported environment');
  }
}

/**
 * Write a file to the filesystem (Node.js only)
 * @param {string} filepath - Path to the file
 * @param {string} content - Content to write
 */
export async function writeFile(filepath, content) {
  if (isNode) {
    const fs = await import('fs/promises');
    await fs.writeFile(filepath, content, 'utf-8');
  } else {
    throw new Error('writeFile is only supported in Node.js environment');
  }
}

/**
 * Check if a file exists
 * @param {string} filepath - Path to the file
 * @returns {Promise<boolean>}
 */
export async function fileExists(filepath) {
  if (isNode) {
    const fs = await import('fs/promises');
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  } else if (isBrowser) {
    try {
      const response = await fetch(filepath, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
  return false;
}

export { isNode, isBrowser };
