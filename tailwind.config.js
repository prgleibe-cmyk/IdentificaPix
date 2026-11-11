
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./portal/**/*.{js,ts,jsx,tsx}",
    "./modules/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./types/**/*.{js,ts,jsx,tsx}"
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
          deep: '#0F172A',
          blue: '#EA580C',
          teal: '#64748B',
          orange: '#EA580C',
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          graphite: '#1E293B',
          subtle: '#FFF7ED',
          border: '#FDBA74',
        },
        canvas: {
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          subtle: '#F1F5F9',
          border: '#E2E8F0',
          dark: '#0F172A',
        },
        finance: {
          credit: '#059669',
          'credit-bg': '#ECFDF5',
          debit: '#DC2626',
          'debit-bg': '#FFF1F2',
          pending: '#D97706',
          'pending-bg': '#FFFBEB',
          neutral: '#64748B',
          'neutral-bg': '#F1F5F9',
        }
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
        'elevated': '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
        'glow': '0 0 15px rgba(234, 88, 12, 0.25)',
      }
    },
  },
  plugins: [],
}
