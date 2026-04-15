import { Resend } from "resend";
import type { Digest, Story, Subscriber } from "@/db/schema";
import { digestSlug } from "./date";
import { strings } from "./strings";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "flinkbase <newsletter@flinkbase.com>";
const BASE_URL = "https://flinkbase.com";

export async function sendConfirmationEmail(subscriber: Subscriber) {
  const confirmUrl = `${BASE_URL}/api/confirm?id=${subscriber.id}`;

  await resend.emails.send({
    from: FROM,
    to: subscriber.email,
    subject: "Bitte bestätige dein flinkbase-Abo",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #18181b;">Fast geschafft!</h2>
        <p style="color: #3f3f46; line-height: 1.6;">
          Du hast dich für den <strong>flinkbase AI Digest</strong> angemeldet —
          die wichtigsten KI-News, 3x am Tag, auf Deutsch.
        </p>
        <p style="margin: 24px 0;">
          <a href="${confirmUrl}"
             style="background: #18181b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Anmeldung bestätigen
          </a>
        </p>
        <p style="color: #71717a; font-size: 14px;">
          Falls du dich nicht angemeldet hast, ignoriere diese E-Mail einfach.
        </p>
      </div>
    `,
  });
}

export async function sendDigestEmail(
  subscriber: Subscriber,
  digest: Digest,
  digestStories: Story[]
) {
  const digestUrl = `${BASE_URL}/digest/${digestSlug(digest.digestDate, digest.slot)}`;
  const unsubUrl = `${BASE_URL}/api/unsubscribe?id=${subscriber.id}`;

  const storiesHtml = digestStories
    .map(
      (s) => `
      <div style="padding: 16px 0; border-bottom: 1px solid #e4e4e7;">
        <h3 style="margin: 0 0 8px; color: #18181b; font-size: 18px;">${s.headlineDe}</h3>
        <p style="margin: 0 0 8px; color: #3f3f46; line-height: 1.6;">${s.summary}</p>
        <p style="margin: 0 0 8px; color: #18181b; font-size: 14px;">
          <span style="color: #71717a;">${strings.whyRelevantLabel}:</span> ${s.whyRelevant}
        </p>
        <p style="margin: 0; font-size: 13px;">
          ${s.sourceUrl ? `<a href="${s.sourceUrl}" style="color: #71717a;">Original</a> · ` : ""}
          <a href="${s.hnUrl}" style="color: #71717a;">HN-Diskussion</a>
        </p>
      </div>`
    )
    .join("");

  await resend.emails.send({
    from: FROM,
    to: subscriber.email,
    subject: digest.title,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 16px 0; border-bottom: 2px solid #18181b;">
          <a href="${BASE_URL}" style="font-size: 20px; font-weight: 700; color: #18181b; text-decoration: none;">
            flinkbase
          </a>
        </div>

        <h1 style="font-size: 22px; color: #18181b; margin: 24px 0 8px;">${digest.title}</h1>

        ${storiesHtml}

        ${
          digest.summaryOfDay
            ? `<div style="margin: 24px 0; padding: 16px; background: #fafafa; border-left: 4px solid #18181b; border-radius: 4px;">
                <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #71717a;">${strings.dayInsightLabel}</p>
                <p style="margin: 0; color: #3f3f46; line-height: 1.6;">${digest.summaryOfDay}</p>
              </div>`
            : ""
        }

        <p style="margin: 24px 0; text-align: center;">
          <a href="${digestUrl}" style="color: #71717a; font-size: 14px;">Im Browser lesen →</a>
        </p>

        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e4e4e7; text-align: center; font-size: 12px; color: #a1a1aa;">
          <p>${strings.footer}</p>
          <a href="${unsubUrl}" style="color: #a1a1aa;">Abmelden</a>
        </div>
      </div>
    `,
  });
}

export async function sendDigestToAll(
  subscriberList: Subscriber[],
  digest: Digest,
  digestStories: Story[]
) {
  let sent = 0;
  let failed = 0;

  for (const sub of subscriberList) {
    try {
      await sendDigestEmail(sub, digest, digestStories);
      sent++;
    } catch (err) {
      console.error(`  ✗ Failed to send to ${sub.email}:`, err);
      failed++;
    }
  }

  return { sent, failed };
}
