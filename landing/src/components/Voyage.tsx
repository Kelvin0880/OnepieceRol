import { Compass, Hourglass, Lock, Mountain, Waves } from "lucide-react";
import { GAME, NEW_WORLD_POINTS, PARADISE_POINTS, REVERSE_POINTS } from "../data/content";
import { Reveal } from "../ui/Reveal";
import { Chapter } from "./Chapter";
import { Archetypes, Factions } from "./Factions";

const GATES = ["whiskyPeak", "alabasta", "waterSeven", "sabaody", "fishMan", "wano", "maryGeoise", "impelDown", "laughTale"];
const POINT_ICONS = [Lock, Hourglass, Compass, Waves];

function PointCards({ points }: { points: Array<{ title: string; text: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {points.map((p, i) => (
        <Reveal key={p.title} delay={0.1 + i * 0.07}>
          <div className="h-full rounded-2xl border border-gold/15 bg-black/25 p-4">
            <p className="font-display text-[0.78rem] font-bold tracking-[0.1em] text-gold-bright uppercase">{p.title}</p>
            <p className="mt-1.5 leading-snug text-ink-dim">{p.text}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

export function EastBlue() {
  return (
    <Chapter
      id="viaje"
      sea={0.42}
      numeral="I"
      seaName="East Blue"
      title="Donde empieza tu leyenda"
      lead="Cinco bandos, cinco islas de partida. Eliges quién eres, cómo peleas y a quién le debes lealtad. Lo demás lo escribes tú."
      after={<Factions />}
    >
      <Archetypes />
    </Chapter>
  );
}

export function ReverseMountain() {
  const byKey = new Map(GAME.islands.map((i) => [i.key, i]));
  const gates = GATES.map((k) => byKey.get(k)).filter((i): i is NonNullable<typeof i> => !!i);
  return (
    <Chapter
      id="reverse-mountain"
      sea={1}
      numeral="II"
      seaName="Reverse Mountain"
      title="La puerta del Grand Line"
      lead="Cuatro corrientes suben la montaña. Al otro lado, cada isla pide nivel y cada travesía tiene su precio."
    >
      <ul className="flex flex-col gap-3">
        {REVERSE_POINTS.map((p, i) => {
          const Icon = POINT_ICONS[i % POINT_ICONS.length];
          return (
            <Reveal key={p} delay={0.08 * i}>
              <li className="flex items-start gap-3 text-ink-dim">
                <Icon className="mt-1 h-4.5 w-4.5 shrink-0 text-gold" />
                {p}
              </li>
            </Reveal>
          );
        })}
      </ul>
      <Reveal delay={0.3}>
        <p className="mt-7 flex items-center gap-2 font-display text-[0.7rem] tracking-[0.22em] text-gold uppercase">
          <Mountain className="h-4 w-4" /> Nivel para atracar
        </p>
        <div className="mt-3 flex flex-wrap gap-2" data-testid="level-gates">
          {gates.map((isl) => (
            <span key={isl.key} className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-black/30 py-1 pr-1 pl-3 text-sm text-ink">
              {isl.name}
              <span className="rounded-full bg-gold/20 px-2 py-0.5 font-display text-[0.62rem] tracking-[0.1em] text-gold-bright">Nv {isl.minLevel}</span>
            </span>
          ))}
        </div>
      </Reveal>
    </Chapter>
  );
}

export function Paradise() {
  return (
    <Chapter
      id="paradise"
      sea={2}
      numeral="III"
      seaName="Paradise"
      side="right"
      title="Islas que recuerdan"
      lead="Aquí nadie es un extra. Cada isla tiene su gente, sus secretos y su memoria: lo que hagas hoy lo notarás mañana."
    >
      <PointCards points={PARADISE_POINTS} />
    </Chapter>
  );
}

export function NewWorld() {
  return (
    <Chapter
      id="nuevo-mundo"
      sea={3}
      numeral="IV"
      seaName="Nuevo Mundo"
      title="Donde se decide el mundo"
      lead="Los tronos se pueden perder, los asientos de mando se ganan en combate y las guerras estallan aunque tú estés durmiendo."
    >
      <PointCards points={NEW_WORLD_POINTS} />
    </Chapter>
  );
}
