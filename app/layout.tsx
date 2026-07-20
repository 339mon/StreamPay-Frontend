import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";
import { ToastProvider } from "./components/ToastProvider";
import { getThemeScript } from "./utils/theme-noflash";

/**
 * SplashScreen is loaded lazily (issue #85) so it is excluded from the
 * critical rendering path. The `ssr: false` option prevents a meaningless
 * server render of a purely client-side overlay and avoids hydration mismatches.
 */
const SplashScreen = dynamic(() => import("./components/SplashScreen"), {
  ssr: false,
});

export const metadata: Metadata = {
  title: "StreamPay - Payment Streaming",
  description: "Real-time payment streaming on Stellar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: getThemeScript() }}
          suppressHydrationWarning
        />
      </head>
      <body>
        <ToastProvider>
          <SplashScreen />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
