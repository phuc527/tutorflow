// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest'
import { readStoredTheme, resolveTheme, storeTheme, THEME_STORAGE_KEY } from './theme'

afterEach(() => localStorage.clear())

describe('resolveTheme', () => {
  test('light and dark are used as chosen, whatever the system says', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  test('system follows the operating system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('stored theme', () => {
  test('defaults to system when nothing (or garbage) is stored', () => {
    expect(readStoredTheme()).toBe('system')
    localStorage.setItem(THEME_STORAGE_KEY, 'purple')
    expect(readStoredTheme()).toBe('system')
  })

  test('round-trips a saved choice', () => {
    storeTheme('dark')
    expect(readStoredTheme()).toBe('dark')
  })
})
