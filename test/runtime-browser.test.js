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

test('loadSqliteModule hides Node-like globals while importing bundled sql.js assets', async () => {
  await withBrowserEnvironment(async ({ setImportHook }) => {
    const seen = [];
    const observedGlobals = [];

    setImportHook(async (specifier) => {
      seen.push(specifier);
      if (specifier.endsWith('/sql-wasm.mjs')) {
        observedGlobals.push({
          processType: typeof globalThis.process,
          requireType: typeof globalThis.require,
        });
        class SqlJsModule {}
        return {
          default: async () => ({ Database: SqlJsModule }),
        };
      }
      throw new Error(`Unexpected import: ${specifier}`);
    });

    const originalProcess = globalThis.process;
    const originalRequire = globalThis.require;

    if (typeof originalRequire === 'undefined') {
      globalThis.require = () => {
        throw new Error('require should not be used during browser sql.js loading');
      };
    }

    try {
      const { loadSqliteModule } = await import(
        `${RUNTIME_IMPORT}?browser-node-shim-${Date.now()}-${Math.random()}`,
      );
      const module = await loadSqliteModule();

      assert.equal(seen.length, 1);
      assert.ok(seen[0].endsWith('/sql-wasm.mjs'));
      assert.deepEqual(observedGlobals, [
        { processType: 'undefined', requireType: 'undefined' },
      ]);
      assert.strictEqual(typeof module.Database, 'function');
      assert.strictEqual(globalThis.process, originalProcess);
    } finally {
      if (typeof originalRequire === 'undefined') {
        delete globalThis.require;
      } else {
        globalThis.require = originalRequire;
      }
    }
  });
});

test('loadSqliteModule falls back to the CDN assets when the bundled files are unavailable', async () => {
  await withBrowserEnvironment(async ({ setImportHook }) => {
    const seen = [];
    const fetched = [];
    let capturedLocateFile;

    setImportHook(async (specifier) => {
      seen.push(specifier);
      if (specifier.endsWith('/sql-wasm.mjs')) {
        throw new Error('Bundled asset missing');
      }
      if (specifier.startsWith('data:text/javascript') || specifier.startsWith('blob:')) {
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

    const originalFetch = globalThis.fetch;
    const moduleSource = [
      'module.exports = async function initSqlJs(config = {}) {',
      '  return { Database: class SqlJsModule {} };',
      '};',
    ].join('\n');

    globalThis.fetch = async (input) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://esm.sh/sql.js@1.10.3/dist/sql-wasm.js?raw') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          async text() {
            return moduleSource;
          },
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    try {
      const { loadSqliteModule } = await import(
        `${RUNTIME_IMPORT}?browser-cdn-fallback-${Date.now()}-${Math.random()}`,
      );
      const module = await loadSqliteModule();

      assert.equal(seen.length, 2);
      assert.ok(seen[0].endsWith('/sql-wasm.mjs'));
      assert.ok(
        seen[1].startsWith('data:text/javascript') || seen[1].startsWith('blob:'),
      );
      assert.ok(capturedLocateFile);
      assert.match(
        capturedLocateFile('sql-wasm.wasm'),
        /https:\/\/esm\.sh\/sql\.js@1\.10\.3\/dist\/sql-wasm\.wasm/,
      );
      assert.strictEqual(typeof module.Database, 'function');
      assert.deepEqual(fetched, ['https://esm.sh/sql.js@1.10.3/dist/sql-wasm.js?raw']);
    } finally {
      if (originalFetch === undefined) {
        delete globalThis.fetch;
      } else {
        globalThis.fetch = originalFetch;
      }
    }
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
        specifier.endsWith('/sql-wasm.mjs') ||
        specifier.startsWith('data:text/javascript') ||
        specifier.startsWith('blob:'),
      ),
    );
  });
});
