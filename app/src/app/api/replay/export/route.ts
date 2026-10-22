import { getComparison, getReel, getResearch } from "@/lib/replay/store";
import { reelMarkdown, comparisonMarkdown, researchMarkdown } from "@/lib/replay/export";
import { apiError, guard } from "@/lib/replay/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    guard(request); const params = new URL(request.url).searchParams;
    const id = params.get("id") || "", comparison = params.get("type") === "comparison", research = params.get("type") === "research";
    const report = research ? getResearch(id) : comparison ? getComparison(id) : getReel(id);
    if (!report) return new Response("Not found", { status: 404 });
    const json = params.get("format") === "json";
    const text = json ? JSON.stringify(comparison || research ? report : { ...report, videoUrl: "", thumbnail: "" }, null, 2) : research ? researchMarkdown(getResearch(id)!) : comparison ? comparisonMarkdown(getComparison(id)!) : reelMarkdown(getReel(id)!);
    return new Response(text, { headers: { "Content-Type": json ? "application/json" : "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="one-more-replay-${id.replace(/[^a-zA-Z0-9_-]/g, "")}.${json ? "json" : "md"}"`, "Cache-Control": "no-store" } });
  } catch (err) { return apiError(err); }
}
