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
import { getShopPlanFromDB } from "../utils/planUtils";

interface LoaderData { currentPlan: string; }
interface ActionData { confirmationUrl?: string; error?: string; }
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
    const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);

    const isSubmitting = navigation.state === "submitting";
    const currentPlanMeta = PLANS[currentPlan];
    const currentPlanLabel = currentPlanMeta?.label ?? currentPlan.toUpperCase();
    const currentPlanPrice = currentPlanMeta?.price ?? 0;

    useEffect(() => {
        if (actionData?.confirmationUrl) {
            open(actionData.confirmationUrl, "_top");
        }
    }, [actionData]);

    return (
        <Page
            title="Choose Your Plan"
            subtitle="Select the plan that best fits your store's needs"
            backAction={{ content: "Back", onAction: () => navigate("/app") }}
        >
            <TitleBar title="Billing" />
            <BlockStack gap="500">

                {actionData?.error && (
                    <Banner title="Billing Error" tone="critical">
                        <Text as="p">{actionData.error}</Text>
                    </Banner>
                )}

                {actionData?.confirmationUrl && (
                    <Banner title="Redirecting to Shopify billing…" tone="info">
                        <Text as="p">Please wait while we redirect you to confirm your subscription.</Text>
                    </Banner>
                )}

                <Banner title={`You are currently on the ${currentPlanLabel} plan`} tone="info">
                    <Text as="p">
                        {currentPlan === "advanced"
                            ? "You have access to all features."
                            : "Upgrade anytime to unlock more features."}
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
                                            {plan.popular && <Badge tone="info">Most Popular</Badge>}
                                            {isCurrent && <Badge tone="success">Current</Badge>}
                                        </InlineStack>
                                    </InlineStack>
                                    <Box paddingBlockStart="200">
                                        <Text variant="heading2xl" fontWeight="bold" as="p">${plan.price}</Text>
                                        <Text variant="bodySm" tone="subdued" as="p">per month · {plan.emailLimit} emails included</Text>
                                    </Box>
                                </div>

                                <div style={{ padding: "20px 24px", flexGrow: 1 }}>
                                    <BlockStack gap="200">
                                        <Text variant="bodyMd" fontWeight="semibold" as="p">What's included:</Text>
                                        <List type="bullet">
                                            {plan.features.map((f, i) => <List.Item key={i}>{f}</List.Item>)}
                                        </List>
                                    </BlockStack>
                                </div>

                                <div style={{ padding: "16px 24px", borderTop: "1px solid #E1E3E5" }}>
                                    {isCurrent ? (
                                        <Button fullWidth disabled>✓ Current Plan</Button>
                                    ) : (
                                        <Form method="post">
                                            <input type="hidden" name="plan" value={plan.key} />
                                            <Button
                                                fullWidth variant="primary" submit
                                                loading={(isSubmitting && submittingPlan === plan.key) || !!actionData?.confirmationUrl}
                                                onClick={() => setSubmittingPlan(plan.key)}
                                            >
                                                {currentPlanPrice > plan.price ? `Downgrade to ${plan.label}` : `Upgrade to ${plan.label}`}
                                            </Button>
                                        </Form>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </InlineGrid>

                <Box paddingBlockEnd="400">
                    {/* <Text alignment="center" tone="subdued" variant="bodySm" as="p">
                        All plans include a 7-day free trial. Cancel anytime. Billed in USD.
                    </Text> */}
                </Box>

            </BlockStack>
        </Page>
    );
}