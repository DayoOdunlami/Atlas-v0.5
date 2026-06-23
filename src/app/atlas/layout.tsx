import { IBM_Plex_Mono, Libre_Franklin, Newsreader } from "next/font/google";
import type { ReactNode } from "react";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-atlas-serif",
  display: "swap",
});

const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-atlas-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-atlas-mono",
  display: "swap",
});

export default function AtlasLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${newsreader.variable} ${libreFranklin.variable} ${ibmPlexMono.variable} min-h-screen`}
      style={{ fontFamily: "var(--font-atlas-sans), system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
