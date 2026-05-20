import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { topic, shop, payload } = await authenticate.webhook(request);

    if (topic !== "CHECKOUTS_CREATE" && topic !== "CHECKOUTS_UPDATE") {
        return new Response("Unhandled topic", { status: 404 });
    }

    const cart = payload as any;

    if (!cart.line_items?.length) {
        return new Response("Empty cart", { status: 200 });
    }

    try {
        const savedCart = await db.abandonedCart.upsert({
            where: { cartToken: cart.token },
            update: {
                customerEmail: cart.email || null,
                customerPhone: cart.phone || null,
                customerName: cart.billing_address?.name || null,
                cartData: JSON.stringify(cart.line_items),
                totalPrice: cart.total_price || "0",
                updatedAt: new Date(),
            },
            create: {
                shop,
                cartToken: cart.token,
                customerEmail: cart.email || null,
                customerPhone: cart.phone || null,
                customerName: cart.billing_address?.name || null,
                cartData: JSON.stringify(cart.line_items),
                totalPrice: cart.total_price || "0",
                currency: cart.currency || "INR",
            },
        });


    } catch (error) {
        console.error("Error saving cart:", error);
        return new Response("Error", { status: 500 });
    }

    return new Response("OK", { status: 200 });
};