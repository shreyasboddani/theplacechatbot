import { getRuntimeConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const config = getRuntimeConfig();
  const ready = Boolean(config.apiKey && config.fileSearchStore);
  return Response.json(
    {
      status: ready ? "ok" : "unavailable",
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

