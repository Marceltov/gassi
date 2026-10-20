import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Gassi", description: "Das Hundetagebuch für Toffee" };

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { color: "#f6f4ef", media: "(prefers-color-scheme: light)" },
    { color: "#15140f", media: "(prefers-color-scheme: dark)" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
