import { prisma } from "../db";
import { fruitRemovalBlockReason, fruitRemovalPrice, FRUIT_REMOVAL_ISLAND } from "../engine/fruit-removal";

export class FruitRemovalError extends Error {}

async function loadOwned(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true, devilFruit: true } });
  if (!c || c.userId !== userId) throw new FruitRemovalError("Personaje no encontrado.");
  return c;
}

type Owned = Awaited<ReturnType<typeof loadOwned>>;

function priceFor(c: Owned): number {
  if (!c.devilFruit) return 0;
  return fruitRemovalPrice({ level: c.level, fruitType: c.devilFruit.type, awakened: c.fruitAwakened, singleton: c.devilFruit.isSingleton });
}

function blockReason(c: Owned, price: number): string | null {
  if (c.voyageToIslandId) return "Estás en plena travesía: el ritual solo se hace con los pies en Isla Kairos.";
  return fruitRemovalBlockReason({ hasFruit: !!c.devilFruit, islandName: c.currentIsland.name, alive: c.status === "ALIVE", berries: c.berries, price });
}

/** What the Isla Kairos card shows: the fruit, the price and, if it can't happen now, why. */
export async function getFruitRemovalOffer(characterId: string, userId: string) {
  const c = await loadOwned(characterId, userId);
  const price = priceFor(c);
  return {
    island: FRUIT_REMOVAL_ISLAND,
    here: c.currentIsland.name === FRUIT_REMOVAL_ISLAND,
    fruitName: c.devilFruit?.name ?? null,
    mastery: c.fruitMastery,
    awakened: c.fruitAwakened,
    price,
    berries: c.berries,
    blockedReason: blockReason(c, price),
  };
}

/**
 * The ritual of the Still Waters: the fruit's power leaves for good, its mastery with it, and the character can
 * swim again. The fruit's name must be confirmed, and the row is claimed by the very fruit and balance that were
 * checked, so a double click or a fruit eaten in between can never take the wrong power or charge twice.
 */
export async function removeDevilFruit(characterId: string, userId: string, confirmFruitName: string): Promise<{ message: string }> {
  const c = await loadOwned(characterId, userId);
  const price = priceFor(c);
  const reason = blockReason(c, price);
  if (reason) throw new FruitRemovalError(reason);
  const fruit = c.devilFruit!;
  if (confirmFruitName.trim() !== fruit.name) throw new FruitRemovalError("Confirma escribiendo el nombre exacto de tu fruta.");

  const { assertCalm } = await import("./perform-action"); // dynamic: perform-action imports the game layer
  await assertCalm(characterId, userId, "usar objetos").catch(() => {
    throw new FruitRemovalError("La Orden no te sumergirá en las Aguas Quietas con una situación sin resolver a tu alrededor: una pelea, un duelo o un peligro en la isla.");
  });

  const res = await prisma.character.updateMany({
    where: { id: characterId, devilFruitId: fruit.id, berries: { gte: price } },
    data: { devilFruitId: null, fruitMastery: 0, fruitAwakened: false, bankedFruit: 0, berries: { decrement: price } },
  });
  if (res.count === 0) throw new FruitRemovalError("El ritual ya se hizo o algo cambió mientras tanto: vuelve a intentarlo.");

  const message =
    `Pagas ฿ ${price.toLocaleString("es-ES")} a la Orden del Mar Callado. Tres días sumergido en las Aguas Quietas: el frío del Kairoseki te vacía hasta los huesos y, al tercer amanecer, el poder de la ${fruit.name} se apaga dentro de ti. ` +
    "Su poder vuelve al mar, a renacer en alguna otra fruta del mundo. Sales débil pero libre: puedes volver a nadar, y la próxima fruta que comas empezará desde cero.";
  await prisma.gameLogEntry.create({ data: { characterId, kind: "item", text: message } });
  const { postNews } = await import("./death-resolution");
  await postNews(
    `${c.name} renuncia al poder de la ${fruit.name}`,
    `En ${FRUIT_REMOVAL_ISLAND}, la Orden del Mar Callado sumergió a ${c.name} en las Aguas Quietas hasta arrancarle su fruta. El poder de la ${fruit.name} vuelve al mar.`,
    "Frutas",
    characterId,
  );
  return { message };
}
