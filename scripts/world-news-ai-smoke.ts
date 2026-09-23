// Live verification for the faction-aware AI news narration (real OpenRouter
// API call, not deterministic — same style as ai-narration-smoke.ts).
// Usage: npx tsx scripts/world-news-ai-smoke.ts
import "dotenv/config";
import { narrateNews, narrateBountyDigest } from "../src/lib/ai/narrate";

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
}

const FORBIDDEN_FINALITY = /\b(muere|murió|muerto|fallece|falleció|cae muerto|es capturad[oa] definitivamente|es ejecutad[oa])\b/i;

async function main() {
  console.log("--- narrateNews: MARINE-only template with a real actor (real API call) ---");
  const marineNews = await narrateNews(
    {
      category: "Gobierno Mundial",
      promptHint: "a Marine officer leads a patrol that captures or drives off a minor pirate crew",
      actorName: "Kizaru",
      actorFactionName: "Marina",
      actorRankLabel: "Almirante",
      actorPersonality: "Arrastra las palabras con pereza deliberada, como si nada le urgiera nunca.",
      heat: 20,
    },
    { headline: "[fallback] Kizaru despliega una patrulla", body: "[fallback body]" },
    { category: "Gobierno Mundial" }
  );
  console.log("Result:", marineNews);
  check("headline is non-empty and not the raw fallback", marineNews.headline.trim().length > 0 && marineNews.headline !== "[fallback] Kizaru despliega una patrulla");
  check("body is non-empty and not the raw fallback", marineNews.body.trim().length > 0 && marineNews.body !== "[fallback body]");
  check("mentions the actor by name", marineNews.headline.includes("Kizaru") || marineNews.body.includes("Kizaru"));
  check("does not claim the actor died/was executed/was permanently captured", !FORBIDDEN_FINALITY.test(marineNews.headline) && !FORBIDDEN_FINALITY.test(marineNews.body));

  console.log("\n--- narrateNews: PIRATE-only template (real API call) ---");
  const pirateNews = await narrateNews(
    {
      category: "Tripulaciones",
      promptHint: "a pirate captain recruits new crew members in a discreet port",
      actorName: "Buggy",
      actorFactionName: "Cross Guild",
      heat: 10,
    },
    { headline: "[fallback] Buggy recluta aliados", body: "[fallback body]" },
    { category: "Tripulaciones" }
  );
  console.log("Result:", pirateNews);
  check("PIRATE news headline/body non-empty and not fallback", pirateNews.headline !== "[fallback] Buggy recluta aliados" && pirateNews.body !== "[fallback body]");
  check("PIRATE news does not claim death/capture", !FORBIDDEN_FINALITY.test(pirateNews.headline) && !FORBIDDEN_FINALITY.test(pirateNews.body));

  console.log("\n--- narrateBountyDigest (real API call) ---");
  const digest = await narrateBountyDigest(
    {
      entries: [
        { name: "Shanks", factionName: "Piratas Pelirrojos", canonBounty: "4.048.900.000 berries" },
        { name: "Monkey D. Luffy", factionName: "Piratas de Sombrero de Paja", canonBounty: "3.000.000.000 berries" },
      ],
    },
    { headline: "[fallback] Cartelera de recompensas", body: "[fallback body]" }
  );
  console.log("Result:", digest);
  check("digest headline/body non-empty and not fallback", digest.headline !== "[fallback] Cartelera de recompensas" && digest.body !== "[fallback body]");
  check("digest mentions at least one of the real names", digest.body.includes("Shanks") || digest.body.includes("Luffy") || digest.headline.includes("Shanks") || digest.headline.includes("Luffy"));

  console.log(failures === 0 ? "\nAll AI news checks passed." : `\n${failures} check(s) FAILED.`);
  if (failures > 0) process.exit(1);
}

main();
