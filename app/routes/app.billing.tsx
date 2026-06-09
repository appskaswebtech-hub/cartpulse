import { redirect } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigate, useNavigation, Form } from "react-router";
import { useState, useEffect } from "react";
import {
    Page, BlockStack, InlineStack, InlineGrid,
    Box, Text, Button, Badge, Banner, List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { PLANS, PLAN_KEYS } from "../config/plans";
import { getShopPlanFromDB, cancelShopPlan } from "../utils/planUtils";
import { useTranslation } from "../i18n/LanguageContext";

interface LoaderData { currentPlan: string; }
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

const PLANS_ORDERED = ["basic", "pro", "advanced"]
    .map((key) => PLANS[key])
    .filter(Boolean);

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const record = await getShopPlanFromDB(session.shop);
    return { currentPlan: record.plan } satisfies LoaderData;
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "cancel") {
        try {
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

                    test: false,
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

export default function BillingPage() {
    const { currentPlan } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const { t } = useTranslation();
    const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    const isSubmitting = navigation.state === "submitting";
    const currentPlanMeta = PLANS[currentPlan];
    const currentPlanLabel = currentPlanMeta?.label ?? currentPlan.toUpperCase();
    const currentPlanPrice = currentPlanMeta?.price ?? 0;

    useEffect(() => {
        if (actionData?.confirmationUrl) {
            open(actionData.confirmationUrl, "_top");
        }
        if (actionData?.cancelled) {
            navigate("/app");
        }
    }, [actionData]);

    return (
        <Page
            title={t.billing.title}
            subtitle={t.billing.subtitle}
            backAction={{ content: "Back", onAction: () => navigate("/app") }}
        >
            <TitleBar title={t.nav.billing} />
            <BlockStack gap="500">

                {actionData?.error && (
                    <Banner title={t.billing.billingError} tone="critical">
                        <Text as="p">{actionData.error}</Text>
                    </Banner>
                )}

                {actionData?.confirmationUrl && (
                    <Banner title={t.billing.redirecting} tone="info">
                        <Text as="p">{t.billing.redirectingText}</Text>
                    </Banner>
                )}

                <Banner title={t.billing.currentPlanBanner(currentPlanLabel)} tone="info">
                    <Text as="p">
                        {currentPlan === "advanced"
                            ? t.billing.allFeaturesAccess
                            : t.billing.upgradeAnytime}
                    </Text>
                </Banner>

                <InlineGrid columns={{ xs: 1, sm: 1, md: 3 }} gap="400">
                    {PLANS_ORDERED.map((plan) => {
                        const isCurrent = currentPlan === plan.key;
                        return (
                            <div
                                key={plan.key}
                                style={{
                                    borderRadius: "12px",
                                    border: isCurrent ? "2px solid #008060" : plan.popular ? "2px solid #005BD3" : "1px solid #E1E3E5",
                                    background: "#FFFFFF",
                                    boxShadow: plan.popular ? "0 4px 20px rgba(0,91,211,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
                                    display: "flex", flexDirection: "column", overflow: "hidden",
                                }}
                            >
                                <div style={{ background: plan.color, padding: "20px 24px 16px", borderBottom: "1px solid #E1E3E5" }}>
                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text variant="headingLg" fontWeight="bold" as="h2">{plan.label}</Text>
                                        <InlineStack gap="200">
                                            {plan.popular && <Badge tone="info">{t.billing.mostPopular}</Badge>}
                                            {isCurrent && <Badge tone="success">{t.billing.current}</Badge>}
                                        </InlineStack>
                                    </InlineStack>
                                    <Box paddingBlockStart="200">
                                        <Text variant="heading2xl" fontWeight="bold" as="p">${plan.price}</Text>
                                        <Text variant="bodySm" tone="subdued" as="p">{t.billing.perMonthEmails(plan.emailLimit)}</Text>
                                    </Box>
                                </div>

                                <div style={{ padding: "20px 24px", flexGrow: 1 }}>
                                    <BlockStack gap="200">
                                        <Text variant="bodyMd" fontWeight="semibold" as="p">{t.billing.whatsIncluded}</Text>
                                        <List type="bullet">
                                            <List.Item>{t.billing.planFeatures.emailsPerMonth(plan.emailLimit)}</List.Item>
                                            <List.Item>{t.billing.planFeatures.abandonedCartTracking}</List.Item>
                                            <List.Item>{t.billing.planFeatures.pushNotifications}</List.Item>
                                            <List.Item>{t.billing.planFeatures.recoveryAnalytics}</List.Item>
                                        </List>
                                    </BlockStack>
                                </div>

                                <div style={{ padding: "16px 24px", borderTop: "1px solid #E1E3E5" }}>
                                    {isCurrent ? (
                                        <Button fullWidth disabled>{t.billing.currentPlanBtn}</Button>
                                    ) : (
                                        <Form method="post">
                                            <input type="hidden" name="plan" value={plan.key} />
                                            <Button
                                                fullWidth variant="primary" submit
                                                loading={(isSubmitting && submittingPlan === plan.key) || !!actionData?.confirmationUrl}
                                                onClick={() => setSubmittingPlan(plan.key)}
                                            >
                                                {currentPlanPrice > plan.price ? t.billing.downgradeTo(plan.label) : t.billing.upgradeTo(plan.label)}
                                            </Button>
                                        </Form>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </InlineGrid>

                {currentPlan !== "none" && (
                    <div style={{ borderRadius: "12px", border: "1px solid #FECACA", background: "#FFF5F5", padding: "20px 24px" }}>
                        <InlineStack align="space-between" blockAlign="center">
                            <div>
                                <Text variant="headingSm" fontWeight="semibold" as="p">{t.billing.cancelSubscription}</Text>
                                <Text variant="bodySm" tone="subdued" as="p">
                                    {t.billing.cancelSubtitle(currentPlanLabel)}
                                </Text>
                            </div>
                            {!showCancelConfirm ? (
                                <Button tone="critical" onClick={() => setShowCancelConfirm(true)}>
                                    {t.billing.cancelPlan}
                                </Button>
                            ) : (
                                <InlineStack gap="200">
                                    <Button onClick={() => setShowCancelConfirm(false)}>{t.billing.keepPlan}</Button>
                                    <Form method="post">
                                        <input type="hidden" name="intent" value="cancel" />
                                        <Button tone="critical" variant="primary" submit loading={isSubmitting}>
                                            {t.billing.yesCancel}
                                        </Button>
                                    </Form>
                                </InlineStack>
                            )}
                        </InlineStack>
                    </div>
                )}

                <Box paddingBlockEnd="400" />

            </BlockStack>
        </Page>
    );
}
