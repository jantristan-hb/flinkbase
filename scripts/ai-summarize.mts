import { GoogleGenerativeAI } from "@google/generative-ai";
import type { HNStory } from "./hn-client.mts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface StorySummary {
  headline_de: string;
  summary: string;
  why_relevant: string;
  tags: string[];
}

export async function summarizeStory(story: HNStory): Promise<StorySummary> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `Du schreibst für flinkbase.com — einen deutschen AI News Digest. Dein Stil ist meinungsstark, zugänglich und auf den Punkt, wie Morning Brew. Du zeigst Haltung, lieferst Kontext, und gelegentlich Humor. Keine trockene Nachrichtenagentur.

Fasse diese Story zusammen:

Titel: ${story.title}
URL: ${story.url ?? "keine URL"}
HN-Score: ${story.score}
HN-Kommentare: ${story.descendants}

Antworte als JSON-Objekt:
{
  "headline_de": "Deutsche Headline, max 80 Zeichen, kein Clickbait aber Aufmerksamkeit wecken",
  "summary": "2-3 Sätze auf Deutsch. Meinungsstark, mit Kontext und Einordnung.",
  "why_relevant": "Ein Satz: Warum muss ein Tech-Entscheider das wissen?",
  "tags": ["1-3 Schlagwörter, lowercase, englisch"]
}

NUR das JSON-Objekt, kein anderer Text.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text.replace(/\`\`\`json\n?/g, "").replace(/\`\`\`\n?/g, ""));
}

export async function correctStory(
  story: { title: string; url: string | null; score: number; descendants: number },
  previousSummary: StorySummary,
  rejectionReason: string,
  sourceContent: string | null
): Promise<StorySummary> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `Du schreibst für flinkbase.com — einen deutschen AI News Digest. Dein Stil ist meinungsstark, zugänglich und auf den Punkt.

Deine vorherige Zusammenfassung wurde von einem Faktenprüfer ABGELEHNT:

ORIGINAL-STORY:
- Titel: ${story.title}
- URL: ${story.url ?? "keine URL"}
- HN-Score: ${story.score}
${sourceContent ? `- Inhalt der Quelle (Auszug): "${sourceContent.slice(0, 2000)}"` : ""}

DEINE VORHERIGE ZUSAMMENFASSUNG (ABGELEHNT):
- Headline: "${previousSummary.headline_de}"
- Summary: "${previousSummary.summary}"
- Why relevant: "${previousSummary.why_relevant}"

ABLEHNUNGSGRUND:
"${rejectionReason}"

KORRIGIERE die Zusammenfassung. Halte dich STRIKT an die Originalquelle. Erfinde KEINE Fakten. Wenn die Quelle nicht genug Informationen hergibt, bleib bei dem was du sicher weißt (Titel + URL).

Antworte als JSON-Objekt:
{
  "headline_de": "Korrigierte deutsche Headline, max 80 Zeichen",
  "summary": "2-3 Sätze auf Deutsch. NUR Fakten aus der Quelle. Meinungsstark aber korrekt.",
  "why_relevant": "Ein Satz: Warum muss ein Tech-Entscheider das wissen?",
  "tags": ["1-3 Schlagwörter, lowercase, englisch"]
}

NUR das JSON-Objekt, kein anderer Text.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, ""));
}

export async function summarizeDaySummary(summaries: StorySummary[]): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const headlines = summaries.map((s) => `- ${s.headline_de}`).join("\n");
  const prompt = `Du schreibst für flinkbase.com. Hier sind die Headlines des aktuellen Digests:

${headlines}

Schreibe eine "Einordnung des Tages" — 2-3 Sätze auf Deutsch. Was ist der rote Faden? Meinungsstark und pointiert.

NUR den Text, keine Formatierung, kein JSON.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
