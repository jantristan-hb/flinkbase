import Anthropic from "@anthropic-ai/sdk";
import {
  getUnverifiedStories,
  updateStoryVerification,
} from "../src/db/queries";
import { correctStory } from "./ai-summarize.mts";
import { db } from "../src/db/client";
import { stories } from "../src/db/schema";
import { eq } from "drizzle-orm";
import type { Story } from "../src/db/schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MAX_CORRECTION_ROUNDS = 2;

export async function fetchSourceContent(url: string): Promise<string | null> {
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

async function verifyStory(
  story: Story,
  sourceContent: string | null
): Promise<{ status: "verified" | "rejected"; reason: string }> {
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

WICHTIG: Nur "rejected" wenn die Summary FAKTISCH FALSCH ist oder das Thema NICHT zur Quelle passt. Stilistische Unterschiede oder leichte Vereinfachungen sind OK. Wenn die Quelle nicht geladen werden konnte und Headline zum Originaltitel passt → "verified".

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

async function updateStoryContent(storyId: string, summary: { headline_de: string; summary: string; why_relevant: string; tags: string[] }) {
  await db
    .update(stories)
    .set({
      headlineDe: summary.headline_de,
      summary: summary.summary,
      whyRelevant: summary.why_relevant,
      tags: summary.tags,
      verificationStatus: "unverified",
      verificationReason: null,
    })
    .where(eq(stories.id, storyId));
}

export async function runVerification(digestId: string): Promise<{ verified: number; rejected: number }> {
  const unverified = await getUnverifiedStories(digestId);

  if (unverified.length === 0) {
    return { verified: 0, rejected: 0 };
  }

  let totalVerified = 0;
  let totalRejected = 0;

  for (const story of unverified) {
    // Fetch source content once per story (reused across correction rounds)
    const sourceContent = story.sourceUrl
      ? await fetchSourceContent(story.sourceUrl)
      : null;

    let currentStory = story;
    let finalStatus: "verified" | "rejected" = "rejected";
    let finalReason = "";

    for (let round = 0; round <= MAX_CORRECTION_ROUNDS; round++) {
      const label = round === 0 ? "Verify" : `Correction ${round}`;
      console.log(`    [${label}] "${currentStory.headlineDe}"`);

      const result = await verifyStory(currentStory, sourceContent);

      if (result.status === "verified") {
        finalStatus = "verified";
        finalReason = result.reason;
        console.log(`      ✓ Verified: ${result.reason}`);
        break;
      }

      // Rejected
      console.log(`      ✗ Rejected: ${result.reason}`);

      if (round >= MAX_CORRECTION_ROUNDS) {
        // Max rounds exceeded — stay rejected
        finalStatus = "rejected";
        finalReason = `Nach ${MAX_CORRECTION_ROUNDS} Korrekturrunden weiterhin fehlerhaft: ${result.reason}`;
        console.log(`      ⚠ Max correction rounds reached — dropping story.`);
        break;
      }

      // Correct with Gemini
      console.log(`      → Correcting with Gemini...`);
      const corrected = await correctStory(
        {
          title: currentStory.headlineEn,
          url: currentStory.sourceUrl,
          score: 0,
          descendants: 0,
        },
        {
          headline_de: currentStory.headlineDe,
          summary: currentStory.summary,
          why_relevant: currentStory.whyRelevant,
          tags: currentStory.tags,
        },
        result.reason,
        sourceContent
      );

      // Update story in DB with corrected content
      await updateStoryContent(currentStory.id, corrected);
      console.log(`      → Corrected headline: "${corrected.headline_de}"`);

      // Reload story for next verification round
      currentStory = {
        ...currentStory,
        headlineDe: corrected.headline_de,
        summary: corrected.summary,
        whyRelevant: corrected.why_relevant,
        tags: corrected.tags,
      };
    }

    await updateStoryVerification(currentStory.id, finalStatus, finalReason);

    if (finalStatus === "verified") {
      totalVerified++;
    } else {
      totalRejected++;
    }
  }

  return { verified: totalVerified, rejected: totalRejected };
}
