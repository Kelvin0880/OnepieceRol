"use client";

import { useEffect } from "react";
import { m, useReducedMotion, useSpring, useTransform } from "motion/react";

// A number that rolls to its new value (berries, bounty). It mounts already showing the real value; only later
// changes roll. The text is written straight to the DOM by the motion value, so rolling never re-renders React.
export default function AnimatedNumber({ value, format = (n) => String(n), className, testId }: { value: number; format?: (n: number) => string; className?: string; testId?: string }) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, { stiffness: 90, damping: 22, mass: 0.8 });
  const text = useTransform(spring, (v) => format(Math.round(v)));

  useEffect(() => {
    if (reduce) spring.jump(value);
    else spring.set(value);
  }, [value, reduce, spring]);

  return (
    <m.span className={className} data-testid={testId}>
      {text}
    </m.span>
  );
}
