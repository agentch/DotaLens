import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "DotaLens",
  description: "Dota 2 选手资料与参赛履历"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
