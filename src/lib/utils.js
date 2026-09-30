import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge class names; later Tailwind classes override earlier conflicting ones. */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
