import db from "./db.server";
import { getShopPlanFromDB } from "./utils/planUtils";

const DEV_NOTIFICATION_LIMIT = 5;

const EMAIL_LIMITS: Record<string, number> = {
    basic: 100,
    pro: 200,
    advanced: 500,
};

export async function scheduleCartNotifications(cart: {
    id: string;
    customerEmail: string | null;
    cartData: string;
    totalPrice: string;
    shop: string;
}) {
    if (!cart.customerEmail) return;

    const shopPlan = await getShopPlanFromDB(cart.shop);
    const isDevShop = await checkIsDevShop(cart.shop);
    const hasPlan = ["basic", "pro", "advanced"].includes(shopPlan.plan);

    console.log(`🔍 isDevShop: ${isDevShop}, plan: ${shopPlan.plan}, hasPlan: ${hasPlan}`);

    // Live store with no plan → block all
    if (!isDevShop && !hasPlan) {
        console.log(`🚫 No active plan for shop: ${cart.shop}. Notifications blocked.`);
        return;
    }

    // Dev store → cap at 5 notifications per cart
    if (isDevShop) {
        const existingCount = await db.cartNotification.count({
            where: { cartId: cart.id },
        });

        if (existingCount >= DEV_NOTIFICATION_LIMIT) {
            console.log(`🚫 Dev store limit reached (${DEV_NOTIFICATION_LIMIT}) for cart: ${cart.id}`);
            return;
        }
    }

    // Live store → check monthly email limit
    if (!isDevShop && hasPlan) {
        const emailLimit = EMAIL_LIMITS[shopPlan.plan] ?? 0;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const emailsSentThisMonth = await db.cartNotification.count({
            where: {
                cart: { shop: cart.shop },
                channel: "email",
                status: "sent",
                sentAt: { gte: startOfMonth },
            },
        });

        if (emailsSentThisMonth >= emailLimit) {
            console.log(`🚫 Email limit reached (${emailLimit}) for shop: ${cart.shop}. Skipping email jobs.`);

            const items = JSON.parse(cart.cartData);
            const productNames = items.map((i: any) => i.title).join(", ");
            const payload = JSON.stringify({
                cartId: cart.id,
                customerEmail: cart.customerEmail,
                totalPrice: cart.totalPrice,
                productNames,
                shop: cart.shop,
            });

            const now = new Date();
            await db.jobQueue.create({
                data: {
                    jobName: "push-notification",
                    payload,
                    scheduledAt: new Date(now.getTime() + 60 * 60 * 1000),
                },
            });

            console.log(`✅ Push-only notification scheduled for cart: ${cart.id}`);
            return;
        }
    }

    const items = JSON.parse(cart.cartData);
    const productNames = items.map((i: any) => i.title).join(", ");
    const payload = JSON.stringify({
        cartId: cart.id,
        customerEmail: cart.customerEmail,
        totalPrice: cart.totalPrice,
        productNames,
        shop: cart.shop,
    });

    const now = new Date();

    // Push after 1 hour
    await db.jobQueue.create({
        data: {
            jobName: "push-notification",
            payload,
            scheduledAt: new Date(now.getTime() + 60 * 60 * 1000),
        },
    });

    // Email after 24 hours
    await db.jobQueue.create({
        data: {
            jobName: "email-notification",
            payload,
            scheduledAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
    });

    // Final email after 30 days
    await db.jobQueue.create({
        data: {
            jobName: "email-final",
            payload,
            scheduledAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
    });

    console.log(`✅ Notifications scheduled for cart: ${cart.id}`);
}

async function checkIsDevShop(shop: string): Promise<boolean> {
    try {
        const session = await db.session.findFirst({
            where: { shop, isOnline: false },
            orderBy: { expires: "desc" },
        });

        if (!session?.accessToken) return false;

        const res = await fetch(
            `https://${shop}/admin/api/2025-10/shop.json`,
            {
                headers: {
                    "X-Shopify-Access-Token": session.accessToken,
                    "Content-Type": "application/json",
                },
            }
        );

        const data = await res.json();
        const planName = data?.shop?.plan_name ?? "";
        return planName === "developer" || planName === "developer_preview" || planName === "partner_test";

    } catch (err) {
        console.error("[checkIsDevShop] error:", err);
        return false;
    }
}