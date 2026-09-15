import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#E9EFF6",
          100: "#D3DEEE",
          200: "#A6BDDC",
          300: "#7A9CCB",
          400: "#4D7BB9",
          500: "#215AA8",
          600: "#1A4886",
          700: "#143665",
          800: "#0D2443",
          900: "#071222",
        },
      },
      fontFamily: {
        sans:    ["Lato", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Lato", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
