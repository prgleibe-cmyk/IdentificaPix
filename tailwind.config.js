/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./views/**/*.{ts,tsx,js,jsx}",
    "./contexts/**/*.{ts,tsx,js,jsx}",
    "./hooks/**/*.{ts,tsx,js,jsx}",
    "./services/**/*.{ts,tsx,js,jsx}",
    "./lib/**/*.{ts,tsx,js,jsx}",
    "./types/**/*.{ts,tsx,js,jsx}",
    "./utils/**/*.{ts,tsx,js,jsx}",
    "./estilos/**/*.{css}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
