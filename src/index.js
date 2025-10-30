/**
 * Main entry point for commonjs2esm
 */

export { transformCommonJsToEsm, transformFile } from './transformer.js';
export {
  readFile,
  writeFile,
  fileExists,
  isNode,
  isBrowser,
  loadSqliteModule,
  sqliteToJson,
} from './runtime.js';

export default {
  transformCommonJsToEsm: (await import('./transformer.js')).transformCommonJsToEsm,
  transformFile: (await import('./transformer.js')).transformFile,
  readFile: (await import('./runtime.js')).readFile,
  writeFile: (await import('./runtime.js')).writeFile,
  fileExists: (await import('./runtime.js')).fileExists,
  isNode: (await import('./runtime.js')).isNode,
  isBrowser: (await import('./runtime.js')).isBrowser,
  loadSqliteModule: (await import('./runtime.js')).loadSqliteModule,
  sqliteToJson: (await import('./runtime.js')).sqliteToJson,
};
