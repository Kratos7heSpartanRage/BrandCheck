import type { Metadata } from "next";
import "./globals.css";
import "../components/brandcheck/styles.css";

export const metadata: Metadata = {
  title: "BrandCheck — Source-Grounded Brand Review & Approvals",
  description: "Pre-publication brand governance: multimodal content review, source-grounded AI, and accountable human decisions.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] font-sans">{children}</body>
    </html>
  );
}

