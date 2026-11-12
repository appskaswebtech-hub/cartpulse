import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Page } from "@shopify/polaris";
import { useTranslation } from "../i18n/LanguageContext";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const carts = await db.abandonedCart.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { notifications: true },
  });

  const total = carts.length;
  const recovered = carts.filter((c) => c.isRecovered).length;
  const recoveryRate = total > 0 ? Math.round((recovered / total) * 100) : 0;
  const revenue = carts
    .filter((c) => c.isRecovered)
    .reduce((sum, c) => sum + parseFloat(c.totalPrice), 0)
    .toFixed(2);

  return { stats: { total, recovered, recoveryRate, revenue }, carts };
};

function Stat({
  name,
  value,
  foot,
  tone,
  icon,
}: {
  name: string;
  value: string | number;
  foot?: string;
  tone?: "success" | "warn";
  icon: React.ReactNode;
}) {
  const color =
    tone === "success" ? "var(--ui-success)" : tone === "warn" ? "var(--ui-warn)" : "var(--ui-ink)";
  const bg =
    tone === "success"
      ? "var(--ui-success-soft)"
      : tone === "warn"
        ? "var(--ui-warn-soft)"
        : "var(--ui-accent-soft)";

  return (
    <div className="ui-kpi">
      <div className="ui-kpi-top">
        <span className="ui-kpi-dot" style={{ background: bg }}>
          {icon}
        </span>
        <p className="ui-kpi-name">{name}</p>
      </div>
      <p className="ui-kpi-value" style={{ color }}>
        {value}
      </p>
      {foot ? <p className="ui-kpi-foot">{foot}</p> : null}
    </div>
  );
}

const ICON = {
  cart: (c: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  refresh: (c: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  pulse: (c: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  money: (c: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
};

export default function Carts() {
  const { stats, carts } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  return (
    <Page>
      <div className="ui">
        <header className="ui-head">
          <div className="ui-head-left">
            <span className="ui-head-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ui-accent)" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </span>
            <div>
              <h1 className="ui-title">{t.carts.title}</h1>
              <p className="ui-sub">{t.carts.subtitle}</p>
            </div>
          </div>
          <span className="ui-badge ui-badge-quiet" style={{ padding: "7px 14px", fontSize: "12px" }}>
            {t.carts.totalCarts(carts.length)}
          </span>
        </header>

        <div className="ui-kpis" style={{ marginBottom: "18px" }}>
          <Stat
            name={t.carts.totalAbandoned}
            value={stats.total}
            foot={t.carts.recentCartEvents}
            icon={ICON.cart("var(--ui-accent)")}
          />
          <Stat
            name={t.carts.recovered}
            value={stats.recovered}
            tone="success"
            foot={`${stats.recoveryRate}% ${t.carts.recoveryRate.toLowerCase()}`}
            icon={ICON.refresh("var(--ui-success)")}
          />
          <Stat
            name={t.carts.recoveryRate}
            value={`${stats.recoveryRate}%`}
            tone="warn"
            icon={ICON.pulse("var(--ui-warn)")}
          />
          <Stat
            name={t.carts.revenueRecovered}
            value={`$${stats.revenue}`}
            tone="success"
            icon={ICON.money("var(--ui-success)")}
          />
        </div>

        <div className="ui-card">
          <div className="ui-card-head">
            <p className="ui-card-title">{t.carts.recentCartEvents}</p>
            {carts.length > 0 ? (
              <span className="ui-badge ui-badge-quiet">
                {stats.recovered} / {stats.total}
              </span>
            ) : null}
          </div>

          {carts.length === 0 ? (
            <div className="ui-empty">
              <div className="ui-empty-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ui-faint)" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                </svg>
              </div>
              <p className="ui-empty-title">{t.carts.noCartsTitle}</p>
              <p className="ui-empty-text">{t.carts.noCartsSubtitle}</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>{t.carts.customer}</th>
                    <th>{t.carts.products}</th>
                    <th>{t.carts.total}</th>
                    <th>{t.carts.date}</th>
                    <th>{t.carts.notifications}</th>
                    <th>{t.carts.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {carts.map((cart) => {
                    const items = JSON.parse(cart.cartData as string);
                    const productNames = items.map((i: any) => i.title).join(", ");
                    const notifCount = cart.notifications?.length || 0;

                    return (
                      <tr key={cart.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span className="ui-avatar">
                              {(cart.customerEmail || "G")[0].toUpperCase()}
                            </span>
                            <span style={{ fontWeight: 550, color: "var(--ui-ink)" }}>
                              {cart.customerEmail || t.carts.guest}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="ui-trunc" style={{ display: "block", color: "var(--ui-muted)" }}>
                            {productNames}
                          </span>
                        </td>
                        <td className="ui-num">${cart.totalPrice}</td>
                        <td style={{ color: "var(--ui-muted)" }}>
                          {new Date(cart.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td>
                          <span
                            className={
                              notifCount > 0 ? "ui-badge ui-badge-accent" : "ui-badge ui-badge-quiet"
                            }
                          >
                            {t.carts.sentCount(notifCount)}
                          </span>
                        </td>
                        <td>
                          {cart.isRecovered ? (
                            <span className="ui-badge ui-badge-success">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              {t.carts.recoveredBadge}
                            </span>
                          ) : (
                            <span className="ui-badge ui-badge-warn">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              {t.carts.abandonedBadge}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="ui-foot">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {t.carts.privacyFooter}
        </p>
      </div>
    </Page>
  );
}
