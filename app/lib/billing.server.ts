import { PRO_PLAN } from "../shopify.server";

export type EntitlementReason =
  | "development_store"
  | "plus_sandbox"
  | "active_subscription"
  | "no_subscription"
  | "unknown";

export interface Entitlement {
  /** True when paid features may run for this shop. */
  entitled: boolean;
  reason: EntitlementReason;
  /** Dev/sandbox stores are free and can never be charged real money. */
  isDevelopmentStore: boolean;
  planName: string;
  /** Test charges must be used on stores that cannot be billed for real. */
  isTest: boolean;
}

const SHOP_PLAN_QUERY = `#graphql
  query ShopPlan {
    shop {
      myshopifyDomain
      plan {
        displayName
        partnerDevelopment
        shopifyPlus
      }
    }
  }
`;

interface AdminLike {
  graphql: (query: string) => Promise<Response>;
}

interface BillingLike {
  check: (options: any) => Promise<{ hasActivePayment: boolean }>;
}

export interface ShopPlan {
  displayName: string;
  partnerDevelopment: boolean;
  shopifyPlus: boolean;
}

export async function getShopPlan(admin: AdminLike): Promise<ShopPlan | null> {
  try {
    const response = await admin.graphql(SHOP_PLAN_QUERY);
    const body = await response.json();
    const plan = body?.data?.shop?.plan;
    if (!plan) return null;
    return {
      displayName: String(plan.displayName ?? ""),
      partnerDevelopment: Boolean(plan.partnerDevelopment),
      shopifyPlus: Boolean(plan.shopifyPlus),
    };
  } catch {
    return null;
  }
}

/**
 * Shopify reports development and sandbox stores through the shop plan.
 * `partnerDevelopment` covers partner dev stores; the display names cover
 * the trial/staff/plus-sandbox cases that also cannot be charged.
 */
const FREE_PLAN_NAMES = new Set([
  "affiliate",
  "partner_test",
  "plus_partner_sandbox",
  "staff",
  "staff_business",
  "development",
  "trial",
  "npo_full",
]);

export function isNonBillableStore(plan: ShopPlan | null): boolean {
  if (!plan) return false;
  if (plan.partnerDevelopment) return true;
  return FREE_PLAN_NAMES.has(plan.displayName.toLowerCase().replace(/\s+/g, "_"));
}

/**
 * Decides whether paid features may run.
 *
 * Development and sandbox stores get everything for free. Live stores need an
 * active $7.99 subscription. When the plan lookup fails we fall back to the
 * billing check rather than handing out free access.
 */
export async function getEntitlement(
  admin: AdminLike,
  billing: BillingLike
): Promise<Entitlement> {
  const plan = await getShopPlan(admin);
  const isDevelopmentStore = isNonBillableStore(plan);
  const planName = plan?.displayName || "unknown";

  if (isDevelopmentStore) {
    return {
      entitled: true,
      reason: plan?.partnerDevelopment ? "development_store" : "plus_sandbox",
      isDevelopmentStore: true,
      planName,
      isTest: true,
    };
  }

  try {
    const { hasActivePayment } = await billing.check({
      plans: [PRO_PLAN],
      isTest: false,
    });

    return {
      entitled: hasActivePayment,
      reason: hasActivePayment ? "active_subscription" : "no_subscription",
      isDevelopmentStore: false,
      planName,
      isTest: false,
    };
  } catch {
    return {
      entitled: false,
      reason: "unknown",
      isDevelopmentStore: false,
      planName,
      isTest: false,
    };
  }
}
