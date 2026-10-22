import { guard, apiError } from "@/lib/replay/http";
import { getUsage, usageSummary } from "@/lib/replay/store";
import { pricingSnapshot, refreshPricing } from "@/lib/replay/pricing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { guard(request); return Response.json({ records: getUsage(50), summary: usageSummary(), pricing: pricingSnapshot() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try { guard(request); const prices = await refreshPricing(); return Response.json({ fetchedAt: prices.fetchedAt, modelCount: Object.keys(prices.models).length }); }
  catch (error) { return apiError(error); }
}
