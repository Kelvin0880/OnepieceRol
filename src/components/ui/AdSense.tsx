"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSenseProps = {
  slot: string | undefined;
  className?: string;
};

const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-1952398982375580";

export default function AdSense({ slot, className = "" }: AdSenseProps) {
  useEffect(() => {
    if (!client || !slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // AdSense can reject an empty or unavailable slot while the page remains usable.
    }
  }, [slot]);

  if (!client || !slot) return null;

  return (
    <>
      <div className={`w-full overflow-hidden text-center ${className}`} aria-label="Publicidad">
        <ins
          className="adsbygoogle block min-h-[90px]"
          style={{ display: "block" }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </>
  );
}
