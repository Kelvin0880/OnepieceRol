import { describe, expect, it } from "vitest";
import { raiseUnderbookedWounds, kitTerms, usesKit, capUnshownWounds, extractCombatMarker, playerActSentences, dropSentences, unbookedWounds, floorWounds, foldUnknownChanges, checkConsistency, powerCapFraction, MAX_HP_LOSS_FRACTION, MAX_STAMINA_LOSS, applyVerdict, parseRefereeVerdict, sanitizeVerdict, splitSentences, stubVerdict } from "./referee";

const NARR = "El rival bloquea con el antebrazo y responde con una patada baja que se acerca a tu rodilla.";
const good = (extra = "") => JSON.stringify({ narracion: NARR, cambios: [{ nombre: "Kirito", vida: 10, aguante: 5 }, { nombre: "Bandido", vida: 20, aguante: 8 }], ...(extra ? { x: extra } : {}) });

describe("parseRefereeVerdict", () => {
  it("reads a clean verdict", () => {
    const v = parseRefereeVerdict(good())!;
    expect(v.narration).toBe(NARR);
    expect(v.changes).toEqual([{ name: "Kirito", hp: 10, stamina: 5 }, { name: "Bandido", hp: 20, stamina: 8 }]);
  });
  it("digs the object out of fences and chatter", () => {
    expect(parseRefereeVerdict("Aquí tienes:\n```json\n" + good() + "\n```\nSuerte")).not.toBeNull();
  });
  it("survives braces and quotes inside the narration", () => {
    const raw = JSON.stringify({ narracion: 'Grita "¡Corta-Tormentas!" y {algo} se rompe en dos mientras el suelo tiembla.', cambios: [] });
    expect(parseRefereeVerdict(raw)?.narration).toContain("{algo}");
  });
  it("accepts english keys, negatives and floats safely", () => {
    const v = parseRefereeVerdict(JSON.stringify({ narration: NARR, changes: [{ name: "A", hp: -5, stamina: 3.6 }] }))!;
    expect(v.changes[0]).toEqual({ name: "A", hp: 0, stamina: 4 });
  });
  it("rejects junk, missing or too-short narration and broken JSON", () => {
    expect(parseRefereeVerdict("User Safety: safe")).toBeNull();
    expect(parseRefereeVerdict("{oops")).toBeNull();
    expect(parseRefereeVerdict(JSON.stringify({ narracion: "corto", cambios: [] }))).toBeNull();
    expect(parseRefereeVerdict(JSON.stringify({ cambios: [] }))).toBeNull();
    expect(parseRefereeVerdict("")).toBeNull();
  });
  it("ignores nameless or malformed changes", () => {
    const v = parseRefereeVerdict(JSON.stringify({ narracion: NARR, cambios: [null, 3, { vida: 5 }, { nombre: "  ", vida: 5 }, { nombre: "B", vida: 2 }] }))!;
    expect(v.changes).toEqual([{ name: "B", hp: 2, stamina: 0 }]);
  });
});

