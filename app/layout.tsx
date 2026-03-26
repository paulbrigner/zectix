import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import { appPath } from "@/lib/app-paths";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "ZecTix",
  description:
    "A home for Zcash ticketing with direct CipherPay events and a managed Luma + CipherPay integration.",
  openGraph: {
    title: "ZecTix",
    description:
      "A home for Zcash ticketing with direct CipherPay events and a managed Luma + CipherPay integration.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ZecTix",
    description:
      "A home for Zcash ticketing with direct CipherPay events and a managed Luma + CipherPay integration.",
  },
  icons: {
    icon: appPath("/icon.png"),
    shortcut: appPath("/favicon.ico"),
    apple: appPath("/apple-icon.png"),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${spaceGrotesk.variable}`}>
        {children}
      </body>
    </html>
  );
}
