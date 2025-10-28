// Simple CommonJS module with named exports
const util = require('util');

function greet(name) {
  return `Hello, ${name}!`;
}

function formatMessage(msg) {
  return util.format('Message: %s', msg);
}

exports.greet = greet;
exports.formatMessage = formatMessage;
