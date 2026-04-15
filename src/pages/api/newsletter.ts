import type { APIRoute } from "astro";
import { insertSubscriber } from "@/db/queries";
import { sendConfirmationEmail } from "@/lib/mail";

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString()?.trim();
  if (!email || !email.includes("@")) {
    return new Response(null, { status: 302, headers: { Location: "/?newsletter=error" } });
  }

  const result = await insertSubscriber(email);

  // Only send confirmation if this is a new subscriber
  if (result.length > 0) {
    try {
      await sendConfirmationEmail(result[0]);
    } catch (err) {
      console.error("Failed to send confirmation email:", err);
    }
  }

  return new Response(null, { status: 302, headers: { Location: "/?newsletter=success" } });
};
