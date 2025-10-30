import test from 'node:test';
import assert from 'node:assert/strict';

const RUNTIME_IMPORT = '../src/runtime.js';

async function withBrowserEnvironment(callback) {
  const previousEnv = globalThis.__COMMONJS2ESM_ENVIRONMENT;
  const previousHook = globalThis.__COMMONJS2ESM_IMPORT_HOOK__;

  globalThis.__COMMONJS2ESM_ENVIRONMENT = 'browser';

  try {
    await callback({
      setImportHook(hook) {
        globalThis.__COMMONJS2ESM_IMPORT_HOOK__ = hook;
      },
    });
  } finally {
    if (previousEnv === undefined) {
      delete globalThis.__COMMONJS2ESM_ENVIRONMENT;
    } else {
      globalThis.__COMMONJS2ESM_ENVIRONMENT = previousEnv;
    }

    if (previousHook === undefined) {
      delete globalThis.__COMMONJS2ESM_IMPORT_HOOK__;
    } else {
      globalThis.__COMMONJS2ESM_IMPORT_HOOK__ = previousHook;
    }
  }
}

test('loadSqliteModule prefers bundled sql.js assets in browser environments', async () => {
  await withBrowserEnvironment(async ({ setImportHook }) => {
    const seen = [];
    let capturedLocateFile;

    setImportHook(async (specifier) => {
      seen.push(specifier);
      if (specifier.endsWith('/sql-wasm.mjs')) {
        class SqlJsModule {}
        return {
          default: async (config = {}) => {
            capturedLocateFile = config.locateFile;
            return { Database: SqlJsModule };
          },
        };
      }
      throw new Error(`Unexpected import: ${specifier}`);
    });

    const { loadSqliteModule } = await import(
      `${RUNTIME_IMPORT}?browser-cdn-${Date.now()}-${Math.random()}`
    );
    const module = await loadSqliteModule();

    assert.equal(seen.length, 1);
    assert.ok(seen[0].endsWith('/sql-wasm.mjs'));
    assert.ok(capturedLocateFile);
    assert.match(capturedLocateFile('sql-wasm.wasm'), /sql-wasm\.wasm$/);
    assert.strictEqual(typeof module.Database, 'function');
  });
});

test('loadSqliteModule falls back to the CDN assets when the bundled files are unavailable', async () => {
  await withBrowserEnvironment(async ({ setImportHook }) => {
    const seen = [];
    let capturedLocateFile;

    setImportHook(async (specifier) => {
      seen.push(specifier);
      if (specifier.endsWith('/sql-wasm.mjs')) {
        throw new Error('Bundled asset missing');
      }
      if (specifier.includes('https://esm.sh/sql.js/dist/sql-wasm.js')) {
        class SqlJsModule {}
        return {
          default: async (config = {}) => {
            capturedLocateFile = config.locateFile;
            return { Database: SqlJsModule };
          },
        };
      }
      throw new Error(`Unexpected import: ${specifier}`);
    });

    const { loadSqliteModule } = await import(
      `${RUNTIME_IMPORT}?browser-cdn-fallback-${Date.now()}-${Math.random()}`
    );
    const module = await loadSqliteModule();

    assert.equal(seen.length, 2);
    assert.ok(seen[0].endsWith('/sql-wasm.mjs'));
    assert.ok(seen[1].includes('https://esm.sh/sql.js/dist/sql-wasm.js'));
    assert.ok(capturedLocateFile);
    assert.match(capturedLocateFile('sql-wasm.wasm'), /https:\/\/esm\.sh\/sql\.js\/dist\/sql-wasm\.wasm/);
    assert.strictEqual(typeof module.Database, 'function');
  });
});

test('sqliteToJson loads sql.js from the resolved assets when given binary data in the browser', async () => {
  await withBrowserEnvironment(async ({ setImportHook }) => {
    const seen = [];

    setImportHook(async (specifier) => {
      seen.push(specifier);
      if (specifier.endsWith('/sql-wasm.mjs')) {
        class FakeDatabase {
          constructor() {
            this.closed = false;
          }

          exec(query) {
            if (query.startsWith("SELECT name FROM sqlite_master")) {
              return [{ columns: ['name'], values: [['logs']] }];
            }
            if (query.startsWith('SELECT * FROM "logs"')) {
              return [
                {
                  columns: ['id', 'message'],
                  values: [[1, 'Boot']],
                },
              ];
            }
            return [];
          }

          close() {
            this.closed = true;
          }
        }

        return {
          default: async () => ({ Database: FakeDatabase }),
        };
      }
      throw new Error(`Unexpected import: ${specifier}`);
    });

    const { sqliteToJson } = await import(
      `${RUNTIME_IMPORT}?browser-sqlite-${Date.now()}-${Math.random()}`
    );

    const json = await sqliteToJson(new Uint8Array([1, 2, 3]));

    assert.deepEqual(json, {
      logs: [
        { id: 1, message: 'Boot' },
      ],
    });
    assert.ok(seen.length >= 1);
    assert.ok(
      seen.some((specifier) =>
        specifier.endsWith('/sql-wasm.mjs') || specifier.includes('https://esm.sh/sql.js/dist/sql-wasm.js'),
      ),
    );
  });
});
