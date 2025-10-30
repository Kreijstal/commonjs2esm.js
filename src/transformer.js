/**
 * Convert CommonJS module to ESM module
 * Does NOT bundle dependencies - uses esm.js to load them
 */

/**
 * Transform CommonJS code to ESM
 * @param {string} code - CommonJS source code
 * @param {Object} options - Transformation options
 * @param {string} options.filename - Name of the file being transformed
 * @param {boolean} options.includeRuntime - Whether to include runtime helpers
 * @returns {string} ESM code
 */
export function transformCommonJsToEsm(code, options = {}) {
  const { filename = 'module.js', includeRuntime = true } = options;
  
  let result = code;
  
  // Track imports that need to be added
  const imports = new Set();
  const namedImports = new Map(); // module -> Set of named imports
  
  // 1. Convert require() calls to import statements
  // Handle: const x = require('module')
  result = result.replace(
    /(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\);?\n?/g,
    (match, varName, modulePath) => {
      if (modulePath.startsWith('.')) {
        // Local module - convert to ESM import
        imports.add(`import ${varName} from '${modulePath}';`);
      } else {
        // External module - use esm.js CDN
        const esmPath = `https://esm.sh/${modulePath}`;
        imports.add(`import ${varName} from '${esmPath}';`);
      }
      return ''; // Remove the original require statement
    }
  );
  
  // Handle: const { x, y } = require('module')
  result = result.replace(
    /(?:const|let|var)\s+\{\s*([^}]+)\s*\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\);?\n?/g,
    (match, names, modulePath) => {
      const importNames = names.split(',').map(n => n.trim()).join(', ');
      if (modulePath.startsWith('.')) {
        imports.add(`import { ${importNames} } from '${modulePath}';`);
      } else {
        const esmPath = `https://esm.sh/${modulePath}`;
        imports.add(`import { ${importNames} } from '${esmPath}';`);
      }
      return '';
    }
  );
  
  // 2. Convert module.exports to export statements
  // Handle: module.exports = { ... }
  result = result.replace(
    /module\.exports\s*=\s*\{([^}]*)\}/g,
    (match, content) => {
      // Parse the object properties
      const exports = content
        .split(',')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => {
          const parts = line.split(':').map(p => p.trim());
          if (parts.length === 1) {
            // Shorthand property
            return `export { ${parts[0]} };`;
          } else {
            // Named property
            return `export { ${parts[1]} as ${parts[0]} };`;
          }
        });
      return exports.join('\n');
    }
  );
  
  // Handle: module.exports.something = value
  result = result.replace(
    /module\.exports\.(\w+)\s*=\s*/g,
    'export const $1 = '
  );
  
  // Handle: exports.something = value
  result = result.replace(
    /exports\.(\w+)\s*=\s*/g,
    'export const $1 = '
  );
  
  // Handle: module.exports = function/class
  result = result.replace(
    /module\.exports\s*=\s*(function|class)\s+(\w+)/g,
    'export default $1 $2'
  );
  
  // Handle: module.exports = something (default export)
  result = result.replace(
    /module\.exports\s*=\s*([^;]+);?$/gm,
    'export default $1;'
  );
  
  // 3. Add runtime imports if needed
  if (includeRuntime && /\b(readFile|writeFile|fileExists|loadSqliteModule)\b/.test(code)) {
    imports.add("import { readFile, writeFile, fileExists, loadSqliteModule } from './runtime.js';");
  }
  
  // 4. Combine imports with the transformed code
  const importStatements = Array.from(imports).join('\n');
  result = importStatements + (importStatements ? '\n\n' : '') + result;
  
  return result;
}

/**
 * Transform a CommonJS file to ESM
 * @param {string} inputPath - Path to input CommonJS file
 * @param {string} outputPath - Path to output ESM file
 * @param {Object} options - Transformation options
 */
export async function transformFile(inputPath, outputPath, options = {}) {
  const { readFile, writeFile } = await import('./runtime.js');
  
  const code = await readFile(inputPath);
  const transformed = transformCommonJsToEsm(code, {
    filename: inputPath,
    ...options
  });
  
  await writeFile(outputPath, transformed);
  return transformed;
}

export default { transformCommonJsToEsm, transformFile };
