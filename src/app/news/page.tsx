"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface NewsItem {
  id: string;
  headline: string;
  body: string;
  category: string;
  createdAt: string;
}

const CATEGORY_COLOR: Record<string, string> = {
  Recompensas: "text-gold-bright",
  Frutas: "text-purple-300",
  Poneglifos: "text-cyan-300",
  Tripulaciones: "text-emerald-300",
  Guerra: "text-blood",
  Muertes: "text-blood",
  "Gobierno Mundial": "text-ink-dim",
};

export default function NewsPage() {
  const router = useRouter();
  const [news, setNews] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((d) => setNews(d.news));
  }, []);

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-gold-bright">El Heraldo del Mundo</h1>
        <button onClick={() => router.back()} className="btn-ghost px-3 py-1.5 text-sm">
          Volver
        </button>
      </div>
      <p className="text-ink-dim text-sm mb-6">
        El mundo se mueve incluso cuando tú no lo haces. Estas son las noticias que corren de isla en isla.
      </p>

      {!news ? (
        <p className="text-ink-dim">Cargando...</p>
      ) : news.length === 0 ? (
        <p className="text-ink-dim">Los mares están, por ahora, en calma. Vuelve pronto.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {news.map((n) => (
            <div key={n.id} className="panel p-4">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs uppercase tracking-wide ${CATEGORY_COLOR[n.category] ?? "text-ink-dim"}`}>{n.category}</span>
                <span className="text-xs text-ink-dim">{new Date(n.createdAt).toLocaleString("es-ES")}</span>
              </div>
              <div className="font-display text-base">{n.headline}</div>
              <p className="text-sm text-ink-dim mt-1">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