describe("applyVerdict", () => {
  const verdict = { narration: NARR, changes: [{ name: "kirito", hp: 30, stamina: 10 }, { name: "Bandido", hp: 500, stamina: 500 }] };
  it("matches names ignoring case and accents and subtracts", () => {
    const [k] = applyVerdict(verdict, [{ name: "Kirito", hp: 100, maxHp: 100, stamina: 80 }]);
    expect(k).toMatchObject({ hpLoss: 30, staminaLoss: 10, hpAfter: 70, staminaAfter: 70 });
    const [acc] = applyVerdict({ narration: NARR, changes: [{ name: "Ácido", hp: 4, stamina: 0 }] }, [{ name: "acido", hp: 10, maxHp: 10 }]);
    expect(acc.hpLoss).toBe(4);
    expect(acc.staminaAfter).toBeNull();
  });
  it("caps a single exchange at half the maximum life and a stamina ceiling", () => {
    const [b] = applyVerdict(verdict, [{ name: "Bandido", hp: 200, maxHp: 200, stamina: 100 }]);
    expect(b.hpLoss).toBe(200 * MAX_HP_LOSS_FRACTION);
    expect(b.staminaLoss).toBe(MAX_STAMINA_LOSS);
  });
  it("can finish someone already at half life or less, never below zero", () => {
    const [b] = applyVerdict({ narration: NARR, changes: [{ name: "Bandido", hp: 50, stamina: 0 }] }, [{ name: "Bandido", hp: 40, maxHp: 100 }]);
    expect(b).toMatchObject({ hpLoss: 40, hpAfter: 0 });
  });
  it("cannot kill a healthy fighter in one exchange", () => {
    const [b] = applyVerdict({ narration: NARR, changes: [{ name: "Bandido", hp: 100, stamina: 0 }] }, [{ name: "Bandido", hp: 100, maxHp: 100 }]);
    expect(b.hpAfter).toBe(50);
  });
  it("protects a fighter who has not been attacked yet", () => {
    const [k] = applyVerdict(verdict, [{ name: "Kirito", hp: 100, maxHp: 100, stamina: 80, protectedThisExchange: true }]);
    expect(k).toMatchObject({ hpLoss: 0, staminaLoss: 0, hpAfter: 100, staminaAfter: 80 });
  });
  it("adds several entries for the same fighter and leaves unmentioned ones untouched", () => {
    const v = { narration: NARR, changes: [{ name: "A", hp: 5, stamina: 1 }, { name: "A", hp: 6, stamina: 2 }] };
    const out = applyVerdict(v, [{ name: "A", hp: 50, maxHp: 50 }, { name: "B", hp: 50, maxHp: 50 }]);
    expect(out[0].hpLoss).toBe(11);
    expect(out[1]).toMatchObject({ hpLoss: 0, hpAfter: 50 });
  });
});

describe("stubVerdict (scripted checks only)", () => {
  const strong = { name: "Fuerte", side: "player" as const, maxHp: 100, sheet: "ataque 100, defensa 100, velocidad 50" };
  const weak = { name: "Debil", side: "enemy" as const, maxHp: 100, sheet: "ataque 5, defensa 5, velocidad 5" };
  it("the stronger side loses little and the weaker loses a lot", () => {
    const v = stubVerdict([strong, weak]);
    const s = v.changes.find((c) => c.name === "Fuerte")!;
    const w = v.changes.find((c) => c.name === "Debil")!;
    expect(w.hp).toBeGreaterThan(s.hp * 3);
    expect(parseRefereeVerdict(JSON.stringify({ narracion: v.narration, cambios: v.changes }))).not.toBeNull();
  });
  it("pairs the first two actors when nobody is an enemy (a duel)", () => {
    const v = stubVerdict([{ ...strong, side: "player" }, { ...weak, side: "player" }]);
    expect(v.changes.find((c) => c.name === "Debil")!.hp).toBeGreaterThan(v.changes.find((c) => c.name === "Fuerte")!.hp);
  });
});

describe("three-part verdict", () => {
  it("assembles result, reaction and the rival's intention in that order", () => {
    const v = parseRefereeVerdict(JSON.stringify({ resultado: "El puñetazo pasó rozando tu costado sin tocarte.", reaccion_rival: "Rocco resopla, herido pero en pie.", intencion_rival: "Rocco intenta un gancho a tu mandíbula que, si conecta, te dejaría aturdido.", cambios: [] }))!;
    expect(v.narration.split("\n\n")).toHaveLength(3);
    expect(v.narration.endsWith("aturdido.")).toBe(true);
    expect(v.rivalIntent).toContain("intenta un gancho");
  });
  it("still accepts the single-field form", () => {
    expect(parseRefereeVerdict(JSON.stringify({ narracion: NARR, cambios: [] }))?.rivalIntent).toBeUndefined();
  });
});

