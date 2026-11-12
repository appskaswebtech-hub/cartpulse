import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigate, useNavigation, Form } from "react-router";
import { useState, useEffect } from "react";
import { Page } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { PLANS, PLAN_KEYS } from "../config/plans";
import { getShopPlanFromDB, cancelShopPlan } from "../utils/planUtils";

interface LoaderData { currentPlan: string; isDevShop: boolean; }
interface ActionData { confirmationUrl?: string; error?: string; cancelled?: boolean; }
interface UserError { field: string; message: string; }
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
            const subJson = await subResponse.json() as any;
            const activeSubs = subJson?.data?.currentAppInstallation?.activeSubscriptions ?? [];

            for (const sub of activeSubs) {
                await admin.graphql(
                    `#graphql
                    mutation CancelSub($id: ID!) {
                        appSubscriptionCancel(id: $id) {
                            userErrors { field message }
                        }
                    }`,
                    { variables: { id: sub.id } }
                );
            }

            await cancelShopPlan(shop);
            return { cancelled: true } satisfies ActionData;
        } catch (err) {
            console.error("[app.billing] cancel error:", err);
            return { error: "Failed to cancel plan. Please try again." } satisfies ActionData;
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
            }
        );

        const resJson: AppSubscriptionCreateResponse = await response.json();
        const { confirmationUrl, userErrors } = resJson.data?.appSubscriptionCreate ?? {};

        if (userErrors?.length) {
            return { error: userErrors.map((e) => e.message).join(", ") } satisfies ActionData;
        }

        if (!confirmationUrl) {
            return { error: "No confirmation URL returned from Shopify." } satisfies ActionData;
        }

        return { confirmationUrl } satisfies ActionData;

    } catch (err) {
        console.error("[app.billing] action error:", err);
        return { error: "Something went wrong. Please try again." } satisfies ActionData;
    }
};

const STYLES = `
  .bp { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .bp-title { font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 4px; }
  .bp-sub { font-size: 14px; color: #8a8a8a; margin: 0 0 20px; }

  .bp-status { display: flex; align-items: center; justify-content: space-between; gap: 16px;
    background: #F3FBF6; border: 1px solid #CFEBDB; border-radius: 14px; padding: 16px 20px;
    margin-bottom: 22px; max-width: 900px; }
  .bp-status-left { display: flex; align-items: center; gap: 12px; }
  .bp-status-icon { width: 34px; height: 34px; border-radius: 50%; background: #E3F5EB;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .bp-status-text { font-size: 15px; font-weight: 600; color: #15774A; }
  .bp-status-badge { background: #fff; border: 1px solid #CFEBDB; color: #15774A; border-radius: 999px;
    padding: 5px 14px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center;
    gap: 5px; white-space: nowrap; }

  .bp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: stretch; max-width: 900px; }
  @media (max-width: 860px) { .bp-grid { grid-template-columns: 1fr; } }

  .bp-card { border-radius: 18px; border: 1px solid #EFEAE0; background: #fff; overflow: hidden;
    display: flex; flex-direction: column; }
  .bp-card.free { background: #FDF9F1; border-color: #F0E7D6; }
  .bp-card-top { padding: 26px 26px 22px; position: relative; }
  .bp-card.free .bp-card-top { background: #FBF4E7; }
  .bp-pill { position: absolute; top: 22px; right: 22px; background: #EFEDFD; color: #5B4CC4;
    border-radius: 999px; padding: 5px 12px; font-size: 10px; font-weight: 700;
    letter-spacing: .04em; text-transform: uppercase; }

  .bp-plan { font-family: Georgia, "Times New Roman", serif; font-size: 27px; font-weight: 700;
    color: #1a1a1a; margin: 0 0 14px; }
  .bp-price { display: flex; align-items: baseline; gap: 4px; }
  .bp-cur { font-family: Georgia, serif; font-size: 17px; font-weight: 600; color: #1a1a1a; }
  .bp-amt { font-family: Georgia, "Times New Roman", serif; font-size: 40px; font-weight: 700;
    color: #1a1a1a; line-height: 1; }
  .bp-per { font-size: 14px; color: #8a8a8a; margin-left: 4px; }

  .bp-body { padding: 4px 26px 0; flex: 1; }
  .bp-inc { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    color: #a1a1a1; margin: 18px 0 14px; }
  .bp-feat { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
  .bp-check { width: 17px; height: 17px; border-radius: 50%; background: #E8F6EE; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .bp-card.free .bp-check { background: #F1EDE3; }
  .bp-feat span { font-size: 13.5px; color: #3d3d3d; line-height: 1.45; }

  .bp-foot { padding: 20px 26px 26px; }
  .bp-btn { width: 100%; border: none; border-radius: 11px; padding: 13px; font-size: 14px;
    font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center;
    gap: 7px; font-family: inherit; }
  .bp-btn-pro { background: #6C5CE7; color: #fff; }
  .bp-btn-pro:hover { background: #5b4bd6; }
  .bp-btn-pro:disabled { opacity: .55; cursor: not-allowed; }
  .bp-btn-current { background: transparent; border: 1px solid #E6DCC8; color: #8a7f68; cursor: default; }
  .bp-note { text-align: center; font-size: 12px; color: #a1a1a1; margin: 12px 0 0; }

  .bp-cancel { margin-top: 24px; max-width: 900px; border-radius: 14px; border: 1px solid #F3C9C5;
    background: #FFF8F7; padding: 18px 22px; display: flex; align-items: center;
    justify-content: space-between; gap: 16px; }
  .bp-cancel strong { display: block; font-size: 14px; color: #1a1a1a; }
  .bp-cancel em { display: block; font-size: 12.5px; color: #8a8a8a; font-style: normal; margin-top: 2px; }
  .bp-btn-sm { border-radius: 10px; padding: 9px 16px; font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: inherit; border: 1px solid #E6DCC8; background: #fff; color: #3d3d3d; }
  .bp-btn-danger { background: #B42318; border-color: #B42318; color: #fff; }

  .bp-alert { max-width: 900px; border-radius: 12px; padding: 14px 18px; margin-bottom: 18px; font-size: 13.5px; }
  .bp-alert-err { background: #FEF0EF; border: 1px solid #F3C9C5; color: #8A2018; }
  .bp-alert-info { background: #EFF4FF; border: 1px solid #C9D8F3; color: #1D3C7A; }
`;

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
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={free ? "#9b8e74" : "#1D9E75"} strokeWidth="4">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        </span>
    );
}

