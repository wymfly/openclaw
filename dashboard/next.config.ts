import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // 服务端需要加载 native 模块（better-sqlite3, ws）
  serverExternalPackages: ["better-sqlite3", "ws"],
  // 支持 standalone 输出用于 Docker 部署
  output: "standalone",
};

export default withNextIntl(nextConfig);