describe("mano negra guard (sanitizeVerdict)", () => {
  const mk = (resultado: string, intent: string) => parseRefereeVerdict(JSON.stringify({ resultado, reaccion_rival: "Rocco se tambalea, herido pero sigue en pie ante ti.", intencion_rival: intent, cambios: [] }))!;

  it("the reported case: 'activo mi Haki de observación' does not become a dodge", () => {
    const v = mk("Rocco lanza un puñetazo cargado de Haki. El puñetazo conecta, pero logras esquivarlo por un estrecho margen. Tu Haki de Observación te muestra el golpe venir.", "Rocco intenta un cabezazo contra tu frente que, si conecta, te aturdiría.");
    const { verdict, report } = sanitizeVerdict(v, "Ok muchacho intenta atacarme\n-Activaria mi HAKI de observación-", "Rocco");
    expect(verdict.narration).not.toContain("logras esquivarlo");
    expect(verdict.narration).toContain("Tu Haki de Observación te muestra");
    expect(report.removed.some((s) => s.includes("logras esquivarlo"))).toBe(true);
  });
  it("keeps a dodge the player did write", () => {
    const v = mk("Rocco lanza un puñetazo. Logras esquivar por un palmo.", "Rocco intenta otro golpe que, si conecta, te haría retroceder.");
    const { verdict } = sanitizeVerdict(v, "Me agacho y esquivo hacia la izquierda", "Rocco");
    expect(verdict.narration).toContain("Logras esquivar por un palmo");
  });
  it("a rival attack written as landed is dropped from the intention", () => {
    const v = mk("El corte de Kirito se pierde en el aire, sin tocarlo.", "Rocco te golpea en el estómago. Rocco intenta después una patada baja que, si conecta, te derribaría.");
    const { verdict } = sanitizeVerdict(v, "Ataco con mi espada", "Rocco");
    expect(verdict.rivalIntent).not.toContain("te golpea");
    expect(verdict.rivalIntent).toContain("intenta después una patada");
  });
  it("if the whole intention was a landed hit it is replaced by a safe hand-over", () => {
    const v = mk("El corte de Kirito se pierde en el aire sin tocarlo.", "Sientes el golpe en tu costado. El puñetazo conecta y te derriba.");
    const { verdict } = sanitizeVerdict(v, "Ataco con mi espada", "Rocco");
    expect(verdict.rivalIntent).toContain("Rocco se prepara para atacar de nuevo");
    expect(verdict.narration.endsWith(verdict.rivalIntent!)).toBe(true);
  });
  it("catches accented past tenses too (te golpeó, conectó)", () => {
    const v = mk("El corte de Kirito se pierde en el aire sin tocarlo.", "El puñetazo de Rocco te golpeó en el costado. Rocco intenta una patada que, si conecta, te derribaría.");
    const { verdict } = sanitizeVerdict(v, "Ataco con mi espada", "Rocco");
    expect(verdict.rivalIntent).not.toContain("te golpeó");
    expect(verdict.rivalIntent).toContain("intenta una patada");
  });
  it("does not flag a noun 'impacto' inside an intention", () => {
    const v = mk("El corte de Kirito se pierde en el aire sin tocarlo.", "Rocco intenta un puñetazo que, si conecta, te dejaría aturdido por el impacto.");
    const { verdict } = sanitizeVerdict(v, "Ataco con mi espada", "Rocco");
    expect(verdict.rivalIntent).toContain("aturdido por el impacto");
  });
  it("does not let the narration attack for the player", () => {
    const v = mk("Te lanzas contra él y cortas su hombro. El aire se rompe.", "Rocco intenta una patada que, si conecta, te haría retroceder.");
    const { verdict } = sanitizeVerdict(v, "-Lo miraría con desdén-", "Rocco");
    expect(verdict.narration).not.toContain("Te lanzas");
  });
  it("leaves clean verdicts untouched", () => {
    const v = mk("El puñetazo llega y te alcanza el costado con fuerza.", "Rocco intenta un gancho que, si conecta, te sacudiría.");
    const { verdict, report } = sanitizeVerdict(v, "Ok, intenta atacarme", "Rocco");
    expect(report.removed).toHaveLength(0);
    expect(verdict.narration).toBe(v.narration);
  });
  it("a sentence that opens with the player's name is the narrator acting for them", () => {
    const v = mk("Kirito saca su espada y la clava en el muelle. El puñetazo de Rocco pasa a un palmo de tu cara.", "Rocco intenta un gancho que, si conecta, te sacudiría.");
    const { verdict } = sanitizeVerdict(v, "Ataco con mi espada", "Rocco", "Kirito");
    expect(verdict.narration).not.toContain("Kirito saca");
    expect(verdict.narration).toContain("pasa a un palmo");
  });
  it("splits sentences without losing text", () => {
    expect(splitSentences("Uno. Dos! ¿Tres?").join(" ")).toBe("Uno. Dos! ¿Tres?");
  });
});

