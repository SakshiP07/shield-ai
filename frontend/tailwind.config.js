/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        shield: '#0B0B0B',
        surface: {
          DEFAULT: '#111111',
          card: '#161616',
          input: '#141414',
        },
      },
    },
  },
  plugins: [],
};
