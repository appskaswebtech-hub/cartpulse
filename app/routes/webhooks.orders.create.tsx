import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { topic, shop, payload } = await authenticate.webhook(request);

    if (topic !== "ORDERS_CREATE") {
        return new Response("Unhandled topic", { status: 404 });
    }

    const order = payload as any;

    try {
        // Find the cart using customer email
        const cart = await db.abandonedCart.findFirst({
            where: {
                shop,
                customerEmail: order.email,
                isRecovered: false,
            },
        });

        if (cart) {
            // Mark cart as recovered
            await db.abandonedCart.update({
                where: { id: cart.id },
                data: {
                    isRecovered: true,
                    recoveredAt: new Date(),
                },
            });

            console.log(`Cart recovered for shop: ${shop}`);
        }
    } catch (error) {
        console.error("Error updating cart:", error);
        return new Response("Error", { status: 500 });
    }

    return new Response("OK", { status: 200 });
};