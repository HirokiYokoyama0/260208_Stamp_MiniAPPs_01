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
        // 子供用カラーパレット
        "kids-pink": "#FF6B9D",
        "kids-yellow": "#FFD93D",
        "kids-green": "#6BCF7F",
        "kids-blue": "#4ECDC4",
        "kids-purple": "#A78BFA",
      },
      fontFamily: {
        sans: [
          "Hiragino Sans",
          "Hiragino Kaku Gothic ProN",
          "Yu Gothic UI",
          "Meiryo",
          "sans-serif",
        ],
        // 子供用フォント（丸ゴシック）
        kids: ['"M PLUS Rounded 1c"', "ui-rounded", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
