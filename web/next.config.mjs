/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  // 根路径重定向到画廊 /demo（站点结构：/demo 画廊 · /mint 铸造中心 · /mint/create 创建原创）
  async redirects() {
    return [{ source: "/", destination: "/demo", permanent: false }];
  }
};

export default nextConfig;
