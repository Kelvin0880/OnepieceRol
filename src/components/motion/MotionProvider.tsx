"use client";

import type { ReactNode } from "react";
import { LazyMotion, MotionConfig } from "motion/react";

const loadFeatures = () => import("./features").then((mod) => mod.default);

// Animation features are fetched after the first paint, so they never delay the page. `strict` makes any stray
// full `motion.*` component throw, which keeps the whole app on the lightweight `m.*` components.
// reducedMotion="user" drops transform animations for players who asked their OS for less motion.
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
