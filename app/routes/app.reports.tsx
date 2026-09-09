import { useLoaderData, useSearchParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Page } from "@shopify/polaris";

// ─── types ───────────────────────────────────────────────────────────────────

type DateRangeKey = "7d" | "30d" | "90d" | "all";
type ReportTypeKey = "top-products" | "revenue-by-product" | "recovery-by-product";

interface ProductRow {
  title: string;
  count: number;
  revenue: number;
  recovered: number;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 3 months",
  "all": "All time",
};

const REPORT_TYPE_LABELS: Record<ReportTypeKey, string> = {
  "top-products": "Top Add to Cart Products",
  "revenue-by-product": "Revenue by Product",
  "recovery-by-product": "Recovery by Product",
};

function getDateFrom(range: DateRangeKey): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function aggregateProducts(
  carts: { cartData: string; totalPrice: string; isRecovered: boolean }[]
): ProductRow[] {
  const map = new Map<string, ProductRow>();

  for (const cart of carts) {
    let items: any[] = [];
    try { items = JSON.parse(cart.cartData); } catch { continue; }

    const cartTotal = parseFloat(cart.totalPrice) || 0;
    const perItemRevenue = items.length > 0 ? cartTotal / items.length : 0;

    for (const item of items) {
      const title: string = item.title || "Unknown";
      const qty: number = item.quantity || 1;
      const existing = map.get(title);
      if (existing) {
        existing.count += qty;
        existing.revenue += perItemRevenue * qty;
        if (cart.isRecovered) existing.recovered += qty;
      } else {
        map.set(title, {
          title,
          count: qty,
          revenue: perItemRevenue * qty,
          recovered: cart.isRecovered ? qty : 0,
        });
      }
    }
  }

  return Array.from(map.values());
}

function buildCSV(rows: ProductRow[], reportType: ReportTypeKey): string {
  const headers =
    reportType === "top-products"
      ? ["Product", "Times Added to Cart"]
      : reportType === "revenue-by-product"
      ? ["Product", "Times Added", "Revenue ($)"]
      : ["Product", "Times Added", "Recovered", "Recovery Rate (%)"];

  const lines = [headers.join(",")];

  for (const row of rows) {
    if (reportType === "top-products") {
      lines.push(`"${row.title.replace(/"/g, '""')}",${row.count}`);
    } else if (reportType === "revenue-by-product") {
      lines.push(`"${row.title.replace(/"/g, '""')}",${row.count},${row.revenue.toFixed(2)}`);
    } else {
      const rate = row.count > 0 ? Math.round((row.recovered / row.count) * 100) : 0;
      lines.push(`"${row.title.replace(/"/g, '""')}",${row.count},${row.recovered},${rate}`);
    }
  }

  return lines.join("\n");
}

