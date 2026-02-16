/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        minecraft: {
          green: '#5D9C3F',
          darkGreen: '#3B7821',
          brown: '#8B5A2B',
          stone: '#7F7F7F',
          dirt: '#79553A',
          grass: '#5B8731',
        },
        launcher: {
          bg: '#0F0F0F',
          card: '#1A1A1A',
          cardHover: '#252525',
          border: '#2A2A2A',
          accent: 'var(--color-accent, #3B82F6)',
          accentHover: 'var(--color-accent-hover, #2563EB)',
          secondary: '#6366F1',
          warning: '#F59E0B',
          error: '#EF4444',
          text: '#FFFFFF',
          textMuted: '#9CA3AF',
          textDim: '#6B7280',
        },
      },
      fontFamily: {
        minecraft: ['Minecraft', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 210, 106, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 210, 106, 0.8)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
