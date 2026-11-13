import { useTranslation } from "../i18n/LanguageContext";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  useLoaderData,
  useActionData,
  useNavigate,
  useNavigation,
  Form,
} from "react-router";
import { useState, useEffect } from "react";
import pageStylesheet from "../styles/billing.css?url";

export const links = () => [{ rel: "stylesheet", href: pageStylesheet }];
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { PLANS, PLAN_KEYS } from "../config/plans";
import { getShopPlanFromDB, cancelShopPlan } from "../utils/planUtils";

interface LoaderData {
  currentPlan: string;
  isDevShop: boolean;
}
interface ActionData {
  confirmationUrl?: string;
  error?: string;
  cancelled?: boolean;
}
interface UserError {
  field: string;
  message: string;
}
interface AppSubscriptionCreateResponse {
  data?: {
    appSubscriptionCreate?: {
      confirmationUrl?: string;
      userErrors?: UserError[];
      appSubscription?: { id: string };
    };
  };
}

const PLANS_ORDERED = PLAN_KEYS.map((key) => PLANS[key]).filter(Boolean);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const record = await getShopPlanFromDB(session.shop);

  // Development and sandbox stores run the full app for free.
  const response = await admin.graphql(`#graphql
      query { shop { plan { partnerDevelopment } } }
    `);
  const data = await response.json();
  const isDevShop = data?.data?.shop?.plan?.partnerDevelopment === true;

  return { currentPlan: record.plan, isDevShop } satisfies LoaderData;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "cancel") {
    try {
      // Find and cancel the active Shopify subscription
      const subResponse = await admin.graphql(`#graphql
                query { currentAppInstallation { activeSubscriptions { id name status } } }
            `);
      const subJson = (await subResponse.json()) as any;
      const activeSubs =
        subJson?.data?.currentAppInstallation?.activeSubscriptions ?? [];

      for (const sub of activeSubs) {
        await admin.graphql(
          `#graphql
                    mutation CancelSub($id: ID!) {
                        appSubscriptionCancel(id: $id) {
                            userErrors { field message }
                        }
                    }`,
          { variables: { id: sub.id } },
        );
      }

      await cancelShopPlan(shop);
      return { cancelled: true } satisfies ActionData;
    } catch (err) {
      console.error("[app.billing] cancel error:", err);
      return {
        error: "Failed to cancel plan. Please try again.",
      } satisfies ActionData;
    }
  }

  const planKey = formData.get("plan") as string;

  if (!PLAN_KEYS.includes(planKey)) {
    return { error: `Invalid plan: "${planKey}"` } satisfies ActionData;
  }

  const selectedPlan = PLANS[planKey];

  try {
    const response = await admin.graphql(
      `#graphql
      mutation AppSubscriptionCreate(
        $name: String!
        $lineItems: [AppSubscriptionLineItemInput!]!
        $returnUrl: URL!
        $trialDays: Int
        $test: Boolean
      ) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          lineItems: $lineItems
          trialDays: $trialDays
          test: $test
        ) {
          userErrors { field message }
          appSubscription { id }
          confirmationUrl
        }
      }`,
      {
        variables: {
          name: planKey,
          returnUrl: `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/billing-return`,

          test: true,
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                  price: { amount: selectedPlan.price, currencyCode: "USD" },
                  interval: "EVERY_30_DAYS",
                },
              },
            },
          ],
        },
      },
    );

    const resJson: AppSubscriptionCreateResponse = await response.json();
    const { confirmationUrl, userErrors } =
      resJson.data?.appSubscriptionCreate ?? {};

    if (userErrors?.length) {
      return {
        error: userErrors.map((e) => e.message).join(", "),
      } satisfies ActionData;
    }

    if (!confirmationUrl) {
      return {
        error: "No confirmation URL returned from Shopify.",
      } satisfies ActionData;
    }

    return { confirmationUrl } satisfies ActionData;
  } catch (err) {
    console.error("[app.billing] action error:", err);
    return {
      error: "Something went wrong. Please try again.",
    } satisfies ActionData;
  }
};

const FREE_FEATURES = [
  "Every paid feature, unlocked",
  "Abandoned cart tracking",
  "Size charts and size guides",
  "Recovery analytics and CSV export",
  "No charge is ever created",
];

