export const driver = 'sql.js';

export default {
  driver,
  async createConnection(options = {}) {
    return { driver, ...options };
  },
};
