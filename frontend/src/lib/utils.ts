import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge only knows the default font sizes. Register the custom
 * `--text-*` sizes of `src/styles/app.css` so that `text-mini` and the other
 * sizes are not read as text colors (which removes `text-primary-foreground`).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['micro', 'mini', 'ui', 'title'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
