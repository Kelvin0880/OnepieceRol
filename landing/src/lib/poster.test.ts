import { describe, expect, it } from "vitest";
import { posterFileName } from "./poster";

describe("posterFileName", () => {
  it("builds a safe file name from any name", () => {
    expect(posterFileName("Monkey D. Kirito")).toBe("se-busca-monkey-d-kirito.png");
    expect(posterFileName("Ñandú el Álamo")).toBe("se-busca-nandu-el-alamo.png");
    expect(posterFileName("  ¡¿?!  ")).toBe("se-busca-desconocido.png");
  });
});
