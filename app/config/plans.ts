export interface Plan {
    key: string;
    label: string;
    price: number;
    emailLimit: number;
    features: string[];
    color: string;
    popular: boolean;
}

export const PLANS: Record<string, Plan> = {
    basic: {
        key: "basic",
        label: "Basic",
        price: 9.99,
        emailLimit: 100,
        color: "#F6F6F7",
        popular: false,
        features: [
            "100 Emails per month",
            "Abandoned Cart Tracking",
            "Push Notifications",
            "Recovery Analytics",
        ],
    },
    pro: {
        key: "pro",
        label: "Pro",
        price: 19.99,
        emailLimit: 200,
        color: "#F0F4FF",
        popular: true,
        features: [
            "200 Emails per month",
            "Abandoned Cart Tracking",
            "Push Notifications",
            "Recovery Analytics",
        ],
    },
    advanced: {
        key: "advanced",
        label: "Advanced",
        price: 29.99,
        emailLimit: 500,
        color: "#F3F0FF",
        popular: false,
        features: [
            "500 Emails per month",
            "Abandoned Cart Tracking",
            "Push Notifications",
            "Recovery Analytics",
        ],
    },
};

export const PLAN_KEYS = Object.keys(PLANS);