describe("power cap (a weak attacker cannot take a big bite out of a tough target)", () => {
  it("grows with attack over defence and never passes the flat cap", () => {
    expect(powerCapFraction(150, 440)).toBeLessThan(0.15);
    expect(powerCapFraction(100, 100)).toBeCloseTo(0.24, 2);
    expect(powerCapFraction(1000, 100)).toBe(MAX_HP_LOSS_FRACTION);
    expect(powerCapFraction(0, 100)).toBe(0.06);
  });
  it("the reported case: a level-28 brute cannot cost a level-45 Yonko most of his life in one exchange", () => {
    const v = { narration: NARR, changes: [{ name: "Kirito", hp: 200, stamina: 10 }] };
    const [k] = applyVerdict(v, [{ name: "Kirito", hp: 471, maxHp: 526, stamina: 300, incomingAtk: 150, defense: 440 }]);
    expect(k.hpLoss).toBeLessThan(80);
  });
  it("does not limit a strong attacker on a weak target", () => {
    const v = { narration: NARR, changes: [{ name: "Debil", hp: 200, stamina: 0 }] };
    const [d] = applyVerdict(v, [{ name: "Debil", hp: 400, maxHp: 400, incomingAtk: 500, defense: 50 }]);
    expect(d.hpLoss).toBe(200);
  });
});

describe("defeated + coherence", () => {
  it("a fighter declared out at half life or less drops to zero", () => {
    const v = { narration: NARR, changes: [{ name: "Rocco", hp: 10, stamina: 0 }], defeated: ["Rocco"] };
    const [r] = applyVerdict(v, [{ name: "Rocco", hp: 100, maxHp: 480 }]);
    expect(r).toMatchObject({ hpLoss: 100, hpAfter: 0 });
  });
  it("is refused above half life, and flagged as inconsistent", () => {
    const v = { narration: NARR, changes: [], defeated: ["Rocco"] };
    const [r] = applyVerdict(v, [{ name: "Rocco", hp: 400, maxHp: 480 }]);
    expect(r.hpAfter).toBeGreaterThan(0);
    expect(checkConsistency(v, [{ name: "Rocco", hp: 400, maxHp: 480 }]).length).toBe(1);
  });
  it("flags a narrated fall that is not listed, and the sanitizer drops it", () => {
    const v = { narration: "Su cuerpo cae inerte al suelo. La multitud calla.", changes: [] };
    expect(checkConsistency(v, [{ name: "Rocco", hp: 100, maxHp: 480 }]).length).toBe(1);
    const { verdict } = sanitizeVerdict({ ...v, narration: "El golpe le alcanza el pecho con fuerza y su cuerpo cae inerte al suelo. Rocco jadea de rodillas." }, "Ataco", "Rocco");
    expect(verdict.narration).not.toContain("cae inerte");
  });
  it("accepts a listed fall", () => {
    const v = { narration: "Rocco cae inconsciente, sin poder continuar.", changes: [], defeated: ["Rocco"] };
    expect(checkConsistency(v, [{ name: "Rocco", hp: 100, maxHp: 480 }])).toEqual([]);
  });
  it("parses derrotados, huida and huyen", () => {
    const v = parseRefereeVerdict(JSON.stringify({ resultado: NARR, derrotados: ["Rocco", 5], huida: true, huyen: ["Ana"], cambios: [] }))!;
    expect(v.defeated).toEqual(["Rocco"]);
    expect(v.escaped).toBe(true);
    expect(v.fled).toEqual(["Ana"]);
  });
});

