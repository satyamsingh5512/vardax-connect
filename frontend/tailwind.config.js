/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Enterprise dark theme - inspired by Datadog/Grafana
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
        // Accent colors
        'accent': {
          'blue': '#388bfd',
          'blue-hover': '#58a6ff',
          'green': '#3fb950',
          'green-dim': '#238636',
          'yellow': '#d29922',
          'orange': '#db6d28',
          'red': '#f85149',
          'red-dim': '#da3633',
          'purple': '#a371f7',
          'cyan': '#39c5cf',
        },
        // Severity colors - enterprise grade
        'severity': {
          'critical': '#ff4757',
          'high': '#ff6b6b',
          'medium': '#ffa502',
          'low': '#2ed573',
          'normal': '#70a1ff',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(56, 139, 253, 0.3)',
        'glow-red': '0 0 20px rgba(248, 81, 73, 0.3)',
        'glow-green': '0 0 20px rgba(63, 185, 80, 0.3)',
      },
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
