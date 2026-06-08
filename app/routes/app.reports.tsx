import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Form, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Page } from "@shopify/polaris";
import { useTranslation } from "../i18n/LanguageContext";
import type { Dictionary } from "../i18n/types";

interface LineItem {
  title: string;
  quantity: number;
  price: string;
  variant_title?: string;
}

interface ProductStat {
  title: string;
  count: number;
  totalQty: number;
  totalValue: number;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "30";

  const since = new Date();
  if (range === "7") since.setDate(since.getDate() - 7);
  else if (range === "30") since.setDate(since.getDate() - 30);

  const carts = await db.abandonedCart.findMany({
    where: {
      shop: session.shop,
      ...(range !== "all" && { createdAt: { gte: since } }),
    },
    select: { cartData: true, totalPrice: true, isRecovered: true },
  });

  const productMap = new Map<string, ProductStat>();

  for (const cart of carts) {
    try {
      const items: LineItem[] = JSON.parse(cart.cartData);
      for (const item of items) {
        const key = item.title;
        const existing = productMap.get(key) || {
          title: item.title,
          count: 0,
          totalQty: 0,
          totalValue: 0,
        };
        existing.count += 1;
        existing.totalQty += item.quantity;
        existing.totalValue += parseFloat(item.price || "0") * item.quantity;
        productMap.set(key, existing);
      }
    } catch {
      // skip malformed cart data
    }
  }

  const products = Array.from(productMap.values()).sort((a, b) => b.count - a.count);

  return {
    products,
    totalCarts: carts.length,
    recoveredCarts: carts.filter((c) => c.isRecovered).length,
    range,
  };
};

function downloadCSV(products: ProductStat[], range: string, t: Dictionary, rangeLabel: string) {
  const headers = [
    t.reports.csv.rank,
    t.reports.csv.product,
    t.reports.csv.timesAbandoned,
    t.reports.csv.totalQtyAbandoned,
    t.reports.csv.totalValueAbandoned,
  ];
  const rows = products.map((p, i) => [
    i + 1,
    `"${p.title.replace(/"/g, '""')}"`,
    p.count,
    p.totalQty,
    p.totalValue.toFixed(2),
  ]);

  const csv = [
    [t.reports.csv.reportTitle(rangeLabel)],
    [],
    headers,
    ...rows,
  ]
    .map((r) => r.join(","))
    .join("\n");

  const dataUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  const a = document.createElement("a");
  a.setAttribute("href", dataUri);
  a.setAttribute("download", `cartpulse-report-${range}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function Reports() {
  const { products, totalCarts, recoveredCarts, range } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const recoveryRate = totalCarts > 0 ? Math.round((recoveredCarts / totalCarts) * 100) : 0;

  const rangeLabel =
    range === "7" ? t.reports.last7Days : range === "30" ? t.reports.last30Days : t.reports.allTime;

  return (
    <Page>
      <style>{`
        .cp-card { background: #fff; border-radius: 16px; padding: 24px; border: 1px solid #f0f0f0; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
        .cp-table { width: 100%; border-collapse: collapse; }
        .cp-table th { font-size: 12px; color: #534AB7; font-weight: 600; padding: 10px 16px; text-align: left; border-bottom: 1px solid #f0f0f0; }
        .cp-table td { font-size: 13px; color: #374151; padding: 14px 16px; border-bottom: 1px solid #f9f9f9; }
        .cp-table tr:hover td { background: #fafafa; }
        .cp-table tr:last-child td { border-bottom: none; }
        .stat-card { background: #fff; border-radius: 14px; padding: 20px; border: 1px solid #f0f0f0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .range-btn { padding: 7px 16px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; font-size: 13px; color: #374151; cursor: pointer; font-weight: 500; }
        .range-btn.active { background: #534AB7; color: #fff; border-color: #534AB7; }
        .rank-badge { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; font-size: 11px; font-weight: 700; }
      `}</style>

      <div style={{ maxWidth: "960px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <div style={{ width: "32px", height: "32px", background: "#EEEDFE", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0, color: "#111" }}>{t.reports.title}</h1>
            </div>
            <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>
              {t.reports.subtitle(rangeLabel)}
            </p>
          </div>

          <button
            className="range-btn"
            style={{ background: "#085041", color: "#fff", border: "none", display: "flex", alignItems: "center", gap: "6px" }}
            onClick={() => downloadCSV(products, range, t, rangeLabel)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t.reports.exportCsv}
          </button>
        </div>

        {/* Date Range Filter */}
        <div style={{ marginBottom: "24px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            { value: "7", label: t.reports.last7Days },
            { value: "30", label: t.reports.last30Days },
            { value: "all", label: t.reports.allTime },
          ].map((opt) => (
            <Form key={opt.value} method="get">
              <input type="hidden" name="range" value={opt.value} />
              <button
                type="submit"
                className={`range-btn ${range === opt.value ? "active" : ""}`}
              >
                {opt.label}
              </button>
            </Form>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {[
            { label: t.reports.totalCarts, value: totalCarts, color: "#534AB7", bg: "#EEEDFE" },
            { label: t.reports.recovered, value: recoveredCarts, color: "#085041", bg: "#E1F5EE" },
            { label: t.reports.recoveryRate, value: `${recoveryRate}%`, color: "#d97706", bg: "#FEF3C7" },
            { label: t.reports.uniqueProducts, value: products.length, color: "#374151", bg: "#f3f4f6" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize: "24px", fontWeight: "800", color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px", fontWeight: "500" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Products Table */}
        <div className="cp-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "700", color: "#111", margin: 0 }}>
              {t.reports.topProducts}
            </h2>
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>{t.reports.productsCount(products.length)}</span>
          </div>

          {products.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>📊</div>
              <div style={{ fontSize: "14px" }}>{t.reports.noData}</div>
            </div>
          ) : (
            <table className="cp-table">
              <thead>
                <tr>
                  <th style={{ width: "48px" }}>{t.reports.rank}</th>
                  <th>{t.reports.product}</th>
                  <th style={{ textAlign: "right" }}>{t.reports.timesInCart}</th>
                  <th style={{ textAlign: "right" }}>{t.reports.totalQty}</th>
                  <th style={{ textAlign: "right" }}>{t.reports.totalValue}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p.title}>
                    <td>
                      <span
                        className="rank-badge"
                        style={{
                          background: i === 0 ? "#FEF3C7" : i === 1 ? "#F3F4F6" : i === 2 ? "#FEF9C3" : "#f9fafb",
                          color: i === 0 ? "#92400E" : "#6b7280",
                        }}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td style={{ fontWeight: "500", color: "#111" }}>{p.title}</td>
                    <td style={{ textAlign: "right" }}>
                      <span style={{ background: "#EEEDFE", color: "#534AB7", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>
                        {p.count}×
                      </span>
                    </td>
                    <td style={{ textAlign: "right", color: "#6b7280" }}>{p.totalQty} {t.reports.units}</td>
                    <td style={{ textAlign: "right", fontWeight: "600", color: "#085041" }}>
                      ₹{p.totalValue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </Page>
  );
}
