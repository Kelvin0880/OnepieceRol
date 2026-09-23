import { WeaponGrade } from "@prisma/client";

/**
 * Mass-produced gear, unlike named meito: every character who picks the
 * matching archetype (or buys one in a shop) gets their own instance, so
 * these live as a plain catalog instead of unique seeded rows.
 */
export interface CommonWeaponSpec {
  name: string;
  kind: string;
  description: string;
  atkBonus: number;
  basePrice: number;
}

export const COMMON_WEAPONS: CommonWeaponSpec[] = [
  { name: "Espada de acero", kind: "Katana", description: "Una espada de manufactura simple pero fiable.", atkBonus: 4, basePrice: 500 },
  { name: "Pistola de chispa", kind: "Pistola", description: "Un revólver de mecha estándar, ruidoso y efectivo a corta distancia.", atkBonus: 5, basePrice: 800 },
  { name: "Bo de combate", kind: "Bo", description: "Un bastón de madera endurecida, el arma favorita de quienes prefieren no matar.", atkBonus: 3, basePrice: 300 },
  { name: "Nudillos de hierro", kind: "Puños", description: "Refuerzos metálicos para convertir cada puñetazo en una amenaza real.", atkBonus: 3, basePrice: 350 },
  { name: "Sable de abordaje", kind: "Sable", description: "El sable corto de los asaltos de cubierta: ligero, rápido y muy poco elegante.", atkBonus: 5, basePrice: 700 },
  { name: "Arco largo", kind: "Arco", description: "Un arco de madera flexible, perfecto para quien prefiere la distancia... y la paciencia.", atkBonus: 5, basePrice: 650 },
  { name: "Tridente gyojin", kind: "Tridente", description: "Un tridente forjado en coral y acero, hecho para pelear con el mar de aliado.", atkBonus: 7, basePrice: 1200 },
  { name: "Cañón de mano", kind: "Cañón", description: "Una pieza de artillería adaptada a un solo brazo: retumba, humea y casi siempre convence.", atkBonus: 8, basePrice: 1800 },
  { name: "Hacha de leñador", kind: "Hacha", description: "Pesada y brutal, tan útil para talar árboles como cráneos.", atkBonus: 6, basePrice: 600 },
];

export function findCommonWeapon(name: string): CommonWeaponSpec | undefined {
  return COMMON_WEAPONS.find((w) => w.name === name);
}

export const COMMON_WEAPON_GRADE = WeaponGrade.NONE;
