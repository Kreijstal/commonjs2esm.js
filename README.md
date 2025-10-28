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

## Testing

```bash
npm test
```

## License

MIT
