import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')
) as { version: string };

const customLogger = createLogger();
const originalLoggerError = customLogger.error.bind(customLogger);

customLogger.error = (msg, options) => {
  if (
    typeof msg === 'string' &&
    (msg.includes('Port 1420 is already in use') || msg.includes('EADDRINUSE'))
  ) {
    console.error('\n[LucidClip] Port 1420 Conflict Detected:');
    console.error(' Port 1420 is strictly required for the Tauri desktop application window.');
    console.error(' Port shifting is disabled to prevent desktop devUrl desynchronization.');
    console.error(' To safely terminate orphaned processes, run from the repository root:');
    console.error('   npm run dev -- --clean\n');
  }
  originalLoggerError(msg, options);
};

export default defineConfig({
  customLogger,
  plugins: [
    react(),
    {
      name: 'lucidclip-port-guard',
      configureServer(server) {
        server.httpServer?.on('error', (err: any) => {
          if (err && (err.code === 'EADDRINUSE' || String(err).includes('1420'))) {
            console.error('\n[LucidClip] Frontend Dev Server Port Conflict:');
            console.error(' Port 1420 is strictly required by backend/tauri.conf.json.');
            console.error(' An existing development server or process is currently holding port 1420.');
            console.error(' Run `npm run dev -- --clean` from the repository root to resolve automatically.\n');
          }
        });
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: ['es2021', 'chrome105', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
