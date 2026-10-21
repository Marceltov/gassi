import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

const sans = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Gassi", template: "%s · Gassi" },
  description: "Das Hundetagebuch für den Haushalt",
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

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
      </body>
    </html>
  );
}
