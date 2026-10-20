import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const sans = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Gassi", template: "%s · Gassi" },
  description: "Das Hundetagebuch für den Haushalt",
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: "Gassi", statusBarStyle: "default" },
};

// `viewportFit: "cover"`: the bottom bar keeps clear of the home indicator with env(safe-area-inset-bottom).
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { color: "#e8ece3", media: "(prefers-color-scheme: light)" },
    { color: "#111813", media: "(prefers-color-scheme: dark)" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${sans.variable} antialiased`}>
      <body className="min-h-dvh font-sans text-base leading-normal">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
