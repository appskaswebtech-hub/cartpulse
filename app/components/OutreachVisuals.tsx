import { useTranslation } from "../i18n/LanguageContext";
import type { ReactNode } from "react";

export function OutreachIcon({ name }: { name: string }) {
  const { tr, locale } = useTranslation();

  const paths: Record<string, ReactNode> = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    users: (
      <>
        <circle cx="13" cy="7" r="3" />
        <path d="M6 20v-3c0-5 14-5 14 0v3H6ZM4 4a3 3 0 0 0 0 6M2 17v-2c0-2 1-3 3-3" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    send: (
      <>
        <path d="m3 9 18-7-7 19-3-8-8-4Z" />
        <path d="m11 13 10-11" />
      </>
    ),
    refresh: (
      <>
        <path d="M21 4v6h-6M3 20v-6h6" />
        <path d="M20 9a8 8 0 0 0-14-4L3 8M4 15a8 8 0 0 0 14 4l3-3" />
      </>
    ),
    close: <path d="m5 5 14 14M19 5 5 19" />,
  };
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tr(paths[name] || paths.mail)}
    </svg>
  );
}

export function OutreachHero() {
  const { tr, locale } = useTranslation();

  return (
    <section
      className="outreach-hero"
      aria-label={tr("Customer recovery emails")}
    >
      <svg
        className="outreach-hero-wave"
        viewBox="0 0 1200 170"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="outreach-wave" x1="0" y1="0" x2=".5" y2="1">
            <stop stopColor="#00b46b" />
            <stop offset="1" stopColor="#00502f" />
          </linearGradient>
        </defs>
        <path
          d="M350 170c100-100 150 100 270-10s210 70 320-20 160-80 260-55v85Z"
          fill="url(#outreach-wave)"
        />
        <path
          d="M550 170c120-80 180 50 290-20s180 70 275-45 130-60 160-30v95Z"
          fill="#008648"
          opacity=".5"
        />
      </svg>
      <div className="outreach-hero-copy">
        <h2>
          {tr(" Re-engage ")}
          <span>{tr("Your Customers")}</span>
        </h2>
        <p>
          {tr(" Send targeted recovery emails to bring shoppers back ")}
          <br className="outreach-desktop-break" />{" "}
          {tr(" and complete their purchase. ")}
        </p>
      </div>
      <img
        className="outreach-hero-art"
        src="/outreach-recovery-email.svg"
        alt={tr("Recovery email with a shopping cart and send icon")}
      />
    </section>
  );
}

export function OutreachEmptyArt() {
  return (
    <div className="outreach-empty-art" aria-hidden="true">
      <svg viewBox="0 0 220 135" fill="none">
        <defs>
          <linearGradient
            id="outreach-empty-envelope"
            x1="70"
            y1="65"
            x2="160"
            y2="135"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#a3f6ce" />
            <stop offset="1" stopColor="#4bd191" />
          </linearGradient>
        </defs>
        <path
          d="M8 111C-4 78 40 51 65 80c9-29 43-29 61-11 28-23 50 0 48 17 34-18 49 9 42 25Z"
          fill="#e5f9f0"
        />
        <path
          d="m57 64 48-42q8-8 16 0l46 42v61H57V64Z"
          fill="url(#outreach-empty-envelope)"
          stroke="#75deac"
        />
        <rect
          x="68"
          y="40"
          width="88"
          height="66"
          rx="7"
          fill="#fff"
          stroke="#d8f2e5"
        />
        <path
          d="M85 60h53M85 75h33"
          stroke="#0ebc77"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M57 66 111 103l56-37v51q0 12-11 12H68q-11 0-11-12V66Z"
          fill="url(#outreach-empty-envelope)"
        />
        <path d="m59 124 35-34m36 0 35 34" stroke="#55c993" strokeWidth="1.5" />
        <path
          d="m161 23 4-16m7 25 13-12m-5 23 16-4"
          stroke="#087b39"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
