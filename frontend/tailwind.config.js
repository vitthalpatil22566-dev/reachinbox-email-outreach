/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        reach: {
          bg: '#090D16',
          card: '#141923',
          cardHover: '#1B2232',
          border: '#263147',
          borderLight: '#374151',
          text: '#F3F4F6',
          muted: '#9CA3AF',
          primary: '#6366F1',
          primaryHover: '#4F46E5',
          accent: '#8B5CF6',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
