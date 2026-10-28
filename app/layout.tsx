import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Migsak — Websites, apps & connected tools",
  description: "Explore Migsak's website, app and automation services. Plan an initial scope and share your project requirements.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