describe("rival sequences", () => {
  const long = "Rocco intenta amagar un derechazo alto para que subas la guardia y, con la intención de clavar su rodilla cubierta de Haki en tu costado; si llega a conectar, te dejaría sin aire. Si te apartas, gira para intentar un codazo descendente; si bloqueas, intenta agarrarte la muñeca para arrastrarte contra su cabezazo. Y si te quedas quieto, cierra la distancia con un gancho cubierto de Haki buscando tu mentón, mientras su otra mano prepara el siguiente golpe.";
  it("keeps the rival's conditional follow-ups about how the player might answer", () => {
    const v = { narration: `Rocco retrocede.\n\n${long}`, rivalIntent: long, changes: [] };
    const { verdict, report } = sanitizeVerdict(v, "me quedo quieto", "Rocco");
    expect(report.removed).toEqual([]);
    expect(verdict.rivalIntent).toContain("Si te apartas");
  });
  it("still drops a plain unwritten dodge that is not hypothetical", () => {
    const v = { narration: "Esquivas el golpe con facilidad.", changes: [] };
    expect(sanitizeVerdict(v, "me quedo quieto", "Rocco").report.removed.length).toBe(1);
  });
  it("asks again when the rival's announced attack is a one-liner", () => {
    const issues = checkConsistency({ narration: "x", rivalIntent: "Rocco intenta golpearte.", changes: [] }, []);
    expect(issues.some((i) => i.includes("demasiado corta"))).toBe(true);
    expect(checkConsistency({ narration: "x", rivalIntent: long, changes: [] }, [])).toEqual([]);
  });
});

describe("foldUnknownChanges", () => {
  const known = ["Barbosa", "Sebastian", "Bandido de poca monta"];
  it("books the wounds of an invented henchman on the rival of the list", () => {
    const v = { narration: "x", changes: [{ name: "Leo", hp: 30, stamina: 5 }, { name: "Barbosa", hp: 4, stamina: 0 }] };
    const out = foldUnknownChanges(v, known, "Bandido de poca monta");
    expect(out.changes).toEqual([{ name: "Bandido de poca monta", hp: 30, stamina: 5 }, { name: "Barbosa", hp: 4, stamina: 0 }]);
    const applied = applyVerdict(out, [{ name: "Bandido de poca monta", hp: 88, maxHp: 88 }]);
    expect(applied[0].hpLoss).toBeGreaterThan(0);
  });
  it("matches real names regardless of accents and case", () => {
    const v = { narration: "x", changes: [{ name: "SEBASTIÁN", hp: 6, stamina: 0 }] };
    expect(foldUnknownChanges(v, known, "Bandido de poca monta").changes[0].name).toBe("SEBASTIÁN");
  });
  it("does not declare the whole side fallen because an invented member fell", () => {
    const v = { narration: "x", changes: [], defeated: ["Bruno", "Barbosa"] };
    expect(foldUnknownChanges(v, known, "Bandido de poca monta").defeated).toEqual(["Barbosa"]);
  });
  it("leaves the verdict alone when the rival is not in the list", () => {
    const v = { narration: "x", changes: [{ name: "Leo", hp: 9, stamina: 0 }] };
    expect(foldUnknownChanges(v, ["Barbosa"], "Otro")).toBe(v);
  });
});

describe("wounds the story shows must cost life", () => {
  const actors = [
    { name: "Barbosa", side: "player" as const, hp: 106, maxHp: 106 },
    { name: "Akio", side: "enemy" as const, hp: 185, maxHp: 185 },
  ];
  const narration =
    "Akio lanzó su katana en un movimiento proyectil, logrando que el filo rozara tu hombro izquierdo. Sentiste un ardor punzante. Elevaste tu pistola y disparaste a bocajarro; el impacto de la bala en su cuerpo lo hizo tambalear hacia atrás.\n\nAkio, herido y tambaleante tras recibir el disparo, se detuvo.\n\nAkio intenta agarrarte por la muñeca y, si llega a conectar, un corte profundo.";
  const verdict = { narration, rivalIntent: "Akio intenta agarrarte por la muñeca y, si llega a conectar, un corte profundo.", changes: [{ name: "Barbosa", hp: 0, stamina: 0 }, { name: "Akio", hp: 0, stamina: 0 }] };

  it("flags both fighters when the numbers are all zero, ignoring the rival's announced intention", () => {
    const missing = unbookedWounds(verdict, actors, true);
    expect(missing.map((m) => m.name).sort()).toEqual(["Akio", "Barbosa"]);
    expect(checkConsistency(verdict, actors, true).some((i) => i.includes("Barbosa"))).toBe(true);
  });

  it("books a minimum only for the wounded, and never touches life the model already booked", () => {
    const floored = floorWounds(verdict, actors, true);
    const loss = (n: string) => floored.changes.find((c) => c.name === n)!.hp;
    expect(loss("Akio")).toBe(Math.round(185 * 0.08));
    expect(loss("Barbosa")).toBeGreaterThan(0);
    const booked = floorWounds({ ...verdict, changes: [{ name: "Barbosa", hp: 9, stamina: 0 }, { name: "Akio", hp: 20, stamina: 0 }] }, actors, true);
    expect(booked.changes.map((c) => c.hp)).toEqual([9, 20]);
  });

  it("does not invent wounds for a dodged or missed attack", () => {
    const clean = { narration: "El lingote pasó de largo y se estrelló contra la pared. Akio permanece intacto.", changes: [], };
    expect(unbookedWounds(clean, actors, true)).toEqual([]);
  });
});

