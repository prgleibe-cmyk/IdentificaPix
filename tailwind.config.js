
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
    "!./node_modules/**"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        brand: {
          deep: '#0A1F44',    // Azul profundo
          blue: '#157AFF',    // Azul destaque
          teal: '#4FE6D0',    // Verde suave
          bg: '#F3F6FA',      // Cinza claro
          white: '#FFFFFF',   // Branco
          graphite: '#2F3545',// Cinza grafite
        }
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'card': '0 0 0 1px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.04)',
        'glow': '0 0 15px rgba(21, 122, 255, 0.3)',
      }
    },
  },
  plugins: [],
}
