import type { Metadata } from "next";
import "../components/brandcheck/styles.css";

export const metadata: Metadata = {
  title: "BrandCheck — Review with context",
  description: "Review content against approved brand sources and ask a human reviewer to decide. No account or API key required for this demo.",
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
      <body>{children}</body>
    </html>
  );
}
