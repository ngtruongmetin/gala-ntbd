/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        brand: {
          navy: {
            DEFAULT: '#172B85',
            100: '#E8EEFF',
            300: '#A2B7F2',
            400: '#6789DD',
            500: '#385FBA',
            600: '#172B85',
            700: '#10205E',
            950: '#061136',
          },
          cyan: {
            100: '#E4F8FC',
            500: '#00B9DD',
            600: '#007A9A',
          },
          magenta: {
            DEFAULT: '#C51B61',
            100: '#FDE7F1',
            300: '#F7A2C8',
            400: '#E85599',
            500: '#D72E78',
            600: '#C51B61',
            700: '#9F144E',
            950: '#4C0624',
          },
          gold: {
            100: '#FFF4D6',
            500: '#F4BF23',
            600: '#E09B00',
          },
        },
      },
      fontFamily: {
        sans: ['Aptos', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
