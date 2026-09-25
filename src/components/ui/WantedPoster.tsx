import { formatNumber } from "@/lib/ui/format";

// The iconic bounty poster. Below one million berries the World Government has not printed one yet, which is
// the same rule the rank ladder uses ("Aún sin cartel oficial").
export default function WantedPoster({ name, bounty, size = "md", deceased = false, photoUrl }: { name: string; bounty: number; size?: "sm" | "md"; deceased?: boolean; photoUrl?: string | null }) {
  const official = bounty >= 1_000_000;
  const small = size === "sm";
  return (
    <div
      className={`parchment relative rounded-sm text-center select-none ${small ? "px-2 py-1.5 w-28" : "px-4 py-3"} shadow-[0_6px_18px_-6px_rgba(0,0,0,0.8)]`}
      style={{ transform: small ? "rotate(-2deg)" : undefined }}
      data-testid="wanted-poster"
    >
      <div className={`font-display font-black tracking-[0.2em] ${small ? "text-sm" : "text-2xl"}`}>SE BUSCA</div>
      <div className={`mx-auto my-1 border-2 border-parchment-ink/60 grid place-items-center overflow-hidden font-display ${small ? "w-10 h-10 text-lg" : "w-28 h-28 text-4xl"}`} style={{ background: "rgba(59,42,23,0.12)" }} aria-hidden>
        {photoUrl ? <img src={photoUrl} alt={name} className={`w-full h-full object-cover ${deceased ? "grayscale" : ""}`} data-testid="poster-photo" /> : deceased ? "✝" : name.slice(0, 1).toUpperCase()}
      </div>
      <div className={`font-display uppercase truncate ${small ? "text-[10px]" : "text-sm"}`}>{name}</div>
      {!small && <div className="text-[10px] tracking-[0.3em] opacity-70">VIVO O MUERTO</div>}
      <div className={`font-display font-bold ${small ? "text-[11px]" : "text-lg"} mt-0.5`}>{official ? `฿ ${formatNumber(bounty)}` : bounty > 0 ? "Aún sin cartel oficial" : "Sin recompensa"}</div>
      {!small && <div className="text-[9px] tracking-widest opacity-60 mt-0.5">MARINA</div>}
    </div>
  );
}
