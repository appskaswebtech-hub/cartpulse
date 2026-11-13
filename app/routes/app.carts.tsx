import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import pageStylesheet from "../styles/carts.css?url";
import { CartsBanner } from "../components/CartsBanner";
import { useTranslation } from "../i18n/LanguageContext";

// Load route styles in the document head on both direct visits and navigation.
export const links = () => [{ rel: "stylesheet", href: pageStylesheet }];

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

  return {
    stats: { total, recovered, recoveryRate, revenue },
    carts,
    shop: session.shop,
  };
};

function CartIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 48 48"
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h7l7 28h23M12 13h32l-5 16H16M23 14l2 14m10-14-2 14M16 21h24" />
      <circle cx="21" cy="41" r="3" fill={color} stroke="none" />
      <circle cx="37" cy="41" r="3" fill={color} stroke="none" />
    </svg>
  );
}

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
  const { tr, locale } = useTranslation();

  const color =
    tone === "success"
      ? "var(--ui-success)"
      : tone === "warn"
        ? "var(--ui-warn)"
        : "var(--ui-ink)";
  const bg =
    tone === "success"
      ? "var(--ui-success-soft)"
      : tone === "warn"
        ? "var(--ui-warn-soft)"
        : "var(--ui-accent-soft)";

  return (
    <div className={`ui-kpi carts-stat carts-stat--${tone || "default"}`}>
      <div className="ui-kpi-top">
        <span className="ui-kpi-dot" style={{ background: bg }}>
          {tr(icon)}
        </span>
        <p className="ui-kpi-name">{tr(name)}</p>
      </div>
      <p className="ui-kpi-value" style={{ color }}>
        {tr(value)}
      </p>
      {foot ? <p className="ui-kpi-foot">{tr(foot)}</p> : null}
      <span className="carts-stat-art" aria-hidden="true">
        {tone === "warn" ? (
          <span className="carts-bars">
            <i />
            <i />
            <i />
            <i />
          </span>
        ) : (
          icon
        )}
      </span>
    </div>
  );
}

const ICON = {
  cart: (c: string) => <CartIcon color={c} />,
  refresh: (c: string) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="7 12 10.5 15.5 17 8.5" />
    </svg>
  ),
  pulse: (c: string) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth="2"
    >
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="17" r="3" />
      <path d="M19 3 5 21" />
    </svg>
  ),
  money: (c: string) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth="2"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
};

export default function Carts() {
  const { tr, locale } = useTranslation();

  const { stats, carts, shop } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  return (
    <div className="carts-page-shell">
      <div className="ui carts-page">
        <CartsBanner
          shop={shop}
          recoveryRate={stats.recoveryRate}
          notificationsLabel={t.carts.notifications}
          hasNotifications={carts.some((cart) => cart.notifications.length > 0)}
          icon={<CartIcon />}
        />
        <header className="ui-head">
          <div className="ui-head-left">
            <span className="ui-head-icon">
              <CartIcon />
            </span>
            <div>
              <h1 className="ui-title">{t.carts.title}</h1>
              <p className="ui-sub">{t.carts.subtitle}</p>
            </div>
          </div>
          <div className="carts-header-actions">
            <span className="ui-badge ui-badge-quiet carts-total">
              {t.carts.totalCarts(carts.length)}
            </span>
            <LanguageSwitcher />
          </div>
        </header>

        <div className="ui-kpis">
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

        <div className="ui-card" id="carts-events">
          <div className="ui-card-head">
            <p className="ui-card-title">
              <svg
                width="22"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M3 21v-6m6 6V8m6 13V3m6 18V9" />
              </svg>
              {t.carts.recentCartEvents}
            </p>
            {carts.length > 0 ? (
              <span className="ui-badge ui-badge-quiet">
                {tr(stats.recovered)} / {tr(stats.total)}
              </span>
            ) : null}
          </div>

          {carts.length === 0 ? (
            <div className="ui-empty">
              <div className="ui-empty-icon" aria-hidden="true">
                <svg className="carts-empty-cloud" viewBox="0 0 190 108">
                  <path
                    d="M22 99C-5 99 2 64 18 62-2 24 46 2 64 21 86-12 126 0 126 28c30-10 57 12 49 40 24 2 21 31 3 31Z"
                    fill="#e1fced"
                  />
                </svg>
                <CartIcon />
                <span className="carts-empty-rays">
                  <i />
                  <i />
                  <i />
                </span>
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
                    const productNames = items
                      .map((i: any) => i.title)
                      .join(", ");
                    const notifCount = cart.notifications?.length || 0;

                    return (
                      <tr key={cart.id}>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <span className="ui-avatar">
                              {(cart.customerEmail || "G")[0].toUpperCase()}
                            </span>
                            <span
                              style={{
                                fontWeight: 550,
                                color: "var(--ui-ink)",
                              }}
                            >
                              {cart.customerEmail || t.carts.guest}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className="ui-trunc"
                            style={{
                              display: "block",
                              color: "var(--ui-muted)",
                            }}
                          >
                            {tr(productNames)}
                          </span>
                        </td>
                        <td className="ui-num">${tr(cart.totalPrice)}</td>
                        <td style={{ color: "var(--ui-muted)" }}>
                          {tr(
                            new Date(cart.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            ),
                          )}
                        </td>
                        <td>
                          <span
                            className={
                              notifCount > 0
                                ? "ui-badge ui-badge-accent"
                                : "ui-badge ui-badge-quiet"
                            }
                          >
                            {t.carts.sentCount(notifCount)}
                          </span>
                        </td>
                        <td>
                          {cart.isRecovered ? (
                            <span className="ui-badge ui-badge-success">
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              {t.carts.recoveredBadge}
                            </span>
                          ) : (
                            <span className="ui-badge ui-badge-warn">
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
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
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {t.carts.privacyFooter}
        </p>
      </div>
    </div>
  );
}
