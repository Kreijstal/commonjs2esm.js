export const driver = 'node-sqlite3';

export default {
  driver,
  createConnection(filename) {
    return { driver, filename };
  },
};
