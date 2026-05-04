/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./frontend/**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          500: '#10b981',
          400: '#34d399',
        }
      }
    },
  },
  plugins: [],
}
