/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Fredoka"', 'sans-serif'], // Apply Fredoka as the default sans font
      },
    },
    keyframes: {
      'pop-in': {
        '0%': { transform: 'scale(0.5)', opacity: '0' },
        '75%': { transform: 'scale(1.05)', opacity: '1' },
        '100%': { transform: 'scale(1)', opacity: '1' },
      },
      wiggle: {
        '0%, 100%': { transform: 'rotate(-3deg)' },
        '50%': { transform: 'rotate(3deg)' },
      },
    },
    animation: {
      'pop-in': 'pop-in 0.4s ease-out forwards',
      wiggle: 'wiggle 0.3s ease-in-out infinite',
    },
  },
  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        '.text-shadow-sm': {
          'text-shadow': '1px 1px 0px rgba(0, 0, 0, 0.05)',
        },
        '.text-shadow-md': {
          'text-shadow': '2px 2px 0px rgba(0, 0, 0, 0.07)',
        },
        '.text-shadow-lg': {
          'text-shadow': '3px 3px 0px rgba(0, 0, 0, 0.09)',
        },
      }
      addUtilities(newUtilities, ['responsive', 'hover']);
    },
  ],
}