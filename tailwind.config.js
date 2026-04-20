/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:   '#0a1628',
          mid:    '#0f2040',
          light:  '#162d54',
        },
        accent: {
          DEFAULT: '#00c896',
          hover:   '#00b085',
          dim:     'rgba(0,200,150,0.12)',
          glow:    'rgba(0,200,150,0.06)',
        },
        canvas: '#ffffff',
        surface: {
          DEFAULT: '#f5f7fa',
          2:       '#eef0f5',
          3:       '#e4e8f0',
        },
        ink: {
          DEFAULT: '#0d1b35',
          2:       '#3d4f6e',
          muted:   '#8a95ab',
        },
        rule: '#dde2ec',
        danger: '#e5534b',
        warn:   '#e8a02a',
        ok:     '#22c55e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg:      '12px',
        xl:      '16px',
      },
      boxShadow: {
        card:  '0 1px 3px rgba(13,27,53,0.08), 0 1px 8px rgba(13,27,53,0.04)',
        float: '0 4px 24px rgba(13,27,53,0.12)',
        glow:  '0 0 0 3px rgba(0,200,150,0.18)',
      },
    },
  },
  plugins: [],
}
