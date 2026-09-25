// Two slow, offset wave layers along the bottom of every page. Pure CSS animation, no JS, and switched off by
// prefers-reduced-motion in globals.css.
function Wave({ fill, d }: { fill: string; d: string }) {
  return (
    <svg viewBox="0 0 2400 120" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill={fill} />
    </svg>
  );
}

const PATH_A =
  "M0 70 C150 40 300 100 450 70 C600 40 750 100 900 70 C1050 40 1200 100 1350 70 C1500 40 1650 100 1800 70 C1950 40 2100 100 2250 70 C2325 55 2375 62 2400 70 L2400 120 L0 120 Z";
const PATH_B =
  "M0 85 C200 60 400 110 600 85 C800 60 1000 110 1200 85 C1400 60 1600 110 1800 85 C2000 60 2200 110 2400 85 L2400 120 L0 120 Z";

export default function SeaBackground() {
  return (
    <div className="sea-waves" aria-hidden>
      <Wave fill="rgba(74,144,194,0.10)" d={PATH_A} />
      <Wave fill="rgba(212,169,74,0.06)" d={PATH_B} />
    </div>
  );
}
