/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E3A5F',
          light: '#2A4A7F',
          dark: '#152A4F',
        },
        secondary: {
          DEFAULT: '#3A506B',
          light: '#4A607B',
          dark: '#2A405B',
        },
        accent: {
          DEFAULT: '#3FFF8C',
          light: '#5FFFAC',
          dark: '#2FFF6C',
        },
        background: {
          DEFAULT: '#101820',
          light: '#1A2830',
          dark: '#0A1018',
        },
        text: {
          DEFAULT: '#F1F3F5',
          light: '#FFFFFF',
          dark: '#D1D3D5',
        },
        warning: {
          DEFAULT: '#FF7A00',
          light: '#FF9A30',
          dark: '#DF5A00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #3FFF8C, 0 0 10px #3FFF8C' },
          '100%': { boxShadow: '0 0 10px #3FFF8C, 0 0 20px #3FFF8C, 0 0 30px #3FFF8C' },
        },
      },
    },
  },
  plugins: [],
}

