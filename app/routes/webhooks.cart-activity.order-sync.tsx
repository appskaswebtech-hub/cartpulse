import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { topic, shop, payload } = await authenticate.webhook(request);

    if (topic !== "ORDERS_CREATE") {
        return new Response("Unhandled topic", { status: 404 });
    }

    const order = payload as any;
    const cartToken = order.checkout_token || order.cart_token;

    if (!cartToken && !order.email) {
        return new Response("No cart token or email", { status: 200 });
    }

    try {
        await db.cartActivity.updateMany({
            where: {
                shop,
                status: { not: "converted" },
                OR: [
                    ...(cartToken ? [{ cartToken }] : []),
                    ...(order.email ? [{ customerEmail: order.email }] : []),
                ],
            },
            data: { status: "converted" },
        });
    } catch (error) {
        console.error("Error syncing cart activity with order:", error);
        return new Response("Error", { status: 500 });
    }

    return new Response("OK", { status: 200 });
};
