import { GAME_URL } from "../lib/wake";

export function Footer() {
  return (
    <footer data-sea="4" className="relative border-t border-gold/15 bg-abyss/85 px-4 py-12 backdrop-blur-sm sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <div className="flex items-center gap-2.5">
            <img src="./favicon.svg" alt="" className="h-9 w-9" width={36} height={36} />
            <span className="font-display text-sm font-bold tracking-[0.22em] text-ink">GRAND LINE RPG</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-mute">
            Proyecto de fans, gratuito y sin ánimo de lucro. One Piece es obra de Eiichiro Oda; sus marcas pertenecen a Shueisha y Toei Animation. Este juego no está afiliado ni respaldado por ellos.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 font-display text-[0.72rem] tracking-[0.18em] uppercase" aria-label="Enlaces">
          <a className="text-ink-dim hover:text-gold-bright" href={GAME_URL}>
            Jugar
          </a>
          <a className="text-ink-dim hover:text-gold-bright" href="guia.html">
            Guía del jugador
          </a>
          <a className="text-ink-dim hover:text-gold-bright" href="mapa.html">
            Mapa de ruta
          </a>
          <a className="text-ink-dim hover:text-gold-bright" href="#top">
            Volver arriba
          </a>
        </nav>
      </div>
    </footer>
  );
}