// ─── loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const dateRange = (url.searchParams.get("dateRange") as DateRangeKey) || "30d";
  const reportType = (url.searchParams.get("reportType") as ReportTypeKey) || "top-products";
  const exportCsv = url.searchParams.get("export") === "csv";

  const dateFrom = getDateFrom(dateRange);

  const carts = await db.abandonedCart.findMany({
    where: {
      shop: session.shop,
      ...(dateFrom ? { createdAt: { gte: dateFrom } } : {}),
    },
    select: { cartData: true, totalPrice: true, isRecovered: true },
  });

  const allRows = aggregateProducts(carts);

  let sorted: ProductRow[];
  if (reportType === "top-products") {
    sorted = allRows.sort((a, b) => b.count - a.count);
  } else if (reportType === "revenue-by-product") {
    sorted = allRows.sort((a, b) => b.revenue - a.revenue);
  } else {
    sorted = allRows.sort((a, b) => b.recovered - a.recovered);
  }

  if (exportCsv) {
    const csv = buildCSV(sorted, reportType);
    const filename = `cartpulse-${reportType}-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return { rows: sorted, dateRange, reportType, totalCarts: carts.length };
};

// ─── component ───────────────────────────────────────────────────────────────

export default function Reports() {
  const { rows, dateRange, reportType, totalCarts } = useLoaderData<typeof loader>() as {
    rows: ProductRow[];
    dateRange: DateRangeKey;
    reportType: ReportTypeKey;
    totalCarts: number;
  };

  const [, setSearchParams] = useSearchParams();

  const updateParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(key, value);
      return next;
    });
  };

  const exportUrl = `?dateRange=${dateRange}&reportType=${reportType}&export=csv`;

  const maxCount = rows.length > 0 ? Math.max(...rows.map((r) => r.count)) : 1;

  return (
    <Page>
      <style>{`
        .cp-card { background: #fff; border-radius: 16px; padding: 24px; border: 1px solid #f0f0f0; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
        .cp-select { border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 9px 36px 9px 14px; font-size: 14px; color: #111; background: #fff; cursor: pointer; outline: none; appearance: none; -webkit-appearance: none; font-family: inherit; }
        .cp-select:focus { border-color: #534AB7; box-shadow: 0 0 0 3px rgba(83,74,183,0.1); }
        .cp-select-wrap { position: relative; display: inline-block; }
        .cp-select-wrap::after { content: ""; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #6b7280; pointer-events: none; }
        .cp-export-btn { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 9px 18px; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; text-decoration: none; transition: border-color 0.15s, background 0.15s; }
        .cp-export-btn:hover { border-color: #534AB7; color: #534AB7; background: #F8F7FF; }
        .cp-row { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid #f5f5f7; }
        .cp-row:last-child { border-bottom: none; }
        .cp-bar-track { flex: 1; height: 8px; background: #f0f0f0; border-radius: 10px; overflow: hidden; }
        .cp-bar-fill { height: 100%; border-radius: 10px; background: linear-gradient(90deg, #534AB7, #7F77DD); transition: width 0.5s ease; }
        .cp-bar-fill-green { background: linear-gradient(90deg, #1D9E75, #5DCAA5); }
        .cp-bar-fill-amber { background: linear-gradient(90deg, #BA7517, #F0A429); }
        .cp-rank { width: 28px; height: 28px; border-radius: 8px; background: #EEEDFE; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #534AB7; flex-shrink: 0; }
        .cp-rank-1 { background: #FEF9C3; color: #854D0E; }
        .cp-rank-2 { background: #F1F5F9; color: #475569; }
        .cp-rank-3 { background: #FAEEDA; color: #BA7517; }
      `}</style>

      <div>
        {/* Header */}
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <div style={{ width: "32px", height: "32px", background: "#EEEDFE", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0, color: "#111" }}>Reports</h1>
            </div>
            <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>Analyze products added to abandoned carts and export data</p>
          </div>
          <div style={{ background: "#E1F5EE", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", color: "#085041", fontWeight: "500" }}>
            {totalCarts} carts in range
          </div>
        </div>

        {/* Filters row */}
        <div className="cp-card" style={{ marginBottom: "20px", padding: "18px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>

            {/* Date range */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date range</label>
              <div className="cp-select-wrap">
                <select
                  className="cp-select"
                  value={dateRange}
                  onChange={(e) => updateParam("dateRange", e.target.value)}
                >
                  {(Object.entries(DATE_RANGE_LABELS) as [DateRangeKey, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Report type */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Report type</label>
              <div className="cp-select-wrap">
                <select
                  className="cp-select"
                  value={reportType}
                  onChange={(e) => updateParam("reportType", e.target.value)}
                >
                  {(Object.entries(REPORT_TYPE_LABELS) as [ReportTypeKey, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Export button — pushed to the right */}
            <div style={{ marginLeft: "auto" }}>
              <a href={exportUrl} className="cp-export-btn" download>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </a>
            </div>
          </div>
        </div>

        {/* Results card */}
        <div className="cp-card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Card header */}
          <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span style={{ fontSize: "15px", fontWeight: "600", color: "#111" }}>
                {REPORT_TYPE_LABELS[reportType]}
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>
              {DATE_RANGE_LABELS[dateRange]} · {rows.length} product{rows.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Column headers */}
          {rows.length > 0 && (
            <div style={{ padding: "10px 24px 6px", display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "28px" }} />
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", flex: "0 0 220px" }}>Product</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", minWidth: "120px", textAlign: "right" }}>
                {reportType === "top-products" && "Times Added"}
                {reportType === "revenue-by-product" && "Revenue"}
                {reportType === "recovery-by-product" && "Recovery Rate"}
              </span>
            </div>
          )}

          {/* Rows */}
          <div style={{ padding: "0 24px" }}>
            {rows.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center" }}>
                <div style={{ width: "56px", height: "56px", background: "#F1F5F9", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <p style={{ fontSize: "15px", fontWeight: "600", color: "#374151", margin: "0 0 6px" }}>No data for this period</p>
                <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>Try selecting a wider date range or wait for more abandoned carts</p>
              </div>
            ) : (
              rows.map((row, i) => {
                const rankClass = i === 0 ? "cp-rank cp-rank-1" : i === 1 ? "cp-rank cp-rank-2" : i === 2 ? "cp-rank cp-rank-3" : "cp-rank";
                const barPct = Math.max((row.count / maxCount) * 100, 4);
                const barClass = reportType === "revenue-by-product" ? "cp-bar-fill cp-bar-fill-green" : reportType === "recovery-by-product" ? "cp-bar-fill cp-bar-fill-amber" : "cp-bar-fill";
                const recoveryRate = row.count > 0 ? Math.round((row.recovered / row.count) * 100) : 0;

                return (
                  <div key={row.title} className="cp-row">
                    <div className={rankClass}>{i + 1}</div>
                    <span style={{ flex: "0 0 220px", fontSize: "14px", fontWeight: "500", color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.title}
                    </span>
                    <div className="cp-bar-track">
                      <div className={barClass} style={{ width: `${barPct}%` }} />
                    </div>
                    <span style={{ fontSize: "15px", fontWeight: "700", color: "#111", minWidth: "120px", textAlign: "right" }}>
                      {reportType === "top-products" && row.count}
                      {reportType === "revenue-by-product" && `$${row.revenue.toFixed(2)}`}
                      {reportType === "recovery-by-product" && `${recoveryRate}%`}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {rows.length > 0 && (
            <div style={{ padding: "14px 24px", borderTop: "1px solid #f5f5f7", background: "#FAFAFA", display: "flex", gap: "24px" }}>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Total products: <strong style={{ color: "#111" }}>{rows.length}</strong>
              </span>
              {reportType === "top-products" && (
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  Total add-to-carts: <strong style={{ color: "#111" }}>{rows.reduce((s, r) => s + r.count, 0)}</strong>
                </span>
              )}
              {reportType === "revenue-by-product" && (
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  Total revenue in carts: <strong style={{ color: "#111" }}>${rows.reduce((s, r) => s + r.revenue, 0).toFixed(2)}</strong>
                </span>
              )}
              {reportType === "recovery-by-product" && (
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  Total recovered items: <strong style={{ color: "#111" }}>{rows.reduce((s, r) => s + r.recovered, 0)}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          All data is encrypted and your privacy is protected.
        </p>
      </div>
    </Page>
  );
}
