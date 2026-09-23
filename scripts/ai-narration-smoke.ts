// Live verification for the AI narration/classification layer (src/lib/ai/*).
// Hits the real OpenRouter API using OPENROUTER_API_KEY from .env — not a
// deterministic unit test, just structural/behavioral assertions since AI
// *content* can't be asserted on exactly. Usage: npx tsx scripts/ai-narration-smoke.ts
import "dotenv/config";
import { narrateExplore } from "../src/lib/ai/narrate";
import { classifyPlayerAction } from "../src/lib/ai/classify-action";
import { callOpenRouter } from "../src/lib/ai/openrouter-client";

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
}

async function main() {
  console.log("--- narrateExplore (real API call) ---");
  const narrated = await narrateExplore(
    {
      characterName: "Kaze Testigo",
      faction: "PIRATE",
      level: 5,
      islandName: "Pueblo Foosha",
      islandDescription: "Un pueblo costero tranquilo de tejados rojos.",
      outcomeTier: "success",
      baseFlavorText: "Sigues un rumor local hasta un claro que nadie recuerda.",
      baseNarrative: "Encuentras un atajo útil y algo de botín menor.",
      berries: 150,
      xp: 10,
      bounty: 0,
      hpLoss: 0,
    },
    { characterId: "smoke-test" }
  );
  console.log("Narrated:", narrated);
  check("narration is non-empty", narrated.length > 0 && narrated.every((l) => l.trim().length > 0));
  check("narration is not literally the raw static fallback (AI actually ran)", narrated.join(" ") !== "Sigues un rumor local hasta un claro que nadie recuerda. Encuentras un atajo útil y algo de botín menor.");

  console.log("\n--- classifyPlayerAction: unambiguous engage (real API call) ---");
  const classified = await classifyPlayerAction("Desenfundo mi espada y cargo directo contra él, sin dudar.", ["engage", "flee"]);
  console.log("Classified:", classified);
  check("picks engage for clearly aggressive text", classified.action === "engage");
  check("source is ai, not keyword fallback (network worked)", classified.source === "ai");

  console.log("\n--- classifyPlayerAction: unambiguous flee (real API call) ---");
  const fled = await classifyPlayerAction("¡Corro tan rápido como puedo, esto es una encerrona!", ["engage", "flee"]);
  console.log("Classified:", fled);
  check("picks flee for clearly evasive text", fled.action === "flee");

  console.log("\n--- narrateExplore: bogus model list must still fall back safely, never throw ---");
  const originalKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "sk-or-v1-deliberately-invalid-key-for-testing";
  try {
    const fallback = await narrateExplore(
      {
        characterName: "Kaze",
        faction: "PIRATE",
        level: 1,
        islandName: "X",
        islandDescription: "X",
        outcomeTier: "fail",
        baseFlavorText: "FALLBACK_FLAVOR",
        baseNarrative: "FALLBACK_NARRATIVE",
        berries: 0,
        xp: 0,
        bounty: 0,
        hpLoss: 5,
      },
      { characterId: "smoke-test" }
    );
    check("falls back to exact static text on total AI failure", fallback.join(" ") === "FALLBACK_FLAVOR FALLBACK_NARRATIVE");
  } finally {
    process.env.OPENROUTER_API_KEY = originalKey;
  }

  console.log("\n--- classifyPlayerAction: bogus key must fall back to keyword matching, never throw ---");
  process.env.OPENROUTER_API_KEY = "sk-or-v1-deliberately-invalid-key-for-testing";
  try {
    const kw = await classifyPlayerAction("Ataco con todo lo que tengo.", ["engage", "flee"]);
    check("falls back to keyword classification on AI failure", kw.action === "engage" && kw.source === "keyword_fallback");
  } finally {
    process.env.OPENROUTER_API_KEY = originalKey;
  }

  console.log("\n--- raw callOpenRouter sanity check ---");
  const raw = await callOpenRouter("Responde solo con la palabra OK.", "Di OK.", { models: ["openrouter/free"], timeoutMs: 10_000 });
  console.log("Raw response:", raw);
  check("raw call returns non-empty text", raw.trim().length > 0);

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("SMOKE SCRIPT CRASHED:", e);
  process.exit(1);
});
