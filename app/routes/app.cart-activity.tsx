import { useTranslation } from "../i18n/LanguageContext";
import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Modal } from "@shopify/polaris";
import pageStylesheet from "../styles/cart-activity.css?url";
import {
  getCartActivitySettings,
  sweepDueCartActivities,
  sendCartActivityReminder,
} from "../cartActivity.server";
import { DEFAULT_SUBJECT, DEFAULT_BODY } from "../cartActivityDefaults";

// Load route styles in the document head on both direct visits and navigation.
export const links = () => [{ rel: "stylesheet", href: pageStylesheet }];

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
    awaitingManual: activities.filter((a) => a.status === "awaiting_manual")
      .length,
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
    const delayMinutes = Math.max(
      1,
      parseInt(formData.get("delayMinutes") as string, 10) || 60,
    );

    await db.cartActivitySettings.upsert({
      where: { shop },
      update: { sendMode, subject, body, delayMinutes },
      create: { shop, sendMode, subject, body, delayMinutes },
    });

    return { success: true, type: "settings" };
  }

  if (intent === "sendManual") {
    const activityIds = JSON.parse(
      formData.get("activityIds") as string,
    ) as string[];
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
      return {
        success: false,
        type: "send",
        sent: 0,
        failed: 0,
        scheduled: 0,
        skipped,
        error: "None of the selected carts have a captured email yet.",
      };
    }

    const scheduledDate = sendAt ? new Date(sendAt) : null;
    const isFuture =
      scheduledDate && scheduledDate.getTime() > Date.now() + 60_000;

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
      return {
        success: true,
        type: "send",
        sent: 0,
        failed: 0,
        scheduled: sendableIds.length,
        skipped,
      };
    }

    await sendCartActivityReminder(sendableIds, baseUrl, subject, body);

    return {
      success: true,
      type: "send",
      sent: sendableIds.length,
      failed: 0,
      scheduled: 0,
      skipped,
    };
  }

  if (intent === "delete") {
    const activityIds = JSON.parse(
      formData.get("activityIds") as string,
    ) as string[];
    await db.cartActivity.deleteMany({
      where: { id: { in: activityIds }, shop },
    });
    return { success: true, type: "delete" };
  }

  return { success: false };
};

function ActivityIcon({ name }: { name: string }) {
  const { tr, locale } = useTranslation();

  const paths: Record<string, React.ReactNode> = {
    cart: (
      <>
        <path d="M2 3h3l4 14h11l3-10H6M9 11h12M13 7l1 10m5-10-2 10" />
        <circle cx="10" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
      </>
    ),
    chart: (
      <>
        <rect
          x="3"
          y="14"
          width="4"
          height="7"
          rx="1"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="10"
          y="9"
          width="4"
          height="12"
          rx="1"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="17"
          y="3"
          width="4"
          height="18"
          rx="1"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
    send: (
      <>
        <path d="m3 10 18-7-7 18-3-8-8-3Z" />
        <path d="m11 13 10-10" />
      </>
    ),
    bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
    check: <path d="m5 12 5 5L20 6" />,
    code: (
      <>
        <path d="m7 6-5 6 5 6m10-12 5 6-5 6m-3-15-4 18" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3 1-2h4l1 2 3 1 2 1 2 3-1 2v4l1 2-2 3-3 1-2 1-1 2h-4l-1-2-3-1-2-1-2-3 1-2v-4L2 8l2-3 3-1Z" />
        <circle cx="12" cy="12" r="5" />
      </>
    ),
    layers: (
      <>
        <path d="m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    message: (
      <>
        <path d="M3 3h15v13H8l-5 4V3Zm5 17h11l3 2V8" />
        <path d="M7 7h7M7 11h4" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7v.1" />
      </>
    ),
    save: (
      <>
        <path d="M3 3h15l3 3v15H3V3Z" />
        <path d="M7 3v6h10V3M7 21v-8h10v8" />
      </>
    ),
  };
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tr(paths[name] || paths.cart)}
    </svg>
  );
}

