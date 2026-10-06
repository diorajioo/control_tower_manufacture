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
          50: "#EEF4FB",
          100: "#DCE5F1",
          200: "#C3CEE3",
          300: "#8FA6C9",
          400: "#5C7AA8",
          500: "#1E4076",
          600: "#16305C",
          700: "#102446",
          800: "#0B1830",
          900: "#050C18",
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
