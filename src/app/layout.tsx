import type { Metadata, Viewport } from "next";
import { Cinzel, Crimson_Pro } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SeaBackground from "@/components/ui/SeaBackground";
import MotionProvider from "@/components/motion/MotionProvider";

const cinzel = Cinzel({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
});

const crimson = Crimson_Pro({
  variable: "--font-body",
  subsets: ["latin"],
});

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-1952398982375580";

export const metadata: Metadata = {
  title: "Grand Line RPG — Un rol de texto de One Piece",
  description: "Crea tu personaje, zarpa hacia el Grand Line y escribe tu propia leyenda.",
};

export const viewport: Viewport = {
  themeColor: "#0b1520",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${cinzel.variable} ${crimson.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Script
          id="google-adsense"
          async
          strategy="afterInteractive"
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
        />
        <SeaBackground />
        <MotionProvider>
          <div className="relative z-10 flex-1 flex flex-col">{children}</div>
        </MotionProvider>
      </body>
    </html>
  );
}
