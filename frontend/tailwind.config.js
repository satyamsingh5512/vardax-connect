/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Enterprise theme colors
        'enterprise': {
          'bg': '#0a0e14',
          'surface': '#0d1117',
          'card': '#161b22',
          'elevated': '#1c2128',
          'hover': '#21262d',
          'active': '#262c36',
          'border': '#21262d',
          'border-light': '#30363d',
          'text': '#f0f6fc',
          'text-secondary': '#8b949e',
          'text-muted': '#6e7681',
        },
        // Brand colors
        'brand': {
          'primary': '#0066ff',
          'primary-hover': '#0052cc',
          'secondary': '#6c5ce7',
          'accent': '#00d4aa',
        },
        // Status colors
        'status': {
          'success': '#00b894',
          'success-light': '#00cec9',
          'warning': '#fdcb6e',
          'warning-light': '#ffeaa7',
          'error': '#e84393',
          'error-light': '#fd79a8',
          'info': '#74b9ff',
          'info-light': '#a29bfe',
        },
        // Severity colors
        'severity': {
          'critical': '#ff1744',
          'high': '#ff5252',
          'medium': '#ff9800',
          'low': '#00e676',
          'normal': '#2196f3',
        },
        // Vibrant dark theme with rich colors (legacy support)
        'vardax': {
          'bg': '#0a0e14',
          'secondary': '#0d1117',
          'card': '#161b22',
          'elevated': '#1c2128',
          'hover': '#21262d',
          'active': '#262c36',
          'border': '#21262d',
          'border-secondary': '#30363d',
          'text': '#f0f6fc',
          'muted': '#8b949e',
          'tertiary': '#6e7681',
        },
        // Vibrant accent colors
        'accent': {
          'blue': '#3b82f6',
          'blue-hover': '#60a5fa',
          'blue-bright': '#2563eb',
          'green': '#10b981',
          'green-bright': '#34d399',
          'green-dim': '#059669',
          'yellow': '#f59e0b',
          'yellow-bright': '#fbbf24',
          'orange': '#f97316',
          'orange-bright': '#fb923c',
          'red': '#ef4444',
          'red-bright': '#f87171',
          'red-dim': '#dc2626',
          'purple': '#a855f7',
          'purple-bright': '#c084fc',
          'purple-dim': '#9333ea',
          'cyan': '#06b6d4',
          'cyan-bright': '#22d3ee',
          'pink': '#ec4899',
          'pink-bright': '#f472b6',
          'indigo': '#6366f1',
          'indigo-bright': '#818cf8',
        },
      },
      boxShadow: {
        'enterprise': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'glow-primary': '0 0 20px rgba(0, 102, 255, 0.4)',
        'glow-blue': '0 0 30px rgba(59, 130, 246, 0.5)',
        'glow-red': '0 0 30px rgba(239, 68, 68, 0.5)',
        'glow-green': '0 0 30px rgba(16, 185, 129, 0.5)',
        'glow-purple': '0 0 30px rgba(168, 85, 247, 0.5)',
        'glow-cyan': '0 0 30px rgba(6, 182, 212, 0.5)',
        'glow-pink': '0 0 30px rgba(236, 72, 153, 0.5)',
        'neon-blue': '0 0 5px #3b82f6, 0 0 20px #3b82f6, 0 0 40px #3b82f6',
        'neon-purple': '0 0 5px #a855f7, 0 0 20px #a855f7, 0 0 40px #a855f7',
        'neon-cyan': '0 0 5px #06b6d4, 0 0 20px #06b6d4, 0 0 40px #06b6d4',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'gradient': 'gradient 3s ease infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
