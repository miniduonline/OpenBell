/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef4ff', 100: '#d9e6ff', 200: '#bcd2ff', 300: '#8fb4ff',
          400: '#5b8cff', 500: '#3366ff', 600: '#1f47e0', 700: '#1936b3',
          800: '#162d8c', 900: '#152a70'
        }
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } }
      },
      animation: { fadeIn: 'fadeIn .25s ease-out' }
    }
  },
  plugins: []
};
