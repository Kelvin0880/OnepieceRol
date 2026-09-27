import type { MetadataRoute } from "next";

// Lets a phone "add to home screen" the game with its own icon, name and dark splash, opening full screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grand Line RPG",
    short_name: "Grand Line",
    description: "Un rol de texto ambientado en el mundo de One Piece.",
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1520",
    theme_color: "#0b1520",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
