import type { Metadata } from "next";
import "../components/brandcheck/styles.css";

export const metadata: Metadata = {
  title: "BrandCheck — Review with context",
  description: "Manage approved brand guidelines, review content and collaborate on versioned human approvals in BrandCheck.",
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
