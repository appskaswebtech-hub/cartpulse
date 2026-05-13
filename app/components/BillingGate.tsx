import { useNavigate } from "react-router";
import { Button, Text, BlockStack, InlineStack, Badge } from "@shopify/polaris";

interface Props {
    show: boolean;
}

export function BillingGate({ show }: Props) {
    const navigate = useNavigate();

    if (!show) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.75)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(4px)",
            }}
        >
            <div
                style={{
                    background: "#FFFFFF",
                    borderRadius: "16px",
                    padding: "40px",
                    maxWidth: "480px",
                    width: "90%",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                    textAlign: "center",
                }}
            >
                <BlockStack gap="400" inlineAlign="center">

                    <div style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #1D9E75, #085041)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto",
                    }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>

                    <Text variant="headingXl" fontWeight="bold" as="h2">
                        Unlock CartPulse
                    </Text>

                    <Text variant="bodyMd" tone="subdued" as="p">
                        Choose a plan to start recovering abandoned carts and sending notifications on your live store.
                    </Text>

                    <div style={{
                        background: "#F6F6F7",
                        borderRadius: "12px",
                        padding: "16px 20px",
                        width: "100%",
                        textAlign: "left",
                    }}>
                        <BlockStack gap="200">
                            {[
                                "✓ Abandoned cart tracking",
                                "✓ Email & Push notifications",
                                "✓ Recovery analytics",
                            ].map((f, i) => (
                                <Text key={i} variant="bodySm" as="p">{f}</Text>
                            ))}
                        </BlockStack>
                    </div>

                    <Badge tone="success">Starting at $9.99/mo</Badge>

                    <div style={{ width: "100%" }}>
                        <Button
                            fullWidth
                            variant="primary"
                            size="large"
                            onClick={() => navigate("/app/billing")}
                        >
                            Choose a Plan
                        </Button>
                    </div>

                </BlockStack>
            </div>
        </div>
    );
}