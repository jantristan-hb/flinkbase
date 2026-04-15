import "dotenv/config";
import { insertDigestWithStories } from "../src/db/queries";

const TEST_STORIES = [
  {
    headlineDe: "OpenAI stellt GPT-5 Turbo vor — schneller, günstiger, gefährlicher?",
    headlineEn: "OpenAI Announces GPT-5 Turbo with Native Tool Use",
    summary: "OpenAI hat GPT-5 Turbo vorgestellt — doppelt so schnell wie GPT-4, 60% günstiger, und mit nativem Tool-Use ohne extra Prompting.",
    whyRelevant: "Jedes neue Frontier-Modell verschiebt die Baseline.",
    hnUrl: "https://news.ycombinator.com/item?id=40001",
    sourceUrl: "https://openai.com/blog/gpt-5-turbo",
    tags: ["openai", "llm", "gpt-5"],
  },
  {
    headlineDe: "EU verhängt erste Strafen unter dem AI Act",
    headlineEn: "EU Issues First Fines Under the AI Act",
    summary: "Die EU-Kommission hat erstmals Strafen unter dem AI Act verhängt — gegen zwei Unternehmen, die High-Risk AI-Systeme ohne Konformitätsbewertung betrieben haben.",
    whyRelevant: "Der AI Act wird jetzt durchgesetzt.",
    hnUrl: "https://news.ycombinator.com/item?id=40002",
    sourceUrl: "https://ec.europa.eu/digital-strategy/ai-act-enforcement",
    tags: ["regulation", "eu", "ai-act"],
  },
  {
    headlineDe: "Anthropic veröffentlicht Claude Code als Open Source",
    headlineEn: "Anthropic Open Sources Claude Code CLI",
    summary: "Claude Code ist ab sofort Open Source unter Apache 2.0. Die Community kann jetzt eigene Plugins und Integrationen bauen.",
    whyRelevant: "Open-Source-AI-Tools werden zum Standard für Developer Workflows.",
    hnUrl: "https://news.ycombinator.com/item?id=40003",
    sourceUrl: "https://anthropic.com/claude-code-open-source",
    tags: ["anthropic", "claude", "open-source"],
  },
  {
    headlineDe: "Google DeepMind zeigt Roboter, der Kaffee kocht",
    headlineEn: "DeepMind Robot Makes Coffee from Scratch Using Only Vision",
    summary: "Neuer Robotik-Prototyp kann eigenständig Kaffee zubereiten — gesteuert nur durch Vision und ein Foundation Model.",
    whyRelevant: "Robotik + Foundation Models = der nächste große Markt.",
    hnUrl: "https://news.ycombinator.com/item?id=40004",
    sourceUrl: "https://deepmind.google/robotics-coffee",
    tags: ["deepmind", "robotik", "foundation-models"],
  },
  {
    headlineDe: "NVIDIA meldet Rekord-Quartal: H200 ausverkauft bis Q3 2027",
    headlineEn: "NVIDIA Reports Record Q1 — H200 Sold Out Through Q3 2027",
    summary: "NVIDIAs Q1: 42B USD Umsatz, H200 bis Q3 2027 ausverkauft. Die Frage ist nicht ob AI skaliert, sondern ob die Hardware hinterherkommt.",
    whyRelevant: "GPU-Knappheit bestimmt, wer trainieren und deployen kann.",
    hnUrl: "https://news.ycombinator.com/item?id=40005",
    sourceUrl: "https://investor.nvidia.com/q1-2027",
    tags: ["nvidia", "gpu", "infrastruktur"],
  },
];

async function seed() {
  console.log("Seeding test digest...");
  const result = await insertDigestWithStories(
    {
      digestDate: "2026-04-15",
      slot: "morgen",
      publishedAt: new Date("2026-04-15T09:00:00+02:00"),
      title: "OpenAI stellt GPT-5 Turbo vor, EU verhängt erste AI-Act-Strafen — AI Digest 15.04.2026",
      description: "OpenAI GPT-5 Turbo, erste EU AI Act Strafen, Anthropic open-sourced Claude Code...",
      summaryOfDay: "Der Tag steht im Zeichen der Konsolidierung: Während OpenAI und NVIDIA die Skalierungs-These untermauern, zeigt die EU erstmals regulatorische Zähne.",
    },
    TEST_STORIES,
    []
  );
  console.log(`✓ Seeded digest: ${result.digest.id} (${result.stories.length} stories)`);
}

seed().catch((err) => { console.error("Seed failed:", err); process.exit(1); });
