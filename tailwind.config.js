/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{html,js,ts,jsx,tsx,css}", // Inclui index.css e toda a raiz
  ],
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
