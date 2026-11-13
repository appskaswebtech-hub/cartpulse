import { useTranslation } from "../i18n/LanguageContext";
import type { ReactNode } from "react";

export function ReportsIcon({ name }: { name: string }) {
  const { tr, locale } = useTranslation();

  const paths: Record<string, ReactNode> = {
    report: (
      <>
        <path d="M3 21V9h5v12H3Zm7 0V3h5v18h-5Zm7 0V6h4v15h-4Z" />
        <path d="m7 15 4-4 3 2 6-6" />
      </>
    ),
    chart: (
      <>
        <rect x="3" y="13" width="4" height="8" rx="1" />
        <rect x="10" y="3" width="4" height="18" rx="1" />
        <rect x="17" y="8" width="4" height="13" rx="1" />
      </>
    ),
    layers: (
      <>
        <path d="m2 7 10-5 10 5-10 5L2 7Zm0 5 10 5 10-5M2 17l10 5 10-5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 2v6m10-6v6M3 10h18M8 14h1m6 0h1m-8 3h1" />
      </>
    ),
    download: (
      <>
        <path d="M3 15v6h18v-6M12 3v13m-5-5 5 5 5-5" />
      </>
    ),
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
      {tr(paths[name] || paths.chart)}
    </svg>
  );
}

export function ReportsHero() {
  const { tr, locale } = useTranslation();

  return (
    <section
      className="reports-hero"
      aria-label={tr("Cart activity analytics")}
    >
      <svg
        className="reports-hero-wave"
        viewBox="0 0 1200 170"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="reports-wave" x1="0" y1="0" x2=".5" y2="1">
            <stop stopColor="#009a4f" />
            <stop offset="1" stopColor="#004c26" />
          </linearGradient>
        </defs>
        <path
          d="M520 170c160-150 210-20 310-40s230-160 370-185v225Z"
          fill="url(#reports-wave)"
          opacity=".85"
        />
        <path
          d="M700 170c120-90 150 45 280-20s130-125 220-125v145Z"
          fill="#006333"
          opacity=".5"
        />
      </svg>
      <div className="reports-hero-copy">
        <h2>
          {tr(" Track &amp; Analyze ")}
          <span>{tr("Cart Activity")}</span>
        </h2>
        <p>
          {tr(" See which products are most often added to carts and get ")}
          <br className="reports-desktop-break" />{" "}
          {tr(" insights to recover more sales. ")}
        </p>
      </div>
      <img
        className="reports-hero-art"
        src="/reports-analytics.svg"
        alt={tr(
          "Product analytics dashboard with a bar chart and magnifying glass",
        )}
      />
    </section>
  );
}

export function ReportsEmptyArt() {
  return (
    <div className="reports-empty-art" aria-hidden="true">
      <svg className="reports-empty-cloud" viewBox="0 0 280 100">
        <path
          d="M22 91C-6 77 6 42 37 44 39 9 86 6 102 29c22-33 63-25 75-4 40-28 87 9 76 39 29 1 32 27 7 27Z"
          fill="#def9ec"
        />
      </svg>
      <img src="/reports-analytics.svg" alt="" />
    </div>
  );
}
