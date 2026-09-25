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

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
