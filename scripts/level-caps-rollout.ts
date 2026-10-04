// One-time rollout of the Haki / fruit level caps (2026-10-04) plus the owner's apology gift, for every character
// that isn't dead. Idempotent: the caps settle the same way twice, the gift is marked per character and the news
// announcement is posted once — safe to re-run. Production: run with an inline DATABASE_URL against the postgres
// client (see CLAUDE.md "Deployment"), never store the URL.
// Usage: npx tsx scripts/level-caps-rollout.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { grantCapRolloutGift, syncProgressionCaps, CAP_GIFT_BERRIES } from "../src/lib/game/progression-caps";
import { postNews } from "../src/lib/game/death-resolution";
import { FULL_MASTERY_LEVEL } from "../src/lib/engine/training";

const HEADLINE = "El Haki ahora crece con tu nivel — y un regalo para todos";
const BODY =
  `Por decisión del dueño del juego, el Haki de Armadura, el de Observación, el dominio de la fruta y la maestría de los estilos solo pueden crecer hasta el tope que permite tu nivel: 10 en el nivel 1, cuatro más por cada nivel, y el máximo (100) se abre en el nivel ${FULL_MASTERY_LEVEL}, a las puertas del Nuevo Mundo. ` +
  "Nadie pierde nada: si ya habías entrenado por encima de tu tope, esos puntos quedan en reserva y vuelven solos a medida que subes de nivel. Lo puedes ver en tu ficha. " +
  `Como disculpa por las molestias, todos los personajes reciben un nivel completo, ฿ ${CAP_GIFT_BERRIES.toLocaleString("es-ES")} y la vida y el aguante al máximo. Además, junto al botón de Entrenar ya puedes elegir qué entrenar.`;

async function main() {
  const chars = await prisma.character.findMany({ where: { status: { not: "DEAD" } }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
  for (const c of chars) {
    await syncProgressionCaps(c.id);
    const r = await grantCapRolloutGift(c.id);
    const now = await prisma.character.findUniqueOrThrow({ where: { id: c.id }, select: { level: true, armamentHaki: true, observationHaki: true, fruitMastery: true, bankedArmament: true, bankedObservation: true, bankedFruit: true } });
    console.log(
      `${c.name}: ${r.granted ? "regalo entregado" : "ya lo tenía"} — nivel ${now.level}, arm ${now.armamentHaki}(+${now.bankedArmament}) obs ${now.observationHaki}(+${now.bankedObservation}) fruta ${now.fruitMastery}(+${now.bankedFruit})`,
    );
  }
  if (!(await prisma.newsItem.findFirst({ where: { headline: HEADLINE } }))) {
    await postNews(HEADLINE, BODY, "Anuncios", undefined, "major", { locationName: "Todo el mundo" });
    console.log("Anuncio publicado en las noticias.");
  } else {
    console.log("El anuncio ya estaba publicado.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
