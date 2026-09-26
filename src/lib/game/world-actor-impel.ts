/**
 * The canon staff of Impel Down (2026-09-26). Magellan, Hannyabal, Sadi-chan and Domino live in world-actor-wave4.ts;
 * these are the beast-keepers and chief guards that hold each level. The rank-and-file jailers are IslandNpc rows
 * (game/island-npc-data.ts). The rescue raid meets the chief of the level it enters.
 */
import { ActorRole, FactionType } from "@prisma/client";
import type { ExtraActor } from "./world-actor-extra";

const M = FactionType.MARINE;
const MO = ActorRole.MARINE_OFFICER;

export const IMPEL_ACTORS: ExtraActor[] = [
  { name: "Blugori", role: MO, powerLevel: 46, factionType: M, factionName: "Impel Down", rankLabel: "Guardián del Nivel 1 (Infierno Carmesí)", description: "Un gigantesco guardián mitad hombre y mitad bestia que vigila la entrada del infierno: una puerta con puños del tamaño de barriles.", personality: "Fiel como un perro de presa y casi sin palabras; obedece órdenes sin pensar.", profile: { s: [72, 42, 70, 40, 24], h: [30, 24, false], ab: ["Puños aplastantes", "Embestida de bestia", "Rugido que paraliza a los novatos"], home: "impelDown" } },
  { name: "Minochihuahua", role: MO, powerLevel: 44, factionType: M, factionName: "Impel Down", rankLabel: "Jefe de guardia del Nivel 2 (Infierno de las Bestias)", canonWeapon: "Colmillos y garras", description: "Una bestia carcelera diminuta y furiosa, mitad perro, mitad hombre: hace sonar la alarma antes de que nadie note que ha llegado.", personality: "Ladra más que muerde, pero muerde. Odia a los intrusos con todo su pequeño cuerpo.", profile: { s: [52, 70, 48, 44, 34], h: [26, 32, false], ab: ["Mordisco rápido", "Aullido de alarma", "Persecución en las galerías"], home: "impelDown" } },
  { name: "Minorhinoceros", role: MO, powerLevel: 50, factionType: M, factionName: "Impel Down", rankLabel: "Jefe de guardia del Nivel 3 (Infierno del Hambre)", canonWeapon: "Cuerno", description: "Un rinoceronte carcelero de cuerpo macizo que carga contra cualquier cosa que se mueva sin permiso.", personality: "Testarudo y brutal; solo entiende de golpes de frente.", profile: { s: [80, 44, 78, 48, 26], h: [34, 26, false], ab: ["Carga con cuerno", "Piel de coraza", "Pisotón sísmico"], home: "impelDown" } },
  { name: "Saldeath", role: MO, powerLevel: 60, factionType: M, factionName: "Impel Down", rankLabel: "Jefe de guardia del Nivel 4 (Infierno Ardiente)", canonWeapon: "Cadenas y sable", description: "El carcelero mayor del Nivel 4: un hombre tranquilo, cortés y absolutamente implacable, que domina las bestias de la caldera.", personality: "Educado, frío y metódico; cada fuga fallida es para él un problema administrativo.", profile: { s: [64, 62, 66, 74, 70], h: [42, 48, false], ab: ["Manejo de bestias de la caldera", "Sable de carcelero", "Trampas en las galerías"], home: "impelDown" } },
  { name: "Minozebra", role: MO, powerLevel: 62, factionType: M, factionName: "Impel Down", rankLabel: "Jefe de guardia del Nivel 5 (Infierno Helado)", canonWeapon: "Pezuñas de acero", description: "Un guardián rayado de una velocidad absurda que patrulla el hielo del Nivel 5 como si volara.", personality: "Presumido y veloz; disfruta cazando presos en fuga.", profile: { s: [66, 88, 62, 54, 42], h: [40, 52, false], ab: ["Patada relámpago", "Carrera sobre hielo", "Rodeo de presas"], home: "impelDown" } },
  { name: "Minokoala", role: MO, powerLevel: 66, factionType: M, factionName: "Impel Down", rankLabel: "Jefe de guardia del Nivel 6 (Infierno Eterno)", canonWeapon: "Garras", description: "El guardián del último nivel, tan tranquilo y silencioso que casi se le confunde con una sombra hasta que ya tienes sus garras encima.", personality: "Silencioso, paciente y aterrador; nunca tiene prisa porque nadie sale de allí.", profile: { s: [70, 58, 74, 68, 60], h: [46, 50, false], ab: ["Garras de sombra", "Emboscada silenciosa", "Presión del último nivel"], home: "impelDown" } },
];

/** Who leads the guard of each level: the rescue raid fights this canon guard. */
export const IMPEL_LEVEL_GUARD: Record<number, string> = {
  1: "Blugori",
  2: "Minochihuahua",
  3: "Minorhinoceros",
  4: "Saldeath",
  5: "Minozebra",
  6: "Minokoala",
};
