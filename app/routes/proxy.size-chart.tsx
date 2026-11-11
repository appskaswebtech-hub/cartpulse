import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { pickChart } from "../lib/size-chart-match";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Charts change rarely; repeat product views should not hit the app.
      "Cache-Control": "public, max-age=300",
    },
  });
}

function splitParam(value: string | null): string[] {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Verifies Shopify's proxy signature and resolves the shop.
  const { session } = await authenticate.public.appProxy(request);
  if (!session?.shop) return json({ chart: null }, 401);

  const url = new URL(request.url);
  const handle = url.searchParams.get("handle");

  // The endpoint only serves product pages — no handle, no answer.
  if (!handle) return json({ chart: null }, 404);

  const charts = await db.sizeChart.findMany({
    where: { shop: session.shop, status: "active" },
    select: {
      id: true,
      name: true,
      unitSystem: true,
      description: true,
      columns: true,
      rows: true,
      assignType: true,
      assignValue: true,
      updatedAt: true,
    },
  });

  const match = pickChart(charts, {
    handle,
    tags: splitParam(url.searchParams.get("tags")),
    collections: splitParam(url.searchParams.get("collections")),
  });

  if (!match) return json({ chart: null });

  try {
    return json({
      chart: {
        id: match.id,
        name: match.name,
        unitSystem: match.unitSystem === "in" ? "in" : "cm",
        description: match.description || "",
        columns: JSON.parse(match.columns),
        rows: JSON.parse(match.rows),
      },
    });
  } catch {
    return json({ chart: null });
  }
};
