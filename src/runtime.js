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

const runtimeUrl = typeof import.meta !== 'undefined' && import.meta.url ? import.meta.url : undefined;

let runtimeDirectoryUrl;
try {
  runtimeDirectoryUrl = runtimeUrl ? new URL('.', runtimeUrl).href : undefined;
} catch {
  runtimeDirectoryUrl = undefined;
}

const localSqlJsModuleUrl = (() => {
  if (!runtimeDirectoryUrl) {
    return undefined;
  }
  try {
    return new URL('sql-wasm.mjs', runtimeDirectoryUrl).href;
  } catch {
    return undefined;
  }
})();

const localSqlJsAssetsBaseUrl = (() => {
  if (!localSqlJsModuleUrl) {
    return undefined;
  }
  try {
    return new URL('.', localSqlJsModuleUrl).href;
  } catch {
    return undefined;
  }
})();

const sqlJsVersion = '1.10.3';
const cdnSqlJsBaseUrl = `https://esm.sh/sql.js@${sqlJsVersion}/dist/`;
const cdnSqlJsModuleUrl = `${cdnSqlJsBaseUrl}sql-wasm.js?target=es2022&deno`;

let cachedSqlJsSourcePromise;

async function dynamicImport(specifier) {
  const hook = globalThis.__COMMONJS2ESM_IMPORT_HOOK__;
  if (typeof hook === 'function') {
    return await hook(specifier);
  }
  return import(specifier);
}

const SQL_JS_BLOCKED_GLOBALS = ['process', 'require'];

async function withSqlJsCompatibleGlobals(callback) {
  const snapshots = SQL_JS_BLOCKED_GLOBALS.map((key) => ({
    key,
    descriptor: Object.getOwnPropertyDescriptor(globalThis, key),
    existed: key in globalThis,
    value: globalThis[key],
  }));

  try {
    for (const snapshot of snapshots) {
      const { key, descriptor, existed } = snapshot;

      if (descriptor) {
        const { configurable, writable, set } = descriptor;
        const canRedefine = configurable || writable || typeof set === 'function';
        if (canRedefine) {
          try {
            Object.defineProperty(globalThis, key, {
              configurable: true,
              writable: true,
              value: undefined,
            });
            continue;
          } catch {
            // fall through to assignment/delete handling below
          }
        }
      }

      if (existed) {
        try {
          globalThis[key] = undefined;
        } catch {
          try {
            // Some environments expose read-only shims. Best effort removal.
            delete globalThis[key];
          } catch {
            // Ignore – the sql.js loader will have to tolerate the existing value.
          }
        }
      }
    }

    return await callback();
  } finally {
    for (const snapshot of snapshots.reverse()) {
      const { key, descriptor, existed, value } = snapshot;

      if (!existed) {
        delete globalThis[key];
        continue;
      }

      if (descriptor) {
        try {
          Object.defineProperty(globalThis, key, descriptor);
          continue;
        } catch {
          // If redefining fails fall back to simple assignment below.
        }
      }

      try {
        globalThis[key] = value;
      } catch {
        // Ignore failures restoring – there's little we can do if reassignment is blocked.
      }
    }
  }
}

async function importSqlJsModule(specifier) {
  return await withSqlJsCompatibleGlobals(() => dynamicImport(specifier));
}

/**
 * Read a file from the filesystem (Node.js) or fetch from network (browser)
 * @param {string} filepath - Path to the file
 * @returns {Promise<string>} File contents
 */
export async function readFile(filepath) {
  if (isNode) {
    // In Node.js, read from filesystem
    const fs = await dynamicImport('fs/promises');
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
    const fs = await dynamicImport('fs/promises');
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
    const fs = await dynamicImport('fs/promises');
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
    const module = await dynamicImport('sqlite3');
    return module?.default ?? module;
  }

  if (isBrowser) {
    if (typeof browserLoader === 'function') {
      return await browserLoader();
    }
    return await loadSqlJsInstance(options);
  }

  throw new Error('Unsupported environment for loadSqliteModule');
}

function isSqlJsDatabase(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.exec === 'function' &&
    typeof value.export === 'function'
  );
}

function normalizeSqliteInput(source) {
  if (source instanceof Uint8Array) {
    return source;
  }

  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }

  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(
      source.buffer,
      source.byteOffset,
      source.byteLength,
    );
  }

  return null;
}

async function resolveSqlJsSource() {
  if (!cachedSqlJsSourcePromise) {
    cachedSqlJsSourcePromise = (async () => {
      let lastError;

      if (localSqlJsModuleUrl) {
        try {
          const imported = await importSqlJsModule(localSqlJsModuleUrl);
          const initSqlJs = imported?.default ?? imported;
          if (typeof initSqlJs !== 'function') {
            throw new Error('Local sql.js module does not export an initializer function');
          }
          return {
            initSqlJs,
            assetBaseUrl: localSqlJsAssetsBaseUrl,
            source: 'local',
          };
        } catch (error) {
          const normalized = error instanceof Error ? error : new Error(String(error));
          normalized.message = `Failed to load bundled sql.js assets: ${normalized.message}`;
          lastError = normalized;
        }
      }

      try {
        const imported = await importSqlJsModule(cdnSqlJsModuleUrl);
        const initSqlJs = imported?.default ?? imported;
        if (typeof initSqlJs !== 'function') {
          throw new Error('CDN sql.js module does not export an initializer function');
        }
        return {
          initSqlJs,
          assetBaseUrl: cdnSqlJsBaseUrl,
          source: 'cdn',
        };
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        if (lastError) {
          normalized.message = `${normalized.message} (after ${lastError.message})`;
        }
        throw normalized;
      }
    })();
  }

  const result = await cachedSqlJsSourcePromise;
  if (!result || typeof result.initSqlJs !== 'function') {
    throw new Error('Unable to resolve a sql.js initializer');
  }
  return result;
}

