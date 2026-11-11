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
    include: { notifications: true },
  });

  const total = carts.length;
  const recovered = carts.filter((c) => c.isRecovered).length;
  const recoveryRate = total > 0 ? Math.round((recovered / total) * 100) : 0;
  const totalNotifications = carts.reduce((sum, c) => sum + c.notifications.length, 0);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const count = carts.filter(
      (c) => new Date(c.createdAt).toDateString() === date.toDateString()
    ).length;
    const notifCount = carts.reduce(
      (sum, c) =>
        sum +
        c.notifications.filter(
          (n) => new Date(n.createdAt).toDateString() === date.toDateString()
        ).length,
      0
    );
    return { date: dateStr, count, notifCount };
  });

  const peakDay = last7Days.reduce((a, b) => (a.count > b.count ? a : b));

  return {
    stats: { total, recovered, recoveryRate, totalNotifications },
    last7Days,
    peakDay,
  };
};

function Sparkbars({
  days,
  valueKey,
}: {
  days: { date: string; count: number; notifCount: number }[];
  valueKey: "count" | "notifCount";
}) {
  const max = Math.max(...days.map((d) => d[valueKey]), 1);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "7px",
          height: "88px",
          marginBottom: "10px",
        }}
      >
        {days.map((day) => {
          const value = day[valueKey];
          return (
            <div
              key={day.date}
              style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}
              title={`${day.date}: ${value}`}
            >
              <div
                className={value > 0 ? "ui-bar" : "ui-bar ui-bar-empty"}
                style={{
                  width: "100%",
                  height: `${Math.max((value / max) * 100, value > 0 ? 8 : 3)}%`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ height: "1px", background: "var(--ui-border)", marginBottom: "8px" }} />
      <div style={{ display: "flex" }}>
        {days.map((day) => (
          <p
            key={day.date}
            style={{
              fontSize: "10px",
              color: "var(--ui-faint)",
              margin: 0,
              flex: 1,
              textAlign: "center",
            }}
          >
            {day.date}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { stats, last7Days, peakDay } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  return (
    <Page>
      <div className="ui">
        <header className="ui-head">
          <div className="ui-head-left">
            <span className="ui-head-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ui-accent)" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </span>
            <div>
              <h1 className="ui-title">{t.dashboard.title}</h1>
              <p className="ui-sub">{t.dashboard.subtitle}</p>
            </div>
          </div>
        </header>

        <div className="ui-kpis" style={{ marginBottom: "18px" }}>
          <div className="ui-kpi">
            <div className="ui-kpi-top">
              <span className="ui-kpi-dot">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ui-accent)" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                </svg>
              </span>
              <p className="ui-kpi-name">{t.dashboard.abandoned}</p>
            </div>
            <p className="ui-kpi-value">{stats.total}</p>
          </div>

          <div className="ui-kpi">
            <div className="ui-kpi-top">
              <span className="ui-kpi-dot">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ui-accent)" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </span>
              <p className="ui-kpi-name">{t.dashboard.notified}</p>
            </div>
            <p className="ui-kpi-value">{stats.totalNotifications}</p>
          </div>

          <div className="ui-kpi">
            <div className="ui-kpi-top">
              <span className="ui-kpi-dot" style={{ background: "var(--ui-success-soft)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ui-success)" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </span>
              <p className="ui-kpi-name">{t.dashboard.recovery}</p>
            </div>
            <p className="ui-kpi-value" style={{ color: "var(--ui-success)" }}>
              {stats.recoveryRate}%
            </p>
          </div>

          <div className="ui-kpi">
            <div className="ui-kpi-top">
              <span className="ui-kpi-dot" style={{ background: "var(--ui-warn-soft)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ui-warn)" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <p className="ui-kpi-name">{t.dashboard.peakDay}</p>
            </div>
            <p className="ui-kpi-value" style={{ fontSize: "22px" }}>
              {peakDay.count > 0 ? peakDay.date : "—"}
            </p>
            <p className="ui-kpi-foot">{t.dashboard.mostActivity}</p>
          </div>
        </div>

        <div className="ui-grid-2" style={{ marginBottom: "18px" }}>
          <div className="ui-card ui-card-pad">
            <p className="ui-label">{t.dashboard.abandonedCartsChart}</p>
            <p className="ui-kpi-value" style={{ marginBottom: "18px" }}>
              {stats.total}
            </p>
            <Sparkbars days={last7Days} valueKey="count" />
          </div>

          <div className="ui-card ui-card-pad">
            <p className="ui-label">{t.dashboard.notificationsSentChart}</p>
            <p className="ui-kpi-value" style={{ marginBottom: "18px" }}>
              {stats.totalNotifications}
            </p>
            <Sparkbars days={last7Days} valueKey="notifCount" />
          </div>
        </div>

        <div
          className="ui-card ui-card-pad"
          style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "28px", alignItems: "center" }}
        >
          <div>
            <p className="ui-label">{t.dashboard.recoveryRate}</p>
            <p className="ui-kpi-value" style={{ marginBottom: "14px" }}>
              {stats.recoveryRate}%
            </p>
            <div className="ui-meter" style={{ marginBottom: "10px" }}>
              <div style={{ width: `${stats.recoveryRate || 2}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontSize: "12px", color: "var(--ui-muted)", margin: 0 }}>
                {t.dashboard.recoveredCount(stats.recovered)}
              </p>
              <p style={{ fontSize: "12px", color: "var(--ui-muted)", margin: 0 }}>
                {t.dashboard.stillAbandonedCount(stats.total - stats.recovered)}
              </p>
            </div>
          </div>

          <div
            style={{
              background: "var(--ui-cream)",
              border: "1px solid var(--ui-border)",
              borderRadius: "var(--ui-r-md)",
              padding: "18px 20px",
              maxWidth: "260px",
            }}
          >
            <p
              className="ui-label"
              style={{ color: "var(--ui-accent-ink)", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {t.dashboard.insight}
            </p>
            <p style={{ fontSize: "12.5px", color: "var(--ui-ink-2)", margin: 0, lineHeight: 1.6 }}>
              {stats.recovered === 0
                ? t.dashboard.insightEmpty
                : t.dashboard.insightSome(stats.recovered)}
            </p>
          </div>
        </div>

        <p className="ui-foot">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {t.dashboard.privacyFooter}
        </p>
      </div>
    </Page>
  );
}
