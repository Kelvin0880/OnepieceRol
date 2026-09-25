export interface Combatant {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  /** Experience: higher levels soak more damage and tire slower (engine/resilience.ts). Absent = no adjustment. */
  level?: number;
  /** Fraction (0-0.5) of the defender's defence this attacker ignores: vibration, claw and internal-shock styles. */
  pierce?: number;
}

/** Combat is judged exchange by exchange by the AI referee (ai/narrate.ts refereeExchange, engine/referee.ts); nothing is rolled. */
