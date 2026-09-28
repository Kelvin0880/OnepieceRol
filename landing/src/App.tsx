import { MotionConfig } from "motion/react";
import { useMemo } from "react";
import { DemoScene } from "./components/DemoScene";
import { Finale } from "./components/Finale";
import { Footer } from "./components/Footer";
import { FruitSection } from "./components/FruitSection";
import { Hero } from "./components/Hero";
import { Intro, INTRO_SECONDS } from "./components/Intro";
import { Marquee } from "./components/Marquee";
import { Nav } from "./components/Nav";
import { Numbers } from "./components/Numbers";
import { RouteIndicator } from "./components/RouteIndicator";
import { SceneLayer } from "./components/SceneLayer";
import { SoundToggle } from "./components/SoundToggle";
import { Systems } from "./components/Systems";
import { EastBlue, NewWorld, Paradise, ReverseMountain } from "./components/Voyage";
import { WantedMaker } from "./components/WantedMaker";
import { usePointerTracker, useSmoothScroll, useVoyageTracker } from "./hooks/useVoyage";
import { useWakeOnInterest } from "./hooks/useWake";
import { param } from "./lib/scroll";

export default function App() {
  useVoyageTracker();
  usePointerTracker();
  useSmoothScroll();
  useWakeOnInterest();
  const { intro, clean, og } = useMemo(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const og = param("og") !== null;
    return { intro: !reduce && !og && param("nointro") === null && param("voyage") === null, clean: param("clean") !== null, og };
  }, []);
  const delay = intro ? INTRO_SECONDS - 0.2 : 0.1;

  return (
    <MotionConfig reducedMotion="user">
      <SceneLayer />
      {!clean && (
        <>
          <Intro enabled={intro} />
          {!og && <Nav />}
          {!og && <RouteIndicator />}
          <main className="relative z-10">
            <Hero delay={delay} og={og} />
            <Marquee />
            <DemoScene />
            <Numbers />
            <EastBlue />
            <ReverseMountain />
            <Paradise />
            <WantedMaker />
            <NewWorld />
            <FruitSection />
            <Systems />
            <Finale />
          </main>
          <Footer />
          {!og && <SoundToggle />}
        </>
      )}
    </MotionConfig>
  );
}
