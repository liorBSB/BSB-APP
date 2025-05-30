/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#E0BF8A',
        accent: '#076332',
        background: '#FAF4EF',
        surface: '#F5F0E8',
        text: '#3B3B3B',
        muted: '#757575',
        success: '#076332',
        warning: '#EBA937',
        error: '#C85C5C',
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Poppins', 'sans-serif'],
      },
      screens: {
        'phone-sm': {'min': '320px', 'max': '375px'},
        'phone-md': {'min': '375px', 'max': '414px'},
        'phone-lg': {'min': '414px', 'max': '480px'},
      },
    }
  },
  plugins: [],
};