function Tick({ free }: { free?: boolean }) {
  return (
    <span className="bp-check">
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke={free ? "#9b8e74" : "#1D9E75"}
        strokeWidth="4"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

export default function BillingPage() {
  const { tr, locale } = useTranslation();

  const { currentPlan, isDevShop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const isSubmitting = navigation.state === "submitting";
  const plan = PLANS_ORDERED[0];
  const isOnPaidPlan = PLAN_KEYS.includes(currentPlan);

  useEffect(() => {
    if (actionData?.confirmationUrl) open(actionData.confirmationUrl, "_top");
    if (actionData?.cancelled) navigate("/app");
  }, [actionData]);

  return (
    <div className="billing-shell">
      <TitleBar title={tr("Billing")} />

      <div className="bp billing-page">
        <header className="bp-header">
          <span className="bp-header-icon" aria-hidden="true">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 9h20M6 15h4" />
            </svg>
          </span>
          <div>
            <h1 className="bp-title">{tr("Billing &amp; Plans")}</h1>
            <p className="bp-sub">
              {tr(
                "Choose the plan that fits your store. Upgrade or cancel anytime.",
              )}
            </p>
          </div>
        </header>

        {actionData?.error ? (
          <div className="bp-alert bp-alert-err">{tr(actionData.error)}</div>
        ) : null}
        {actionData?.confirmationUrl ? (
          <div className="bp-alert bp-alert-info">
            {tr("Redirecting to Shopify billing...")}
          </div>
        ) : null}

        <div className="bp-status">
          <div className="bp-status-left">
            <span className="bp-status-icon">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#15774A"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span className="bp-status-text">
              {isDevShop
                ? tr("Development store — every feature is unlocked")
                : isOnPaidPlan
                  ? tr("You are on the {0} plan", [plan?.label ?? "Pro"])
                  : tr("You are on the FREE plan")}
            </span>
          </div>
          <span className="bp-status-badge">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {isDevShop || isOnPaidPlan ? tr("ACTIVE") : tr("LIMITED")}
          </span>
        </div>

        <div className="bp-grid">
          {/* Free — development stores only */}
          <div className="bp-card free">
            <div className="bp-card-top">
              <span className="bp-pill">
                {tr("Only for development stores")}
              </span>
              <h2 className="bp-plan">{tr("Free")}</h2>
              <img
                className="bp-plan-art bp-free-art"
                src="/billing-free-store.svg"
                alt=""
                aria-hidden="true"
              />
              <div className="bp-price">
                <span className="bp-cur">$</span>
                <span className="bp-amt">0</span>
                <span className="bp-per">{tr("/ month")}</span>
              </div>
            </div>
            <div className="bp-body">
              <p className="bp-inc">{tr("What is included")}</p>
              {FREE_FEATURES.map((feature) => (
                <div key={feature} className="bp-feat">
                  <Tick free />
                  <span>{tr(feature)}</span>
                </div>
              ))}
            </div>
            <div className="bp-foot">
              {!isOnPaidPlan ? (
                <button
                  type="button"
                  className="bp-btn bp-btn-current"
                  disabled
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {tr(" Current Plan ")}
                </button>
              ) : (
                <p className="bp-note">
                  {tr("Available on development stores only")}
                </p>
              )}
            </div>
          </div>

          {/* Paid plan */}
          {plan ? (
            <div className="bp-card paid">
              <div className="bp-card-top">
                <h2 className="bp-plan">
                  {tr(plan.label)}
                  <svg
                    className="bp-crown"
                    width="30"
                    height="30"
                    viewBox="0 0 32 32"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="m4 10 6 4 6-10 6 10 6-4-4 16H8L4 10Z"
                      fill="#ffcf3e"
                    />
                    <circle cx="4" cy="9" r="2" fill="#ffe37c" />
                    <circle cx="16" cy="4" r="2" fill="#ffe37c" />
                    <circle cx="28" cy="9" r="2" fill="#ffe37c" />
                    <path d="M9 23h14" stroke="#e8aa17" strokeWidth="2" />
                  </svg>
                </h2>
                <img
                  className="bp-plan-art bp-pro-art"
                  src="/billing-pro-bag.svg"
                  alt=""
                  aria-hidden="true"
                />
                <div className="bp-price">
                  <span className="bp-cur">$</span>
                  <span className="bp-amt">{tr(plan.price)}</span>
                  <span className="bp-per">{tr("/ month")}</span>
                </div>
              </div>
              <div className="bp-body">
                <p className="bp-inc">{tr("What is included")}</p>
                {plan.features.map((feature) => (
                  <div key={feature} className="bp-feat">
                    <Tick />
                    <span>{tr(feature)}</span>
                  </div>
                ))}
              </div>
              <div className="bp-foot">
                {isOnPaidPlan ? (
                  <button
                    type="button"
                    className="bp-btn bp-btn-current"
                    disabled
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {tr(" Current Plan ")}
                  </button>
                ) : (
                  <Form method="post">
                    <input type="hidden" name="plan" value={plan.key} />
                    <button
                      type="submit"
                      className="bp-btn bp-btn-pro"
                      disabled={
                        isSubmitting ||
                        !!actionData?.confirmationUrl ||
                        isDevShop
                      }
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      {isSubmitting
                        ? tr("Redirecting...")
                        : tr("Upgrade to {0}", [plan.label])}
                    </button>
                  </Form>
                )}
                {isDevShop ? (
                  <p className="bp-note">
                    {tr("No charge can be created on a development store.")}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {isOnPaidPlan ? (
          <div className="bp-cancel">
            <div>
              <strong>{tr("Cancel subscription")}</strong>
              <em>
                {tr("You will lose access to paid features immediately.")}
              </em>
            </div>
            {!showCancelConfirm ? (
              <button
                type="button"
                className="bp-btn-sm"
                onClick={() => setShowCancelConfirm(true)}
              >
                {tr(" Cancel plan ")}
              </button>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="bp-btn-sm"
                  onClick={() => setShowCancelConfirm(false)}
                >
                  {tr(" Keep plan ")}
                </button>
                <Form method="post">
                  <input type="hidden" name="intent" value="cancel" />
                  <button
                    type="submit"
                    className="bp-btn-sm bp-btn-danger"
                    disabled={isSubmitting}
                  >
                    {tr(" Yes, cancel ")}
                  </button>
                </Form>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
