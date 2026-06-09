import db from "../db.server";

export async function getShopPlanFromDB(shop: string) {
    const record = await db.shopPlan.findUnique({ where: { shop } });

    if (!record) {
        return await db.shopPlan.create({
            data: {
                shop,
                plan: "none",
                status: "active",
            },
        });
    }

    return record;
}

export async function updateShopPlan(
    shop: string,
    plan: string,
    subscriptionId: string | null
) {
    const now = new Date();

    return db.shopPlan.upsert({
        where: { shop },
        update: {
            plan,
            subscriptionId,
            status: "active",
            billingStartedAt: subscriptionId ? now : null,
        },
        create: {
            shop,
            plan,
            subscriptionId,
            status: "active",
            billingStartedAt: subscriptionId ? now : null,
        },
    });
}

export async function cancelShopPlan(shop: string) {
    return db.shopPlan.update({
        where: { shop },
        data: {
            plan: "none",
            subscriptionId: null,
            status: "cancelled",
            billingStartedAt: null,
        },
    });
}