import Anthropic from "@anthropic-ai/sdk";
import {
  getUnverifiedStories,
  updateStoryVerification,
} from "../src/db/queries";
import type { Story } from "../src/db/schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function fetchSourceContent(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "flinkbase-verifier/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);
  } catch {
    return null;
  }
}

async function verifyStory(story: Story): Promise<{ status: "verified" | "rejected"; reason: string }> {
  const sourceContent = story.sourceUrl
    ? await fetchSourceContent(story.sourceUrl)
    : null;

  const prompt = `Du bist ein Faktenprüfer für den AI News Digest "flinkbase.com". Prüfe ob die folgende deutsche Zusammenfassung korrekt ist.

ORIGINAL:
- Englischer Titel: "${story.headlineEn}"
- URL: ${story.sourceUrl ?? "keine"}
${sourceContent ? `- Inhalt der Quelle (Auszug): "${sourceContent.slice(0, 2000)}"` : "- Quelle konnte nicht abgerufen werden. Prüfe nur ob Headline und Titel zusammenpassen."}

ZUSAMMENFASSUNG (zu prüfen):
- Deutsche Headline: "${story.headlineDe}"
- Summary: "${story.summary}"
- Warum relevant: "${story.whyRelevant}"

PRÜFE:
1. Stimmt die deutsche Headline inhaltlich mit dem Originaltitel und der Quelle überein?
2. Enthält die Summary Fakten oder Behauptungen die NICHT aus der Quelle ableitbar sind? (Halluzination)
3. Ist die Themen-Zuordnung korrekt — handelt es sich wirklich um eine AI/ML-relevante Story?

Antworte als JSON:
{
  "status": "verified" oder "rejected",
  "reason": "Kurze Begründung (1-2 Sätze). Bei 'verified': was bestätigt wurde. Bei 'rejected': was falsch ist."
}

WICHTIG: Nur "rejected" wenn die Summary FAKTISCH FALSCH ist oder das Thema NICHT zur Quelle passt. Stilistische Unterschiede oder leichte Vereinfachungen sind OK.

NUR das JSON, kein anderer Text.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    return JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, ""));
  } catch {
    return { status: "verified", reason: "Parse error — defaulting to verified." };
  }
}

export async function runVerification(digestId: string): Promise<{ verified: number; rejected: number }> {
  const unverified = await getUnverifiedStories(digestId);

  if (unverified.length === 0) {
    return { verified: 0, rejected: 0 };
  }

  let verified = 0;
  let rejected = 0;

  for (const story of unverified) {
    const result = await verifyStory(story);
    await updateStoryVerification(story.id, result.status, result.reason);

    if (result.status === "verified") {
      verified++;
      console.log(`    ✓ "${story.headlineDe}" — ${result.reason}`);
    } else {
      rejected++;
      console.log(`    ✗ REJECTED: "${story.headlineDe}" — ${result.reason}`);
    }
  }

  return { verified, rejected };
}
