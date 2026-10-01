import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://trustjonathan.github.io',
  base: '/STUDY-HUB',
  integrations: [react()],
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' }
});