# CommonJS to ESM Conversion Example

This example demonstrates the full workflow of converting a CommonJS module to ESM.

## Step 1: Start with a CommonJS module

See `example-module.cjs`:
- Uses `require()` for dependencies
- Uses `module.exports` for exports
- Works in Node.js

## Step 2: Convert to ESM

Run the converter:
```bash
node ../bin/cli.js example-module.cjs
```

This generates `example-module.esm.js`:
- Converts `require()` to `import` statements
- External dependencies use esm.sh CDN
- Local dependencies use relative imports
- Converts exports to ESM syntax

## Step 3: Use in Browser

The converted module can now be used in the browser:

```html
<script type="module">
  import { loadConfig, joinPaths } from './example-module.esm.js';
  
  // The module works in the browser!
  const config = await loadConfig('./config.json');
  console.log(config);
</script>
```

## Step 4: Still works in Node.js

The ESM module also works in Node.js:

```javascript
import { loadConfig, joinPaths } from './example-module.esm.js';

const config = await loadConfig('./config.json');
console.log(config);
```

## Key Features

1. **No bundling required**: Dependencies are loaded from esm.sh
2. **Cross-platform**: Same code works in Node.js and browsers
3. **Minimal changes**: Original code structure is preserved
4. **Runtime helpers**: Functions like `readFile()` adapt to the environment
