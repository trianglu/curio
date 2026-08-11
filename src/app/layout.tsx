import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { LearningProvider } from "@/context/learning-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Curio — Learn anything, at your pace",
  description:
    "A Duolingo-style learning app that builds personalized paths for any subject.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Curio",
  },
};

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-dvh text-stone-900">
        <ErrorBoundary>
          <LearningProvider>
            <AppHeader />
            <main>{children}</main>
          </LearningProvider>
        </ErrorBoundary>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                var isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
                if (isDev) {
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    regs.forEach(function(r) { r.unregister(); });
                  });
                  if ('caches' in window) {
                    caches.keys().then(function(keys) {
                      keys.forEach(function(k) { caches.delete(k); });
                    });
                  }
                } else {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function() {});
                  });
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
