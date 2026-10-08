import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Reporithm — Read the health of any repository",
  description: "Turn public GitHub signals into a transparent repository health score and focused recommendations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <Navbar />
          {children}
          <footer className="border-t border-black/8 px-5 py-8 text-center text-xs text-zinc-500 dark:border-white/10 sm:px-8">
            <p>Reporithm · Transparent signals for healthier open source.</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
