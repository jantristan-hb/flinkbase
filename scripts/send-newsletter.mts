import "dotenv/config";
import { getConfirmedSubscribers, getLatestDigest, getStoriesForDigest } from "../src/db/queries";
import { sendDigestToAll } from "../src/lib/mail";

async function main() {
  const subs = await getConfirmedSubscribers();
  console.log(`Confirmed subscribers: ${subs.length}`);

  const digest = await getLatestDigest();
  if (!digest) {
    console.log("No digest found");
    process.exit(1);
  }

  const stories = await getStoriesForDigest(digest.id);
  console.log(`Sending: "${digest.title}" (${stories.length} stories)`);

  const { sent, failed } = await sendDigestToAll(subs, digest, stories);
  console.log(`✓ Sent: ${sent}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
