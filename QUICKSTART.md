# Quick Start Guide

## Installation

```bash
npm install commonjs2esm
```

## Basic Usage

### 1. Convert a CommonJS file

```bash
# Convert and generate output file automatically
npx commonjs2esm mymodule.cjs

# Or specify output file
npx commonjs2esm mymodule.cjs mymodule.esm.js
```

### 2. Use in Node.js

```javascript
import { myFunction } from './mymodule.esm.js';

myFunction();
```

### 3. Use in Browser

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <script type="module">
    import { myFunction } from './mymodule.esm.js';
    
    myFunction();
  </script>
</body>
</html>
```

## How Dependencies Work

### External Dependencies (npm packages)

Loaded from esm.sh CDN automatically:

```javascript
// Before (CommonJS)
const lodash = require('lodash');

// After (ESM)
import lodash from 'https://esm.sh/lodash';
```

### Local Dependencies

Converted to relative imports:

```javascript
// Before (CommonJS)
const utils = require('./utils');

// After (ESM)
import utils from './utils';
```

## Cross-Platform Functions

The library provides functions that work in both Node.js and browsers:

```javascript
import { readFile, writeFile, fileExists } from 'commonjs2esm';

// Reads from filesystem (Node.js) or fetches via HTTP (browser)
const data = await readFile('./data.json');

// Only works in Node.js
await writeFile('./output.txt', 'content');

// Works in both environments
const exists = await fileExists('./config.json');
```

## Common Transformations

### Export Patterns

```javascript
// Pattern 1: Named exports with exports.x
exports.myFunc = function() { };
// Becomes:
export const myFunc = function() { };

// Pattern 2: Named exports with module.exports.x
module.exports.myVar = 42;
// Becomes:
export const myVar = 42;

// Pattern 3: Object export
module.exports = { func1, func2 };
// Becomes:
export { func1 };
export { func2 };

// Pattern 4: Default export
module.exports = function() { };
// Becomes:
export default function() { };
```

## Need Help?

- Check the [examples](./examples) folder
- Read the [full README](./README.md)
- Run `npx commonjs2esm --help`
