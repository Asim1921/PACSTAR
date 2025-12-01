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
        // Hack The Box & Cyber Theme Colors
        cyber: {
          dark: '#0A0E27',
          darker: '#050812',
          '900': '#0D1117',
          '800': '#161B22',
          '700': '#1C2128',
          '600': '#22272E',
          '500': '#2D333B',
        },
        neon: {
          green: '#00FF88',
          cyan: '#00D9FF',
          purple: '#9D4EDD',
          orange: '#FF6B35',
          blue: '#0066FF',
        },
        white: {
          DEFAULT: '#FFFFFF',
          light: '#FFFFFF',
          dark: '#FAFAFA',
        },
        brown: {
          DEFAULT: '#8B4513',
          light: '#A0522D',
          dark: '#654321',
          '50': '#F5F1EB',
          '100': '#E8DDD0',
          '200': '#D4C4B0',
          '300': '#B8956A',
          '400': '#9D6F47',
          '500': '#8B4513',
          '600': '#6B3410',
          '700': '#4A240B',
        },
        green: {
          DEFAULT: '#00FF88',
          light: '#33FF99',
          dark: '#00CC6A',
          '50': '#E6FFF5',
          '100': '#B3FFE0',
          '500': '#00FF88',
          '600': '#00CC6A',
          '700': '#00994D',
        },
        orange: {
          DEFAULT: '#FF6B35',
          light: '#FF8C5A',
          dark: '#CC5529',
          '50': '#FFF3EF',
          '100': '#FFD9CC',
          '500': '#FF6B35',
          '600': '#CC5529',
          '700': '#993F1F',
        },
        primary: {
          DEFAULT: '#00FF88',
          light: '#33FF99',
          dark: '#00CC6A',
        },
        secondary: {
          DEFAULT: '#00D9FF',
          light: '#33E0FF',
          dark: '#00ACC6',
        },
        accent: {
          DEFAULT: '#00FF88',
          light: '#33FF99',
          dark: '#00CC6A',
          cyan: '#00D9FF',
          purple: '#9D4EDD',
        },
        background: {
          DEFAULT: '#0A0E27',
          light: '#161B22',
          dark: '#050812',
        },
        text: {
          DEFAULT: '#F1F3F5',
          light: '#FFFFFF',
          dark: '#ADB5BD',
          muted: '#6C757D',
        },
        border: {
          DEFAULT: '#E5E7EB',
          light: '#F3F4F6',
          dark: '#D1D5DB',
        },
        warning: {
          DEFAULT: '#F97316',
          light: '#FB923C',
          dark: '#EA580C',
        },
        success: {
          DEFAULT: '#22C55E',
          light: '#4ADE80',
          dark: '#16A34A',
        },
        error: {
          DEFAULT: '#EF4444',
          light: '#F87171',
          dark: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-in': 'slide-in 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-out': 'slide-out 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'grid-move': 'grid-move 20s linear infinite',
        'hex-shift': 'hex-shift 30s linear infinite',
        'sweep': 'sweep 4s ease-in-out infinite',
        'scan': 'scan 4s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #00FF88, 0 0 10px #00FF88' },
          '100%': { boxShadow: '0 0 10px #00FF88, 0 0 20px #00FF88, 0 0 30px #00FF88' },
        },
        'glow-pulse': {
          '0%, 100%': { 
            boxShadow: '0 0 20px rgba(0, 255, 136, 0.4), 0 0 40px rgba(0, 255, 136, 0.2)',
          },
          '50%': { 
            boxShadow: '0 0 30px rgba(0, 255, 136, 0.6), 0 0 60px rgba(0, 255, 136, 0.3)',
          },
        },
        'fade-in': {
          'from': { opacity: '0', transform: 'translateY(10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          'from': { transform: 'translateX(100%) scale(0.9)', opacity: '0' },
          'to': { transform: 'translateX(0) scale(1)', opacity: '1' },
        },
        'slide-out': {
          'from': { transform: 'translateX(0) scale(1)', opacity: '1' },
          'to': { transform: 'translateX(100%) scale(0.9)', opacity: '0' },
        },
        'grid-move': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 40px' },
        },
        'hex-shift': {
          '0%': { backgroundPosition: '0 0, 0 0, 0 0, 0 0, 0 0' },
          '100%': { backgroundPosition: '50px 50px, -50px -50px, 25px 25px, -25px -25px, 0 0' },
        },
        'sweep': {
          '0%': { left: '-100%', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { left: '100%', opacity: '0' },
        },
        'scan': {
          '0%': { top: '0', opacity: '0.8' },
          '50%': { opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}

