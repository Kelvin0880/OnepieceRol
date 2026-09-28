import type { TierSettings } from "../lib/quality";
import { LaughTale } from "./LaughTale";
import { Paradise } from "./Paradise";
import { RedLine } from "./RedLine";
import { Storm } from "./Storm";

export function Landmarks({ settings }: { settings: TierSettings }) {
  return (
    <>
      <RedLine sparkles={Math.round(settings.sparkles * 0.5)} />
      <Paradise bubbles={settings.bubbles} />
      <Storm />
      <LaughTale sparkles={settings.sparkles} />
    </>
  );
}
