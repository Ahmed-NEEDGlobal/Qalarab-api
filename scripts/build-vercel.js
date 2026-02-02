import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

async function build() {
  try {
    await esbuild.build({
      entryPoints: [resolve(projectRoot, 'src/vercel/index.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: resolve(projectRoot, 'api/index.js'),
      external: [
        // Keep native modules external
        'argon2',
        'sharp',
        // Node built-ins that might be referenced
        'fs',
        'path',
        'crypto',
        'http',
        'https',
        'net',
        'tls',
        'stream',
        'zlib',
        'util',
        'os',
        'events',
        'buffer',
        'url',
        'querystring',
        'child_process',
        'worker_threads',
        'cluster',
        'dns',
        'async_hooks',
        'perf_hooks',
        'v8',
        'vm',
        'tty',
        'readline',
      ],
      banner: {
        js: '// Bundled for Vercel serverless function\n',
      },
      sourcemap: false,
      minify: false,
      // Handle path aliases
      alias: {
        '@': resolve(projectRoot, 'src'),
      },
    });

    console.log('Build completed successfully for Vercel');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
