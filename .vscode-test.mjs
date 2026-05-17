import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'test/integration/**/*.test.js',
  workspaceFolder: './test/integration/fixture',
  mocha: {
    timeout: 20000
  }
});