async function loadSqlJsInstance(options = {}) {
  const { locateFile, moduleLoader } = options;

  let resolvedSource;
  let effectiveLocateFile = typeof locateFile === 'function' ? locateFile : undefined;

  if (!effectiveLocateFile && isBrowser) {
    try {
      resolvedSource = await resolveSqlJsSource();
      if (resolvedSource.assetBaseUrl) {
        effectiveLocateFile = (file) => new URL(file, resolvedSource.assetBaseUrl).href;
      }
    } catch (error) {
      if (typeof moduleLoader !== 'function') {
        throw error;
      }
    }
  }

  const loaderConfig = effectiveLocateFile ? { locateFile: effectiveLocateFile } : undefined;

  if (typeof moduleLoader === 'function') {
    const customModule = await moduleLoader(loaderConfig);
    if (customModule && typeof customModule.Database === 'function') {
      return customModule;
    }
    if (typeof customModule === 'function') {
      return await customModule(loaderConfig ?? {});
    }
    return customModule;
  }

  if (isBrowser) {
    try {
      const source = resolvedSource ?? await resolveSqlJsSource();
      const config = loaderConfig ?? {};
      return await source.initSqlJs(config);
    } catch (error) {
      const message = 'Unable to load sql.js for browser usage. Ensure sql-wasm assets are available locally or accessible via https://esm.sh/sql.js/dist/.';
      if (error instanceof Error) {
        error.message = `${message} ${error.message}`;
        throw error;
      }
      throw new Error(message);
    }
  }

  const imported = await dynamicImport('sql.js');
  const initSqlJs = imported.default ?? imported;
  if (initSqlJs && typeof initSqlJs.Database === 'function') {
    return initSqlJs;
  }
  if (typeof initSqlJs === 'function') {
    const config = loaderConfig ?? {};
    return await initSqlJs(config);
  }
  throw new Error('Unable to load sql.js module');
}

function execToObjects(result) {
  if (!result || result.length === 0) {
    return [];
  }

  const { columns, values } = result[0];
  return values.map((row) => {
    const entry = {};
    for (let i = 0; i < columns.length; i += 1) {
      entry[columns[i]] = row[i];
    }
    return entry;
  });
}

function sanitizeTableName(name) {
  return name.replace(/"/g, '""');
}

async function fetchTableNames(database, tables) {
  const query =
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";
  const result = database.exec(query);
  const available = new Set(execToObjects(result).map((row) => row.name));

  if (Array.isArray(tables) && tables.length > 0) {
    const uniqueRequested = Array.from(new Set(tables));
    return uniqueRequested.filter((name) => available.has(name));
  }

  return Array.from(available);
}

/**
 * Convert a SQLite database into a JSON representation.
 *
 * The function accepts either a path to a SQLite database (Node.js only),
 * or a binary representation of the database such as an ArrayBuffer or
 * Uint8Array. It uses sql.js under the hood, loading the WebAssembly file
 * either from a provided `locateFile` hook, the package-local wasm in Node.js,
 * or the `sql-wasm.mjs`/`sql-wasm.wasm` assets that ship with the browser
 * bundle.
 *
 * @param {string|Uint8Array|ArrayBuffer} source - The SQLite database source.
 * @param {Object} [options]
 * @param {string[]} [options.tables] - Optional list of tables to extract.
 * @param {(() => Promise<any>) | ((config: { locateFile?: (file: string) => string }) => Promise<any>)} [options.moduleLoader]
 *   Custom loader. Can return a resolved sql.js module or the `initSqlJs` initializer.
 * @param {(file: string) => string} [options.locateFile] - Custom locateFile hook passed to sql.js.
 * @returns {Promise<Record<string, any[]>>} A JSON object keyed by table name.
 */
export async function sqliteToJson(source, options = {}) {
  const { tables, moduleLoader, locateFile } = options;

  if (typeof source === 'string') {
    if (isNode) {
      const fs = await dynamicImport('fs/promises');
      const fileData = await fs.readFile(source);
      return sqliteToJson(new Uint8Array(fileData), options);
    }

    if (typeof fetch === 'function') {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to fetch SQLite database from ${source}: ${response.status} ${response.statusText}`);
      }
      const fileData = await response.arrayBuffer();
      return sqliteToJson(new Uint8Array(fileData), options);
    }

    throw new Error('Reading SQLite files by path requires filesystem access (Node.js) or fetch support (browsers).');
  }

  if (isSqlJsDatabase(source)) {
    const tableNames = await fetchTableNames(source, tables);
    const output = {};
    for (const table of tableNames) {
      const rows = source.exec(`SELECT * FROM "${sanitizeTableName(table)}";`);
      output[table] = execToObjects(rows);
    }
    return output;
  }

  const normalized = normalizeSqliteInput(source);
  if (!normalized) {
    throw new TypeError('Unsupported SQLite input. Expected path, ArrayBuffer, Uint8Array, or sql.js Database instance.');
  }

  const sqlModule = await loadSqlJsInstance({ locateFile, moduleLoader });
  if (!sqlModule || typeof sqlModule.Database !== 'function') {
    throw new Error('sql.js module does not expose a Database constructor');
  }

  const database = new sqlModule.Database(normalized);
  try {
    const tableNames = await fetchTableNames(database, tables);
    const output = {};
    for (const table of tableNames) {
      const rows = database.exec(`SELECT * FROM "${sanitizeTableName(table)}";`);
      output[table] = execToObjects(rows);
    }
    return output;
  } finally {
    if (typeof database.close === 'function') {
      database.close();
    }
  }
}

export { isNode, isBrowser };
