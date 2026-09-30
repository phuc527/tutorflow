/**
 * Build-time safety checks for Supabase env vars, run by vite.config.js on every dev/build.
 *
 * Every VITE_* variable is inlined into the JavaScript sent to browsers. A service_role / secret key
 * there would let anyone bypass Row Level Security completely, so the build refuses it.
 */

/** Role claim of a legacy Supabase JWT key ('anon' | 'service_role'), or null if not a JWT. */
export function jwtRole(value) {
  const parts = String(value ?? '').split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role ?? null
  } catch {
    return null
  }
}

function looksSecret(value) {
  return String(value ?? '').startsWith('sb_secret_') || jwtRole(value) === 'service_role'
}

/**
 * @param env  object of VITE_* variables
 * @param opts.requireValues  fail if URL / key are missing (production deploys)
 * @returns list of problems (empty = OK)
 */
export function checkSupabaseEnv(env, { requireValues = false } = {}) {
  const problems = []
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith('VITE_') && looksSecret(value)) {
      problems.push(
        `${name} contains a Supabase SECRET/service_role key. VITE_* values are shipped to every browser; ` +
          'use the anon/publishable key instead and rotate the leaked secret key in the Supabase dashboard.',
      )
    }
  }
  if (requireValues) {
    for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
      if (!env[name]) problems.push(`${name} is not set. Add it to the deployment's environment variables.`)
    }
  }
  if (env.VITE_SUPABASE_URL && !/^https:\/\//.test(env.VITE_SUPABASE_URL) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(env.VITE_SUPABASE_URL)) {
    problems.push('VITE_SUPABASE_URL must use https:// (http is only allowed for localhost).')
  }
  return problems
}
