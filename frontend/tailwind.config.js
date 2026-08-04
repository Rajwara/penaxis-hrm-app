/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#F2F1F4",
          100: "#E1DFE6",
          400: "#6B6570",
          600: "#3D3843",
          700: "#2C2830",
          800: "#212121",
          900: "#1A1A1A",
        },
        brand: {
          50: "#F1ECF8",
          100: "#E1D5EF",
          400: "#9779C0",
          500: "#734FA0",
          600: "#5E3F86",
          700: "#4A3269",
        },
        amber: {
          400: "#FD8438",
          500: "#FC6607",
          600: "#DB5502",
        },
        teal: {
          400: "#9779C0",
          500: "#734FA0",
          600: "#5E3F86",
        },
        success: "#2F9E6E",
        danger: "#D2564A",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(19, 27, 43, 0.06), 0 1px 12px rgba(19, 27, 43, 0.05)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};
