import type { APIRoute } from "astro";
import { confirmSubscriber } from "@/db/queries";

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response("Ungültiger Link.", { status: 400 });
  }

  const result = await confirmSubscriber(id);
  if (result.length === 0) {
    return new Response("Subscriber nicht gefunden.", { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: "/?confirmed=true" },
  });
};
