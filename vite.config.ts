/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",  // 🔹 Inclui toda a raiz
    "./estilos/**/*.{css}"      // 🔹 Garante que o base.css seja processado
  ],
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
