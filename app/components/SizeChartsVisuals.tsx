import { useTranslation } from "../i18n/LanguageContext";
import type { ReactNode } from "react";

export function SizeChartIcon({ name }: { name: string }) {
  const { tr, locale } = useTranslation();

  const paths: Record<string, ReactNode> = {
    details: (
      <>
        <path d="M6 2h8l4 4v16H6V2Z" />
        <path d="M13 2v5h5M9 11h6M9 15h6M9 19h3" />
      </>
    ),
    measurements: (
      <>
        <rect x="2" y="3" width="20" height="18" rx="1" />
        <path d="M2 8h20M2 14h20M9 8v13M16 8v13" />
      </>
    ),
    save: (
      <>
        <path d="M3 3h15l3 3v15H3V3Z" />
        <path d="M7 3v6h10V3M7 21v-8h10v8" />
      </>
    ),
    play: <path d="m6 3 15 9-15 9V3Z" />,
    close: <path d="m5 5 14 14M19 5 5 19" />,
    ruler: (
      <>
        <path d="m3 16 13-13 5 5L8 21l-5-5Z" />
        <path d="m7 12 2 2m2-6 2 2m2-6 2 2" />
      </>
    ),
    layers: (
      <>
        <path d="m2 7 10-5 10 5-10 5L2 7Zm0 5 10 5 10-5M2 17l10 5 10-5" />
      </>
    ),
    chart: (
      <>
        <rect x="3" y="15" width="4" height="6" rx="1" />
        <rect x="10" y="10" width="4" height="11" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </>
    ),
    "women-tops": (
      <>
        <path d="M7 3 5 5l3 5-4 11h16l-4-11 3-5-2-2c-3 3-7 3-10 0Z" />
        <path d="M8 10h8" />
      </>
    ),
    "men-tops": <path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c-2 3-6 3-8 0Z" />,
    kids: (
      <>
        <path d="M5 9c-2-6 3-7 5-6 2-3 7 0 7 3 5-1 5 7 2 7-1 9-14 9-14 0-4-1-3-6 0-4Z" />
        <path d="M6 10c4 0 5-3 6-3 2 3 5 3 6 3M9 13v.1m6-.1v.1M9 16q3 3 6 0" />
      </>
    ),
    "shoes-unisex": (
      <>
        <path d="M3 11c3 1 4-2 4-5l4 1 2 5 7 3q2 1 2 5H3v-9Z" />
        <path d="M3 17h18M13 12l-2 2m6 0-2 2" />
      </>
    ),
    lingerie: (
      <>
        <path d="M4 3 5 11M20 3l-1 8M12 16c-3-8-10-7-10-2l2 7c3-2 6 1 8-3 2 4 5 1 8 3l2-7c0-5-7-6-10 2Z" />
      </>
    ),
    pets: (
      <>
        <ellipse cx="4" cy="10" rx="2" ry="3" transform="rotate(-25 4 10)" />
        <ellipse cx="9" cy="5" rx="2" ry="3" />
        <ellipse cx="16" cy="5" rx="2" ry="3" />
        <ellipse cx="21" cy="10" rx="2" ry="3" transform="rotate(25 21 10)" />
        <path d="M6 16c-5 6 0 7 4 5 3-1 4 0 7 1 5 0 4-5 1-7-5-7-8-5-12 1Z" />
      </>
    ),
    custom: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    clipboard: (
      <>
        <rect x="4" y="4" width="16" height="18" rx="2" />
        <rect x="9" y="2" width="6" height="4" rx="1" />
        <path d="M8 16h8M8 19h6m-5-8 2-1c1 1 2 1 3 0l2 1-1 2-1-1v3h-4v-3l-1 1-1-2Z" />
      </>
    ),
  };
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tr(paths[name] || paths.ruler)}
    </svg>
  );
}

export function SizeChartsHero() {
  const { tr, locale } = useTranslation();

  return (
    <section
      className="size-charts-hero"
      aria-label={tr("Professional size guides")}
    >
      <svg
        className="size-charts-hero-wave"
        viewBox="0 0 1200 240"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="size-wave">
            <stop stopColor="#007d65" />
            <stop offset="1" stopColor="#005e38" />
          </linearGradient>
        </defs>
        <path
          d="M0 210C210 330 280 240 450 150S650 300 860 190s210-140 340-80v140H0Z"
          fill="url(#size-wave)"
          opacity=".7"
        />
        <path
          d="M0 240c330-80 480 100 720-20s280-85 480-100v120Z"
          fill="#004a34"
          opacity=".65"
        />
      </svg>
      <div className="size-charts-hero-copy">
        <h2>
          {tr(" Create Professional ")}
          <br />
          <span>{tr("Size Charts")}</span>
        </h2>
        <p>
          {tr(" Help customers find the right fit and reduce ")}
          <br className="size-charts-desktop-break" />{" "}
          {tr(" returns with easy-to-use size guides. ")}
        </p>
        <div className="size-charts-hero-features">
          {[
            "Ready-to-use templates",
            "Fully customizable",
            "Reduce returns",
          ].map((feature) => (
            <span key={feature}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="9" fill="#6ff1b9" />
                <path
                  d="m5 10 3 3 7-7"
                  fill="none"
                  stroke="#005939"
                  strokeWidth="2"
                />
              </svg>
              {tr(feature)}
            </span>
          ))}
        </div>
      </div>
      <img
        className="size-charts-hero-art"
        src="/size-charts-fit.svg"
        alt={tr("T-shirt measurements, a size chart and measuring tape")}
      />
    </section>
  );
}

export function SizeChartsEmptyArt() {
  return (
    <div className="size-charts-empty-art" aria-hidden="true">
      <svg className="size-charts-empty-cloud" viewBox="0 0 220 100">
        <path
          d="M27 90C-14 82 0 36 46 41 43 5 100-4 115 20c34-22 77 0 69 29 48-2 51 41 16 41Z"
          fill="#e0f9ee"
        />
      </svg>
      <SizeChartIcon name="clipboard" />
      <span className="size-charts-empty-rays">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
