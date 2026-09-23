// Ad-hoc verification script (not a committed smoke test) for the devil
// fruit "can't swim" mechanic: explores repeatedly, auto-resolving any
// pending combat (always fight, always spare) along the way, until the
// water-hazard event fires or the character dies, then prints what
// happened. Requires `npm run dev` running and a character id that
// already has a devil fruit granted (see scripts/grant-fruit.ts).
const BASE = "http://localhost:3000";
const characterId = process.argv[2];
const cookie = process.argv[3];
if (!characterId || !cookie) {
  console.error("Usage: node verify-water-hazard.mjs <characterId> <cookieHeader>");
  process.exit(1);
}

async function act(body) {
  const res = await fetch(`${BASE}/api/characters/${characterId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  for (let i = 1; i <= 150; i++) {
    let resp = await act({ action: "explore" });

    if (resp.error?.includes("enfrentamiento sin resolver")) {
      resp = await act({ action: "engage" });
      if (resp.awaitingMercyChoice) resp = await act({ action: "mercy", spare: true });
    }

    if (resp.error) {
      console.log(`[${i}] error: ${resp.error}`);
      continue;
    }

    const hitWater = resp.log?.some((l) => /mar no perdona|hunde|pulmones ardiendo|se cierra sobre ti/i.test(l));
    if (hitWater) {
      console.log(`[${i}] WATER HAZARD HIT:`, JSON.stringify(resp, null, 2));
      return;
    }

    if (resp.pendingCombat) {
      resp = await act({ action: "engage" });
      if (resp.awaitingMercyChoice) {
        resp = await act({ action: "mercy", spare: true });
      }
    }

    if (resp.died) {
      console.log(`[${i}] DIED:`, JSON.stringify(resp, null, 2));
      return;
    }
  }
  console.log("No water hazard hit in 150 attempts.");
}

main();
