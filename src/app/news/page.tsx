"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface NewsItem {
  id: string;
  headline: string;
  body: string;
  category: string;
  severity: string;
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

const CATEGORIES = ["Recompensas", "Frutas", "Poneglifos", "Tripulaciones", "Guerra", "Muertes", "Gobierno Mundial"];

function dayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function groupByDay(items: NewsItem[]): { label: string; items: NewsItem[] }[] {
  const groups: { label: string; items: NewsItem[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function NewsCard({ item }: { item: NewsItem }) {
  const color = CATEGORY_COLOR[item.category] ?? "text-ink-dim";
  if (item.severity === "major") {
    return (
      <div className="panel p-5 border-2 border-gold-bright/60">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs uppercase tracking-wide font-semibold ${color}`}>{item.category} · Titular destacado</span>
          <span className="text-xs text-ink-dim">{new Date(item.createdAt).toLocaleString("es-ES")}</span>
        </div>
        <div className="font-display text-xl text-gold-bright">{item.headline}</div>
        <p className="text-sm text-ink-dim mt-2">{item.body}</p>
      </div>
    );
  }
  if (item.severity === "digest") {
    return (
      <div className="panel p-4 bg-black/20 border border-gold-bright/20">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs uppercase tracking-wide text-gold-bright">Cartelera · {item.category}</span>
          <span className="text-xs text-ink-dim">{new Date(item.createdAt).toLocaleString("es-ES")}</span>
        </div>
        <div className="font-display text-base">{item.headline}</div>
        <p className="text-sm text-ink-dim mt-1">{item.body}</p>
      </div>
    );
  }
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs uppercase tracking-wide ${color}`}>{item.category}</span>
        <span className="text-xs text-ink-dim">{new Date(item.createdAt).toLocaleString("es-ES")}</span>
      </div>
      <div className="font-display text-base">{item.headline}</div>
      <p className="text-sm text-ink-dim mt-1">{item.body}</p>
    </div>
  );
}

export default function NewsPage() {
  const router = useRouter();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const load = useCallback((cat: string | null) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "20" });
    if (cat) params.set("category", cat);
    fetch(`/api/news?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setNews(d.news);
        setNextCursor(d.nextCursor);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load(category);
  }, [category, load]);

  const loadMore = () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    const params = new URLSearchParams({ limit: "20", cursor: nextCursor });
    if (category) params.set("category", category);
    fetch(`/api/news?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setNews((prev) => [...prev, ...d.news]);
        setNextCursor(d.nextCursor);
        setLoadingMore(false);
      });
  };

  const groups = groupByDay(news);

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-gold-bright">El Heraldo del Mundo</h1>
        <button onClick={() => router.back()} className="btn-ghost px-3 py-1.5 text-sm">
          Volver
        </button>
      </div>
      <p className="text-ink-dim text-sm mb-4">
        El mundo se mueve incluso cuando tú no lo haces. Estas son las noticias que corren de isla en isla.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setCategory(null)}
          className={`px-3 py-1 rounded-full text-xs border ${!category ? "border-gold-bright text-gold-bright" : "border-white/15 text-ink-dim"}`}
        >
          Todas
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1 rounded-full text-xs border ${category === c ? "border-gold-bright text-gold-bright" : "border-white/15 text-ink-dim"}`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink-dim">Cargando...</p>
      ) : news.length === 0 ? (
        <p className="text-ink-dim">Los mares están, por ahora, en calma. Vuelve pronto.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="font-display text-sm uppercase tracking-widest text-ink-dim mb-2">{group.label}</h2>
              <div className="flex flex-col gap-3">
                {group.items.map((n) => (
                  <NewsCard key={n.id} item={n} />
                ))}
              </div>
            </div>
          ))}
          {nextCursor && (
            <button onClick={loadMore} disabled={loadingMore} className="btn-ghost self-center px-4 py-2 text-sm">
              {loadingMore ? "Cargando..." : "Cargar más"}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
