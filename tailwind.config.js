/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Map to CSS variables for dynamic theme support
        page: 'rgb(var(--bg-page))',
        card: 'rgb(var(--bg-card))',
        elevated: 'rgb(var(--bg-elevated))',
        primary: {
          DEFAULT: 'rgb(var(--primary))',
          hover: 'rgb(var(--primary-hover))',
        },
        accent: 'rgb(var(--accent))',
        success: 'rgb(var(--success))',
        warning: 'rgb(var(--warning))',
        danger: 'rgb(var(--danger))',
        border: {
          DEFAULT: 'rgb(var(--border))',
          subtle: 'rgb(var(--border-subtle))',
        },
        text: {
          primary: 'rgb(var(--text-primary))',
          secondary: 'rgb(var(--text-secondary))',
          muted: 'rgb(var(--text-muted))',
        }
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease forwards',
        'scale-in': 'scaleIn 150ms ease forwards',
        'slide-up': 'slideUp 250ms ease forwards',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
};