import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { useEffect } from "react";
import { Page, Spinner, BlockStack, Text, Banner } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { PLANS } from "../config/plans";
import { updateShopPlan } from "../utils/planUtils";

interface ActiveSubscription {
    id: string;
    name: string;
    status: "ACTIVE" | "PENDING" | "EXPIRED" | "DECLINED" | "FROZEN" | "CANCELLED";
}

interface ActiveSubscriptionResponse {
    data?: {
        currentAppInstallation?: {
            activeSubscriptions?: ActiveSubscription[];
        };
    };
}

interface LoaderData {
    ok: boolean;
    plan: { key: string; label: string } | null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;

    try {
        const response = await admin.graphql(`#graphql
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
          }
        }
      }
    `);

        const data: ActiveSubscriptionResponse = await response.json();
        const activeSubscriptions = data?.data?.currentAppInstallation?.activeSubscriptions ?? [];

        const activeSub = activeSubscriptions.find(
            (sub) => sub.status === "ACTIVE" && Object.keys(PLANS).includes(sub.name.toLowerCase())
        );

        if (activeSub) {
            const planKey = activeSub.name.toLowerCase();
            const planMeta = PLANS[planKey];
            await updateShopPlan(shop, planKey, activeSub.id);
            return { ok: true, plan: { key: planKey, label: planMeta?.label ?? planKey } } satisfies LoaderData;
        }

        await updateShopPlan(shop, "none", null);
        return { ok: false, plan: null } satisfies LoaderData;

    } catch (err) {
        console.error("[billing-return] error:", err);
        return { ok: false, plan: null } satisfies LoaderData;
    }
};

export default function BillingReturnPage() {
    const { ok, plan } = useLoaderData<typeof loader>();
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => navigate("/app/billing"), 5000);
        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <Page>
            <TitleBar title="Billing" />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "24px" }}>
                <BlockStack gap="400" inlineAlign="center">
                    {ok && plan ? (
                        <Banner tone="success" title="Plan activated successfully!">
                            <Text as="p">You are now on the <strong>{plan.label}</strong> plan. Redirecting…</Text>
                        </Banner>
                    ) : (
                        <Banner tone="warning" title="Could not confirm plan.">
                            <Text as="p">Your subscription may have been cancelled or is still pending.</Text>
                        </Banner>
                    )}
                    <Spinner size="large" />
                    <Text tone="subdued" variant="bodySm" as="p">Redirecting in 5 seconds…</Text>
                </BlockStack>
            </div>
        </Page>
    );
}