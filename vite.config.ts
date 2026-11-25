import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function normalizeBasePath(raw?: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === '/') return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function resolveProductionBase(): string {
  if (process.env.VITE_BASE_PATH !== undefined && process.env.VITE_BASE_PATH !== '') {
    return normalizeBasePath(process.env.VITE_BASE_PATH);
  }
  const ghRepo = process.env.GITHUB_REPOSITORY;
  if (ghRepo && ghRepo.includes('/')) {
    const repoName = ghRepo.split('/')[1];
    if (repoName) return normalizeBasePath(repoName);
  }
  return '/Game-X-Africa-Elnino-Challenge-2027/';
}

export default defineConfig(({ command }) => {
  return {
    base: command === 'build' ? resolveProductionBase() : '/',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 2500,
    },
    plugins: [
      react(),
      tailwindcss(),
      // Ensures static GitHub Pages builds have .nojekyll, SPA 404 fallback, and unbundled src/assets.
      {
        name: 'github-pages-static-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          if (!fs.existsSync(distDir)) return;

          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }

          const indexHtml = path.resolve(distDir, 'index.html');
          const notFoundHtml = path.resolve(distDir, '404.html');
          if (fs.existsSync(indexHtml)) {
            fs.copyFileSync(indexHtml, notFoundHtml);
          }

          const nojekyllPath = path.resolve(distDir, '.nojekyll');
          if (!fs.existsSync(nojekyllPath)) {
            fs.writeFileSync(nojekyllPath, '');
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
