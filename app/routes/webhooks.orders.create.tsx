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
        // Match by checkout_token first (most reliable), fallback to email
        const cart = await db.abandonedCart.findFirst({
            where: {
                shop,
                isRecovered: false,
                OR: [
                    { cartToken: order.checkout_token },
                    { customerEmail: order.email },
                ],
            },
            orderBy: { createdAt: "desc" },
        });

        if (cart) {
            const ageSeconds = (Date.now() - new Date(cart.createdAt).getTime()) / 1000;

            if (ageSeconds < 600) {
                await db.abandonedCart.delete({ where: { id: cart.id } });
                console.log(`Cart deleted (purchased immediately) for shop: ${shop}`);
            } else {
                await db.abandonedCart.update({
                    where: { id: cart.id },
                    data: { isRecovered: true, recoveredAt: new Date() },
                });
                console.log(`Cart recovered for shop: ${shop}`);
            }
        }
    } catch (error) {
        console.error("Error updating cart:", error);
        return new Response("Error", { status: 500 });
    }

    return new Response("OK", { status: 200 });
};
