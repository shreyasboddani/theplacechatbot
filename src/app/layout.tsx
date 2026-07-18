import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Place Information Assistant",
  description:
    "A grounded information assistant prototype using The Place's approved website and staff-provided information.",
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
