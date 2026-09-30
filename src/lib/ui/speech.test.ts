import { describe, expect, it } from "vitest";
import { pickVoice } from "./speech";

function voice(name: string, lang: string, localService: boolean): SpeechSynthesisVoice {
  return { name, lang, localService, default: false, voiceURI: name } as SpeechSynthesisVoice;
}

describe("pickVoice", () => {
  it("returns nothing when there are no voices at all", () => {
    expect(pickVoice([])).toBeUndefined();
  });

  it("prefers a Spanish-tagged voice over an equally-good non-Spanish one", () => {
    const en = voice("Google US English", "en-US", false);
    const es = voice("Google español", "es-ES", false);
    expect(pickVoice([en, es])).toBe(es);
  });

  it("prefers a network/neural voice over a robotic-sounding local one", () => {
    const local = voice("Microsoft Sabina", "es-MX", true);
    const network = voice("Google español", "es-ES", false);
    expect(pickVoice([local, network])).toBe(network);
  });

  it("falls back to any voice at all when nothing is tagged Spanish", () => {
    const en = voice("Daniel", "en-GB", true);
    expect(pickVoice([en])).toBe(en);
  });

  it("rewards a voice explicitly labelled natural/neural", () => {
    const plain = voice("Voz genérica", "es-ES", false);
    const natural = voice("Voz Natural Online", "es-ES", false);
    expect(pickVoice([plain, natural])).toBe(natural);
  });
});
