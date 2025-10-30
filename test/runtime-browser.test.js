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

test('loadSqliteModule loads sql.js from esm.sh in browser environments', async () => {
  await withBrowserEnvironment(async ({ setImportHook }) => {
    const seen = [];

    setImportHook(async (specifier) => {
      seen.push(specifier);
      if (specifier === 'https://esm.sh/sql.js') {
        return { default: class SqlJsModule {} };
      }
      throw new Error(`Unexpected import: ${specifier}`);
    });

    const { loadSqliteModule } = await import(
      `${RUNTIME_IMPORT}?browser-cdn-${Date.now()}-${Math.random()}`
    );
    const module = await loadSqliteModule();

    assert.equal(seen.length, 1);
    assert.equal(seen[0], 'https://esm.sh/sql.js');
    assert.strictEqual(typeof module, 'function');
  });
});

test('sqliteToJson loads sql.js from esm.sh when given binary data in the browser', async () => {
  await withBrowserEnvironment(async ({ setImportHook }) => {
    const seen = [];

    setImportHook(async (specifier) => {
      seen.push(specifier);
      if (specifier === 'https://esm.sh/sql.js') {
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

        return { Database: FakeDatabase };
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
    assert.deepEqual(seen, ['https://esm.sh/sql.js']);
  });
});
