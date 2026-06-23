import { Newsreader, Libre_Franklin } from "next/font/google";

export const entryNewsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-entry-serif",
});

export const entryFranklin = Libre_Franklin({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-entry-sans",
});
