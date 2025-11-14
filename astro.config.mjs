// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
  image: {
    domains: [],
  },
  vite: {
    server: {
      fs: {
        allow: ['..']
      }
    }
  }
});
