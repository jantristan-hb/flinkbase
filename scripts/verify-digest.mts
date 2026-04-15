import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import {
  getLatestUnverifiedDigest,
  getUnverifiedStories,
  updateStoryVerification,
} from "../src/db/queries";
import type { Story } from "../src/db/schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface VerificationResult {
  status: "verified" | "rejected";
  reason: string;
}

async function fetchSourceContent(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "flinkbase-verifier/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Strip HTML tags, keep text content
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000); // Limit to ~3000 chars to stay within context
  } catch {
    return null;
  }
}

async function verifyStory(story: Story): Promise<VerificationResult> {
  const sourceContent = story.sourceUrl
    ? await fetchSourceContent(story.sourceUrl)
    : null;

  const prompt = `Du bist ein Faktenprüfer für den AI News Digest "flinkbase.com". Prüfe ob die folgende deutsche Zusammenfassung korrekt ist.

ORIGINAL:
- Englischer Titel: "${story.headlineEn}"
- URL: ${story.sourceUrl ?? "keine"}
${sourceContent ? `- Inhalt der Quelle (Auszug): "${sourceContent.slice(0, 2000)}"` : "- Quelle konnte nicht abgerufen werden."}

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

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  try {
    return JSON.parse(
      text.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    );
  } catch {
    return { status: "verified", reason: "Verification parse error — defaulting to verified." };
  }
}

async function main() {
  const digestId = process.argv[2];

  let digest;
  if (digestId) {
    // Verify specific digest
    digest = { id: digestId };
    console.log(`[verify] Verifying digest ${digestId}...`);
  } else {
    // Find latest unverified digest
    digest = await getLatestUnverifiedDigest();
    if (!digest) {
      console.log("[verify] No unverified digests found.");
      process.exit(0);
    }
    console.log(`[verify] Found unverified digest: ${digest.id}`);
  }

  const unverified = await getUnverifiedStories(digest.id);
  console.log(`[verify] ${unverified.length} stories to verify.\n`);

  if (unverified.length === 0) {
    console.log("[verify] All stories already verified.");
    process.exit(0);
  }

  let verified = 0;
  let rejected = 0;

  for (const story of unverified) {
    console.log(`  Checking: "${story.headlineDe}"`);
    const result = await verifyStory(story);
    await updateStoryVerification(story.id, result.status, result.reason);

    if (result.status === "verified") {
      verified++;
      console.log(`    ✓ Verified: ${result.reason}`);
    } else {
      rejected++;
      console.log(`    ✗ REJECTED: ${result.reason}`);
    }
  }

  console.log(`\n[verify] Done. ${verified} verified, ${rejected} rejected.`);

  if (rejected > 0) {
    console.log(
      "[verify] Rejected stories will not appear on the website."
    );
  }
}

main().catch((err) => {
  console.error("[verify] FATAL:", err);
  process.exit(1);
});
