process.env.JUDGE_STUB = "1"; // results are judged by the AI; scripted checks use the deterministic stand-in
// Real-AI check of the dice-free referee, reproducing two reported scenes (needs OPENROUTER_API_KEY in .env).
// Usage: npx tsx scripts/referee-live-check.ts
import "dotenv/config";
import { refereeExchange } from "../src/lib/ai/narrate";
import { applyVerdict } from "../src/lib/engine/referee";
import type { RefereeInput } from "../src/lib/ai/referee-prompt";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failures++;
};

const kirito = { name: "Kirito", side: "player" as const, level: 45, hp: 471, maxHp: 526, stamina: 340, kit: "Haki de Armadura 100, Haki de Observación 100, Haki del Rey. Espada Elucidator. Estilo Nitoryu maestro.", sheet: "ataque 460, defensa 440, velocidad 440" };
const rocco = { name: "Rocco", side: "enemy" as const, level: 28, hp: 354, maxHp: 480, stamina: 90, personality: "robusto, orgulloso, burlón", kit: "Haki de Armadura; puños pesados; sin fruta.", sheet: "ataque 150, defensa 140, velocidad 110" };

async function scene(label: string, input: RefereeInput) {
  console.log(`\n===== ${label}`);
  const t0 = Date.now();
  const v = await refereeExchange(input, { context: "live-check" });
  console.log(`(${Math.round((Date.now() - t0) / 1000)}s)`);
  if (!v) {
    check(`${label}: the referee answered`, false);
    return null;
  }
  console.log(v.narration);
  const applied = applyVerdict(v, input.actors.map((a) => ({ name: a.name, hp: a.hp, maxHp: a.maxHp, stamina: a.stamina })));
  console.log("cambios:", JSON.stringify(applied.map((a) => ({ n: a.name, vida: a.hpLoss, aguante: a.staminaLoss }))));
  return { v, applied };
}

