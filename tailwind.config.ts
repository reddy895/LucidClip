import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        graphite: {
          bg: '#111315',
          sidebar: '#151719',
          surface: '#191C20',
          'surface-card': '#16191D',
          'surface-elevated': '#22262B',
          hover: '#292E34',
          border: '#30363D',
          'border-subtle': '#21262D',
          'text-primary': '#F3F4F6',
          'text-secondary': '#A1A7B0',
          'text-muted': '#747C86',
        },
        accent: {
          DEFAULT: '#8B9CF7',
          hover: '#A3B0FF',
          muted: 'rgba(139, 156, 247, 0.12)',
          border: 'rgba(139, 156, 247, 0.3)',
        },
        status: {
          success: '#55B889',
          'success-bg': 'rgba(85, 184, 137, 0.12)',
          warning: '#E5B567',
          'warning-bg': 'rgba(229, 181, 103, 0.12)',
          error: '#E47777',
          'error-bg': 'rgba(228, 119, 119, 0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'Courier New', 'monospace'],
      },
      borderRadius: {
        btn: '6px',
        input: '8px',
        panel: '10px',
        modal: '12px',
        badge: '5px',
      },
      boxShadow: {
        desktop: '0 4px 16px 0 rgba(0, 0, 0, 0.35)',
        modal: '0 8px 32px 0 rgba(0, 0, 0, 0.55)',
        tooltip: '0 2px 8px 0 rgba(0, 0, 0, 0.4)',
      },
      transitionDuration: {
        micro: '140ms',
        panel: '180ms',
      },
    },
  },
  plugins: [],
} satisfies Config;
