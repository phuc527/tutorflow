import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { checkSupabaseEnv } from './scripts/env-guard.mjs'

export default defineConfig(({ mode }) => {
  // Refuse to build/serve with a secret key in VITE_* (it would be shipped to browsers), and make
  // deploys fail loudly when the Supabase env vars are missing instead of shipping a broken app.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const problems = checkSupabaseEnv(env, {
    requireValues: mode === 'production' && Boolean(process.env.VERCEL || process.env.REQUIRE_SUPABASE_ENV),
  })
  if (problems.length) throw new Error(`Unsafe or missing Supabase configuration:\n - ${problems.join('\n - ')}`)

  return {
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
      include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.js'],
      setupFiles: ['src/test/setup.js'],
    },
  }
})
