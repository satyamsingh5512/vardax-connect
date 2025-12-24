/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark navy/charcoal theme
        'vardax': {
          'bg': '#0f1419',
          'card': '#1a1f2e',
          'border': '#2d3748',
          'text': '#e2e8f0',
          'muted': '#718096',
        },
        // Severity colors
        'severity': {
          'normal': '#10b981',    // Green
          'low': '#10b981',       // Green
          'medium': '#f59e0b',    // Amber
          'high': '#ef4444',      // Red
          'critical': '#dc2626',  // Dark red
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
