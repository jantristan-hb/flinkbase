import type { APIRoute } from "astro";
import { insertSubscriber } from "@/db/queries";

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString()?.trim();
  if (!email || !email.includes("@")) {
    return new Response(null, { status: 302, headers: { Location: "/?newsletter=error" } });
  }
  await insertSubscriber(email);
  return new Response(null, { status: 302, headers: { Location: "/?newsletter=success" } });
};
