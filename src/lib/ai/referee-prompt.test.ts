import { describe, expect, it } from "vitest";
import { buildRefereePrompt, type RefereeInput } from "./referee-prompt";

const base: RefereeInput = {
  mode: "solo",
  actors: [
    { name: "Kirito", side: "player", level: 45, hp: 300, maxHp: 500, stamina: 200, kit: "Haki de Armadura 100" },
    { name: "Rocco", side: "enemy", level: 30, hp: 200, maxHp: 400, personality: "orgulloso", kit: "Haki de Armadura" },
  ],
  actions: [{ name: "Kirito", text: "Bloqueo con la palma y le doy un puñetazo en la cara" }],
  pendingThreat: "Rocco lanza un puñetazo directo hacia tu cara.",
};

describe("buildRefereePrompt", () => {
  it("removes the dice and demands JSON with lives and stamina", () => {
    const { system } = buildRefereePrompt(base);
    expect(system).toContain("NO existen los dados");
    expect(system).toContain('"cambios"');
    expect(system).toContain("\"reaccion_rival\"");
    expect(system).toContain("\"intencion_rival\"");
  });
  it("hands over what is pending and what the player wrote", () => {
    const { user } = buildRefereePrompt(base);
    expect(user).toContain("INTENCIÓN PENDIENTE DEL RIVAL");
    expect(user).toContain("Rocco lanza un puñetazo directo");
    expect(user).toContain("Bloqueo con la palma");
    expect(user).toContain("vida 300/500");
  });
  it("says nothing is pending on an opening strike and protects the player", () => {
    const out = buildRefereePrompt({ ...base, pendingThreat: undefined, openingStrike: true });
    expect(out.user).toContain("No hay ataque pendiente");
    expect(out.system).toContain("NO pierde vida ni aguante en este veredicto");
  });
  it("only hurts what is really attacked and never hits without a chance to respond", () => {
    const { system } = buildRefereePrompt(base);
    expect(system).toContain("SOLO SE HIERE LO QUE SE ATACA DE VERDAD");
    expect(system).toContain("MANO NEGRA");
    expect(system).toContain("NUNCA escribas por el jugador");
    expect(system).toContain("grado de tentativa");
  });
  it("duel mode resolves both simultaneous moves and has no pending threat", () => {
    const out = buildRefereePrompt({
      mode: "duel",
      lethal: true,
      actors: [
        { name: "A", side: "player", hp: 100, maxHp: 100 },
        { name: "B", side: "player", hp: 100, maxHp: 100 },
      ],
      actions: [
        { name: "A", text: "corta" },
        { name: "B", text: "esquiva" },
      ],
    });
    expect(out.system).toContain("MODO DUELO");
    expect(out.system).toContain("Nunca escribas acciones que un jugador no escribió");
    expect(out.system).toContain("A MUERTE");
    expect(out.user).toContain("Intenciones simultáneas");
    expect(out.user).not.toContain("PENDIENTE DEL RIVAL");
  });
  it("joint mode asks for the final blow", () => {
    const out = buildRefereePrompt({ ...base, mode: "joint" });
    expect(out.system).toContain("golpe_final");
  });
  it("tells the model to resolve a dodge only if the player wrote one", () => {
    const { system } = buildRefereePrompt(base);
    expect(system).toContain("activo mi Haki de observación");
    expect(system).toContain("NO esquiva");
    expect(system).toContain("SIN atribuirle movimientos");
  });
  it("leaves room for three beats", () => {
    expect(buildRefereePrompt(base).maxTokens).toBeGreaterThan(600);
  });
  it("asks for a varied, adaptive multi-step rival attack", () => {
    const { system } = buildRefereePrompt(base);
    expect(system).toContain("OFICIO DEL RIVAL");
    expect(system).toContain("NUNCA repitas la técnica");
    expect(system).toContain("APRENDE");
  });
});
