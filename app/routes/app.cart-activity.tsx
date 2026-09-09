import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Page } from "@shopify/polaris";
import {
    getCartActivitySettings,
    sweepDueCartActivities,
    sendCartActivityReminder,
} from "../cartActivity.server";
import { DEFAULT_SUBJECT, DEFAULT_BODY } from "../cartActivityDefaults";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    await sweepDueCartActivities(shop, baseUrl);

    const [settings, activities] = await Promise.all([
        getCartActivitySettings(shop),
        db.cartActivity.findMany({
            where: { shop },
            orderBy: { addedAt: "desc" },
            take: 200,
        }),
    ]);

    const stats = {
        total: activities.length,
        awaitingManual: activities.filter((a) => a.status === "awaiting_manual").length,
        reminded: activities.filter((a) => a.status === "reminded").length,
        converted: activities.filter((a) => a.status === "converted").length,
    };

    return { settings, activities, stats };
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;
    const formData = await request.formData();
    const intent = formData.get("intent");

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    if (intent === "updateSettings") {
        const sendMode = formData.get("sendMode") as string;
        const subject = formData.get("subject") as string;
        const body = formData.get("body") as string;
        const delayMinutes = Math.max(1, parseInt(formData.get("delayMinutes") as string, 10) || 60);

        await db.cartActivitySettings.upsert({
            where: { shop },
            update: { sendMode, subject, body, delayMinutes },
            create: { shop, sendMode, subject, body, delayMinutes },
        });

        return { success: true, type: "settings" };
    }

    if (intent === "sendManual") {
        const activityIds = JSON.parse(formData.get("activityIds") as string) as string[];
        const subject = formData.get("subject") as string;
        const body = formData.get("body") as string;
        const sendAt = formData.get("sendAt") as string;

        const withEmail = await db.cartActivity.findMany({
            where: { id: { in: activityIds }, shop, customerEmail: { not: null } },
            select: { id: true },
        });
        const sendableIds = withEmail.map((a) => a.id);
        const skipped = activityIds.length - sendableIds.length;

        if (sendableIds.length === 0) {
            return { success: false, type: "send", sent: 0, failed: 0, scheduled: 0, skipped, error: "None of the selected carts have a captured email yet." };
        }

        const scheduledDate = sendAt ? new Date(sendAt) : null;
        const isFuture = scheduledDate && scheduledDate.getTime() > Date.now() + 60_000;

        if (isFuture) {
            await db.cartActivity.updateMany({
                where: { id: { in: sendableIds } },
                data: {
                    status: "scheduled",
                    scheduledSendAt: scheduledDate,
                    scheduledSubject: subject,
                    scheduledBody: body,
                },
            });
            return { success: true, type: "send", sent: 0, failed: 0, scheduled: sendableIds.length, skipped };
        }

        await sendCartActivityReminder(sendableIds, baseUrl, subject, body);

        return { success: true, type: "send", sent: sendableIds.length, failed: 0, scheduled: 0, skipped };
    }

    if (intent === "delete") {
        const activityIds = JSON.parse(formData.get("activityIds") as string) as string[];
        await db.cartActivity.deleteMany({ where: { id: { in: activityIds }, shop } });
        return { success: true, type: "delete" };
    }

    return { success: false };
};

