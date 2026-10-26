import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function threeImportMapPlugin(): Plugin {
  return {
    name: 'three-importmap',
    resolveId(id: string) {
      if (id === 'three') {
        return {
          id: 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js',
          external: true,
        };
      }
      if (id.startsWith('three/addons/')) {
        return {
          id: id.replace(
            'three/addons/',
            'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/',
          ),
          external: true,
        };
      }
      return null;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html: string) {
        const match = html.match(/<script type="importmap">[\s\S]*?<\/script>/);
        if (!match) return html;
        const cleaned = html.replace(match[0], '');
        return cleaned.replace('<head>', `<head>\n    ${match[0]}`);
      },
    },
  };
}
export default {
  base: '/Creative-design-Portfolio/',
}
export default defineConfig(() => {
  return {
    plugins: [threeImportMapPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
