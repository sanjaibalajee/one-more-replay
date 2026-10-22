import OpenAI from "openai";
import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/replay/http";
import { privateSettings } from "@/lib/replay/store";
import { OPENAI_MODELS, modelOption } from "@/lib/replay/models";
import { codexModels } from "@/lib/replay/codex-models";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    guard(request);
    if (new URL(request.url).searchParams.get("provider") === "codex") {
      const models = await codexModels(request.signal);
      return NextResponse.json({ models, source: "codex-cli", note: "Reported by your Codex CLI. Model access still depends on your plan and current limits." }, { headers: { "Cache-Control": "no-store" } });
    }
    const { openaiKey } = privateSettings();
    if (!openaiKey) return NextResponse.json({ models: OPENAI_MODELS, source: "catalogue", note: "Suggested models. Save an API key, then refresh to check your account’s model list." });
    const client = new OpenAI({ apiKey: openaiKey, timeout: 15000, maxRetries: 0 });
    const list = await client.models.list({ signal: request.signal });
    const models = list.data.flatMap(item => { const capability = modelOption(item.id); return capability ? [{ ...capability, id: item.id }] : []; });
    return NextResponse.json({ models, source: "account", note: "Listed for your API account. Project permissions and quotas still apply." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
