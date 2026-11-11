import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useNavigation } from "react-router";
import { Page } from "@shopify/polaris";
import { authenticate, PRO_PLAN } from "../shopify.server";
import { getEntitlement } from "../lib/billing.server";

const PRICE = "7.99";

const FEATURES = [
  "Unlimited abandoned cart tracking",
  "Automated recovery email sequence",
  "Browser push notifications",
  "Unlimited size charts and size guides",
  "Size chart templates and auto unit conversion",
  "Reports with CSV export",
  "Support chat widget",
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const entitlement = await getEntitlement(admin, billing);
  return { entitlement, shop: session.shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  const entitlement = await getEntitlement(admin, billing);

  // Development stores already have everything and cannot be charged.
  if (entitlement.isDevelopmentStore) {
    return { ok: true, message: "Development stores already include every feature." };
  }

  if (intent === "subscribe") {
    // Throws a redirect to Shopify's subscription confirmation page.
    await billing.request({
      // Cast needed only because the pre-existing sessionStorage type mismatch
      // in shopify.server.ts collapses the billing plan key union to `never`.
      plan: PRO_PLAN as never,
      isTest: entitlement.isTest,
      returnUrl: `${process.env.SHOPIFY_APP_URL}/app/billing`,
    });
  }

  return { ok: false };
};

const STYLES = `
  .bp-wrap { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .bp-head { margin-bottom: 20px; }
  .bp-title { font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 4px; }
  .bp-sub { font-size: 14px; color: #8a8a8a; margin: 0; }

  .bp-status { display: flex; align-items: center; justify-content: space-between; gap: 16px;
    background: #F3FBF6; border: 1px solid #CFEBDB; border-radius: 14px; padding: 16px 20px; margin-bottom: 22px; }
  .bp-status-left { display: flex; align-items: center; gap: 12px; }
  .bp-status-icon { width: 34px; height: 34px; border-radius: 50%; background: #E3F5EB;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .bp-status-text { font-size: 15px; font-weight: 600; color: #15774A; }
  .bp-status-badge { background: #fff; border: 1px solid #CFEBDB; color: #15774A; border-radius: 999px;
    padding: 5px 14px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
  .bp-status.off { background: #FFF8F1; border-color: #F6DEC4; }
  .bp-status.off .bp-status-icon { background: #FDEBD8; }
  .bp-status.off .bp-status-text { color: #9A5B13; }
  .bp-status.off .bp-status-badge { border-color: #F6DEC4; color: #9A5B13; }

  .bp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: stretch; }
  @media (max-width: 860px) { .bp-grid { grid-template-columns: 1fr; } }

  .bp-card { border-radius: 18px; border: 1px solid #EFEAE0; background: #fff; overflow: hidden;
    display: flex; flex-direction: column; min-height: 420px; }
  .bp-card.free { background: #FDF9F1; border-color: #F0E7D6; }
  .bp-card-top { padding: 26px 26px 20px; position: relative; }
  .bp-card.free .bp-card-top { background: #FBF4E7; border-bottom: 1px solid #F3EADA; }
  /* The Pro card has a trial pill the Free card lacks, so pad to match. */
  .bp-card:not(.free) .bp-card-top { padding-bottom: 20px; }
  .bp-card.free .bp-card-top { padding-bottom: 26px; }

  .bp-pill { position: absolute; top: 22px; right: 22px; background: #EFEDFD; color: #5B4CC4;
    border-radius: 999px; padding: 5px 12px; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }

  .bp-plan { font-family: Georgia, "Times New Roman", serif; font-size: 27px; font-weight: 700; color: #1a1a1a; margin: 0 0 14px; }
  .bp-price-row { display: flex; align-items: baseline; gap: 4px; }
  .bp-currency { font-family: Georgia, serif; font-size: 17px; font-weight: 600; color: #1a1a1a; }
  .bp-amount { font-family: Georgia, "Times New Roman", serif; font-size: 40px; font-weight: 700; color: #1a1a1a; line-height: 1; }
  .bp-period { font-size: 14px; color: #8a8a8a; margin-left: 4px; }
  .bp-trial { display: inline-flex; align-items: center; gap: 5px; margin-top: 12px; background: #EEF2FF;
    color: #4338CA; border-radius: 999px; padding: 5px 12px; font-size: 12px; font-weight: 600; }

  .bp-body { padding: 4px 26px 0; flex: 1; }
  .bp-included { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    color: #a1a1a1; margin: 18px 0 14px; }
  .bp-feat { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
  .bp-check { width: 17px; height: 17px; border-radius: 50%; background: #E8F6EE; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .bp-card.free .bp-check { background: #F1EDE3; }
  .bp-feat span { font-size: 13.5px; color: #3d3d3d; line-height: 1.45; }

  .bp-foot { padding: 20px 26px 26px; }
  .bp-btn { width: 100%; border: none; border-radius: 11px; padding: 13px; font-size: 14px; font-weight: 600;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; font-family: inherit; }
  .bp-btn-pro { background: #6C5CE7; color: #fff; }
  .bp-btn-pro:hover { background: #5b4bd6; }
  .bp-btn-pro:disabled { opacity: .55; cursor: not-allowed; }
  .bp-btn-current { background: transparent; border: 1px solid #E6DCC8; color: #8a7f68; cursor: default; }
  .bp-note { text-align: center; font-size: 12px; color: #a1a1a1; margin: 12px 0 0; }
`;

function Check({ free }: { free?: boolean }) {
  return (
    <span className="bp-check">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={free ? "#9b8e74" : "#1D9E75"} strokeWidth="4">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function FeatureList({ free }: { free?: boolean }) {
  return (
    <>
      <p className="bp-included">What&apos;s included</p>
      {FEATURES.map((feature) => (
        <div key={feature} className="bp-feat">
          <Check free={free} />
          <span>{feature}</span>
        </div>
      ))}
    </>
  );
}

export default function Billing() {
  const { entitlement, shop } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const onFree = !entitlement.entitled || entitlement.isDevelopmentStore;
  const statusLabel = entitlement.isDevelopmentStore
    ? "You're on the FREE plan (development store)"
    : entitlement.entitled
      ? "You're on the PRO plan"
      : "You're on the FREE plan — recovery messages are paused";

  return (
    <Page>
      <style>{STYLES}</style>

      <div className="bp-wrap">
        <div className="bp-head">
          <h1 className="bp-title">Billing &amp; Plans</h1>
          <p className="bp-sub">
            Choose the plan that fits your store. Upgrade or cancel anytime. · {shop}
          </p>
        </div>

        <div className={entitlement.entitled ? "bp-status" : "bp-status off"}>
          <div className="bp-status-left">
            <span className="bp-status-icon">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke={entitlement.entitled ? "#15774A" : "#9A5B13"}
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span className="bp-status-text">{statusLabel}</span>
          </div>
          <span className="bp-status-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {entitlement.entitled ? "ACTIVE" : "LIMITED"}
          </span>
        </div>

        <div className="bp-grid">
          {/* Free */}
          <div className="bp-card free">
            <div className="bp-card-top">
              <span className="bp-pill">Only for development stores</span>
              <h2 className="bp-plan">Free</h2>
              <div className="bp-price-row">
                <span className="bp-currency">$</span>
                <span className="bp-amount">0</span>
                <span className="bp-period">/ month</span>
              </div>
            </div>
            <div className="bp-body">
              <FeatureList free />
            </div>
            <div className="bp-foot">
              {onFree ? (
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

          {/* Pro */}
          <div className="bp-card">
            <div className="bp-card-top">
              <h2 className="bp-plan">Pro</h2>
              <div className="bp-price-row">
                <span className="bp-currency">$</span>
                <span className="bp-amount">{PRICE}</span>
                <span className="bp-period">/ month</span>
              </div>
              <span className="bp-trial">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Works on live stores
              </span>
            </div>
            <div className="bp-body">
              <FeatureList />
            </div>
            <div className="bp-foot">
              {entitlement.entitled && !entitlement.isDevelopmentStore ? (
                <button type="button" className="bp-btn bp-btn-current" disabled>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Current Plan
                </button>
              ) : (
                <Form method="post">
                  <input type="hidden" name="intent" value="subscribe" />
                  <button
                    type="submit"
                    className="bp-btn bp-btn-pro"
                    disabled={submitting || entitlement.isDevelopmentStore}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    {submitting ? "Redirecting..." : "Upgrade to Pro"}
                  </button>
                </Form>
              )}
              {entitlement.isDevelopmentStore ? (
                <p className="bp-note">No charge can be created on a development store.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
