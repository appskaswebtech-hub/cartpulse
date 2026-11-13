import { useTranslation } from "../i18n/LanguageContext";
import type { ReactNode } from "react";

export function EmailSettingsIcon({ name }: { name: string }) {
  const { tr, locale } = useTranslation();

  const paths: Record<string, ReactNode> = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="1.5" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v7M12 6.5v.2" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 6-3 7-3 8h18c0-1-3-2-3-8M10 21h4" />
        <path d="M12 2v1" />
      </>
    ),
    send: (
      <>
        <path d="m3 9 18-7-7 19-3-8-8-4Z" />
        <path d="m11 13 10-11" />
      </>
    ),
    save: (
      <>
        <path d="M3 3h15l3 3v15H3V3Z" />
        <path d="M7 3v6h10V3M7 21v-8h10v8" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="1.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    check: <path d="m5 12 5 5L20 6" />,
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

export function EmailSettingsHero() {
  const { tr, locale } = useTranslation();

  return (
    <section
      className="email-settings-hero"
      aria-label={tr("Recovery email setup")}
    >
      <svg
        className="email-settings-hero-waves"
        viewBox="0 0 1200 170"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="email-settings-wave" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#00ce7c" />
            <stop offset="1" stopColor="#005830" />
          </linearGradient>
        </defs>
        <path
          d="M230 170C420 24 470 150 640 150S850 68 1000 128s100-46 200-10v52Z"
          fill="url(#email-settings-wave)"
        />
        <path
          d="M420 170c150-110 170-20 310-60s180 95 310 36 140-42 160-33v57Z"
          fill="#007640"
          opacity=".6"
        />
      </svg>
      <div className="email-settings-hero-copy">
        <h2>
          {tr(" Manage ")}
          <span>{tr("Recovery Emails")}</span>
        </h2>
        <p>
          {tr(" Set up automated emails and notifications to ")}
          <br className="email-settings-desktop-break" />{" "}
          {tr(" bring shoppers back to complete their purchase. ")}
        </p>
      </div>
      <img
        className="email-settings-hero-art"
        src="/email-settings-recovery.svg"
        alt={tr("Shopping cart recovery email and paper airplane")}
      />
    </section>
  );
}