describe("scene narration must not act for the player", () => {
  const written = "Ajeno a aquello, me quedo mirando a Akio con la mano sobre el mango de mi katana enfundada, con mi Haki de observación activo. Ven y empecemos esta batalla";
  const narration =
    'Akio desaparece de su posición y su katana llega a tu cuello en un tajo horizontal. Tu espada aún está en su vaina. Te lanzas hacia atrás y a un lado, con brusquedad. Con un gruñido de esfuerzo, tu mano derecha actúa. Llevas la vaina de tu katana en un bloqueo ascendente. Akio intenta un corte y, si te apartas, girará sobre su pie.';
  it("flags the dodge and the block the player never wrote, but not the rival's conditional plan", () => {
    const bad = playerActSentences(narration, written);
    expect(bad.some((s) => s.includes("Te lanzas hacia atrás"))).toBe(true);
    expect(bad.some((s) => s.includes("Llevas la vaina"))).toBe(true);
    expect(bad.some((s) => s.includes("si te apartas"))).toBe(false);
  });
  it("respects a dodge the player did write", () => {
    expect(playerActSentences("Te lanzas hacia atrás y a un lado.", "Me lanzo hacia atrás para esquivar el tajo.")).toEqual([]);
  });
  it("drops only the flagged sentences", () => {
    const bad = playerActSentences(narration, written);
    const clean = dropSentences(narration, bad);
    expect(clean).not.toContain("Te lanzas");
    expect(clean).toContain("Akio desaparece");
  });
});

describe("scene narration: second real Akio case", () => {
  it("flags a resolved dodge written as the player's reaction", () => {
    const written = "Ajeno a aquello, me quedo mirando a Akio con la mano sobre el mango de mi katana enfundada. Ven y empecemos esta batalla";
    const text = "El filo atraviesa el aire donde tu cabeza estaba un instante antes. Tu reacción, forzada al límite por tu Haki, ha sido un giro brusco hacia la derecha, sintiendo el viento de la hoja pasar rozando tu mejilla. Akio pivota con una patada baja.";
    const bad = playerActSentences(text, written);
    expect(bad.length).toBeGreaterThanOrEqual(2);
    expect(dropSentences(text, bad)).toContain("Akio pivota");
  });
});

describe("extractCombatMarker", () => {
  it("takes the attacker's name out of the narration", () => {
    const r = extractCombatMarker("Akio ataca.\n\n[[COMBATE: Akio]]");
    expect(r).toEqual({ text: "Akio ataca.", attacker: "Akio" });
  });
  it("leaves a normal narration alone and strips stray markers", () => {
    expect(extractCombatMarker("Nada pasa.")).toEqual({ text: "Nada pasa.", attacker: null });
    expect(extractCombatMarker("Texto [[combate:  Kaleb ]] más").text).toBe("Texto  más");
  });
});

describe("the rival's next attack is mandatory while it stands", () => {
  const base = { narration: "Smoker se endereza y respira más fuerte, con el puro casi sin ceniza en la boca y el hombro decolorado.", changes: [] };
  it("asks for the intention when it is missing, but not when the rival falls or the mode is a duel", () => {
    expect(checkConsistency(base, [], true, true).some((i) => i.includes("intencion_rival"))).toBe(true);
    expect(checkConsistency({ ...base, defeated: ["Smoker"] }, [], true, true).some((i) => i.includes("intencion_rival"))).toBe(false);
    expect(checkConsistency(base, [], true, false).some((i) => i.includes("intencion_rival"))).toBe(false);
    expect(checkConsistency({ ...base, rivalIntent: "x".repeat(400) }, [], true, true).some((i) => i.includes("Falta"))).toBe(false);
  });
});

