"use client";

import { useMemo, useState } from "react";
import { Nav, PoweredBy } from "@/components/Nav";
import { Mascot } from "@/components/Mascot";
import { Panel, PixelButton, Badge, TextInput, Segmented } from "@/components/ui";
import { SEED_SKILLS, CATEGORIES } from "@/lib/skills-seed";
import type { Skill } from "@/lib/types";

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>(SEED_SKILLS);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [source, setSource] = useState("");
  const [scraping, setScraping] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const cats = useMemo(() => {
    const extra = Array.from(new Set(skills.map((s) => s.category)));
    return Array.from(new Set([...CATEGORIES, ...extra]));
  }, [skills]);

  const filtered = skills.filter((s) => {
    const inCat = cat === "All" || s.category === cat;
    const inQ =
      !q ||
      (s.name + s.description + s.tags.join(" ")).toLowerCase().includes(q.toLowerCase());
    return inCat && inQ;
  });

  const scrape = async () => {
    setScraping(true);
    setNote(null);
    try {
      const url = source ? `/api/skills?source=${encodeURIComponent(source)}` : "/api/skills";
      const res = await fetch(url);
      const data = await res.json();
      // merge, dedupe by slug
      const map = new Map<string, Skill>();
      [...skills, ...(data.skills as Skill[])].forEach((s) => map.set(s.slug, s));
      setSkills(Array.from(map.values()));
      setNote(
        data.scraped
          ? `Scraped ${data.count} skills from ${data.source}`
          : data.error
            ? `Fallback to seed — ${data.error}`
            : "Loaded seed catalog",
      );
    } catch {
      setNote("Scrape request failed");
    } finally {
      setScraping(false);
    }
  };

  return (
    <div>
      <Nav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-pixel text-sm mb-1">SKILL_REGISTRY</h1>
            <PoweredBy />
          </div>
          <Badge tone="ink">{skills.length} in catalog</Badge>
        </div>

        {/* SCRAPER */}
        <Panel className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Mascot state={scraping ? "working" : "sherlock"} size={40} />
            <span className="font-pixel text-[10px] uppercase">Scrape a source</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <TextInput
              placeholder="https://…/README.md  or  JSON feed  (blank = seed)"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="flex-1 min-w-[240px]"
            />
            <PixelButton variant="coral" onClick={scrape} disabled={scraping}>
              {scraping ? "Scraping…" : "Scrape →"}
            </PixelButton>
          </div>
          {note && <p className="font-mono text-[11px] text-muted mt-2">{note}</p>}
        </Panel>

        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <TextInput
            placeholder="search skills…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <div className="overflow-x-auto">
            <Segmented
              options={cats.map((c) => ({ id: c, label: c }))}
              value={cat}
              onChange={setCat}
            />
          </div>
        </div>

        {/* GRID */}
        {filtered.length === 0 ? (
          <Panel className="p-10 text-center dither-stone">
            <Mascot state="sleeping" size={64} className="mx-auto" />
            <p className="font-mono text-sm mt-3">No skills match.</p>
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <Panel key={s.slug} className="p-4 pop-in flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-sans font-bold truncate">{s.name}</h3>
                  <Badge>{s.category}</Badge>
                </div>
                <p className="font-mono text-[11px] text-muted mt-2 leading-relaxed flex-1">
                  {s.description}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-1 flex-wrap">
                    {s.tags.slice(0, 3).map((t) => (
                      <span key={t} className="font-mono text-[9px] text-coral">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <span className="font-mono text-[10px] text-muted">{s.source}</span>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
