import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // つくばホワイト歯科 大人向けカラーパレット
        primary: {
          DEFAULT: "#87CEEB", // スカイブルー
          light: "#B0E0E6",
          dark: "#5BA3C6",
        },
        accent: {
          DEFAULT: "#D4AF37", // シャンパンゴールド
          light: "#E8D48B",
          dark: "#B8960C",
        },
      },
      fontFamily: {
        sans: [
          "Hiragino Sans",
          "Hiragino Kaku Gothic ProN",
          "Yu Gothic UI",
          "Meiryo",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
