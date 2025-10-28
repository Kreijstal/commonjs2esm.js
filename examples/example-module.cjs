// Example CommonJS module that uses external dependencies
const path = require('path');
const fs = require('fs');

// Example function that reads a file
async function loadConfig(filename) {
  const content = await readFile(filename);
  return JSON.parse(content);
}

// Example function with external dependency
function joinPaths(a, b) {
  return path.join(a, b);
}

// Export functions
module.exports = {
  loadConfig,
  joinPaths
};
