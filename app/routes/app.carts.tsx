import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Page } from "@shopify/polaris";
import { useTranslation } from "../i18n/LanguageContext";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const carts = await db.abandonedCart.findMany({
        where: { shop: session.shop, createdAt: { lte: tenMinutesAgo } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { notifications: true },
    });

    const recovered = carts.filter((c) => c.isRecovered).length;
    const total = carts.length - recovered;
    const recoveryRate = carts.length > 0 ? Math.round((recovered / carts.length) * 100) : 0;
    const revenue = carts
        .filter((c) => c.isRecovered)
        .reduce((sum, c) => sum + parseFloat(c.totalPrice), 0)
        .toFixed(2);

    return { stats: { total, recovered, recoveryRate, revenue }, carts };
};

export default function Carts() {
    const { stats, carts } = useLoaderData<typeof loader>();
    const { t } = useTranslation();

    return (
        <Page>
            <style>{`
        .cp-card { background: #fff; border-radius: 16px; padding: 24px; border: 1px solid #f0f0f0; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
        .cp-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
        .cp-table { width: 100%; border-collapse: collapse; }
        .cp-table th { font-size: 12px; color: #534AB7; font-weight: 600; padding: 10px 16px; text-align: left; border-bottom: 1px solid #f0f0f0; }
        .cp-table td { font-size: 13px; color: #374151; padding: 14px 16px; border-bottom: 1px solid #f9f9f9; }
        .cp-table tr:hover td { background: #fafafa; }
        .cp-table tr:last-child td { border-bottom: none; }
        .badge-abandoned { background: #FEF9C3; color: #854D0E; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; }
        .badge-recovered { background: #DCFCE7; color: #166534; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; }
        .stat-card { background: #fff; border-radius: 14px; padding: 20px; border: 1px solid #f0f0f0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 14px; }
      `}</style>

            <div>
                {/* Header */}
                <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                            <div style={{ width: "32px", height: "32px", background: "#EEEDFE", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /></svg>
                            </div>
                            <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0, color: "#111" }}>{t.carts.title}</h1>
                        </div>
                        <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>{t.carts.subtitle}</p>
                    </div>
                    <div style={{ background: "#E1F5EE", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", color: "#085041", fontWeight: "500" }}>
                        {t.carts.totalCarts(carts.length)}
                    </div>
                </div>

                {/* Stat cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "20px" }}>
                    <div className="stat-card">
                        <div style={{ width: "42px", height: "42px", background: "#EEEDFE", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /></svg>
                        </div>
                        <div>
                            <p style={{ fontSize: "12px", color: "#9ca3af", margin: "0 0 2px" }}>{t.carts.totalAbandoned}</p>
                            <p style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#111" }}>{stats.total}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div style={{ width: "42px", height: "42px", background: "#E1F5EE", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                        </div>
                        <div>
                            <p style={{ fontSize: "12px", color: "#9ca3af", margin: "0 0 2px" }}>{t.carts.recovered}</p>
                            <p style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#1D9E75" }}>{stats.recovered}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div style={{ width: "42px", height: "42px", background: "#FAEEDA", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                        </div>
                        <div>
                            <p style={{ fontSize: "12px", color: "#9ca3af", margin: "0 0 2px" }}>{t.carts.recoveryRate}</p>
                            <p style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#111" }}>{stats.recoveryRate}%</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div style={{ width: "42px", height: "42px", background: "#E1F5EE", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                        </div>
                        <div>
                            <p style={{ fontSize: "12px", color: "#9ca3af", margin: "0 0 2px" }}>{t.carts.revenueRecovered}</p>
                            <p style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#1D9E75" }}>${stats.revenue}</p>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="cp-card" style={{ padding: "0", overflow: "hidden" }}>
                    <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: "10px" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                        <span style={{ fontSize: "15px", fontWeight: "600", color: "#111" }}>{t.carts.recentCartEvents}</span>
                    </div>

                    {carts.length === 0 ? (
                        <div style={{ padding: "60px 24px", textAlign: "center" }}>
                            <div style={{ width: "56px", height: "56px", background: "#F1F5F9", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /></svg>
                            </div>
                            <p style={{ fontSize: "15px", fontWeight: "600", color: "#374151", margin: "0 0 6px" }}>{t.carts.noCartsTitle}</p>
                            <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>{t.carts.noCartsSubtitle}</p>
                        </div>
                    ) : (
                        <table className="cp-table">
                            <thead>
                                <tr>
                                    <th>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                            {t.carts.customer}
                                        </div>
                                    </th>
                                    <th>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                                            {t.carts.products}
                                        </div>
                                    </th>
                                    <th>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                            {t.carts.total}
                                        </div>
                                    </th>
                                    <th>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                            {t.carts.date}
                                        </div>
                                    </th>
                                    <th>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /></svg>
                                            {t.carts.notifications}
                                        </div>
                                    </th>
                                    <th>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /></svg>
                                            {t.carts.status}
                                        </div>
                                    </th>
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
                                                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "600", color: "#534AB7", flexShrink: 0 }}>
                                                        {(cart.customerEmail || "G")[0].toUpperCase()}
                                                    </div>
                                                    <span style={{ fontWeight: "500" }}>{cart.customerEmail || t.carts.guest}</span>
                                                </div>
                                            </td>
                                            <td style={{ color: "#6b7280", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {productNames.length > 45 ? productNames.substring(0, 45) + "..." : productNames}
                                            </td>
                                            <td style={{ fontWeight: "600", color: "#111" }}>${cart.totalPrice}</td>
                                            <td style={{ color: "#6b7280" }}>
                                                {new Date(cart.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <div style={{ width: "20px", height: "20px", background: "#EEEDFE", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                                                    </div>
                                                    <span style={{ fontWeight: "500", color: "#534AB7" }}>{t.carts.sentCount(notifCount)}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {cart.isRecovered ? (
                                                    <span className="badge-recovered">
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                                        {t.carts.recoveredBadge}
                                                    </span>
                                                ) : (
                                                    <span className="badge-abandoned">
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
                                                        {t.carts.abandonedBadge}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    {t.carts.privacyFooter}
                </p>

            </div>
        </Page>
    );
}
