/**
 * Smoke-check a real Supabase project using only the PUBLIC key from .env / .env.local:
 *   1. every table exists (migrations were applied)
 *   2. logged-out (anon) requests are refused by the database
 *
 *   npm run check:supabase
 *
 * Read-only: it never writes anything.
 */
import { existsSync, readFileSync } from 'node:fs'

function loadEnv() {
  const env = {}
  for (const file of ['.env', '.env.local']) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  }
  return { ...env, ...process.env }
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('✗ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set (.env or .env.local).')
  process.exit(1)
}

const TABLES = ['profiles', 'teachers', 'students', 'teacher_students', 'schedules', 'payments', 'payment_history']
const RPCS = ['dashboard_summary', 'generate_monthly_payments', 'set_student_teachers']
let failures = 0
const report = (ok, label, detail) => {
  if (!ok) failures += 1
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`)
}

async function request(path, init = {}) {
  const res = await fetch(`${url}${path}`, { ...init, headers: { apikey: key, 'content-type': 'application/json', ...init.headers } })
  let body = null
  try {
    body = await res.json()
  } catch {
    /* empty body */
  }
  return { status: res.status, code: body?.code, message: body?.message }
}

console.log(`Checking ${new URL(url).host}\n`)

for (const table of TABLES) {
  const r = await request(`/rest/v1/${table}?select=*&limit=1`)
  if (r.code === 'PGRST205') report(false, `table ${table} exists`, 'missing: run the migrations')
  else report(r.code === '42501', `anon cannot read ${table}`, r.code === '42501' ? 'permission denied' : `got HTTP ${r.status} ${r.code ?? ''}`)
}

for (const fn of RPCS) {
  const r = await request(`/rest/v1/rpc/${fn}`, { method: 'POST', body: '{}' })
  if (r.code === 'PGRST202' && /Could not find/.test(r.message ?? '')) {
    // PostgREST may also say "not found" when anon lacks EXECUTE. Distinguish by the hint-less message.
    report(false, `function ${fn} exists or is hidden from anon`, 'not found: run the migrations if this persists')
  } else {
    report(r.code === '42501' || r.status === 401, `anon cannot call ${fn}`, `HTTP ${r.status} ${r.code ?? ''}`)
  }
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
