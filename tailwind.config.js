/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}", // Inclui toda a raiz
    "./estilos/**/*.css"      // Corrige o aviso de pattern inválido
  ],
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