export default function CartActivity() {
  const { tr, locale } = useTranslation();

  const { settings, activities, stats } = useLoaderData<typeof loader>();
  const visibleActivities = activities.filter((a) => a.status !== "converted");
  const settingsFetcher = useFetcher<typeof action>();
  const sendFetcher = useFetcher<typeof action>();
  const deleteFetcher = useFetcher<typeof action>();
  const trackerFetcher = useFetcher<{
    success: boolean;
    installed?: boolean;
    error?: string;
  }>();

  const trackerInstalled =
    trackerFetcher.data?.installed ?? settings.trackerInstalled;
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
  const settingsSaved =
    settingsFetcher.data?.type === "settings" && settingsFetcher.data.success;
  const sendResult =
    sendFetcher.data?.type === "send" ? sendFetcher.data : null;

  const saveSettings = () => {
    settingsFetcher.submit(
      {
        intent: "updateSettings",
        sendMode,
        subject,
        body,
        delayMinutes: String(delayMinutes),
      },
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
      {
        intent: "delete",
        activityIds: JSON.stringify(Array.from(selectedIds)),
      },
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
      pending: {
        bg: "#F1F5F9",
        color: "#64748b",
        label: `Waiting (< ${settings.delayMinutes} min)`,
      },
      awaiting_manual: {
        bg: "#FEF9C3",
        color: "#854D0E",
        label: "Ready to send",
      },
      scheduled: { bg: "#DBEAFE", color: "#1e40af", label: "Scheduled" },
      reminded: { bg: "#EEEDFE", color: "#534AB7", label: "Reminder sent" },
      converted: { bg: "#DCFCE7", color: "#166534", label: "Converted" },
    };
    const s = map[status] ?? map.pending;
    return (
      <span
        style={{
          background: s.bg,
          color: s.color,
          fontSize: "11px",
          fontWeight: 600,
          padding: "3px 9px",
          borderRadius: "20px",
        }}
      >
        {tr(s.label)}
      </span>
    );
  };

  return (
    <div className="activity-page-shell">
      <div className="activity-page">
        <header className="activity-header">
          <span className="activity-title-icon">
            <ActivityIcon name="chart" />
          </span>
          <div>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                margin: 0,
                color: "#111",
              }}
            >
              {tr(" Cart Activity ")}
            </h1>
            <p
              style={{ fontSize: "13px", color: "#9ca3af", margin: "4px 0 0" }}
            >
              {tr(
                " Track products added to cart and remind customers after they don't check out ",
              )}
            </p>
          </div>
        </header>

        <section
          className="cp-card activity-tracking"
          aria-labelledby="activity-tracking-title"
        >
          <svg
            className="activity-tracking-wave"
            viewBox="0 0 1200 260"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M380 260C600 75 680 300 860 130S1100 50 1200 110V260Z"
              fill="#a2efc9"
              opacity=".5"
            />
          </svg>
          <div className="activity-tracking-copy">
            <h2 id="activity-tracking-title">{tr("Storefront Tracking")}</h2>
            <p>
              {tr(
                " Installs a tracking script on your storefront so logged-in customers' email is captured the moment they add to cart — no checkout needed. ",
              )}
            </p>
            <button
              className={`btn-save activity-tracking-button${trackerInstalled ? " is-installed" : ""}`}
              disabled={isTogglingTracker}
              onClick={toggleTracker}
            >
              <ActivityIcon name={trackerInstalled ? "check" : "code"} />
              {isTogglingTracker
                ? tr("Working\u2026")
                : trackerInstalled
                  ? tr("Disable Tracking")
                  : tr("Enable Tracking")}
            </button>
          </div>
          <img
            className="activity-tracking-art"
            src="/cart-activity-storefront.svg"
            alt={tr(
              "Storefront tracking with a shopping cart and confirmation check",
            )}
          />
        </section>

        {trackerFetcher.data?.success === false && (
          <div
            style={{
              background: "#FEE2E2",
              color: "#991b1b",
              borderRadius: "10px",
              padding: "10px 16px",
              marginBottom: "20px",
              fontSize: "13px",
            }}
          >
            {tr(" Tracking script error: ")}
            {tr(trackerFetcher.data.error)}
          </div>
        )}

        <div className="activity-stats">
          {[
            {
              label: "Tracked",
              value: stats.total,
              icon: "cart",
              tone: "tracked",
            },
            {
              label: "Ready to Send",
              value: stats.awaitingManual,
              icon: "send",
              tone: "ready",
            },
            {
              label: "Reminders Sent",
              value: stats.reminded,
              icon: "bell",
              tone: "reminded",
            },
            {
              label: "Converted",
              value: stats.converted,
              icon: "check",
              tone: "converted",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`cp-card activity-stat activity-stat--${stat.tone}`}
            >
              <span className="activity-stat-icon">
                <ActivityIcon name={stat.icon} />
              </span>
              <div>
                <p className="activity-stat-label">{tr(stat.label)}</p>
                <p className="activity-stat-value">{tr(stat.value)}</p>
              </div>
              {stat.tone === "tracked" && (
                <span className="activity-mini-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
          ))}
        </div>

        <section
          className="cp-card activity-settings"
          aria-labelledby="activity-settings-title"
        >
          <h2 className="activity-section-title" id="activity-settings-title">
            <ActivityIcon name="settings" />
            {tr(" Reminder Settings ")}
          </h2>
          <fieldset className="activity-modes">
            <legend className="activity-sr-only">
              {tr("Reminder sending mode")}
            </legend>
            <label
              className={`mode-option${sendMode === "auto" ? " active" : ""}`}
            >
              <input
                type="radio"
                name="sendMode"
                checked={sendMode === "auto"}
                onChange={() => setSendMode("auto")}
              />
              <span className="activity-mode-icon activity-mode-icon--auto">
                <ActivityIcon name="send" />
              </span>
              <span className="activity-mode-copy">
                <strong>{tr("Send Automatically")}</strong>
                <span>
                  {tr(
                    " Email goes out on its own after the wait time below, if not purchased. ",
                  )}
                </span>
              </span>
            </label>
            <label
              className={`mode-option${sendMode === "manual" ? " active" : ""}`}
            >
              <input
                type="radio"
                name="sendMode"
                checked={sendMode === "manual"}
                onChange={() => setSendMode("manual")}
              />
              <span className="activity-mode-icon activity-mode-icon--manual">
                <ActivityIcon name="layers" />
              </span>
              <span className="activity-mode-copy">
                <strong>{tr("Send Manually")}</strong>
                <span>
                  {tr(
                    " Cart lands in the list below after the wait time — you review and click Send. ",
                  )}
                </span>
              </span>
            </label>
          </fieldset>
          <div
            className="activity-field activity-delay"
            style={{
              opacity: sendMode === "manual" ? 0.7 : 1,
              transition: "opacity 0.15s",
            }}
          >
            <label className="cp-label" htmlFor="activity-delay">
              {tr(" Wait time before auto-send (minutes) ")}
            </label>
            <div className="activity-input-icon">
              <ActivityIcon name="clock" />
              <input
                id="activity-delay"
                className="cp-input"
                type="number"
                min={1}
                value={delayMinutes}
                onChange={(e) =>
                  setDelayMinutes(
                    Math.max(1, parseInt(e.target.value, 10) || 1),
                  )
                }
              />
            </div>
          </div>
          <div className="activity-field">
            <label className="cp-label" htmlFor="activity-subject">
              {tr(" Subject ")}
            </label>
            <div className="activity-input-icon">
              <ActivityIcon name="mail" />
              <input
                id="activity-subject"
                className="cp-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>
          <div className="activity-field">
            <label className="cp-label" htmlFor="activity-message">
              {tr(" Message ")}
            </label>
            <div className="activity-input-icon activity-message-icon">
              <ActivityIcon name="message" />
              <textarea
                id="activity-message"
                className="cp-textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>
          <div className="activity-settings-footer">
            <div className="activity-variables">
              <p>
                {tr(" Available variables ")}
                <ActivityIcon name="info" />
              </p>
              <div>
                {["[name]", "[products]", "[total]", "[cartlink]"].map(
                  (variable) => (
                    <code key={variable}>{tr(variable)}</code>
                  ),
                )}
              </div>
            </div>
            <div className="activity-save-actions">
              {settingsSaved && (
                <span className="activity-saved" role="status">
                  <ActivityIcon name="check" />
                  {tr(" Settings saved ")}
                </span>
              )}
              <button
                className="btn-save"
                disabled={isSavingSettings}
                onClick={saveSettings}
              >
                <ActivityIcon name="save" />
                {isSavingSettings ? tr("Saving\u2026") : tr("Save Settings")}
              </button>
            </div>
          </div>
        </section>

        <section
          className="cp-card activity-tracked"
          aria-labelledby="activity-tracked-title"
        >
          <div className="activity-tracked-head">
            <h2 className="activity-section-title" id="activity-tracked-title">
              <ActivityIcon name="cart" />
              {tr(" Tracked Carts ")}
            </h2>
            {selectedIds.size > 0 && (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn-send"
                  style={{ background: "#FEE2E2", color: "#991b1b" }}
                  disabled={isDeleting}
                  onClick={deleteSelected}
                >
                  {isDeleting
                    ? tr("Deleting…")
                    : tr("Delete ({0})", [selectedIds.size])}
                </button>
                <button
                  className="btn-send"
                  disabled={isSending}
                  onClick={openSendModal}
                >
                  {isSending
                    ? tr("Sending…")
                    : tr("Send / Schedule ({0})", [selectedIds.size])}
                </button>
              </div>
            )}
          </div>

          {sendResult && (
            <div
              style={{
                padding: "10px 20px",
                fontSize: "13px",
                color: sendResult.success ? "#166534" : "#991b1b",
                background: sendResult.success ? "#DCFCE7" : "#FEE2E2",
              }}
            >
              {!sendResult.success && sendResult.error
                ? tr(sendResult.error)
                : sendResult.scheduled
                  ? tr("{0} reminder{1} scheduled.", [
                      sendResult.scheduled,
                      sendResult.scheduled !== 1 ? "s" : "",
                    ])
                  : tr("{0} reminder{1} sent{2}.", [
                      sendResult.sent,
                      sendResult.sent !== 1 ? "s" : "",
                      sendResult.failed ? `, ${sendResult.failed} failed` : "",
                    ])}
              {tr(
                !!sendResult.skipped &&
                  ` (${sendResult.skipped} skipped — no email captured yet.)`,
              )}
            </div>
          )}

          {visibleActivities.length === 0 ? (
            <div className="activity-empty">
              <div className="activity-empty-art" aria-hidden="true">
                <svg viewBox="0 0 190 108">
                  <path
                    d="M22 99C-5 99 2 64 18 62-2 24 46 2 64 21 86-12 126 0 126 28c30-10 57 12 49 40 24 2 21 31 3 31Z"
                    fill="#ddf9e9"
                  />
                </svg>
                <ActivityIcon name="cart" />
                <span className="activity-empty-rays">?</span>
              </div>
              <h3>{tr("No cart activity tracked yet.")}</h3>
              <p>
                {tr(
                  " Once customers add products to their cart, they'll appear here. ",
                )}
              </p>
            </div>
          ) : (
            <div className="cp-table-wrap">
              <table className="cp-table">
                <thead>
                  <tr>
                    <th style={{ width: "36px" }}></th>
                    <th>{tr("Product")}</th>
                    <th>{tr("Customer")}</th>
                    <th>{tr("Qty")}</th>
                    <th>{tr("Price")}</th>
                    <th>{tr("Added")}</th>
                    <th>{tr("Status")}</th>
                    <th>{tr("Sent")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleActivities.map((activity) => {
                    return (
                      <tr key={activity.id}>
                        <td>
                          <input
                            aria-label={tr("Select {0}", [activity.title])}
                            type="checkbox"
                            checked={selectedIds.has(activity.id)}
                            onChange={() => toggleOne(activity.id)}
                          />
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            {activity.imageUrl ? (
                              <img
                                src={activity.imageUrl}
                                alt={tr(activity.title)}
                                width={32}
                                height={32}
                                style={{
                                  borderRadius: "8px",
                                  objectFit: "cover",
                                  flexShrink: 0,
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  background: "#EEEDFE",
                                  borderRadius: "8px",
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            <span
                              style={{
                                maxWidth: "180px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {activity.title}
                            </span>
                          </div>
                        </td>
                        <td>
                          {activity.customerEmail ? (
                            <>
                              <p
                                style={{
                                  margin: 0,
                                  fontWeight: 600,
                                  fontSize: "13px",
                                  color: "#111",
                                }}
                              >
                                {activity.customerName || "—"}
                              </p>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "12px",
                                  color: "#6b7280",
                                }}
                              >
                                {activity.customerEmail}
                              </p>
                            </>
                          ) : (
                            <span
                              style={{ fontSize: "12px", color: "#9ca3af" }}
                            >
                              {tr(" No contact info yet ")}
                            </span>
                          )}
                        </td>
                        <td>{tr(activity.quantity)}</td>
                        <td style={{ fontWeight: 600, color: "#111" }}>
                          {tr(activity.currency)}
                          {tr(" ")}
                          {tr(
                            (
                              Number(activity.price) * activity.quantity
                            ).toFixed(2),
                          )}
                        </td>
                        <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>
                          {tr(
                            new Date(activity.addedAt).toLocaleString(locale, {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                          )}
                        </td>
                        <td>{tr(statusBadge(activity.status))}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {activity.status === "reminded" &&
                          activity.remindedAt ? (
                            <>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: "10px",
                                  background:
                                    activity.sentVia === "auto"
                                      ? "#DBEAFE"
                                      : "#F0EFFE",
                                  color:
                                    activity.sentVia === "auto"
                                      ? "#1e40af"
                                      : "#534AB7",
                                }}
                              >
                                {activity.sentVia === "auto"
                                  ? tr("Auto")
                                  : tr("Manual")}
                              </span>
                              <p
                                style={{
                                  margin: "3px 0 0",
                                  fontSize: "11px",
                                  color: "#9ca3af",
                                }}
                              >
                                {tr(
                                  new Date(activity.remindedAt).toLocaleString(
                                    "en-IN",
                                    {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  ),
                                )}
                              </p>
                            </>
                          ) : (
                            <span
                              style={{ fontSize: "12px", color: "#9ca3af" }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn-icon-delete"
                            onClick={() => deleteOne(activity.id)}
                            disabled={isDeleting}
                            title={tr("Delete")}
                          >
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
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
        </section>
      </div>

      {sendModalOpen && (
        <Modal
          open={sendModalOpen}
          onClose={() => setSendModalOpen(false)}
          title={
            selectedIds.size > 1
              ? tr("Send to {0} customers", [selectedIds.size])
              : tr("Send Reminder")
          }
        >
          <Modal.Section>
            <div className="activity-page activity-send-modal">
              <p
                style={{
                  margin: "0 0 18px",
                  fontSize: "12px",
                  color: "#9ca3af",
                }}
              >
                {tr(" Edit the message and optionally pick a time to send ")}
              </p>

              <div style={{ marginBottom: "14px" }}>
                <label className="cp-label">{tr("Subject")}</label>
                <input
                  className="cp-input"
                  value={sendSubject}
                  onChange={(e) => setSendSubject(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label className="cp-label">{tr("Message")}</label>
                <textarea
                  className="cp-textarea"
                  value={sendBody}
                  onChange={(e) => setSendBody(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label className="cp-label">
                  {tr(" Send At (leave blank to send immediately) ")}
                </label>
                <input
                  className="cp-input"
                  type="datetime-local"
                  value={sendAt}
                  onChange={(e) => setSendAt(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setSendModalOpen(false)}
                  style={{
                    background: "#f5f5f8",
                    color: "#374151",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 20px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {tr(" Cancel ")}
                </button>
                <button
                  className="btn-send"
                  onClick={confirmSend}
                  disabled={!sendSubject.trim() || !sendBody.trim()}
                >
                  {sendAt ? tr("Schedule Send") : tr("Send Now")}
                </button>
              </div>
            </div>
          </Modal.Section>
        </Modal>
      )}
    </div>
  );
}
