import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Page } from "@shopify/polaris";
import { sendCartEmail } from "../email.server";
import { getShopPlanFromDB } from "../utils/planUtils";

const EMAIL_LIMITS: Record<string, number> = { basic: 100, pro: 200, advanced: 500 };

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const shopPlan = await getShopPlanFromDB(session.shop);
    const planLimit = EMAIL_LIMITS[shopPlan.plan] ?? 100;
    const planKey = shopPlan.plan;

    const [carts, unsubscribed] = await Promise.all([
        db.abandonedCart.findMany({
            where: { shop: session.shop, customerEmail: { not: null }, createdAt: { lte: tenMinutesAgo } },
            orderBy: { createdAt: "desc" },
            take: planLimit,
            include: {
                notifications: {
                    where: { channel: "email" },
                    orderBy: { sentAt: "desc" },
                },
            },
        }),
        db.emailUnsubscribe.findMany({
            where: { shop: session.shop },
            select: { email: true },
        }),
    ]);

    const totalCarts = await db.abandonedCart.count({
        where: { shop: session.shop, customerEmail: { not: null }, createdAt: { lte: tenMinutesAgo } },
    });

    const unsubscribedEmails = new Set(unsubscribed.map((u) => u.email));

    const enriched = carts.map((cart) => ({
        ...cart,
        isUnsubscribed: unsubscribedEmails.has(cart.customerEmail ?? ""),
    }));

    const totalEmailed = enriched.filter((c) => c.notifications.length > 0).length;
    const notContacted = enriched.filter((c) => c.notifications.length === 0 && !c.isRecovered && !c.isUnsubscribed).length;
    const recovered = enriched.filter((c) => c.isRecovered).length;
    const totalUnsubscribed = enriched.filter((c) => c.isUnsubscribed).length;
    const limitReached = totalCarts > planLimit;

    return { carts: enriched, stats: { total: enriched.length, totalEmailed, notContacted, recovered, totalUnsubscribed }, planLimit, planKey, limitReached };
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();

    const cartIds = JSON.parse(formData.get("cartIds") as string) as string[];
    const subject = formData.get("subject") as string;
    const body = formData.get("body") as string;

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const [carts, unsubscribed, settings] = await Promise.all([
        db.abandonedCart.findMany({
            where: { id: { in: cartIds }, shop: session.shop },
        }),
        db.emailUnsubscribe.findMany({
            where: { shop: session.shop },
            select: { email: true },
        }),
        db.merchantSettings.findUnique({ where: { shop: session.shop } }),
    ]);

    const unsubscribedEmails = new Set(unsubscribed.map((u) => u.email));
    const eligible = carts.filter((c) => c.customerEmail && !unsubscribedEmails.has(c.customerEmail));

    const results = await Promise.allSettled(
        eligible.map(async (cart) => {
            const items = JSON.parse(cart.cartData as string);
            const productNames = items.map((i: any) => i.title).join(", ");
            const name = cart.customerName ?? "there";

            const cartUrl = `https://${cart.shop}/cart/` +
                items.map((i: any) => `${i.variant_id}:${i.quantity}`).join(",");

            const productCardsHtml = `
              <div style="border:1px solid #eeecfd;border-radius:14px;overflow:hidden;margin:20px 0;">
                ${items.map((i: any, idx: number) => `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;${idx < items.length - 1 ? "border-bottom:1px solid #f0f0f0;" : ""}background:${idx % 2 === 0 ? "#fafafa" : "#fff"};">
                    <div style="display:flex;align-items:center;gap:14px;">
                      <div style="width:42px;height:42px;background:linear-gradient(135deg,#EEEDFE,#D4D0F9);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <span style="font-size:18px;">🛍️</span>
                      </div>
                      <div>
                        <p style="margin:0;font-size:14px;font-weight:600;color:#111;">${i.title}</p>
                        <p style="margin:3px 0 0;font-size:12px;color:#6b7280;">Qty: ${i.quantity}${i.vendor ? ` &middot; ${i.vendor}` : ""}</p>
                      </div>
                    </div>
                    <div style="text-align:right;">
                      <p style="margin:0;font-size:15px;font-weight:700;color:#534AB7;">$${i.line_price || (parseFloat(i.price) * i.quantity).toFixed(2)}</p>
                      <p style="margin:2px 0 0;font-size:11px;color:#9ca3af;">$${i.price} each</p>
                    </div>
                  </div>
                `).join("")}
                <div style="padding:14px 20px;background:linear-gradient(135deg,#f8f7ff,#f0effe);display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:14px;font-weight:600;color:#374151;">Order Total</span>
                  <span style="font-size:20px;font-weight:700;color:#534AB7;">$${cart.totalPrice}</span>
                </div>
              </div>
              <div style="text-align:center;margin-top:8px;">
                <a href="${cartUrl}" style="display:inline-block;background:linear-gradient(135deg,#534AB7,#7F77DD);color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:50px;font-size:16px;font-weight:700;letter-spacing:0.3px;box-shadow:0 6px 20px rgba(83,74,183,0.4);">
                  Complete My Purchase &rarr;
                </a>
              </div>
            `;

            const html = body
                .replace(/\[name\]/g, name)
                .replace(/\[products\]/g, productNames)
                .replace(/\[total\]/g, cart.totalPrice)
                .replace(/\[cartlink\]/g, productCardsHtml)
                .replace(/\n/g, "<br>");

            const unsubscribeUrl = `${baseUrl}/unsubscribe?shop=${encodeURIComponent(cart.shop)}&email=${encodeURIComponent(cart.customerEmail!)}`;

            await sendCartEmail({
                to: cart.customerEmail!,
                subject,
                html,
                unsubscribeUrl,
                fromName: settings?.emailFromName,
                fromAddress: settings?.emailFromAddress,
                appPassword: settings?.emailAppPassword,
            });

            await db.cartNotification.create({
                data: {
                    cartId: cart.id,
                    type: "abandoned",
                    channel: "email",
                    status: "sent",
                    sentAt: new Date(),
                },
            });
        })
    );

    const failed = results.filter((r) => r.status === "rejected");
    const sent = results.length - failed.length;
    const skipped = carts.length - eligible.length;

    if (failed.length > 0) {
        const err = (failed[0] as PromiseRejectedResult).reason;
        console.error("Email send error:", err);
        return { success: false, sent, failed: failed.length, skipped, error: String(err) };
    }

    return { success: true, sent, failed: 0, skipped, error: null };
};

