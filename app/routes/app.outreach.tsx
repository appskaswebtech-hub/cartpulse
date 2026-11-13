import { useTranslation } from "../i18n/LanguageContext";
import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Modal } from "@shopify/polaris";
import {
  OutreachIcon,
  OutreachHero,
  OutreachEmptyArt,
} from "../components/OutreachVisuals";
import pageStylesheet from "../styles/outreach.css?url";

export const links = () => [{ rel: "stylesheet", href: pageStylesheet }];
import { sendCartEmail } from "../email.server";
import { getShopPlanFromDB } from "../utils/planUtils";

const EMAIL_LIMITS: Record<string, number> = {
  basic: 100,
  pro: 200,
  advanced: 500,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const shopPlan = await getShopPlanFromDB(session.shop);
  const planLimit = EMAIL_LIMITS[shopPlan.plan] ?? 100;
  const planKey = shopPlan.plan;

  const [carts, unsubscribed] = await Promise.all([
    db.abandonedCart.findMany({
      where: {
        shop: session.shop,
        customerEmail: { not: null },
        createdAt: { lte: tenMinutesAgo },
      },
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
    where: {
      shop: session.shop,
      customerEmail: { not: null },
      createdAt: { lte: tenMinutesAgo },
    },
  });

  const unsubscribedEmails = new Set(unsubscribed.map((u) => u.email));

  const enriched = carts.map((cart) => ({
    ...cart,
    isUnsubscribed: unsubscribedEmails.has(cart.customerEmail ?? ""),
  }));

  const totalEmailed = enriched.filter(
    (c) => c.notifications.length > 0,
  ).length;
  const notContacted = enriched.filter(
    (c) => c.notifications.length === 0 && !c.isRecovered && !c.isUnsubscribed,
  ).length;
  const recovered = enriched.filter((c) => c.isRecovered).length;
  const totalUnsubscribed = enriched.filter((c) => c.isUnsubscribed).length;
  const limitReached = totalCarts > planLimit;

  return {
    carts: enriched,
    stats: {
      total: enriched.length,
      totalEmailed,
      notContacted,
      recovered,
      totalUnsubscribed,
    },
    planLimit,
    planKey,
    limitReached,
  };
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

  // Respect the merchant's own switch before contacting anyone.
  if (!settings?.emailEnabled) {
    return {
      error:
        'Recovery emails are switched off. Turn on "Send recovery emails" in Email Settings first.',
      sent: 0,
    };
  }

  const unsubscribedEmails = new Set(unsubscribed.map((u) => u.email));
  const eligible = carts.filter(
    (c) => c.customerEmail && !unsubscribedEmails.has(c.customerEmail),
  );

  const results = await Promise.allSettled(
    eligible.map(async (cart) => {
      const items = JSON.parse(cart.cartData as string);
      const productNames = items.map((i: any) => i.title).join(", ");
      const name = cart.customerName ?? "there";

      const cartUrl =
        `https://${cart.shop}/cart/` +
        items.map((i: any) => `${i.variant_id}:${i.quantity}`).join(",");

      const productCardsHtml = `
              <div style="border:1px solid #eeecfd;border-radius:14px;overflow:hidden;margin:20px 0;">
                ${items
                  .map(
                    (i: any, idx: number) => `
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
                `,
                  )
                  .join("")}
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
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");
  const sent = results.length - failed.length;
  const skipped = carts.length - eligible.length;

  if (failed.length > 0) {
    const err = (failed[0] as PromiseRejectedResult).reason;
    console.error("Email send error:", err);
    return {
      success: false,
      sent,
      failed: failed.length,
      skipped,
      error: String(err),
    };
  }

  return { success: true, sent, failed: 0, skipped, error: null };
};

const DEFAULT_SUBJECT = "You left something in your cart!";
const DEFAULT_BODY =
  "Hey [name], you forgot something! 🛒\n\n" +
  "You left the following items in your cart:\n[products]\n\n" +
  "Total: $[total]\n\n" +
  "[cartlink]";

type FilterKey =
  | "all"
  | "not-contacted"
  | "emailed"
  | "recovered"
  | "unsubscribed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "not-contacted", label: "Not Contacted" },
  { key: "emailed", label: "Email Sent" },
  { key: "recovered", label: "Recovered" },
  { key: "unsubscribed", label: "Unsubscribed" },
];

export default function Outreach() {
  const { tr, locale } = useTranslation();

  const { carts, stats, limitReached, planKey, planLimit } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCartIds, setModalCartIds] = useState<string[]>([]);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [upgradeOpen, setUpgradeOpen] = useState(limitReached);

  const filteredCarts = carts.filter((cart) => {
    if (filter === "not-contacted")
      return (
        cart.notifications.length === 0 &&
        !cart.isRecovered &&
        !cart.isUnsubscribed
      );
    if (filter === "emailed") return cart.notifications.length > 0;
    if (filter === "recovered") return cart.isRecovered;
    if (filter === "unsubscribed") return cart.isUnsubscribed;
    return true;
  });

  const allSelected =
    filteredCarts.length > 0 &&
    filteredCarts.every((c) => selectedIds.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(
        new Set(
          filteredCarts
            .filter((c) => !c.isUnsubscribed && !c.isRecovered)
            .map((c) => c.id),
        ),
      );
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
      { method: "POST" },
    );
    setModalOpen(false);
    setSelectedIds(new Set());
  };

  const isSending = fetcher.state !== "idle";
  const result = fetcher.data;

  return (
    <div className="outreach-shell">
      <div className="outreach-page">
        {/* Header */}
        <header className="outreach-header">
          <span className="outreach-title-icon">
            <OutreachIcon name="mail" />
          </span>
          <div>
            <h1>{tr("Email Outreach")}</h1>
            <p>
              {tr("Manually send recovery emails to abandoned cart customers.")}
            </p>
          </div>
          <span className="outreach-count">
            <OutreachIcon name="users" />
            {tr(carts.length)} {tr(" customers ")}
          </span>
        </header>
        <OutreachHero />

        {/* Feedback banner */}
        {result && (
          <div
            style={{
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
            }}
          >
            {result.success ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {tr(result.sent)} {tr(" email")}
                {result.sent !== 1 ? tr("s") : tr("")}{" "}
                {tr(" sent successfully. ")}
                {tr(
                  result.skipped > 0 &&
                    ` ${result.skipped} skipped (unsubscribed).`,
                )}
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {tr(
                  " Failed to send emails. Check your GMAIL_USER and GMAIL_APP_PASSWORD in .env. ",
                )}
                {result.error && (
                  <span style={{ opacity: 0.7 }}> ({tr(result.error)})</span>
                )}
              </>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="outreach-stats">
          {[
            { label: "Total", value: stats.total, icon: "mail", tone: "total" },
            {
              label: "Not Contacted",
              value: stats.notContacted,
              icon: "clock",
              tone: "waiting",
            },
            {
              label: "Emails Sent",
              value: stats.totalEmailed,
              icon: "send",
              tone: "sent",
            },
            {
              label: "Recovered",
              value: stats.recovered,
              icon: "refresh",
              tone: "recovered",
            },
            {
              label: "Unsubscribed",
              value: stats.totalUnsubscribed,
              icon: "close",
              tone: "unsubscribed",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`stat-card outreach-stat outreach-stat--${stat.tone}`}
            >
              <span className="outreach-stat-icon">
                <OutreachIcon name={stat.icon} />
              </span>
              <div>
                <p className="outreach-stat-label">{tr(stat.label)}</p>
                <p className="outreach-stat-value">{tr(stat.value)}</p>
              </div>
              <span className="outreach-stat-bars" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
          ))}
        </div>

        {/* Filters + bulk */}
        <div className="outreach-filters" aria-label={tr("Filter customers")}>
          {FILTERS.map((tab) => (
            <button
              key={tab.key}
              aria-pressed={filter === tab.key}
              className={`filter-tab${filter === tab.key ? " active" : ""}`}
              onClick={() => {
                setFilter(tab.key);
                setSelectedIds(new Set());
              }}
            >
              {tr(tab.label)}
            </button>
          ))}
          {selectedIds.size > 0 && (
            <div
              className="bulk-bar"
              style={{
                marginLeft: "auto",
                borderRadius: "20px",
                padding: "6px 8px 6px 16px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#fff",
                  marginRight: "10px",
                }}
              >
                {tr(selectedIds.size)} {tr(" selected ")}
              </span>
              <button
                className="btn-send"
                style={{
                  background: "#fff",
                  color: "#534AB7",
                  borderRadius: "14px",
                }}
                onClick={() => openModal(Array.from(selectedIds))}
                disabled={isSending}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {tr(" Send Email ")}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                style={{
                  background: "none",
                  color: "rgba(255,255,255,0.7)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                  marginLeft: "4px",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <section
          className="cp-card outreach-customers"
          aria-labelledby="outreach-customers-title"
        >
          <div className="outreach-customers-head">
            <OutreachIcon name="mail" />
            <h2 id="outreach-customers-title">{tr("Customer Outreach")}</h2>
            <span>
              {tr(filteredCarts.length)} {tr(" customers")}
            </span>
          </div>

          {filteredCarts.length === 0 ? (
            <div className="outreach-empty">
              <OutreachEmptyArt />
              <h3>{tr("No customers here")}</h3>
              <p>
                {tr("Try a different filter or wait for more abandoned carts.")}
              </p>
            </div>
          ) : (
            <div className="cp-table-wrap">
              <table className="cp-table">
                <thead>
                  <tr>
                    <th style={{ width: "36px" }}>
                      <input
                        aria-label={tr("Select all eligible customers")}
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                      />
                    </th>
                    <th>{tr("Customer")}</th>
                    <th>{tr("Products")}</th>
                    <th>{tr("Total")}</th>
                    <th>{tr("Abandoned On")}</th>
                    <th>{tr("Email History")}</th>
                    <th>{tr("Status")}</th>
                    <th>{tr("Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCarts.map((cart) => {
                    const items = JSON.parse(cart.cartData as string);
                    const productNames = items
                      .map((i: any) => i.title)
                      .join(", ");
                    const emailNotifs = cart.notifications;
                    const lastSent = emailNotifs[0]?.sentAt;
                    const isSelected = selectedIds.has(cart.id);
                    const canSend = !cart.isRecovered && !cart.isUnsubscribed;

                    return (
                      <tr
                        key={cart.id}
                        style={{
                          background: isSelected ? "#FAFAFF" : undefined,
                        }}
                      >
                        <td>
                          {canSend && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOne(cart.id)}
                            />
                          )}
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "50%",
                                background: cart.isUnsubscribed
                                  ? "#FEE2E2"
                                  : "#EEEDFE",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "11px",
                                fontWeight: "600",
                                color: cart.isUnsubscribed
                                  ? "#991b1b"
                                  : "#534AB7",
                                flexShrink: 0,
                              }}
                            >
                              {(cart.customerName ||
                                cart.customerEmail ||
                                "G")[0].toUpperCase()}
                            </div>
                            <div>
                              {cart.customerName && (
                                <p
                                  style={{
                                    margin: 0,
                                    fontWeight: "600",
                                    fontSize: "13px",
                                    color: "#111",
                                  }}
                                >
                                  {cart.customerName}
                                </p>
                              )}
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "12px",
                                  color: "#6b7280",
                                }}
                              >
                                {cart.customerEmail}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td
                          style={{
                            color: "#6b7280",
                            maxWidth: "180px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {productNames.length > 35
                            ? tr(productNames.substring(0, 35) + "...")
                            : tr(productNames)}
                        </td>
                        <td style={{ fontWeight: "600", color: "#111" }}>
                          ${tr(cart.totalPrice)}
                        </td>
                        <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>
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
                          {emailNotifs.length === 0 ? (
                            <span className="badge-never">{tr("Never")}</span>
                          ) : (
                            <span className="badge-emailed">
                              <svg
                                width="9"
                                height="9"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              {tr(emailNotifs.length)}
                              {tr("x ")}
                              {tr(
                                lastSent &&
                                  ` · ${new Date(lastSent).toLocaleDateString(locale, { day: "numeric", month: "short" })}`,
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          {cart.isUnsubscribed ? (
                            <span className="badge-unsub">
                              {tr("Unsubscribed")}
                            </span>
                          ) : cart.isRecovered ? (
                            <span className="badge-recovered">
                              <svg
                                width="9"
                                height="9"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              {tr(" Recovered ")}
                            </span>
                          ) : emailNotifs.length > 0 ? (
                            <span className="badge-emailed">
                              {tr("Email Sent")}
                            </span>
                          ) : (
                            <span className="badge-never">
                              {tr("Not Contacted")}
                            </span>
                          )}
                        </td>
                        <td>
                          {canSend && (
                            <button
                              className={
                                emailNotifs.length > 0
                                  ? "btn-resend"
                                  : "btn-send"
                              }
                              onClick={() => openModal([cart.id])}
                              disabled={isSending}
                            >
                              {emailNotifs.length > 0 ? (
                                "Resend"
                              ) : (
                                <>
                                  <svg
                                    width="11"
                                    height="11"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                  </svg>
                                  {tr(" Send ")}
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
        </section>

        <p
          className="outreach-privacy"
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

      {/* Upgrade Plan Popup */}
      {upgradeOpen && (
        <Modal
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          title={tr("Plan Limit Reached")}
        >
          <Modal.Section>
            <div className="outreach-page outreach-upgrade">
              <div
                style={{
                  background: "linear-gradient(135deg,#534AB7,#7F77DD)",
                  padding: "28px 28px 20px",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    background: "rgba(255,255,255,0.15)",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "14px",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  {tr(" Your")}
                  {tr(" ")}
                  <strong
                    style={{ color: "#fff", textTransform: "capitalize" }}
                  >
                    {tr(planKey)}
                  </strong>
                  {tr(" ")}
                  {tr(" plan shows up to")}
                  {tr(" ")}
                  <strong style={{ color: "#fff" }}>
                    {tr(planLimit)}
                  </strong>{" "}
                  {tr(
                    " carts. Upgrade to see more customers and send more recovery emails. ",
                  )}
                </p>
              </div>
              <div style={{ padding: "20px 28px 24px" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    marginBottom: "20px",
                  }}
                >
                  {[
                    { plan: "Pro", limit: "200 carts", color: "#534AB7" },
                    { plan: "Advanced", limit: "500 carts", color: "#1D9E75" },
                  ].map((p) => (
                    <div
                      key={p.plan}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "#F8F7FF",
                        borderRadius: "10px",
                        padding: "12px 16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={p.color}
                          strokeWidth="2.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "#111",
                          }}
                        >
                          {tr(p.plan)}
                        </span>
                      </div>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        {tr(p.limit)}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => setUpgradeOpen(false)}
                    style={{
                      flex: 1,
                      background: "#f5f5f8",
                      color: "#374151",
                      border: "none",
                      borderRadius: "8px",
                      padding: "11px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {tr(" Maybe Later ")}
                  </button>
                  <a
                    href="/app/billing"
                    style={{
                      flex: 2,
                      background: "linear-gradient(135deg,#534AB7,#7F77DD)",
                      color: "#fff",
                      borderRadius: "8px",
                      padding: "11px",
                      fontSize: "13px",
                      fontWeight: "700",
                      textDecoration: "none",
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    {tr(" Upgrade Plan → ")}
                  </a>
                </div>
              </div>
            </div>
          </Modal.Section>
        </Modal>
      )}

      {/* Send Email Modal */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={
            modalCartIds.length > 1
              ? tr("Send to {0} customers", [modalCartIds.length])
              : tr("Send Recovery Email")
          }
        >
          <Modal.Section>
            <div className="outreach-page outreach-email-modal">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    background: "#EEEDFE",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#534AB7"
                    strokeWidth="2"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
                    {tr(" Edit and review before sending ")}
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9ca3af",
                    fontSize: "22px",
                    lineHeight: 1,
                    padding: "0 4px",
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label
                  htmlFor="outreach-email-subject"
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#374151",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  {tr(" Subject ")}
                </label>
                <input
                  id="outreach-email-subject"
                  className="modal-input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={tr("Email subject line")}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  htmlFor="outreach-email-message"
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#374151",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  {tr(" Message ")}
                </label>
                <textarea
                  id="outreach-email-message"
                  className="modal-textarea"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              <div
                style={{
                  background: "#F8F7FF",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  marginBottom: "20px",
                }}
              >
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: "11px",
                    color: "#534AB7",
                    fontWeight: "600",
                  }}
                >
                  {tr(" Available variables — personalized per customer ")}
                </p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {["[name]", "[products]", "[total]", "[cartlink]"].map(
                    (v) => (
                      <code
                        key={v}
                        style={{
                          background: "#EEEDFE",
                          color: "#534AB7",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                        }}
                      >
                        {tr(v)}
                      </code>
                    ),
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setModalOpen(false)}
                  style={{
                    background: "#f5f5f8",
                    color: "#374151",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 20px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  {tr(" Cancel ")}
                </button>
                <button
                  className="btn-send"
                  onClick={handleSend}
                  disabled={!subject.trim() || !body.trim() || isSending}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  {modalCartIds.length > 1
                    ? tr("Send to {0} customers", [modalCartIds.length])
                    : tr("Send Email")}
                </button>
              </div>
            </div>
          </Modal.Section>
        </Modal>
      )}
    </div>
  );
}