describe("capUnshownWounds", () => {
  const actors = [
    { name: "Kaito", side: "player" as const, hp: 466, maxHp: 520 },
    { name: "Smoker", side: "enemy" as const, hp: 1324, maxHp: 1360 },
  ];
  it("cuts life booked for a dodged strike back to a graze, keeps life for a shown hit", () => {
    const v = { narration: "Smoker se desplaza hacia atrás y tu sable no lo alcanza. Tu filo corta solo el aire.", changes: [{ name: "Smoker", hp: 351, stamina: 0 }, { name: "Kaito", hp: 60, stamina: 0 }] };
    const out = capUnshownWounds(v, actors, true);
    expect(out.changes.find((c) => c.name === "Smoker")!.hp).toBe(Math.round(1360 * 0.03));
    const hit = { narration: "El puñetazo de Smoker te golpea el costado con un dolor sordo. Tu sable no lo alcanza.", changes: [{ name: "Smoker", hp: 0, stamina: 0 }, { name: "Kaito", hp: 60, stamina: 0 }] };
    expect(capUnshownWounds(hit, actors, true).changes.find((c) => c.name === "Kaito")!.hp).toBe(60);
  });
});

describe("the rival must use its real kit", () => {
  const kit = "REPERTORIO REAL DE SMOKER (juega TODO esto): Haki de Armadura: avanzado (70/100); Haki de Observación: avanzado (78/100); Haki del Rey: no lo posee; Fruta del Diablo: Moku Moku no Mi, dominio avanzado; arma: Jitte con Kairoseki; técnicas propias: Cuerpo de humo; White Blow/White Snake; Persecución implacable.";
  it("extracts Haki, fruit, weapon and techniques", () => {
    const t = kitTerms(kit);
    expect(t).toEqual(expect.arrayContaining(["Haki", "Cuerpo de humo", "Jitte con Kairoseki"]));
    expect(t.some((x) => x.startsWith("Moku Moku"))).toBe(true);
  });
  it("accepts an intention that names a piece and rejects a generic punch", () => {
    const t = kitTerms(kit);
    expect(usesKit("Smoker finta con el jitte y lanza un White Snake hacia tus tobillos.", t)).toBe(true);
    expect(usesKit("Smoker intenta darte un puñetazo fuerte en la cara.", t)).toBe(false);
    expect(usesKit("cualquier cosa", [])).toBe(true);
  });
  it("makes checkConsistency ask for a rewrite", () => {
    const v = { narration: "x", rivalIntent: "Smoker intenta darte un puñetazo fuerte en la cara y luego otro. ".repeat(8), changes: [] };
    expect(checkConsistency(v, [], true, true, kitTerms(kit)).some((i) => i.includes("repertorio real"))).toBe(true);
  });
});

describe("raiseUnderbookedWounds", () => {
  const actors = [
    { name: "Kaito", side: "player" as const, hp: 200, maxHp: 520 },
    { name: "Smoker", side: "enemy" as const, hp: 987, maxHp: 1360 },
  ];
  it("raises a deep wound booked as a scratch to a solid hit, leaves fair numbers alone", () => {
    const v = { narration: "El tajo abre un corte limpio y profundo en el pecho de Smoker, que sangra.", changes: [{ name: "Smoker", hp: 41, stamina: 0 }, { name: "Kaito", hp: 10, stamina: 0 }] };
    const out = raiseUnderbookedWounds(v, actors, true);
    expect(out.changes.find((c) => c.name === "Smoker")!.hp).toBe(Math.round(1360 * 0.08));
    expect(out.changes.find((c) => c.name === "Kaito")!.hp).toBe(10);
    const fair = { narration: v.narration, changes: [{ name: "Smoker", hp: 150, stamina: 0 }] };
    expect(raiseUnderbookedWounds(fair, actors, true).changes[0].hp).toBe(150);
  });
});