export default function BillingPage() {
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
        <Page>
            <TitleBar title="Billing" />
            <style>{STYLES}</style>

            <div className="bp">
                <h1 className="bp-title">Billing &amp; Plans</h1>
                <p className="bp-sub">Choose the plan that fits your store. Upgrade or cancel anytime.</p>

                {actionData?.error ? <div className="bp-alert bp-alert-err">{actionData.error}</div> : null}
                {actionData?.confirmationUrl ? (
                    <div className="bp-alert bp-alert-info">Redirecting to Shopify billing...</div>
                ) : null}

                <div className="bp-status">
                    <div className="bp-status-left">
                        <span className="bp-status-icon">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#15774A" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                        </span>
                        <span className="bp-status-text">
                            {isDevShop
                                ? "Development store — every feature is unlocked"
                                : isOnPaidPlan
                                    ? `You are on the ${plan?.label ?? "Pro"} plan`
                                    : "You are on the FREE plan"}
                        </span>
                    </div>
                    <span className="bp-status-badge">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {isDevShop || isOnPaidPlan ? "ACTIVE" : "LIMITED"}
                    </span>
                </div>

                <div className="bp-grid">
                    {/* Free — development stores only */}
                    <div className="bp-card free">
                        <div className="bp-card-top">
                            <span className="bp-pill">Only for development stores</span>
                            <h2 className="bp-plan">Free</h2>
                            <div className="bp-price">
                                <span className="bp-cur">$</span>
                                <span className="bp-amt">0</span>
                                <span className="bp-per">/ month</span>
                            </div>
                        </div>
                        <div className="bp-body">
                            <p className="bp-inc">What is included</p>
                            {FREE_FEATURES.map((feature) => (
                                <div key={feature} className="bp-feat">
                                    <Tick free />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                        <div className="bp-foot">
                            {!isOnPaidPlan ? (
                                <button type="button" className="bp-btn bp-btn-current" disabled>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Current Plan
                                </button>
                            ) : (
                                <p className="bp-note">Available on development stores only</p>
                            )}
                        </div>
                    </div>

                    {/* Paid plan */}
                    {plan ? (
                        <div className="bp-card">
                            <div className="bp-card-top">
                                <h2 className="bp-plan">{plan.label}</h2>
                                <div className="bp-price">
                                    <span className="bp-cur">$</span>
                                    <span className="bp-amt">{plan.price}</span>
                                    <span className="bp-per">/ month</span>
                                </div>
                            </div>
                            <div className="bp-body">
                                <p className="bp-inc">What is included</p>
                                {plan.features.map((feature) => (
                                    <div key={feature} className="bp-feat">
                                        <Tick />
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="bp-foot">
                                {isOnPaidPlan ? (
                                    <button type="button" className="bp-btn bp-btn-current" disabled>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        Current Plan
                                    </button>
                                ) : (
                                    <Form method="post">
                                        <input type="hidden" name="plan" value={plan.key} />
                                        <button
                                            type="submit"
                                            className="bp-btn bp-btn-pro"
                                            disabled={isSubmitting || !!actionData?.confirmationUrl || isDevShop}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                            </svg>
                                            {isSubmitting ? "Redirecting..." : `Upgrade to ${plan.label}`}
                                        </button>
                                    </Form>
                                )}
                                {isDevShop ? (
                                    <p className="bp-note">No charge can be created on a development store.</p>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </div>

                {isOnPaidPlan ? (
                    <div className="bp-cancel">
                        <div>
                            <strong>Cancel subscription</strong>
                            <em>You will lose access to paid features immediately.</em>
                        </div>
                        {!showCancelConfirm ? (
                            <button type="button" className="bp-btn-sm" onClick={() => setShowCancelConfirm(true)}>
                                Cancel plan
                            </button>
                        ) : (
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button type="button" className="bp-btn-sm" onClick={() => setShowCancelConfirm(false)}>
                                    Keep plan
                                </button>
                                <Form method="post">
                                    <input type="hidden" name="intent" value="cancel" />
                                    <button type="submit" className="bp-btn-sm bp-btn-danger" disabled={isSubmitting}>
                                        Yes, cancel
                                    </button>
                                </Form>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </Page>
    );
}
