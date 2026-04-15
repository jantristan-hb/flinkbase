import { GoogleGenerativeAI } from "@google/generative-ai";
import type { HNStory } from "./hn-client.mts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface FilteredStory {
  story: HNStory;
  confidence: number;
}

export async function filterForAIRelevance(
  stories: HNStory[],
  threshold: number = 0.7
): Promise<FilteredStory[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const storySummaries = stories
    .map((s) => `ID:${s.id} | "${s.title}" | ${s.url ?? "no url"} | score:${s.score}`)
    .join("\n");

  const prompt = `Du bist ein AI-News-Kurator. Bewerte jede Story: Ist sie relevant für das Thema Künstliche Intelligenz / Machine Learning?

Relevant sind: LLMs, Foundation Models, AI-Startups, AI-Regulierung, Computer Vision, Robotik, AI-Infrastruktur (GPUs, Training), AI-Produkte, AI-Forschung (Papers), AI-Ethics.

NICHT relevant: allgemeine Tech-News, Programmierung ohne AI-Bezug, Krypto, Social Media, Hardware ohne AI-Bezug, Karriere/Jobs (außer AI-spezifisch).

Stories:
${storySummaries}

Antworte als JSON-Array. Für jede Story:
{"id": <number>, "relevant": <boolean>, "confidence": <0.0-1.0>}

NUR das JSON-Array, kein anderer Text.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed: { id: number; relevant: boolean; confidence: number }[] =
    JSON.parse(text.replace(/\`\`\`json\n?/g, "").replace(/\`\`\`\n?/g, ""));

  const storyMap = new Map(stories.map((s) => [s.id, s]));

  return parsed
    .filter((r) => r.relevant && r.confidence >= threshold)
    .map((r) => ({ story: storyMap.get(r.id)!, confidence: r.confidence }))
    .filter((r) => r.story !== undefined)
    .sort((a, b) => b.story.score * b.confidence - a.story.score * a.confidence);
}
