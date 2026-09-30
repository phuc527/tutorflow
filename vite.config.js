import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  build: {
    rolldownOptions: {
      output: {
        // Separate, rarely-changing vendor chunks: better caching across deploys and parallel downloads.
        // [\\/] matches both path separators.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'ui', test: /node_modules[\\/](radix-ui|@radix-ui|@floating-ui|lucide-react|sonner)[\\/]/ },
            { name: 'forms', test: /node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/ },
            { name: 'data', test: /node_modules[\\/](@tanstack|date-fns|@date-fns)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.js'],
    setupFiles: ['src/test/setup.js'],
  },
})
