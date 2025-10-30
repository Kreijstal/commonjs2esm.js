# commonjs2esm.js

A tool for converting CommonJS modules to ESM (ECMAScript Modules) for browser use with minimal bundling. Instead of vendoring dependencies, it uses [esm.sh](https://esm.sh) to load external packages, making your code lighter and easier to maintain.

## Features

- 🔄 **Convert CommonJS to ESM**: Automatically transforms `require()` to `import` statements
- 🌐 **Browser Compatible**: Generated code works in both Node.js and browsers
- 📦 **No Bundling**: Uses esm.sh CDN for dependencies instead of bundling them
- 🛠️ **Runtime Helpers**: Provides cross-platform utilities like `readFile()` that work in both environments
- ⚡ **Minimal Changes**: Preserves your original code structure as much as possible

## Installation

```bash
npm install -g commonjs2esm
```

Or use it locally in your project:

```bash
npm install --save-dev commonjs2esm
```

## Usage

### Command Line

Convert a CommonJS file to ESM:

```bash
commonjs2esm input.cjs output.esm.js
```

If you don't specify an output file, it will automatically generate one:

```bash
commonjs2esm mymodule.cjs
# Creates: mymodule.esm.js
```

#### Create a sample SQLite database fixture

Generate the `logs.db` fixture that our Playwright tests consume (or supply
your own file name):

```bash
commonjs2esm-create-db
# or specify a custom name
commonjs2esm-create-db my-fixture.db
```

The command writes the database to the current working directory and populates
it with a `logs` table containing a few sample rows.

### Programmatic API

```javascript
import { transformCommonJsToEsm, transformFile } from 'commonjs2esm';

// Transform code directly
const esmCode = transformCommonJsToEsm(`
  const fs = require('fs');
  exports.myFunc = () => 'hello';
`);

// Transform a file
await transformFile('input.cjs', 'output.esm.js');
```

## How It Works

### Dependency Resolution

- **External modules** (e.g., `require('lodash')`) → Converted to use esm.sh CDN
- **Local modules** (e.g., `require('./utils')`) → Converted to relative ESM imports

### Transformations

**Input (CommonJS):**
```javascript
const path = require('path');
const { readFile } = require('fs/promises');
const utils = require('./utils');

function loadConfig(filename) {
  // ...
}

exports.loadConfig = loadConfig;
```

**Output (ESM):**
```javascript
import path from 'https://esm.sh/path';
import { readFile } from 'https://esm.sh/fs/promises';
import utils from './utils';

function loadConfig(filename) {
  // ...
}

export const loadConfig = loadConfig;
```

## Runtime Helpers

The library provides cross-platform utilities that work in both Node.js and browsers:

### `readFile(filepath)`

Reads a file from the filesystem (Node.js) or fetches from network (browser):

```javascript
import { readFile } from 'commonjs2esm';

// In Node.js: reads from filesystem
// In browser: fetches via HTTP
const content = await readFile('./data.txt');
```

### `writeFile(filepath, content)`

Writes a file (Node.js only):

```javascript
import { writeFile } from 'commonjs2esm';

await writeFile('./output.txt', 'content');
```

### `fileExists(filepath)`

Checks if a file exists:

```javascript
import { fileExists } from 'commonjs2esm';

const exists = await fileExists('./config.json');
```

### `loadSqliteModule(options)`

Loads the correct SQLite implementation for the current environment:

```javascript
import { loadSqliteModule } from 'commonjs2esm';

const sqlite = await loadSqliteModule();
if (sqlite.driver === 'node-sqlite3') {
  // Running in Node.js
} else {
  // Running in the browser with sql.js
}
```

By default Node.js uses the native `sqlite3` bindings while the browser loads
the WebAssembly-powered `sql.js` package. You can pass custom loader functions
through `options.nodeLoader` or `options.browserLoader` if you need to supply
your own adapters.

### `sqliteToJson(source, options)`

Converts a SQLite database into a JSON object keyed by table name. It works in
both Node.js and browsers by leveraging the `sql.js` WebAssembly build behind
the scenes.

```javascript
import { sqliteToJson } from 'commonjs2esm';

// From a file path (Node.js reads from disk, browsers fetch the URL)
const jsonFromFile = await sqliteToJson('./data.db');

// From a Uint8Array or ArrayBuffer (Node.js and browsers)
const response = await fetch('/data.db');
const arrayBuffer = await response.arrayBuffer();
const jsonFromBuffer = await sqliteToJson(arrayBuffer);

console.log(jsonFromBuffer.users);
```

You can limit the exported tables by providing `options.tables` (an array of
table names) and customise the WebAssembly loader through
`options.locateFile` or `options.moduleLoader` if you need to control where the
`sql-wasm.wasm` asset is served from. In Node.js the default loader resolves
the wasm bundled with the installed `sql.js` package, while browsers fall back
to the version-pinned CDN at `https://esm.sh/sql.js@1.10.3/dist/` (loading the
module via `sql-wasm.js?target=es2022&deno`) unless you override the location.

### Environment Detection

```javascript
import { isNode, isBrowser } from 'commonjs2esm';

if (isNode) {
  console.log('Running in Node.js');
} else if (isBrowser) {
  console.log('Running in browser');
}
```

## Examples

See the [examples](./examples) directory for sample CommonJS modules and their ESM conversions.

## Use Cases

- **Migrate CommonJS modules** to modern ESM syntax
- **Use Node.js modules in the browser** without complex bundling
- **Create universal modules** that work in both environments
- **Reduce bundle sizes** by using CDN-hosted dependencies

## Browser Usage

After converting your module, you can use it directly in the browser:

```html
<script type="module">
  import { loadConfig } from './mymodule.esm.js';
  
  const config = await loadConfig('./config.json');
  console.log(config);
</script>
```

### Live Browser Demo

Check out the [browser demo](./examples/demo.html) to see the tool in action! The demo shows:
- Cross-platform file reading (filesystem in Node.js, HTTP fetch in browser)
- Environment detection
- Working with ESM modules in the browser

![Browser Demo](https://github.com/user-attachments/assets/14491b2e-8fc7-4f07-b657-864ca3863197)

### Generate a browser-friendly `commonjs2esm.js`

If you want to exercise the library directly in the browser (for example via
`import("./commonjs2esm.js")`), use the helper CLI to materialise the entry
module and its runtime dependencies in your current working directory:

```bash
# Install dependencies if you haven't already
npm install

# Generate commonjs2esm.js, runtime.js and transformer.js beside one another
npx commonjs2esm-build-browser
# Or, if you prefer an npm script
npm run build:browser
```

The command writes the browser-ready `commonjs2esm.js` together with the
companion `runtime.js`, `transformer.js`, `sql-wasm.mjs`, and `sql-wasm.wasm`
files. Make sure the entire set is served so the module graph resolves and the
SQLite WebAssembly binary can be fetched correctly in the browser. If you omit
the wasm assets the runtime will automatically fall back to
`https://esm.sh/sql.js@1.10.3/dist/sql-wasm.wasm`.

### Serve the project locally for manual browser testing

With the browser bundle generated, start a static HTTP server from the
directory that now contains `commonjs2esm.js`, `runtime.js` and
`transformer.js`. Any simple server works; for example, using Node's
`http-server` utility from the project root after running the generator:

```bash
npx http-server .
```

Then open [`http://localhost:8080`](http://localhost:8080) in your browser and
load a page that performs `import("./commonjs2esm.js")` to verify the runtime
behaves as expected. The runtime consumes the generated `sql-wasm.mjs` wrapper
and `sql-wasm.wasm` binary that live beside `runtime.js`; if they are not
served, it will transparently fetch `sql.js` via
`https://esm.sh/sql.js@1.10.3/dist/sql-wasm.js?target=es2022&deno` and download
the accompanying wasm from the same CDN.

## Testing

```bash
npm test
```

## License

MIT
