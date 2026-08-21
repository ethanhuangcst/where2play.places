import type { Metadata } from "next";
import "./globals.css";
import { readLocaleCookie } from "@/src/auth/session";
import { htmlLang, normalizeLocale } from "@/src/core/locales";
import { LocaleProvider } from "@/src/i18n/locale-provider";

export const metadata: Metadata = {
  title: "where2play.place",
  description: "Plan where to play next — places and itineraries",
  icons: { icon: "/favicon.png" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieLocale = await readLocaleCookie();
  const locale = normalizeLocale(cookieLocale);
  return (
    <html lang={htmlLang(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fredoka:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
