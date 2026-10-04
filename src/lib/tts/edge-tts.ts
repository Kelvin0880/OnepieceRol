// Server-side narration synthesis via edge-tts-universal, a Node port of Microsoft Edge's unofficial "Read
// aloud" service. It's free and far more natural than any installed browser voice, but it's not a stable API
// contract — Microsoft can throttle or change it without notice. The /api/tts route (and ultimately the
// browser speechSynthesis fallback in src/lib/ui/speech.ts) is the real safety net; the circuit breaker below
// just means a bad stretch fails fast instead of piling up slow, doomed requests against our own server.
import { EdgeTTS } from "edge-tts-universal";

const VOICE = "es-MX-JorgeNeural";
const RATE = "-5%";
const PITCH = "-2Hz";
const SYNTH_TIMEOUT_MS = 20000;
const CIRCUIT_THRESHOLD = 4;
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000;

export class EdgeTtsUnavailableError extends Error {}

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`edge-tts timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function resetCircuitForTest(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

export async function synthesizeNarration(text: string): Promise<Buffer> {
  if (Date.now() < circuitOpenUntil) throw new EdgeTtsUnavailableError("edge-tts: circuit open after repeated failures");
  try {
    const tts = new EdgeTTS(text, VOICE, { rate: RATE, pitch: PITCH });
    const result = await withTimeout(tts.synthesize(), SYNTH_TIMEOUT_MS);
    const buf = Buffer.from(await result.audio.arrayBuffer());
    if (buf.length === 0) throw new Error("edge-tts returned empty audio");
    consecutiveFailures = 0;
    return buf;
  } catch (err) {
    consecutiveFailures++;
    if (consecutiveFailures >= CIRCUIT_THRESHOLD) circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    throw new EdgeTtsUnavailableError(err instanceof Error ? err.message : String(err));
  }
}
