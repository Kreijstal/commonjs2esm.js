/**
 * Runtime helpers for cross-platform compatibility
 * Works in both Node.js and browser environments
 */

// Detect environment, allowing tests or consumers to override the detection
const environmentOverride = globalThis.__COMMONJS2ESM_ENVIRONMENT;

const isNode = environmentOverride === 'node'
  ? true
  : environmentOverride === 'browser'
    ? false
    : typeof process !== 'undefined' &&
      process.versions != null &&
      process.versions.node != null;

const isBrowser = environmentOverride === 'browser'
  ? true
  : environmentOverride === 'node'
    ? false
    : typeof window !== 'undefined' &&
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

/**
 * Load the appropriate SQLite implementation depending on the environment.
 * - In Node.js it uses the native `sqlite3` bindings.
 * - In the browser it uses the WebAssembly powered `sql.js` package.
 *
 * Optional overrides are provided mainly for testing or advanced consumers
 * that want to provide their own loaders without touching globals.
 *
 * @param {Object} [options]
 * @param {() => Promise<any>} [options.nodeLoader] - Custom loader for Node.js.
 * @param {() => Promise<any>} [options.browserLoader] - Custom loader for browsers.
 * @returns {Promise<any>} The loaded SQLite module for the current environment.
 */
export async function loadSqliteModule(options = {}) {
  const { nodeLoader, browserLoader } = options;

  if (isNode) {
    if (typeof nodeLoader === 'function') {
      return await nodeLoader();
    }
    const module = await import('sqlite3');
    return module?.default ?? module;
  }

  if (isBrowser) {
    if (typeof browserLoader === 'function') {
      return await browserLoader();
    }
    const module = await import('sql.js');
    return module?.default ?? module;
  }

  throw new Error('Unsupported environment for loadSqliteModule');
}

export { isNode, isBrowser };
