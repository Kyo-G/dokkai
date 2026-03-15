import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Use kuromoji's pre-built browser UMD bundle instead of the Node.js src,
      // which references `fs` and fails in browser environments.
      kuromoji: path.resolve(__dirname, 'node_modules/kuromoji/build/kuromoji.js'),
    },
  },
  optimizeDeps: {
    include: ['kuromoji'],
  },
})
