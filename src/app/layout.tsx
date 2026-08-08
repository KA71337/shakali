import type { Metadata, Viewport } from "next";

import "./globals.css";

const title = "Анонимное сообщение — Напиши без регистрации";
const description =
  "Отправьте анонимное сообщение без регистрации. Простая и защищённая форма до 1000 символов.";
const fallbackSiteUrl = "http://localhost:3000";

function getSiteUrl(): URL {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim();

  if (!configuredUrl) {
    return new URL(fallbackSiteUrl);
  }

  try {
    return new URL(configuredUrl);
  } catch {
    return new URL(fallbackSiteUrl);
  }
}

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title,
  description,
  applicationName: "Без имени",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "анонимное сообщение",
    "сообщение без регистрации",
    "анонимная форма",
  ],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: "Без имени",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#070710",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
