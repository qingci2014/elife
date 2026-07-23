import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { SiteHeader } from "./components/site-header";

const siteTitle = "生活英语重启";
const siteDescription = "面向有基础成年人的生活英语自学教材：重新开口，自然交流，深入表达。";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000")
    .split(",")[0]
    .trim();
  const protocol = (requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https"))
    .split(",")[0]
    .trim();
  const origin = `${protocol}://${host}`;
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: new URL(origin),
    title: {
      default: siteTitle,
      template: `%s｜${siteTitle}`,
    },
    description: siteDescription,
    openGraph: {
      type: "website",
      title: siteTitle,
      description: siteDescription,
      url: origin,
      images: [{ url: socialImage, width: 1734, height: 907, alt: `${siteTitle}网站分享封面` }],
    },
    twitter: {
      card: "summary_large_image",
      title: siteTitle,
      description: siteDescription,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteHeader />
        {children}
        <footer className="site-footer">
          <p>生活英语重启 · 以真实任务重新激活英语</p>
          <p className="footer-note">课程参照CEFR能力描述，不以完成课文自动等同等级认证。</p>
        </footer>
      </body>
    </html>
  );
}
