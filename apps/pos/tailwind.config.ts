import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:    '#080D1A',
          navy:    '#0F1A35',
          teal:    '#06B6D4',
          amber:   '#F0ABFC',
          blue:    '#8B5CF6',
          surface: '#F0F9FF',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
