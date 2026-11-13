import { useTranslation } from "../i18n/LanguageContext";
import type { ReactNode } from "react";

export function CartsBanner({
  shop,
  recoveryRate,
  notificationsLabel,
  hasNotifications,
  icon,
}: {
  shop: string;
  recoveryRate: number;
  notificationsLabel: string;
  hasNotifications: boolean;
  icon: ReactNode;
}) {
  const { tr, locale } = useTranslation();

  return (
    <>
      <div className="carts-topbar">
        <div className="carts-brand">
          {tr(icon)}
          <span>CartPulse</span>
        </div>
        <div className="carts-account">
          {/* <a
            className="carts-store"
            href={`https://${shop}/admin`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="carts-shopify" aria-hidden="true">
              S
            </span>
            <span>{shop.replace(".myshopify.com", "")}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </a> */}
          <a
            className="carts-notifications"
            href="#carts-events"
            aria-label={tr(notificationsLabel)}
          >
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
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
            </svg>
            {hasNotifications && <span />}
          </a>
          <span className="carts-account-avatar" aria-label={tr(shop)}>
            {shop[0].toUpperCase()}
          </span>
        </div>
      </div>
      <section
        className="carts-hero"
        aria-label={tr("CartPulse cart recovery")}
      >
        <svg
          className="carts-hero-waves"
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="carts-wave" x1="0" y1="0" x2="0.4" y2="1">
              <stop stopColor="#00dc83" stopOpacity=".65" />
              <stop offset="1" stopColor="#003528" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M480 200Q620 90 770 165T1200 120V200Z"
            fill="url(#carts-wave)"
            stroke="#00e58d"
            strokeOpacity=".55"
          />
          <path
            d="M750 220Q890 90 1020 150T1250 70V220Z"
            fill="url(#carts-wave)"
            stroke="#00e58d"
            strokeOpacity=".8"
          />
        </svg>
        <div className="carts-hero-copy">
          <div className="carts-hero-brand">{tr(icon)} CartPulse</div>
          <h2>
            {tr(" Recover Lost Revenue. ")}
            <br />
            <span>{tr("Automatically.")}</span>
          </h2>
          <p>
            {tr("Bring back shoppers with smart, automated cart recovery.")}
          </p>
          <div className="carts-hero-channels">
            <span>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3 5h18v14H3z" />
                <path
                  d="m3 5 9 8 9-8"
                  fill="none"
                  stroke="#004332"
                  strokeWidth="2"
                />
              </svg>
              {tr(" Email Reminders ")}
            </span>
            <span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.7a8.5 8.5 0 1 1 16.3-3.8Z" />
                <path
                  d="M8 7c0 5 4 8 8 8l1-3-3-1-1 1-2-2 1-1-2-3Z"
                  fill="currentColor"
                  strokeWidth=".5"
                />
              </svg>
              WhatsApp
            </span>
            <span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
              </svg>
              {tr(" Push Notifications ")}
            </span>
          </div>
        </div>
        <img
          className="carts-hero-art"
          src="/carts-recovery-cart.svg"
          alt={tr("Shopping cart with green shopping bags")}
        />
        <div className="carts-hero-sales">
          <strong>{tr("+ Recover Sales")}</strong>
          <div>
            <span className="carts-sales-arrow" aria-hidden="true">
              ↑
            </span>
            <b>{tr(recoveryRate)}%</b>
            <span className="carts-sales-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
