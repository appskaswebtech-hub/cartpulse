import { useTranslation } from "../i18n/LanguageContext";
import { useLoaderData, useSearchParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  ReportsIcon,
  ReportsHero,
  ReportsEmptyArt,
} from "../components/ReportsVisuals";
import pageStylesheet from "../styles/reports.css?url";

export const links = () => [{ rel: "stylesheet", href: pageStylesheet }];

// ─── types ───────────────────────────────────────────────────────────────────

type DateRangeKey = "7d" | "30d" | "90d" | "all";
type ReportTypeKey =
  | "top-products"
  | "revenue-by-product"
  | "recovery-by-product";

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
  all: "All time",
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
  carts: { cartData: string; totalPrice: string; isRecovered: boolean }[],
): ProductRow[] {
  const map = new Map<string, ProductRow>();

  for (const cart of carts) {
    let items: any[] = [];
    try {
      items = JSON.parse(cart.cartData);
    } catch {
      continue;
    }

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
      lines.push(
        `"${row.title.replace(/"/g, '""')}",${row.count},${row.revenue.toFixed(2)}`,
      );
    } else {
      const rate =
        row.count > 0 ? Math.round((row.recovered / row.count) * 100) : 0;
      lines.push(
        `"${row.title.replace(/"/g, '""')}",${row.count},${row.recovered},${rate}`,
      );
    }
  }

  return lines.join("\n");
}

