import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { topic, shop, payload } = await authenticate.webhook(request);

    if (topic !== "CHECKOUTS_CREATE" && topic !== "CHECKOUTS_UPDATE") {
        return new Response("Unhandled topic", { status: 404 });
    }

    const checkout = payload as any;
    const cartToken = checkout.cart_token || checkout.token;

    if (!cartToken || !checkout.email) {
        return new Response("No cart token or email", { status: 200 });
    }

    try {
        await db.cartActivity.updateMany({
            where: { shop, cartToken, customerEmail: null },
            data: {
                customerEmail: checkout.email,
                customerName: checkout.billing_address?.name ?? null,
            },
        });
    } catch (error) {
        console.error("Error backfilling cart activity email:", error);
        return new Response("Error", { status: 500 });
    }

    return new Response("OK", { status: 200 });
};
