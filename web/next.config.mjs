/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true
  // 站点结构：/ 首页（品牌 + 精选 + 流程）· /demo 画廊 · /mint 铸造中心 · /mint/create 创建原创
};

export default nextConfig;
