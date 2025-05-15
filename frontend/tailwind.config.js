// ==== File: frontend/tailwind.config.js ====
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
        keyframes: {
          marquee: {
            '0%': { transform: 'translateX(0%)' },
            '100%': { transform: 'translateX(-50%)' },
          },
          'marquee-reverse': {
            '0%': { transform: 'translateX(-100%)' },
            '100%': { transform: 'translateX(0%)' },
          }
        },
        animation: {
          'marquee-slow': 'marquee 120s linear infinite',
          'marquee-medium': 'marquee 110s linear infinite',
          'marquee-fast': 'marquee 90s linear infinite'
        },
        // Add typography theme customizations here
        typography: (theme) => ({
          DEFAULT: { // Applied with `prose` class
            css: {
              color: theme('colors.gray.700'),
              h1: {
                color: theme('colors.gray.900'),
                fontWeight: '800', // Extra-bold
                fontSize: theme('fontSize.2xl'), // Tailwind's 2xl by default
                marginTop: theme('spacing.6'),
                marginBottom: theme('spacing.3'),
              },
              h2: {
                color: theme('colors.gray.900'),
                fontWeight: '700',
                fontSize: theme('fontSize.xl'),
                marginTop: theme('spacing.5'),
                marginBottom: theme('spacing.2'),
              },
              h3: {
                color: theme('colors.gray.900'),
                fontWeight: '600',
                fontSize: theme('fontSize.lg'),
                marginTop: theme('spacing.4'),
                marginBottom: theme('spacing.2'),
              },
              // You can add more styles for p, a, strong, code, pre, etc.
              'code::before': { content: '""' }, // Remove default backticks for inline code
              'code::after': { content: '""' },
              code: {
                backgroundColor: theme('colors.gray.100'),
                padding: `${theme('spacing.1')} ${theme('spacing.1_5')}`,
                borderRadius: theme('borderRadius.md'),
                fontWeight: '500',
              },
              pre: {
                backgroundColor: theme('colors.gray.800'),
                color: theme('colors.gray.100'),
                padding: theme('spacing.4'),
                borderRadius: theme('borderRadius.lg'),
                overflowX: 'auto',
              },
              'pre code': { // Styles for code blocks within <pre>
                  backgroundColor: 'transparent',
                  padding: '0',
                  color: 'inherit',
                  fontWeight: 'normal',
              },
              a: {
                color: theme('colors.orange.600'),
                '&:hover': {
                  color: theme('colors.orange.700'),
                },
              },
            },
          },
          // Example of a larger prose style if needed: prose-lg
          lg: {
            css: {
              h1: { fontSize: theme('fontSize.3xl') }, // Larger H1 for prose-lg
              h2: { fontSize: theme('fontSize.2xl') },
              p:  { fontSize: theme('fontSize.lg'), lineHeight: theme('lineHeight.relaxed')},
            },
          },
        }),
      },
    },
    plugins: [
      require('@tailwindcss/line-clamp'),
      require('@tailwindcss/typography'), // Added typography plugin
    ],
  }