import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  testMatch: /.*\.spec\.js/,
  use: {},
  projects: [
    {
      name: 'node',
    },
  ],
});
