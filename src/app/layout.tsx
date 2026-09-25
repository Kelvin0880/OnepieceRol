import type { Metadata, Viewport } from "next";
import { Cinzel, Crimson_Pro } from "next/font/google";
import "./globals.css";
import SeaBackground from "@/components/ui/SeaBackground";

const cinzel = Cinzel({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
});

const crimson = Crimson_Pro({
  variable: "--font-body",
  subsets: ["latin"],
});

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
        <SeaBackground />
        <div className="relative z-10 flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
