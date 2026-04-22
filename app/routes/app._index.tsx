import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Page } from "@shopify/polaris";

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
  const totalNotifications = carts.reduce(
    (sum, c) => sum + c.notifications.length, 0
  );

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const count = carts.filter((c) => new Date(c.createdAt).toDateString() === date.toDateString()).length;
    const notifCount = carts.reduce((sum, c) => sum + c.notifications.filter((n) => new Date(n.createdAt).toDateString() === date.toDateString()).length, 0);
    return { date: dateStr, count, notifCount };
  });

  const peakDay = last7Days.reduce((a, b) => a.count > b.count ? a : b);

  return { stats: { total, recovered, recoveryRate, totalNotifications }, last7Days, peakDay };
};

export default function Index() {
  const { stats, last7Days, peakDay } = useLoaderData<typeof loader>();
  const maxCarts = Math.max(...last7Days.map((d) => d.count), 1);
  const maxNotifs = Math.max(...last7Days.map((d) => d.notifCount), 1);

  return (
    <Page>
      <style>{`
        .cp-card { background: #fff; border-radius: 16px; padding: 24px; border: 1px solid #f0f0f0; box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: box-shadow 0.2s; }
        .cp-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
        .cp-bar { border-radius: 6px 6px 0 0; transition: height 0.4s ease; }
        .cp-stat { display: flex; align-items: center; gap: 14px; }
        .cp-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      `}</style>

      <div style={{ padding: "0" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #1D9E75 0%, #085041 100%)", borderRadius: "16px", padding: "28px 32px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: "700", margin: "0 0 4px", color: "#fff" }}>Analytics Dashboard</h1>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", margin: 0 }}>Track your cart recovery performance</p>
          </div>
          <div style={{ display: "flex", gap: "24px" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "28px", fontWeight: "700", color: "#fff", margin: 0 }}>{stats.total}</p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", margin: 0 }}>Abandoned</p>
            </div>
            <div style={{ width: "1px", background: "rgba(255,255,255,0.2)" }} />
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "28px", fontWeight: "700", color: "#fff", margin: 0 }}>{stats.totalNotifications}</p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", margin: 0 }}>Notified</p>
            </div>
            <div style={{ width: "1px", background: "rgba(255,255,255,0.2)" }} />
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "28px", fontWeight: "700", color: "#fff", margin: 0 }}>{stats.recoveryRate}%</p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", margin: 0 }}>Recovery</p>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>

          <div className="cp-card">
            <div className="cp-stat" style={{ marginBottom: "20px" }}>
              <div className="cp-icon" style={{ background: "#E1F5EE" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
              </div>
              <div>
                <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>Abandoned carts</p>
                <p style={{ fontSize: "32px", fontWeight: "700", margin: 0, color: "#111", lineHeight: 1.1 }}>{stats.total}</p>
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "90px", marginBottom: "8px" }}>
                {last7Days.map((day) => (
                  <div key={day.date} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}>
                    <div className="cp-bar" style={{
                      width: "100%",
                      height: `${Math.max((day.count / maxCarts) * 100, day.count > 0 ? 8 : 2)}%`,
                      background: day.count > 0 ? "linear-gradient(180deg, #1D9E75, #5DCAA5)" : "#E1F5EE",
                    }} />
                  </div>
                ))}
              </div>
              <div style={{ height: "1px", background: "#f0f0f0", marginBottom: "8px" }} />
              <div style={{ display: "flex" }}>
                {last7Days.map((day) => (
                  <p key={day.date} style={{ fontSize: "10px", color: "#9ca3af", margin: 0, flex: 1, textAlign: "center" }}>{day.date}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="cp-card">
            <div className="cp-stat" style={{ marginBottom: "20px" }}>
              <div className="cp-icon" style={{ background: "#EEEDFE" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </div>
              <div>
                <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>Notifications sent</p>
                <p style={{ fontSize: "32px", fontWeight: "700", margin: 0, color: "#111", lineHeight: 1.1 }}>{stats.totalNotifications}</p>
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "90px", marginBottom: "8px" }}>
                {last7Days.map((day) => (
                  <div key={day.date} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}>
                    <div className="cp-bar" style={{
                      width: "100%",
                      height: `${Math.max((day.notifCount / maxNotifs) * 100, day.notifCount > 0 ? 8 : 2)}%`,
                      background: day.notifCount > 0 ? "linear-gradient(180deg, #534AB7, #7F77DD)" : "#EEEDFE",
                    }} />
                  </div>
                ))}
              </div>
              <div style={{ height: "1px", background: "#f0f0f0", marginBottom: "8px" }} />
              <div style={{ display: "flex" }}>
                {last7Days.map((day) => (
                  <p key={day.date} style={{ fontSize: "10px", color: "#9ca3af", margin: 0, flex: 1, textAlign: "center" }}>{day.date}</p>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Recovery rate */}
        <div className="cp-card" style={{ marginBottom: "16px", display: "grid", gridTemplateColumns: "1fr auto", gap: "32px", alignItems: "center" }}>
          <div>
            <div className="cp-stat" style={{ marginBottom: "16px" }}>
              <div className="cp-icon" style={{ background: "#FAEEDA" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              </div>
              <div>
                <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>Recovery rate</p>
                <p style={{ fontSize: "32px", fontWeight: "700", margin: 0, color: "#111", lineHeight: 1.1 }}>{stats.recoveryRate}%</p>
              </div>
            </div>
            <div style={{ height: "10px", background: "#f0f0f0", borderRadius: "10px", overflow: "hidden", marginBottom: "10px" }}>
              <div style={{ height: "100%", width: `${stats.recoveryRate || 2}%`, background: "linear-gradient(90deg, #1D9E75, #5DCAA5)", borderRadius: "10px", transition: "width 0.6s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{stats.recovered} recovered</p>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{stats.total - stats.recovered} still abandoned</p>
            </div>
          </div>
          <div style={{ background: "#EEEDFE", borderRadius: "12px", padding: "20px", minWidth: "220px" }}>
            <p style={{ fontSize: "13px", fontWeight: "600", color: "#534AB7", margin: "0 0 8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#534AB7"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              Insight
            </p>
            <p style={{ fontSize: "12px", color: "#3C3489", margin: "0 0 12px", lineHeight: "1.6" }}>
              {stats.recovered === 0
                ? "No carts recovered yet. Notifications are firing automatically for abandoned carts."
                : `You've recovered ${stats.recovered} cart${stats.recovered > 1 ? "s" : ""}. Keep it up!`}
            </p>
          </div>
        </div>

        {/* Bottom stats */}
        <div className="cp-card" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          {[
            { icon: "M3 4h18v2H3zM3 10h18v2H3zM3 16h18v2H3z", bg: "#EEEDFE", color: "#534AB7", label: "Peak day", value: peakDay.count > 0 ? peakDay.date : "—", sub: "Most activity" },
            { icon: "M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2", bg: "#E1F5EE", color: "#1D9E75", label: "Notifications", value: stats.totalNotifications, sub: "Total sent" },
            { icon: "M22 12h-4l-3 9L9 3l-3 9H2", bg: "#FAECE7", color: "#993C1D", label: "Recovery rate", value: `${stats.recoveryRate}%`, sub: "Of total carts" },
            { icon: "M23 6L13.5 15.5 8.5 10.5 1 18", bg: "#E1F5EE", color: "#1D9E75", label: "Status", value: stats.total > 0 ? "Active" : "Waiting", sub: stats.total > 0 ? "Firing notifications" : "No carts yet" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2"><path d={item.icon} /></svg>
              </div>
              <div>
                <p style={{ fontSize: "11px", color: "#9ca3af", margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: "16px", fontWeight: "600", margin: 0, color: "#111" }}>{item.value}</p>
                <p style={{ fontSize: "11px", color: "#9ca3af", margin: 0 }}>{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          All data is encrypted and your privacy is protected.
        </p>

      </div>
    </Page>
  );
}