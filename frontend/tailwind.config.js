// ==== File: frontend/tailwind.config.js ====
/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          orange: {
            DEFAULT: '#e85d04',
            50: '#fff7ed',
            100: '#ffedd5',
            200: '#fed7aa',
            300: '#fdba74',
            400: '#fb923c',
            500: '#f97316',
            600: '#ea580c',
            700: '#c2410c',
            800: '#9a3412',
            900: '#7c2d12',
            950: '#431407',
          },
        },
        boxShadow: {
          card: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        },
        fontFamily: {
          sans: [
            'Inter',
            'system-ui',
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
          ],
        },
        keyframes: { // <-- ADDED KEYFRAMES
          marquee: {
            '0%': { transform: 'translateX(0%)' },
            '100%': { transform: 'translateX(-100%)' }, // Сдвигаем на всю ширину дублированного контента
          },
          'marquee-reverse': { // Для движения в обратную сторону
            '0%': { transform: 'translateX(-100%)' },
            '100%': { transform: 'translateX(0%)' },
          }
        },
        animation: { // <-- ADDED ANIMATIONS
          'marquee-slow': 'marquee 120s linear infinite',
          'marquee-medium': 'marquee 110s linear infinite',
          'marquee-fast': 'marquee 90s linear infinite'
        },
      },
    },
    plugins: [
      require('@tailwindcss/line-clamp'),
    ],
  }