// ─── loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const dateRange =
    (url.searchParams.get("dateRange") as DateRangeKey) || "30d";
  const reportType =
    (url.searchParams.get("reportType") as ReportTypeKey) || "top-products";
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
  const { tr, locale } = useTranslation();

  const { rows, dateRange, reportType, totalCarts } = useLoaderData<
    typeof loader
  >() as {
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
    <div className="reports-shell">
      <div className="reports-page">
        {/* Header */}
        <header className="reports-header">
          <span className="reports-title-icon">
            <ReportsIcon name="report" />
          </span>
          <div>
            <h1>{tr("Reports")}</h1>
            <p>
              {tr("Analyze products added to abandoned carts and export data.")}
            </p>
          </div>
          <span className="reports-count">
            <ReportsIcon name="layers" />
            {tr(totalCarts)} {tr(" carts in range ")}
          </span>
        </header>
        <ReportsHero />
        <section
          className="cp-card reports-filters"
          aria-label={tr("Report filters and export")}
        >
          <div className="reports-filter-field">
            <ReportsIcon name="calendar" />
            <div>
              <label htmlFor="reports-date-range">{tr("Date range")}</label>
              <div className="cp-select-wrap">
                <select
                  id="reports-date-range"
                  className="cp-select"
                  value={dateRange}
                  onChange={(e) => updateParam("dateRange", e.target.value)}
                >
                  {(
                    Object.entries(DATE_RANGE_LABELS) as [
                      DateRangeKey,
                      string,
                    ][]
                  ).map(([key, label]) => (
                    <option key={key} value={key}>
                      {tr(label)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="reports-filter-field reports-type-field">
            <ReportsIcon name="layers" />
            <div>
              <label htmlFor="reports-report-type">{tr("Report type")}</label>
              <div className="cp-select-wrap">
                <select
                  id="reports-report-type"
                  className="cp-select"
                  value={reportType}
                  onChange={(e) => updateParam("reportType", e.target.value)}
                >
                  {(
                    Object.entries(REPORT_TYPE_LABELS) as [
                      ReportTypeKey,
                      string,
                    ][]
                  ).map(([key, label]) => (
                    <option key={key} value={key}>
                      {tr(label)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <a href={exportUrl} className="cp-export-btn" download>
            <ReportsIcon name="download" />
            {tr(" Export CSV ")}
          </a>
        </section>

        {/* Results card */}
        <section
          className="cp-card reports-results"
          aria-labelledby="reports-results-title"
        >
          <div className="reports-results-heading">
            <span className="reports-results-icon">
              <ReportsIcon name="chart" />
            </span>
            <h2 id="reports-results-title">
              {tr(REPORT_TYPE_LABELS[reportType])}
            </h2>
            <span className="reports-results-summary">
              {tr(DATE_RANGE_LABELS[dateRange])} {tr(" &middot; ")}
              {tr(rows.length === 1 ? "{0} product" : "{0} products", [
                rows.length,
              ])}
            </span>
          </div>
          <div className="reports-data-scroll">
            {/* Column headers */}
            {rows.length > 0 && (
              <div
                className="reports-data-columns"
                style={{
                  padding: "10px 24px 6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <div style={{ width: "28px" }} />
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    flex: "0 0 220px",
                  }}
                >
                  {tr(" Product ")}
                </span>
                <div style={{ flex: 1 }} />
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    minWidth: "120px",
                    textAlign: "right",
                  }}
                >
                  {tr(reportType === "top-products" && "Times Added")}
                  {tr(reportType === "revenue-by-product" && "Revenue")}
                  {tr(reportType === "recovery-by-product" && "Recovery Rate")}
                </span>
              </div>
            )}

            {/* Rows */}
            <div
              className={rows.length > 0 ? "reports-data-rows" : undefined}
              style={{ padding: "0 24px" }}
            >
              {rows.length === 0 ? (
                <div className="reports-empty">
                  <ReportsEmptyArt />
                  <h3>{tr("No data for this period")}</h3>
                  <p>
                    {tr(
                      " Try selecting a wider date range or wait for more abandoned carts. ",
                    )}
                  </p>
                </div>
              ) : (
                rows.map((row, i) => {
                  const rankClass =
                    i === 0
                      ? "cp-rank cp-rank-1"
                      : i === 1
                        ? "cp-rank cp-rank-2"
                        : i === 2
                          ? "cp-rank cp-rank-3"
                          : "cp-rank";
                  const barPct = Math.max((row.count / maxCount) * 100, 4);
                  const barClass =
                    reportType === "revenue-by-product"
                      ? "cp-bar-fill cp-bar-fill-green"
                      : reportType === "recovery-by-product"
                        ? "cp-bar-fill cp-bar-fill-amber"
                        : "cp-bar-fill";
                  const recoveryRate =
                    row.count > 0
                      ? Math.round((row.recovered / row.count) * 100)
                      : 0;

                  return (
                    <div key={row.title} className="cp-row">
                      <div className={rankClass}>{tr(i + 1)}</div>
                      <span
                        style={{
                          flex: "0 0 220px",
                          fontSize: "14px",
                          fontWeight: "500",
                          color: "#111",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.title}
                      </span>
                      <div className="cp-bar-track">
                        <div
                          className={barClass}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: "15px",
                          fontWeight: "700",
                          color: "#111",
                          minWidth: "120px",
                          textAlign: "right",
                        }}
                      >
                        {tr(reportType === "top-products" && row.count)}
                        {tr(
                          reportType === "revenue-by-product" &&
                            `$${row.revenue.toFixed(2)}`,
                        )}
                        {tr(
                          reportType === "recovery-by-product" &&
                            `${recoveryRate}%`,
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {rows.length > 0 && (
              <div
                className="reports-totals"
                style={{
                  padding: "14px 24px",
                  borderTop: "1px solid #f5f5f7",
                  background: "#FAFAFA",
                  display: "flex",
                  gap: "24px",
                }}
              >
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  {tr(" Total products:")}
                  {tr(" ")}
                  <strong style={{ color: "#111" }}>{tr(rows.length)}</strong>
                </span>
                {reportType === "top-products" && (
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>
                    {tr(" Total add-to-carts:")}
                    {tr(" ")}
                    <strong style={{ color: "#111" }}>
                      {tr(rows.reduce((s, r) => s + r.count, 0))}
                    </strong>
                  </span>
                )}
                {reportType === "revenue-by-product" && (
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>
                    {tr(" Total revenue in carts:")}
                    {tr(" ")}
                    <strong style={{ color: "#111" }}>
                      ${tr(rows.reduce((s, r) => s + r.revenue, 0).toFixed(2))}
                    </strong>
                  </span>
                )}
                {reportType === "recovery-by-product" && (
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>
                    {tr(" Total recovered items:")}
                    {tr(" ")}
                    <strong style={{ color: "#111" }}>
                      {tr(rows.reduce((s, r) => s + r.recovered, 0))}
                    </strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        <p
          className="reports-privacy"
          style={{
            textAlign: "center",
            fontSize: "12px",
            color: "#9ca3af",
            marginTop: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {tr(" All data is encrypted and your privacy is protected. ")}
        </p>
      </div>
    </div>
  );
}
