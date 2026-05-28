import type { Metadata } from "next";

import { CopilotKitProvider } from "@/components/copilotkit-provider";
import { Manrope } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Atlas 5 — Decision Intelligence",
  description: "CPC strategic intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${GeistMono.variable}`}>
      <body className={"subpixel-antialiased"}>
        <CopilotKitProvider>
          {children}
        </CopilotKitProvider>
      </body>
    </html>
  );
}
