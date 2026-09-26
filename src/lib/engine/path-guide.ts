import type { FactionKey } from "./progression";

/**
 * "Mi camino": the next few things worth doing, read from the character's real state, so nobody is ever left wondering
 * how to progress. Each step names the panel that does it. Ordered by urgency, then by how close the goal is.
 */

export type PathPanel = "scene" | "power" | "route" | "crew" | "voyage" | "inventory" | "events" | "missions" | "prison";

export interface PathStep {
  id: string;
  title: string;
  detail: string;
  panel: PathPanel;
  urgent?: boolean;
}

export interface PathInput {
  faction: FactionKey;
  level: number;
  imprisoned: boolean;
  hp: number;
  maxHp: number;
  hasCrew: boolean;
  canHaveCrew: boolean;
  rankTitle: string;
  nextRankTitle: string | null;
  rankRemaining: number | null;
  rankMetric: string;
  seatTitle: string | null;
  /** Next seat of command up the ladder, with whether every requirement is met. */
  nextSeat: { title: string; ok: boolean; missing: string[] } | null;
  pendingSeatChallenges: number;
  activeMissions: number;
  factionContractActive: boolean;
  attributePoints: number;
  roadRead: number;
  historyRead: number;
  script: number;
  rubbings: number;
  isEmperor: boolean;
  isWarlord: boolean;
  bounty: number;
  openWorldWars: { label: string; mySide: boolean; canEnlist: boolean }[];
  openEvents: number;
}

const fmt = (n: number) => n.toLocaleString("es-ES");

export function pathSteps(p: PathInput): PathStep[] {
  const steps: PathStep[] = [];
  if (p.imprisoned) steps.push({ id: "prison", title: "Sal de la prisión", detail: "Paga la fianza si te la permiten, pide a un aliado que te rescate o planea una fuga describiendo cómo escapas.", panel: "prison", urgent: true });
  if (p.pendingSeatChallenges > 0) steps.push({ id: "seat-defense", title: "Te han desafiado por tu puesto", detail: "Tienes 24 h para aceptar el duelo o perderás el puesto.", panel: "power", urgent: true });
  if (p.hp < p.maxHp * 0.3 && !p.imprisoned) steps.push({ id: "heal", title: "Recupérate", detail: "Estás malherido: descansa o usa algo del inventario antes de buscar pelea.", panel: "inventory", urgent: true });
  if (p.attributePoints > 0) steps.push({ id: "attributes", title: `Reparte ${p.attributePoints} punto(s) de atributo`, detail: "Fuerza, agilidad, resistencia, voluntad o intelecto: cada punto cuenta en combate.", panel: "inventory" });

  if (p.activeMissions > 0) steps.push({ id: "missions", title: "Cumple los encargos de esta isla", detail: `Tienes ${p.activeMissions} activo(s)${p.factionContractActive ? ", uno de ellos de tu facción (paga rango)" : ""}. Son la forma más rápida de subir de nivel.`, panel: "missions" });
  else steps.push({ id: "explore", title: "Explora o zarpa", detail: "Aquí ya no quedan encargos: explora describiendo lo que haces o zarpa hacia otra isla.", panel: "voyage" });

  if (p.nextRankTitle && p.rankRemaining !== null) {
    const how: Record<FactionKey, string> = {
      PIRATE: "Gana peleas, cumple golpes y encargos: la recompensa sube con cada hazaña.",
      MARINE: "Arresta criminales y cumple las órdenes del cuartel.",
      REVOLUTIONARY: "Derriba a los opresores y cumple las misiones de la Revolución.",
      CP0: "Cumple operaciones encubiertas sin dejar rastro.",
      BOUNTY_HUNTER: "Cobra carteles de SE BUSCA y gana peleas.",
    };
    steps.push({ id: "rank", title: `Asciende a ${p.nextRankTitle}`, detail: `Te faltan ${fmt(p.rankRemaining)} de ${p.rankMetric.toLowerCase()}. ${how[p.faction]}`, panel: "missions" });
  }

  if (p.nextSeat) {
    steps.push(
      p.nextSeat.ok
        ? { id: "seat", title: `Desafía por el puesto de ${p.nextSeat.title}`, detail: "Cumples todo: ve a su isla o al cuartel y desafía a quien lo ocupa.", panel: "power" }
        : { id: "seat", title: `Prepárate para ${p.nextSeat.title}`, detail: `Te falta: ${p.nextSeat.missing.join(", ")}.`, panel: "power" }
    );
  } else if (p.seatTitle) {
    steps.push({ id: "seat-hold", title: `Defiende tu puesto de ${p.seatTitle}`, detail: "Otros aspirantes y el propio mundo vendrán a por él. Mantente fuerte.", panel: "power" });
  }

  if (p.faction === "PIRATE") {
    if (!p.isEmperor && !p.isWarlord && p.level >= 15) steps.push({ id: "warlord", title: "Shichibukai o Yonko", detail: p.bounty >= 100_000_000 ? "Con tu recompensa ya puedes pedir una patente de Shichibukai (nivel 20) o aspirar al trono de Yonko (nivel 35 y 1.000 millones)." : `Shichibukai pide 100 millones de recompensa (tienes ${fmt(p.bounty)}).`, panel: "power" });
  }
  if (p.canHaveCrew && !p.hasCrew) steps.push({ id: "crew", title: "Forma o únete a una tripulación", detail: "Las escenas compartidas, las guerras y el asalto final se juegan en grupo.", panel: "crew" });

  for (const w of p.openWorldWars) {
    if (w.mySide) steps.push({ id: `war-${w.label}`, title: `Lucha en la guerra: ${w.label}`, detail: "Cada asalto ganado suma un golpe decisivo y refuerza a tu bando en los frentes.", panel: "power" });
    else if (w.canEnlist) steps.push({ id: `war-${w.label}`, title: `Hay una guerra: ${w.label}`, detail: "Puedes alistarte en un bando desde Poder → Guerra.", panel: "power" });
  }

  if (p.rubbings > 0) steps.push({ id: "rubbings", title: `Descifra tus ${p.rubbings} calco(s)`, detail: p.script >= 25 ? "Ya sabes algo de lengua antigua: prueba a descifrarlos." : "Aprende la lengua antigua en Ohara o dáselos a un compañero que sepa leer.", panel: "route" });
  if (p.level >= 12 && (p.roadRead < 4 || p.historyRead < 6)) {
    steps.push({
      id: "poneglyphs",
      title: p.script < 25 ? "Aprende la lengua antigua en Ohara" : "Sigue la ruta de los Poneglifos",
      detail: `${p.historyRead}/6 de Historia y ${p.roadRead}/4 de Ruta leídos. El camino a Laugh Tale y al One Piece empieza aquí.`,
      panel: "route",
    });
  }
  if (p.openEvents > 0 && p.level <= 20) steps.push({ id: "events", title: "Hay eventos abiertos", detail: "Pruebas con premio fijo: inscríbete y demuestra lo que vales.", panel: "events" });

  return [...steps.filter((s) => s.urgent), ...steps.filter((s) => !s.urgent)].slice(0, 7);
}
