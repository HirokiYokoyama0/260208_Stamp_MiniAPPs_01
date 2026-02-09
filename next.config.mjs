/** @type {import('next').NextConfig} */
const nextConfig = {
  // LIFF は外部サイトとして開くため、必要に応じて設定
  env: {
    // package.jsonのバージョンを使用
    NEXT_PUBLIC_APP_VERSION:
      process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    // ビルド時にスクリプトで設定される（オプション）
    NEXT_PUBLIC_BUILD_DATE: process.env.NEXT_PUBLIC_BUILD_DATE || "",
    NEXT_PUBLIC_GIT_COMMIT: process.env.NEXT_PUBLIC_GIT_COMMIT || "",
  },
};

export default nextConfig;
