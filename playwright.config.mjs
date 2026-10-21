// 自動回歸測試設定：使用電腦上已安裝的 Microsoft Edge，不需另外下載瀏覽器
// 執行：npm test（會自動在 5180 埠啟動本機伺服器）
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5180/',
    channel: 'msedge',
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: 'zh-TW',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  webServer: {
    command: 'node tests/serve.mjs 5180',
    url: 'http://localhost:5180/',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
