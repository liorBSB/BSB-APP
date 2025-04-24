/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 🔸 Homey & Relaxing Theme
        primary: '#D9A561',
        accent: '#C7644E',
        background: '#FAF4EF',
        surface: '#F2ECE4',
        text: '#3B3B3B',
        muted: '#757575',
        success: '#709775',
        warning: '#EBA937',
        error: '#C85C5C'
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Poppins', 'sans-serif']
      }
    },
  },
  plugins: [],
}
