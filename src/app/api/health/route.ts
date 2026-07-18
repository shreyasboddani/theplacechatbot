import { getRuntimeConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const config = getRuntimeConfig();
  return Response.json(
    {
      status: "ok",
      geminiConfigured: Boolean(config.apiKey),
      fileSearchConfigured: Boolean(config.fileSearchStore),
      model: config.model,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