export default function CartActivity() {
    const { settings, activities, stats } = useLoaderData<typeof loader>();
    const visibleActivities = activities.filter((a) => a.status !== "converted");
    const settingsFetcher = useFetcher<typeof action>();
    const sendFetcher = useFetcher<typeof action>();
    const deleteFetcher = useFetcher<typeof action>();
    const trackerFetcher = useFetcher<{ success: boolean; installed?: boolean; error?: string }>();

    const trackerInstalled = trackerFetcher.data?.installed ?? settings.trackerInstalled;
    const isTogglingTracker = trackerFetcher.state !== "idle";

    const toggleTracker = () => {
        trackerFetcher.submit(
            { intent: trackerInstalled ? "disable" : "enable" },
            { method: "POST", action: "/app/cart-activity-script" },
        );
    };

    const [sendMode, setSendMode] = useState(settings.sendMode);
    const [delayMinutes, setDelayMinutes] = useState(settings.delayMinutes);
    const [subject, setSubject] = useState(settings.subject || DEFAULT_SUBJECT);
    const [body, setBody] = useState(settings.body || DEFAULT_BODY);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const isSavingSettings = settingsFetcher.state !== "idle";
    const isSending = sendFetcher.state !== "idle";
    const settingsSaved = settingsFetcher.data?.type === "settings" && settingsFetcher.data.success;
    const sendResult = sendFetcher.data?.type === "send" ? sendFetcher.data : null;

    const saveSettings = () => {
        settingsFetcher.submit(
            { intent: "updateSettings", sendMode, subject, body, delayMinutes: String(delayMinutes) },
            { method: "POST" },
        );
    };

    const toggleOne = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const isDeleting = deleteFetcher.state !== "idle";

    const deleteOne = (id: string) => {
        deleteFetcher.submit(
            { intent: "delete", activityIds: JSON.stringify([id]) },
            { method: "POST" },
        );
    };

    const deleteSelected = () => {
        deleteFetcher.submit(
            { intent: "delete", activityIds: JSON.stringify(Array.from(selectedIds)) },
            { method: "POST" },
        );
        setSelectedIds(new Set());
    };

    const [sendModalOpen, setSendModalOpen] = useState(false);
    const [sendSubject, setSendSubject] = useState(subject);
    const [sendBody, setSendBody] = useState(body);
    const [sendAt, setSendAt] = useState("");

    const openSendModal = () => {
        setSendSubject(settings.subject || DEFAULT_SUBJECT);
        setSendBody(settings.body || DEFAULT_BODY);
        setSendAt("");
        setSendModalOpen(true);
    };

    const confirmSend = () => {
        sendFetcher.submit(
            {
                intent: "sendManual",
                activityIds: JSON.stringify(Array.from(selectedIds)),
                subject: sendSubject,
                body: sendBody,
                sendAt,
            },
            { method: "POST" },
        );
        setSendModalOpen(false);
        setSelectedIds(new Set());
    };

    const statusBadge = (status: string) => {
        const map: Record<string, { bg: string; color: string; label: string }> = {
            pending: { bg: "#F1F5F9", color: "#64748b", label: `Waiting (< ${settings.delayMinutes} min)` },
            awaiting_manual: { bg: "#FEF9C3", color: "#854D0E", label: "Ready to send" },
            scheduled: { bg: "#DBEAFE", color: "#1e40af", label: "Scheduled" },
            reminded: { bg: "#EEEDFE", color: "#534AB7", label: "Reminder sent" },
            converted: { bg: "#DCFCE7", color: "#166534", label: "Converted" },
        };
        const s = map[status] ?? map.pending;
        return (
            <span style={{ background: s.bg, color: s.color, fontSize: "11px", fontWeight: 600, padding: "3px 9px", borderRadius: "20px" }}>
                {s.label}
            </span>
        );
    };

    return (
        <Page>
            <style>{`
                .cp-card { background: #fff; border-radius: 16px; padding: 24px; border: 1px solid #f0f0f0; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
                .cp-table-wrap { overflow-x: auto; }
                .cp-table { width: 100%; border-collapse: collapse; min-width: 760px; }
                .cp-table th { font-size: 12px; color: #534AB7; font-weight: 600; padding: 10px 14px; text-align: left; border-bottom: 1px solid #f0f0f0; white-space: nowrap; }
                .cp-table td { font-size: 13px; color: #374151; padding: 13px 14px; border-bottom: 1px solid #f9f9f9; vertical-align: middle; }
                .cp-input { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; font-size: 14px; color: #111; outline: none; box-sizing: border-box; font-family: inherit; }
                .cp-textarea { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #111; outline: none; resize: vertical; min-height: 140px; font-family: inherit; box-sizing: border-box; }
                .cp-label { font-size: 12px; font-weight: 600; color: #374151; display: block; margin-bottom: 6px; }
                .mode-option { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; cursor: pointer; flex: 1; }
                .mode-option.active { border-color: #534AB7; background: #F8F7FF; }
                .btn-save { background: linear-gradient(135deg,#534AB7,#7F77DD); color: #fff; border: none; border-radius: 10px; padding: 11px 24px; font-size: 14px; font-weight: 600; cursor: pointer; }
                .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
                .btn-send { background: #534AB7; color: #fff; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
                .btn-send:disabled { opacity: 0.5; cursor: not-allowed; }
                input[type="checkbox"] { accent-color: #534AB7; width: 15px; height: 15px; cursor: pointer; }
                input[type="radio"] { accent-color: #534AB7; }
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999; }
                .modal { background: #fff; border-radius: 16px; padding: 28px; width: 560px; max-width: 95vw; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
                .btn-icon-delete { background: none; border: none; cursor: pointer; color: #9ca3af; padding: 6px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; }
                .btn-icon-delete:hover:not(:disabled) { background: #FEE2E2; color: #991b1b; }
                .btn-icon-delete:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>

            <div>
                <div style={{ marginBottom: "24px" }}>
                    <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "#111" }}>Cart Activity</h1>
                    <p style={{ fontSize: "13px", color: "#9ca3af", margin: "4px 0 0" }}>
                        Track products added to cart and remind customers after they don't check out
                    </p>
                </div>

                <div className="cp-card" style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                    <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: "#111" }}>Storefront Tracking</h3>
                        <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
                            Installs a tracking script on your storefront so logged-in customers' email is captured the moment they add to cart — no checkout needed.
                        </p>
                    </div>
                    <button
                        className="btn-save"
                        style={{ background: trackerInstalled ? "#f5f5f8" : undefined, color: trackerInstalled ? "#374151" : undefined, whiteSpace: "nowrap" }}
                        disabled={isTogglingTracker}
                        onClick={toggleTracker}
                    >
                        {isTogglingTracker ? "Working…" : trackerInstalled ? "Disable Tracking" : "Enable Tracking"}
                    </button>
                </div>

                {trackerFetcher.data?.success === false && (
                    <div style={{ background: "#FEE2E2", color: "#991b1b", borderRadius: "10px", padding: "10px 16px", marginBottom: "20px", fontSize: "13px" }}>
                        Tracking script error: {trackerFetcher.data.error}
                    </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
                    {[
                        { label: "Tracked", value: stats.total },
                        { label: "Ready to Send", value: stats.awaitingManual },
                        { label: "Reminders Sent", value: stats.reminded },
                        { label: "Converted", value: stats.converted },
                    ].map((s) => (
                        <div key={s.label} className="cp-card" style={{ padding: "16px" }}>
                            <p style={{ fontSize: "11px", color: "#9ca3af", margin: "0 0 4px" }}>{s.label}</p>
                            <p style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "#111" }}>{s.value}</p>
                        </div>
                    ))}
                </div>

                <div className="cp-card" style={{ marginBottom: "20px" }}>
                    <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#111" }}>Reminder Settings</h3>

                    <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
                        <label className={`mode-option${sendMode === "auto" ? " active" : ""}`}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                <input type="radio" name="sendMode" checked={sendMode === "auto"} onChange={() => setSendMode("auto")} />
                                <span style={{ fontWeight: 600, fontSize: "13px" }}>Send Automatically</span>
                            </div>
                            <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Email goes out on its own after the wait time below, if not purchased.</p>
                        </label>
                        <label className={`mode-option${sendMode === "manual" ? " active" : ""}`}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                <input type="radio" name="sendMode" checked={sendMode === "manual"} onChange={() => setSendMode("manual")} />
                                <span style={{ fontWeight: 600, fontSize: "13px" }}>Send Manually</span>
                            </div>
                            <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Cart lands in the list below after the wait time — you review and click Send.</p>
                        </label>
                    </div>

                    <div style={{ marginBottom: "20px", maxWidth: "220px", opacity: sendMode === "manual" ? 0.5 : 1, transition: "opacity 0.15s" }}>
                        <label className="cp-label">Wait time before auto-send (minutes)</label>
                        <input
                            className="cp-input"
                            type="number"
                            min={1}
                            value={delayMinutes}
                            onChange={(e) => setDelayMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        />
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                        <label className="cp-label">Subject</label>
                        <input className="cp-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                        <label className="cp-label">Message</label>
                        <textarea className="cp-textarea" value={body} onChange={(e) => setBody(e.target.value)} />
                    </div>

                    <div style={{ background: "#F8F7FF", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px" }}>
                        <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#534AB7", fontWeight: 600 }}>Available variables</p>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {["[name]", "[products]", "[total]", "[cartlink]"].map((v) => (
                                <code key={v} style={{ background: "#EEEDFE", color: "#534AB7", padding: "2px 8px", borderRadius: "4px", fontSize: "11px" }}>{v}</code>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        {settingsSaved && (
                            <span style={{ fontSize: "13px", color: "#166534", fontWeight: 500 }}>Settings saved</span>
                        )}
                        <button className="btn-save" style={{ marginLeft: "auto" }} disabled={isSavingSettings} onClick={saveSettings}>
                            {isSavingSettings ? "Saving…" : "Save Settings"}
                        </button>
                    </div>
                </div>

                <div className="cp-card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                        <span style={{ fontSize: "15px", fontWeight: 600, color: "#111" }}>Tracked Carts</span>
                        {selectedIds.size > 0 && (
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                    className="btn-send"
                                    style={{ background: "#FEE2E2", color: "#991b1b" }}
                                    disabled={isDeleting}
                                    onClick={deleteSelected}
                                >
                                    {isDeleting ? "Deleting…" : `Delete (${selectedIds.size})`}
                                </button>
                                <button className="btn-send" disabled={isSending} onClick={openSendModal}>
                                    {isSending ? "Sending…" : `Send / Schedule (${selectedIds.size})`}
                                </button>
                            </div>
                        )}
                    </div>

                    {sendResult && (
                        <div style={{ padding: "10px 20px", fontSize: "13px", color: sendResult.success ? "#166534" : "#991b1b", background: sendResult.success ? "#DCFCE7" : "#FEE2E2" }}>
                            {!sendResult.success && sendResult.error
                                ? sendResult.error
                                : sendResult.scheduled
                                    ? `${sendResult.scheduled} reminder${sendResult.scheduled !== 1 ? "s" : ""} scheduled.`
                                    : `${sendResult.sent} reminder${sendResult.sent !== 1 ? "s" : ""} sent${sendResult.failed ? `, ${sendResult.failed} failed` : ""}.`}
                            {!!sendResult.skipped && ` (${sendResult.skipped} skipped — no email captured yet.)`}
                        </div>
                    )}

                    {visibleActivities.length === 0 ? (
                        <div style={{ padding: "50px 24px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
                            No cart activity tracked yet.
                        </div>
                    ) : (
                        <div className="cp-table-wrap">
                            <table className="cp-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "36px" }}></th>
                                        <th>Product</th>
                                        <th>Customer</th>
                                        <th>Qty</th>
                                        <th>Price</th>
                                        <th>Added</th>
                                        <th>Status</th>
                                        <th>Sent</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleActivities.map((activity) => {
                                        return (
                                            <tr key={activity.id}>
                                                <td>
                                                    <input type="checkbox" checked={selectedIds.has(activity.id)} onChange={() => toggleOne(activity.id)} />
                                                </td>
                                                <td>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                        {activity.imageUrl ? (
                                                            <img src={activity.imageUrl} width={32} height={32} style={{ borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                                                        ) : (
                                                            <div style={{ width: "32px", height: "32px", background: "#EEEDFE", borderRadius: "8px", flexShrink: 0 }} />
                                                        )}
                                                        <span style={{ maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activity.title}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {activity.customerEmail ? (
                                                        <>
                                                            <p style={{ margin: 0, fontWeight: 600, fontSize: "13px", color: "#111" }}>{activity.customerName || "—"}</p>
                                                            <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>{activity.customerEmail}</p>
                                                        </>
                                                    ) : (
                                                        <span style={{ fontSize: "12px", color: "#9ca3af" }}>No contact info yet</span>
                                                    )}
                                                </td>
                                                <td>{activity.quantity}</td>
                                                <td style={{ fontWeight: 600, color: "#111" }}>{activity.currency} {(Number(activity.price) * activity.quantity).toFixed(2)}</td>
                                                <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>
                                                    {new Date(activity.addedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                </td>
                                                <td>{statusBadge(activity.status)}</td>
                                                <td style={{ whiteSpace: "nowrap" }}>
                                                    {activity.status === "reminded" && activity.remindedAt ? (
                                                        <>
                                                            <span style={{
                                                                fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "10px",
                                                                background: activity.sentVia === "auto" ? "#DBEAFE" : "#F0EFFE",
                                                                color: activity.sentVia === "auto" ? "#1e40af" : "#534AB7",
                                                            }}>
                                                                {activity.sentVia === "auto" ? "Auto" : "Manual"}
                                                            </span>
                                                            <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#9ca3af" }}>
                                                                {new Date(activity.remindedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <span style={{ fontSize: "12px", color: "#9ca3af" }}>—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn-icon-delete"
                                                        onClick={() => deleteOne(activity.id)}
                                                        disabled={isDeleting}
                                                        title="Delete"
                                                    >
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                            <path d="M10 11v6" /><path d="M14 11v6" />
                                                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {sendModalOpen && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSendModalOpen(false); }}>
                    <div className="modal">
                        <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#111" }}>
                            {selectedIds.size > 1 ? `Send to ${selectedIds.size} customers` : "Send Reminder"}
                        </h2>
                        <p style={{ margin: "0 0 18px", fontSize: "12px", color: "#9ca3af" }}>Edit the message and optionally pick a time to send</p>

                        <div style={{ marginBottom: "14px" }}>
                            <label className="cp-label">Subject</label>
                            <input className="cp-input" value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} />
                        </div>

                        <div style={{ marginBottom: "14px" }}>
                            <label className="cp-label">Message</label>
                            <textarea className="cp-textarea" value={sendBody} onChange={(e) => setSendBody(e.target.value)} />
                        </div>

                        <div style={{ marginBottom: "20px" }}>
                            <label className="cp-label">Send At (leave blank to send immediately)</label>
                            <input
                                className="cp-input"
                                type="datetime-local"
                                value={sendAt}
                                onChange={(e) => setSendAt(e.target.value)}
                            />
                        </div>

                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                            <button
                                onClick={() => setSendModalOpen(false)}
                                style={{ background: "#f5f5f8", color: "#374151", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                            >
                                Cancel
                            </button>
                            <button className="btn-send" onClick={confirmSend} disabled={!sendSubject.trim() || !sendBody.trim()}>
                                {sendAt ? "Schedule Send" : "Send Now"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Page>
    );
}
