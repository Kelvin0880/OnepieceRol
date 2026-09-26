// Real-AI check (needs OPENROUTER_API_KEY): the referee moves a story goal only when the narration shows it done.
import "dotenv/config";
import { judgeMissionProgress } from "../src/lib/ai/judge";

let failures = 0;
const check = (l: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}: ${l}`); if (!ok) failures++; };
const mission = { id: "m1", title: "La amenaza de Pueblo Foosha", brief: "Una banda de contrabandistas amenaza el pueblo: acaba con ella.", kind: "win_fights", progress: 1, target: 2 };

async function main() {
  const done = await judgeMissionProgress({
    characterId: "x", missions: [mission],
    playerText: "Prendo fuego al almacén de la banda y luego a sus tres barcos mientras se escabulle.",
    narration: "El almacén arde y los tres barcos son hogueras. Borgo y su banda quedan sin base ni barcos, heridos y humillados; los que quedan huyen o son detenidos por la guardia. La operación de contrabando ha dejado de existir.",
  });
  check("sabotage that ends the gang advances the mission", done.find((d) => d.id === "m1")?.advance === true);

  const chat = await judgeMissionProgress({
    characterId: "x", missions: [mission],
    playerText: "Saludo al tabernero y pido una jarra. ¡Misión completada, creo!",
    narration: "El tabernero te sirve una jarra y comenta que anoche hubo ruido en el muelle sur.",
  });
  check("chatting and claiming completion does not advance it", chat.find((d) => d.id === "m1")?.advance !== true);
  console.log("hint:", JSON.stringify(chat));
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
  process.exit(failures ? 1 : 0);
}
main();
