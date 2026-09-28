import { Download, ImagePlus, Share2, X } from "lucide-react";
import { motion, useAnimationControls } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { bountyFor, cleanName, MAX_NAME_LENGTH } from "../lib/bounty";
import { drawPoster, posterFileName } from "../lib/poster";
import { GhostButton } from "../ui/Buttons";
import { Reveal } from "../ui/Reveal";
import { SplitText } from "../ui/SplitText";

type Photo = ImageBitmap | HTMLImageElement;

async function loadPhoto(file: File): Promise<Photo> {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

export function WantedMaker() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [canShare, setCanShare] = useState(false);
  const stamp = useAnimationControls();
  const inputId = useId();
  const bounty = bountyFor(name || "Tu nombre");

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (canvas.current) void drawPoster(canvas.current, bounty, photo);
    }, 120);
    return () => window.clearTimeout(id);
  }, [bounty.name, bounty.amount, bounty.epithet, photo]);

  useEffect(() => {
    const probe = new File([new Blob()], "x.png", { type: "image/png" });
    setCanShare(typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
  }, []);

  const bump = () => void stamp.start({ scale: [1, 1.035, 1], rotate: [0, 1.5, 0], transition: { duration: 0.5 } });

  const toBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const c = canvas.current;
      if (!c) resolve(null);
      else c.toBlob(resolve, "image/png");
    });

  const download = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = posterFileName(bounty.name);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const share = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], posterFileName(bounty.name), { type: "image/png" });
    try {
      await navigator.share({ files: [file], title: "Mi cartel de SE BUSCA", text: `¡${bounty.name} ya tiene cartel! Zarpa en Grand Line RPG.` });
    } catch {
      // The visitor closed the share sheet.
    }
  };

  return (
    <section id="cartel" data-sea="2.35" className="relative py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div className="glass rounded-3xl p-6 sm:p-9">
          <Reveal>
            <p className="eyebrow">Tu cartel</p>
          </Reveal>
          <SplitText as="h2" text="¿Cuánto vale tu cabeza?" className="mt-3 block text-[clamp(2.1rem,4.8vw,3.4rem)] font-bold text-ink" />
          <Reveal delay={0.12}>
            <p className="mt-5 text-lg text-ink-dim">Escribe tu nombre y el Gobierno Mundial imprimirá tu cartel. Descárgalo y mándaselo a tu tripulación.</p>
          </Reveal>
          <Reveal delay={0.2}>
            <label htmlFor={inputId} className="mt-8 block font-display text-[0.7rem] tracking-[0.22em] text-gold uppercase">
              Nombre del pirata
            </label>
            <input
              id={inputId}
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setName((n) => cleanName(n))}
              onKeyDown={(e) => e.key === "Enter" && bump()}
              placeholder="Ej.: Kaito «Tormenta»"
              autoComplete="off"
              spellCheck={false}
              data-testid="wanted-name"
              className="mt-2 w-full rounded-2xl border border-gold/30 bg-black/35 px-4 py-3.5 font-display text-lg tracking-[0.06em] text-ink placeholder:text-ink-mute focus:border-gold-bright focus:outline-none"
            />
            <div className="mt-5 flex flex-wrap gap-2.5">
              <GhostButton onClick={download} testId="wanted-download">
                <Download className="h-4 w-4" /> Descargar
              </GhostButton>
              {canShare && (
                <GhostButton onClick={share} testId="wanted-share">
                  <Share2 className="h-4 w-4" /> Compartir
                </GhostButton>
              )}
              <label className="relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-gold/40 bg-abyss/50 px-5 py-3 font-display text-xs font-bold tracking-[0.08em] text-ink uppercase hover:border-gold-bright hover:text-gold-bright sm:text-sm">
                <ImagePlus className="h-4 w-4" /> {photo ? "Cambiar foto" : "Poner foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  data-testid="wanted-photo"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPhoto(await loadPhoto(file));
                    bump();
                  }}
                />
              </label>
              {photo && (
                <GhostButton onClick={() => setPhoto(null)}>
                  <X className="h-4 w-4" /> Quitar foto
                </GhostButton>
              )}
            </div>
            <p className="mt-5 text-sm text-ink-mute">Recompensa de muestra: tu foto no sale de tu dispositivo. En el juego, tu recompensa depende de lo que hagas.</p>
          </Reveal>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -120, rotate: -14 }}
          whileInView={{ opacity: 1, y: 0, rotate: -2.5 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ type: "spring", stiffness: 70, damping: 11, mass: 1.1 }}
          className="relative mx-auto w-full max-w-[22rem]"
        >
          <motion.div animate={stamp} className="relative">
            <span aria-hidden className="absolute -top-3 left-1/2 z-10 h-6 w-6 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#ff8a7a,#a0231a_60%,#5a0f0a)] shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
            <canvas
              ref={canvas}
              width={600}
              height={860}
              className="block h-auto w-full rounded-sm shadow-[0_30px_60px_-20px_rgba(0,0,0,0.85),0_0_0_1px_rgba(0,0,0,0.25)]"
              role="img"
              aria-label={`Cartel de SE BUSCA de ${bounty.name}, recompensa de ${bounty.amount.toLocaleString("es-ES")} berries`}
              data-testid="wanted-canvas"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
