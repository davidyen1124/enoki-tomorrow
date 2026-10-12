import { defineConfig } from 'vite';
// Relative base so the same build works at a domain root or under a sub-path
// such as GitHub Pages' https://<user>.github.io/<repo>/.
export default defineConfig({ base: './', server: { port: 5199, strictPort: true }, preview: { port: 5199, strictPort: true } });
