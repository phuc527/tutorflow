import { describe, expect, test } from 'vitest'
import { checkSupabaseEnv, jwtRole } from './env-guard.mjs'

const fakeJwt = (role) => `x.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.y`
const url = 'https://abc.supabase.co'

describe('[SEC-5 / DEP-1] Supabase env guard', () => {
  test('accepts a publishable or anon key', () => {
    expect(checkSupabaseEnv({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: 'sb_publishable_abc' })).toEqual([])
    expect(checkSupabaseEnv({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: fakeJwt('anon') })).toEqual([])
  })

  test('rejects secret and service_role keys in any VITE_ variable', () => {
    expect(jwtRole(fakeJwt('service_role'))).toBe('service_role')
    expect(checkSupabaseEnv({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: 'sb_secret_abc' })).toHaveLength(1)
    expect(checkSupabaseEnv({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: fakeJwt('service_role') })).toHaveLength(1)
    expect(checkSupabaseEnv({ VITE_OTHER: 'sb_secret_abc' })).toHaveLength(1)
  })

  test('requires values only for production deploys', () => {
    expect(checkSupabaseEnv({})).toEqual([])
    expect(checkSupabaseEnv({}, { requireValues: true })).toHaveLength(2)
  })

  test('requires https except for localhost', () => {
    expect(checkSupabaseEnv({ VITE_SUPABASE_URL: 'http://abc.supabase.co' })).toHaveLength(1)
    expect(checkSupabaseEnv({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).toEqual([])
  })
})
