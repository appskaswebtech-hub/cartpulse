export interface MatchableChart {
  id: string;
  assignType: string;
  assignValue: string | null;
  updatedAt: Date;
}

export interface ProductContext {
  handle: string;
  tags: string[];
  collections: string[];
}

/** Most specific assignment wins; "all" is the fallback. */
const PRIORITY: Record<string, number> = {
  products: 1,
  collections: 2,
  tags: 3,
  all: 4,
};

function listOf(value: string | null): string[] {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function matches(chart: MatchableChart, product: ProductContext): boolean {
  const targets = listOf(chart.assignValue);

  switch (chart.assignType) {
    case "all":
      return true;
    case "products":
      return targets.includes(product.handle.toLowerCase());
    case "collections":
      return product.collections.some((handle) => targets.includes(handle.toLowerCase()));
    case "tags":
      return product.tags.some((tag) => targets.includes(tag.toLowerCase()));
    default:
      return false;
  }
}

/**
 * Picks the chart to show for a product. Ties between equally specific
 * assignments break on the most recently updated chart.
 */
export function pickChart<T extends MatchableChart>(
  charts: T[],
  product: ProductContext
): T | null {
  const candidates = charts.filter((chart) => matches(chart, product));
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const byPriority = (PRIORITY[a.assignType] ?? 99) - (PRIORITY[b.assignType] ?? 99);
    if (byPriority !== 0) return byPriority;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return candidates[0];
}
