/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Exclude node_modules
    "!./src/**/node_modules/**",
    "!./node_modules/**",
  ],
  theme: {
    extend: {
      fontFamily: {
        'tajawal': ['Tajawal', 'sans-serif'],
        'poppins': ['Poppins', 'sans-serif'],
        'amiri': ['Amiri', 'serif'],
      },
      colors: {
        'brand-green': {
          light: '#f0fdf4',
          DEFAULT: '#22c55e',
          dark: '#15803d'
        },
        'brand-yellow': {
          light: '#fefce8',
          DEFAULT: '#eab308',
          dark: '#a16207'
        },
        'brand-gray': {
          light: '#f9fafb',
          DEFAULT: '#6b7280',
          dark: '#1f2937'
        },
        'brand-cream': '#fffbeb'
      },
      keyframes: {
        writing: {
          '0%, 100%': { transform: 'rotate(0deg) translateX(0)' },
          '25%': { transform: 'rotate(5deg) translateX(2px)' },
          '75%': { transform: 'rotate(-5deg) translateX(-2px)' },
        },
        'plane-prep': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(-2px, 2px) rotate(-5deg)' },
          '50%': { transform: 'translate(0, 0) scale(1.05)' },
          '75%': { transform: 'translate(1px, -1px) rotate(5deg)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-sm': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.7' },
        },
        buttonPop: {
          '0%': { transform: 'scale(0.95)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      animation: {
        'writing-hand': 'writing 0.8s ease-in-out infinite',
        'plane-loading': 'plane-prep 1.2s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'pulse-sm': 'pulse-sm 2s infinite cubic-bezier(0.4, 0, 0.6, 1)',
        'button-pop': 'buttonPop 0.3s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-radar': 'spin 3s linear infinite',
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('tailwindcss-animate'),
    require('tailwindcss-radix'),
  ],
}