const DEFAULT_SUBJECT = "You left something in your cart!";
const DEFAULT_BODY =
    "Hey [name], you forgot something! 🛒\n\n" +
    "You left the following items in your cart:\n[products]\n\n" +
    "Total: $[total]\n\n" +
    "[cartlink]";

type FilterKey = "all" | "not-contacted" | "emailed" | "recovered" | "unsubscribed";

const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "not-contacted", label: "Not Contacted" },
    { key: "emailed", label: "Email Sent" },
    { key: "recovered", label: "Recovered" },
    { key: "unsubscribed", label: "Unsubscribed" },
];

export default function Outreach() {
    const { carts, stats, limitReached, planKey, planLimit } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();

    const [filter, setFilter] = useState<FilterKey>("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [modalOpen, setModalOpen] = useState(false);
    const [modalCartIds, setModalCartIds] = useState<string[]>([]);
    const [subject, setSubject] = useState(DEFAULT_SUBJECT);
    const [body, setBody] = useState(DEFAULT_BODY);
    const [upgradeOpen, setUpgradeOpen] = useState(limitReached);

    const filteredCarts = carts.filter((cart) => {
        if (filter === "not-contacted") return cart.notifications.length === 0 && !cart.isRecovered && !cart.isUnsubscribed;
        if (filter === "emailed") return cart.notifications.length > 0;
        if (filter === "recovered") return cart.isRecovered;
        if (filter === "unsubscribed") return cart.isUnsubscribed;
        return true;
    });

    const allSelected = filteredCarts.length > 0 && filteredCarts.every((c) => selectedIds.has(c.id));

    const toggleAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredCarts.filter((c) => !c.isUnsubscribed && !c.isRecovered).map((c) => c.id)));
        }
    };

    const toggleOne = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const openModal = (cartIds: string[]) => {
        setModalCartIds(cartIds);
        setSubject(DEFAULT_SUBJECT);
        setBody(DEFAULT_BODY);
        setModalOpen(true);
    };

    const handleSend = () => {
        fetcher.submit(
            { cartIds: JSON.stringify(modalCartIds), subject, body },
            { method: "POST" }
        );
        setModalOpen(false);
        setSelectedIds(new Set());
    };

    const isSending = fetcher.state !== "idle";
    const result = fetcher.data;

    return (
        <Page>
            <style>{`
                .cp-card { background: #fff; border-radius: 16px; padding: 24px; border: 1px solid #f0f0f0; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
                .cp-table-wrap { overflow-x: auto; }
                .cp-table { width: 100%; border-collapse: collapse; min-width: 860px; }
                .cp-table th { font-size: 12px; color: #534AB7; font-weight: 600; padding: 10px 14px; text-align: left; border-bottom: 1px solid #f0f0f0; white-space: nowrap; }
                .cp-table td { font-size: 13px; color: #374151; padding: 13px 14px; border-bottom: 1px solid #f9f9f9; vertical-align: middle; }
                .cp-table tr:hover td { background: #fafafa; }
                .cp-table tr:last-child td { border-bottom: none; }
                .stat-card { background: #fff; border-radius: 14px; padding: 18px; border: 1px solid #f0f0f0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 12px; }
                .filter-tab { padding: 7px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; background: none; }
                .filter-tab.active { background: #534AB7; color: #fff; border-color: #534AB7; }
                .filter-tab:not(.active) { background: #f5f5f8; color: #6b7280; border-color: #f0f0f0; }
                .filter-tab:not(.active):hover { background: #EEEDFE; color: #534AB7; }
                .btn-send { background: #534AB7; color: #fff; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
                .btn-send:hover:not(:disabled) { background: #4339a0; }
                .btn-send:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-resend { background: #f5f5f8; color: #534AB7; border: 1px solid #EEEDFE; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
                .btn-resend:hover { background: #EEEDFE; }
                .badge-never { background: #F1F5F9; color: #64748b; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; }
                .badge-emailed { background: #EEEDFE; color: #534AB7; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; }
                .badge-recovered { background: #DCFCE7; color: #166534; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; }
                .badge-unsub { background: #FEE2E2; color: #991b1b; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; }
                .bulk-bar { background: #534AB7; border-radius: 10px; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999; }
                .modal { background: #fff; border-radius: 16px; padding: 28px; width: 560px; max-width: 95vw; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
                .modal-input { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; font-size: 14px; color: #111; outline: none; box-sizing: border-box; font-family: inherit; }
                .modal-input:focus { border-color: #534AB7; box-shadow: 0 0 0 3px rgba(83,74,183,0.1); }
                .modal-textarea { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #111; outline: none; resize: vertical; min-height: 180px; font-family: inherit; box-sizing: border-box; }
                .modal-textarea:focus { border-color: #534AB7; box-shadow: 0 0 0 3px rgba(83,74,183,0.1); }
                input[type="checkbox"] { accent-color: #534AB7; width: 15px; height: 15px; cursor: pointer; }
            `}</style>

            <div>
                {/* Header */}
                <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                            <div style={{ width: "32px", height: "32px", background: "#EEEDFE", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                            </div>
                            <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0, color: "#111" }}>Email Outreach</h1>
                        </div>
                        <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>Manually send recovery emails to abandoned cart customers</p>
                    </div>
                    <div style={{ background: "#E1F5EE", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", color: "#085041", fontWeight: "500" }}>
                        {carts.length} customers
                    </div>
                </div>

                {/* Feedback banner */}
                {result && (
                    <div style={{
                        background: result.success ? "#DCFCE7" : "#FEE2E2",
                        border: `1px solid ${result.success ? "#bbf7d0" : "#fecaca"}`,
                        borderRadius: "10px",
                        padding: "12px 18px",
                        marginBottom: "16px",
                        fontSize: "13px",
                        color: result.success ? "#166534" : "#991b1b",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}>
                        {result.success ? (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                                {result.sent} email{result.sent !== 1 ? "s" : ""} sent successfully.
                                {result.skipped > 0 && ` ${result.skipped} skipped (unsubscribed).`}
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                Failed to send emails. Check your GMAIL_USER and GMAIL_APP_PASSWORD in .env.
                                {result.error && <span style={{ opacity: 0.7 }}> ({result.error})</span>}
                            </>
                        )}
                    </div>
                )}

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "20px" }}>
                    {[
                        { bg: "#EEEDFE", color: "#534AB7", label: "Total", value: stats.total, icon: <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /> },
                        { bg: "#FEF9C3", color: "#854D0E", label: "Not Contacted", value: stats.notContacted, icon: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></> },
                        { bg: "#EEEDFE", color: "#534AB7", label: "Emails Sent", value: stats.totalEmailed, icon: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></> },
                        { bg: "#DCFCE7", color: "#166534", label: "Recovered", value: stats.recovered, icon: <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></> },
                        { bg: "#FEE2E2", color: "#991b1b", label: "Unsubscribed", value: stats.totalUnsubscribed, icon: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> },
                    ].map((s, i) => (
                        <div key={i} className="stat-card">
                            <div style={{ width: "38px", height: "38px", background: s.bg, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2">{s.icon}</svg>
                            </div>
                            <div>
                                <p style={{ fontSize: "11px", color: "#9ca3af", margin: "0 0 2px" }}>{s.label}</p>
                                <p style={{ fontSize: "22px", fontWeight: "700", margin: 0, color: "#111" }}>{s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters + bulk */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
                    {FILTERS.map((tab) => (
                        <button
                            key={tab.key}
                            className={`filter-tab${filter === tab.key ? " active" : ""}`}
                            onClick={() => { setFilter(tab.key); setSelectedIds(new Set()); }}
                        >
                            {tab.label}
                        </button>
                    ))}
                    {selectedIds.size > 0 && (
                        <div className="bulk-bar" style={{ marginLeft: "auto", borderRadius: "20px", padding: "6px 8px 6px 16px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "#fff", marginRight: "10px" }}>
                                {selectedIds.size} selected
                            </span>
                            <button
                                className="btn-send"
                                style={{ background: "#fff", color: "#534AB7", borderRadius: "14px" }}
                                onClick={() => openModal(Array.from(selectedIds))}
                                disabled={isSending}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                                Send Email
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                style={{ background: "none", color: "rgba(255,255,255,0.7)", border: "none", cursor: "pointer", fontSize: "13px", marginLeft: "4px", padding: "4px 8px" }}
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="cp-card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: "10px" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <span style={{ fontSize: "15px", fontWeight: "600", color: "#111" }}>Customer Outreach</span>
                        <span style={{ marginLeft: "auto", fontSize: "12px", color: "#9ca3af" }}>{filteredCarts.length} customers</span>
                    </div>

                    {filteredCarts.length === 0 ? (
                        <div style={{ padding: "60px 24px", textAlign: "center" }}>
                            <div style={{ width: "56px", height: "56px", background: "#F1F5F9", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                            </div>
                            <p style={{ fontSize: "15px", fontWeight: "600", color: "#374151", margin: "0 0 6px" }}>No customers here</p>
                            <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>Try a different filter or wait for more abandoned carts</p>
                        </div>
                    ) : (
                        <div className="cp-table-wrap">
                            <table className="cp-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "36px" }}>
                                            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                                        </th>
                                        <th>Customer</th>
                                        <th>Products</th>
                                        <th>Total</th>
                                        <th>Abandoned On</th>
                                        <th>Email History</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCarts.map((cart) => {
                                        const items = JSON.parse(cart.cartData as string);
                                        const productNames = items.map((i: any) => i.title).join(", ");
                                        const emailNotifs = cart.notifications;
                                        const lastSent = emailNotifs[0]?.sentAt;
                                        const isSelected = selectedIds.has(cart.id);
                                        const canSend = !cart.isRecovered && !cart.isUnsubscribed;

                                        return (
                                            <tr key={cart.id} style={{ background: isSelected ? "#FAFAFF" : undefined }}>
                                                <td>
                                                    {canSend && (
                                                        <input type="checkbox" checked={isSelected} onChange={() => toggleOne(cart.id)} />
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                        <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: cart.isUnsubscribed ? "#FEE2E2" : "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "600", color: cart.isUnsubscribed ? "#991b1b" : "#534AB7", flexShrink: 0 }}>
                                                            {(cart.customerName || cart.customerEmail || "G")[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            {cart.customerName && (
                                                                <p style={{ margin: 0, fontWeight: "600", fontSize: "13px", color: "#111" }}>{cart.customerName}</p>
                                                            )}
                                                            <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>{cart.customerEmail}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ color: "#6b7280", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {productNames.length > 35 ? productNames.substring(0, 35) + "..." : productNames}
                                                </td>
                                                <td style={{ fontWeight: "600", color: "#111" }}>${cart.totalPrice}</td>
                                                <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>
                                                    {new Date(cart.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                                </td>
                                                <td>
                                                    {emailNotifs.length === 0 ? (
                                                        <span className="badge-never">Never</span>
                                                    ) : (
                                                        <span className="badge-emailed">
                                                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                                            {emailNotifs.length}x{lastSent && ` · ${new Date(lastSent).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {cart.isUnsubscribed ? (
                                                        <span className="badge-unsub">Unsubscribed</span>
                                                    ) : cart.isRecovered ? (
                                                        <span className="badge-recovered">
                                                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                                            Recovered
                                                        </span>
                                                    ) : emailNotifs.length > 0 ? (
                                                        <span className="badge-emailed">Email Sent</span>
                                                    ) : (
                                                        <span className="badge-never">Not Contacted</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {canSend && (
                                                        <button
                                                            className={emailNotifs.length > 0 ? "btn-resend" : "btn-send"}
                                                            onClick={() => openModal([cart.id])}
                                                            disabled={isSending}
                                                        >
                                                            {emailNotifs.length > 0 ? "Resend" : (
                                                                <>
                                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                                                                    </svg>
                                                                    Send
                                                                </>
                                                            )}
                                                        </button>
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

                <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    All data is encrypted and your privacy is protected.
                </p>
            </div>

            {/* Upgrade Plan Popup */}
            {upgradeOpen && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setUpgradeOpen(false); }}>
                    <div className="modal" style={{ maxWidth: "400px", padding: 0, overflow: "hidden" }}>
                        <div style={{ background: "linear-gradient(135deg,#534AB7,#7F77DD)", padding: "28px 28px 20px" }}>
                            <div style={{ width: "44px", height: "44px", background: "rgba(255,255,255,0.15)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                            </div>
                            <h2 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: "700", color: "#fff" }}>Plan Limit Reached</h2>
                            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.75)" }}>
                                Your <strong style={{ color: "#fff", textTransform: "capitalize" }}>{planKey}</strong> plan shows up to <strong style={{ color: "#fff" }}>{planLimit}</strong> carts. Upgrade to see more customers and send more recovery emails.
                            </p>
                        </div>
                        <div style={{ padding: "20px 28px 24px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                                {[
                                    { plan: "Pro", limit: "200 carts", color: "#534AB7" },
                                    { plan: "Advanced", limit: "500 carts", color: "#1D9E75" },
                                ].map((p) => (
                                    <div key={p.plan} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8F7FF", borderRadius: "10px", padding: "12px 16px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                            <span style={{ fontSize: "13px", fontWeight: "600", color: "#111" }}>{p.plan}</span>
                                        </div>
                                        <span style={{ fontSize: "12px", color: "#6b7280" }}>{p.limit}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <button
                                    onClick={() => setUpgradeOpen(false)}
                                    style={{ flex: 1, background: "#f5f5f8", color: "#374151", border: "none", borderRadius: "8px", padding: "11px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                                >
                                    Maybe Later
                                </button>
                                <a
                                    href="/app/billing"
                                    style={{ flex: 2, background: "linear-gradient(135deg,#534AB7,#7F77DD)", color: "#fff", borderRadius: "8px", padding: "11px", fontSize: "13px", fontWeight: "700", textDecoration: "none", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                                >
                                    Upgrade Plan →
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Send Email Modal */}
            {modalOpen && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
                    <div className="modal">
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                            <div style={{ width: "36px", height: "36px", background: "#EEEDFE", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#111" }}>
                                    {modalCartIds.length > 1 ? `Send to ${modalCartIds.length} customers` : "Send Recovery Email"}
                                </h2>
                                <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>Edit and review before sending</p>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "22px", lineHeight: 1, padding: "0 4px" }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ marginBottom: "14px" }}>
                            <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "6px" }}>Subject</label>
                            <input className="modal-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line" />
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                            <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "6px" }}>Message</label>
                            <textarea className="modal-textarea" value={body} onChange={(e) => setBody(e.target.value)} />
                        </div>

                        <div style={{ background: "#F8F7FF", borderRadius: "8px", padding: "10px 14px", marginBottom: "20px" }}>
                            <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#534AB7", fontWeight: "600" }}>Available variables — personalized per customer</p>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                {["[name]", "[products]", "[total]", "[cartlink]"].map((v) => (
                                    <code key={v} style={{ background: "#EEEDFE", color: "#534AB7", padding: "2px 8px", borderRadius: "4px", fontSize: "11px" }}>{v}</code>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                            <button
                                onClick={() => setModalOpen(false)}
                                style={{ background: "#f5f5f8", color: "#374151", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-send"
                                onClick={handleSend}
                                disabled={!subject.trim() || !body.trim() || isSending}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                                {modalCartIds.length > 1 ? `Send to ${modalCartIds.length} customers` : "Send Email"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Page>
    );
}
