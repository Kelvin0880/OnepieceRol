import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // react-three-fiber's whole rendering model is imperative mutation of three.js objects obtained from
    // hooks (scene.fog = ..., refs written every frame in useFrame) — the same pattern landing/'s own R3F
    // code already relies on, just never linted since landing/ is excluded below. The newer React-Compiler-
    // oriented react-hooks rules flag that as illegal mutation; it's the documented, correct way to use R3F,
    // not a bug, so it's disabled only for this directory rather than weakened project-wide.
    files: ["src/three/travel/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The GitHub Pages landing is its own Vite project; docs/ holds its minified build.
    "landing/**",
    "docs/**",
  ]),
]);

export default eslintConfig;
