import { getStyle } from "./styles";

/** The combat style(s) each canon character really uses (names as they appear in the seeded cast). */
export const ACTOR_STYLES: Record<string, string[]> = {
  "Roronoa Zoro": ["santoryu"],
  "Dracule Mihawk": ["ittoryu"],
  "Vinsmoke Sanji": ["black_leg"],
  "Red-Leg Zeff": ["black_leg"],
  "Vinsmoke Yonji": ["black_leg"],
  "Jinbe": ["gyojin_karate"],
  "Arlong": ["gyojin_karate"],
  "Hody Jones": ["gyojin_karate"],
  "Koala": ["gyojin_karate"],
  "Hatchan": ["hachi_ryu"],
  "Rob Lucci": ["rokushiki"],
  Guernica: ["rokushiki"],
  Joseph: ["rokushiki"],
  Maha: ["rokushiki"],
  Gismonda: ["rokushiki"],
  "Gion (Momousagi)": ["ittoryu"],
  "Tokikake (Chaton)": ["ittoryu"],
  Bastille: ["marine_fencing"],
  Doll: ["marine_fencing"],
  Wyper: ["dial_combat"],
  "Kaku": ["rokushiki"],
  "Blueno": ["rokushiki"],
  "Kalifa": ["rokushiki"],
  "Fukuro": ["rokushiki"],
  "Kumadori": ["rokushiki"],
  "Stussy": ["rokushiki"],
  "Jabra": ["tekkai_kenpo"],
  "Sabo": ["ryusoken"],
  "Emporio Ivankov": ["newkama_kenpo"],
  "Inazuma": ["newkama_kenpo"],
  "Bon Clay (Mr. 2)": ["newkama_kenpo"],
  "Kin'emon": ["kitsunebi_ryu"],
  "Kozuki Oden": ["oden_nitoryu"],
  "Denjiro": ["ittoryu"],
  "Hyogoro": ["ittoryu"],
  "Carrot": ["electro"],
  "Bepo": ["electro"],
  "Inuarashi": ["electro"],
  "Nekomamushi": ["electro"],
  "Cavendish": ["rapier"],
  "Rebecca": ["rapier"],
  "Kyros": ["ittoryu"],
  "Kohza": ["ittoryu"],
  "Fujitora": ["zatoichi"],
  "Onigumo": ["jyu_ryu"],
  "Momonga": ["marine_fencing"],
  "Tashigi": ["marine_fencing"],
  "Helmeppo": ["marine_fencing"],
  "Strawberry": ["marine_fencing"],
  "Doberman": ["marine_fencing"],
  "Ronse": ["marine_fencing"],
  "Lacroix": ["marine_fencing"],
  "Maynard": ["marine_fencing"],
  "Coby": ["battleship_fist"],
  "Monkey D. Garp": ["battleship_fist"],
  "Shanks": ["ittoryu"],
  "Silvers Rayleigh": ["ittoryu"],
  "Shiryu": ["ittoryu"],
  "Brook": ["ittoryu"],
  "Ethanbaron V. Nusjuro": ["ittoryu"],
  "Trafalgar D. Water Law": ["ittoryu"],
  "Gol D. Roger": ["ittoryu"],
  "Killer": ["nitoryu"],
  "Vista": ["nitoryu"],
  "Scratchmen Apoo": ["jao_kun_do"],
  "Denjiro Kyoshiro": ["ittoryu"],
};

/** Ability lines for an actor's kit (the narrator reads these): every technique of each of its styles. */
export function styleAbilityLines(actorName: string): string[] {
  return (ACTOR_STYLES[actorName] ?? []).flatMap((id) => {
    const def = getStyle(id);
    return def ? [`Estilo: ${def.name} — ${def.techniques.map((t) => t.name).join(", ")}`] : [];
  });
}

export function actorStyleNames(actorName: string): string[] {
  return (ACTOR_STYLES[actorName] ?? []).flatMap((id) => {
    const def = getStyle(id);
    return def ? [def.name] : [];
  });
}