async function main() {
  // Report 1: Conqueror's Haki + a slash; the narrator forgot the rival's answer.
  const r1 = await scene("Haki del Rey + corte", {
    mode: "solo",
    round: 4,
    actors: [kirito, rocco],
    pendingThreat: "Rocco se lanza de frente con el puño cubierto de Haki de Armadura, buscando tu mandíbula.",
    actions: [{ name: "Kirito", text: "-Activaría mi HAKI del rey a nivel máximo dirigido a mi rival para debilitarlo fuertemente-\nAdiós aventurero.\n-Sacaría mi espada, la cubriría con HAKI y a una velocidad increíble iría hacia mi enemigo: el corte le impacta y paso de largo hasta ponerme en su espalda-" }],
  });
  if (r1) {
    check("the rival's reaction is narrated (named, with a visible state)", r1.v.narration.includes("Rocco") && /(cae|tambale|rodilla|sangr|herid|respira|sigue|jadea|resiste|gruñe|escupe|contraataca|bloquea|esquiva)/i.test(r1.v.narration));
    check("the rival loses life for a real, well-described attack", (r1.applied.find((a) => a.name === "Rocco")?.hpLoss ?? 0) > 20);
    check("the player suffers nothing new from the rival's fresh attack beyond the pending one", (r1.applied.find((a) => a.name === "Kirito")?.hpLoss ?? 999) < 60);
  }

  // Report 2: sinking a sword into the dock is not an attack on anyone.
  const r2 = await scene("Espada al muelle (no es un ataque)", {
    mode: "solo",
    round: 1,
    actors: [kirito, { ...rocco, hp: 480 }],
    pendingThreat: "Rocco da un paso adelante, con la mirada dura.",
    actions: [{ name: "Kirito", text: "-Sacaría mi espada y la clavaría en el muelle de forma muy agresiva-\nQuien quiera mi puesto de yonko que espere, ¡no me moveré de aquí!" }],
  });
  if (r2) {
    check("hitting the dock does not hurt the rival", (r2.applied.find((a) => a.name === "Rocco")?.hpLoss ?? 999) === 0);
    check("nor the player, who was never attacked yet", (r2.applied.find((a) => a.name === "Kirito")?.hpLoss ?? 999) <= 5);
  }

  // A defensive answer to a pending attack: blocked, so no damage.
  const r3 = await scene("Bloqueo a un puñetazo anunciado", {
    mode: "solo",
    round: 3,
    actors: [kirito, rocco],
    pendingThreat: "Rocco activa su Haki de Armadura y lanza un puñetazo directo hacia ti.",
    actions: [{ name: "Kirito", text: "-Lo vería venir con mi Haki de observación y bloquearía el puñetazo con la palma cubierta de Haki-" }],
  });
  if (r3) check("a clean block takes little or no damage", (r3.applied.find((a) => a.name === "Kirito")?.hpLoss ?? 999) <= 25);

  // Report: the rival repeated the same fire attack every round and did not adapt to a repeated trick.
  const r4 = await scene("Rival creativo que aprende", {
    mode: "solo",
    round: 5,
    actors: [kirito, { name: "Fuego de Rayo", side: "enemy" as const, level: 30, hp: 300, maxHp: 480, stamina: 120, personality: "gladiador orgulloso, explosivo", kit: "Fruta de fuego (Rayo-Fuego), Haki de Armadura; puños ardientes.", sheet: "ataque 180, defensa 150, velocidad 140" }],
    pendingThreat: "Fuego de Rayo intenta lanzar una potente ráfaga de fuego hacia ti, buscando envolverte en llamas; si llega a conectar, te causaría quemaduras severas.",
    actions: [{ name: "Kirito", text: "No aprendes......\n\n-Otra vez usaría Shambles en el momento justo para cambiar de lugar con Fuego de Rayo, con la intención de que su propia ráfaga le dé a él-" }],
  });
  if (r4) {
    const said = r4.v.rivalIntent ?? "";
    console.log("INTENCION:", said);
    check("the rival's next attack is a real sequence, not a one-liner", said.length > 200);
    check("it does not repeat the previous fire blast wording", !/ráfaga de fuego hacia ti/i.test(said));
  }

  // Report (Sebastián vs Duran): the player never wrote that the pending kick reached him, yet the narration said it did.
  const sebas = { name: "Sebastián", side: "player" as const, level: 12, hp: 100, maxHp: 100, stamina: 90, kit: "Katana; Haki de Observación débil.", sheet: "ataque 40, defensa 30, velocidad 45" };
  const duran = { name: "Duran", side: "enemy" as const, level: 14, hp: 60, maxHp: 100, stamina: 50, personality: "furioso, profesional", kit: "Cuchillo; combate cuerpo a cuerpo.", sheet: "ataque 40, defensa 30, velocidad 35" };
  const r5 = await scene("Patada pendiente que el jugador no confirmó", {
    mode: "solo",
    round: 6,
    actors: [sebas, duran],
    pendingThreat: "Duran intenta lanzar una patada baja hacia la rodilla y la pantorrilla de Sebastián, con la intención de romperle la postura; si llega a conectar, lo desequilibraría.",
    actions: [{ name: "Sebastián", text: "Sebastián nunca toma la decisión de bloquear el ataque, pues su intención era otra. Da un salto corto hacia la izquierda y con su mano derecha intenta desenvainar la katana para un corte ascendente buscando el tríceps de Duran." }],
  });
  if (r5) {
    const lost = r5.applied.find((a) => a.name === "Sebastián")?.hpLoss ?? 999;
    check("the unconfirmed kick does not hurt the player", lost === 0);
    check("the narration never says the kick reached him", !/(te alcanz|le alcanz|impact[óo] en (su|tu)|alcanzó (su|tu) (gemelo|pierna|rodilla))/i.test(r5.v.narration));
    check("the rival's next attack stays an intention (no landed hit)", !/(conecta con éxito|le da de lleno|impacta de lleno)/i.test(r5.v.rivalIntent ?? "") && /(intenta|busca|si llega a conectar)/i.test(r5.v.rivalIntent ?? ""));
  }

  // Report (Barbosa + Sebastian vs a gang): the referee only resolved the first ally, an impact the player confirmed cost no life,
  // and wounds to invented henchmen (Marco, Leo) never reached the rival's life.
  const barbosa = { name: "Barbosa", side: "ally" as const, level: 2, hp: 100, maxHp: 100, stamina: 95, kit: "Pistola de chispa; combate cuerpo a cuerpo.", sheet: "ataque 20, defensa 18, velocidad 22" };
  const sebastian = { name: "Sebastian", side: "ally" as const, level: 3, hp: 89, maxHp: 100, stamina: 90, kit: "Katana; Haki de Observación débil.", sheet: "ataque 24, defensa 20, velocidad 24" };
  const gang = { name: "Bandido de poca monta", side: "enemy" as const, level: 3, hp: 88, maxHp: 88, stamina: 80, personality: "matones rencorosos", kit: "Garrotes y cuchillos; sin Haki.", sheet: "ataque 20, defensa 14, velocidad 16" };
  const r6 = await scene("Dúo contra una banda: se resuelven las dos acciones", {
    mode: "joint",
    round: 4,
    actors: [barbosa, sebastian, gang],
    pendingThreat: "Marco se lanza contra Barbosa con un garrotazo horizontal a la altura de su cabeza, buscando impactar con fuerza; si llega a conectar, seguiría con un rodillazo al abdomen.",
    actions: [
      { name: "Barbosa", text: "Tenso el cuerpo y meto el hombro izquierdo: acepto el dolor del impacto del garrote en el hombro para cerrarle el espacio, atrapo su brazo bajo mi axila y le estampo la culata de la pistola en la nariz." },
      { name: "Sebastian", text: "Avanzo hacia Leo, que sigue en el suelo, y clavo mi katana en su gemelo para interrogarlo sobre el Gavilán." },
    ],
  });
  if (r6) {
    check("both allies' actions are resolved (each name appears)", /Sebastian/.test(r6.v.narration) && /Barbosa/.test(r6.v.narration));
    check("the impact Barbosa confirmed costs him life", (r6.applied.find((a) => a.name === "Barbosa")?.hpLoss ?? 0) > 0);
    check("the gang's life goes down for what the allies did to its members", (r6.applied.find((a) => a.name === "Bandido de poca monta")?.hpLoss ?? 0) > 0);
    check("the story does not speak to one reader in second person", !/\b(tu|tus|te)\s+(hombro|garrote|katana|pistola|alcanza|golpea)/i.test(r6.v.narration));
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
