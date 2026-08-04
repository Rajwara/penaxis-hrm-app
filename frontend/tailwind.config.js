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
          50: "#EEF1F6",
          100: "#DCE2ED",
          400: "#5B6B82",
          600: "#37455A",
          700: "#2C3A4D",
          800: "#1F2C41",
          900: "#131B2B",
        },
        amber: {
          400: "#F0AE4E",
          500: "#E8A33D",
          600: "#C9852A",
        },
        teal: {
          400: "#4FBFAE",
          500: "#2FA694",
          600: "#227F71",
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
