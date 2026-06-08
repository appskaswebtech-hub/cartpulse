export const SUPPORTED_LOCALES = ["en", "es", "nl", "fr", "it"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export interface Dictionary {
  common: {
    language: string;
    languageNames: Record<Locale, string>;
  };
  nav: {
    abandonedCarts: string;
    reports: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    abandoned: string;
    notified: string;
    recovery: string;
    abandonedCartsChart: string;
    notificationsSentChart: string;
    recoveryRate: string;
    insight: string;
    insightEmpty: string;
    insightSome: (count: number) => string;
    recoveredCount: (count: number) => string;
    stillAbandonedCount: (count: number) => string;
    peakDay: string;
    mostActivity: string;
    notifications: string;
    totalSent: string;
    ofTotalCarts: string;
    status: string;
    active: string;
    waiting: string;
    firingNotifications: string;
    noCartsYet: string;
    privacyFooter: string;
  };
  carts: {
    title: string;
    subtitle: string;
    totalCarts: (count: number) => string;
    totalAbandoned: string;
    recovered: string;
    recoveryRate: string;
    revenueRecovered: string;
    recentCartEvents: string;
    noCartsTitle: string;
    noCartsSubtitle: string;
    customer: string;
    products: string;
    total: string;
    date: string;
    notifications: string;
    status: string;
    guest: string;
    sentCount: (count: number) => string;
    recoveredBadge: string;
    abandonedBadge: string;
    privacyFooter: string;
  };
  reports: {
    title: string;
    subtitle: (rangeLabel: string) => string;
    exportCsv: string;
    last7Days: string;
    last30Days: string;
    allTime: string;
    totalCarts: string;
    recovered: string;
    recoveryRate: string;
    uniqueProducts: string;
    topProducts: string;
    productsCount: (count: number) => string;
    noData: string;
    rank: string;
    product: string;
    timesInCart: string;
    totalQty: string;
    totalValue: string;
    units: string;
    csv: {
      reportTitle: (label: string) => string;
      rank: string;
      product: string;
      timesAbandoned: string;
      totalQtyAbandoned: string;
      totalValueAbandoned: string;
    };
  };
}
