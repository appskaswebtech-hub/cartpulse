export interface Plan {
    key: string;
    label: string;
    price: number;
    emailLimit: number;
    features: string[];
    color: string;
    popular: boolean;
}

/**
 * One paid plan. Development and sandbox stores run everything free — Shopify
 * cannot charge them — so the plan only applies to live stores.
 *
 * The key stays "pro" so existing ShopPlan rows and subscriptions keep working.
 */
export const PLANS: Record<string, Plan> = {
    pro: {
        key: "pro",
        label: "Pro",
        price: 7.99,
        emailLimit: 500,
        color: "#F0F4FF",
        popular: true,
        features: [
            "500 recovery emails per month",
            "Abandoned cart tracking",
            "Push notifications",
            "Size charts and size guides",
            "Recovery analytics and CSV export",
            "Email outreach",
        ],
    },
};

export const PLAN_KEYS = Object.keys(PLANS);
