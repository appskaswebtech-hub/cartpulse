import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { scheduleCartNotifications } from "../queue.server";

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

        // Schedule notifications only on CHECKOUTS_CREATE and only once
        if (topic === "CHECKOUTS_CREATE" && cart.email) {
            const existingNotifications = await db.cartNotification.findFirst({
                where: { cartId: savedCart.id },
            });

            if (!existingNotifications) {
                await scheduleCartNotifications({
                    id: savedCart.id,
                    customerEmail: savedCart.customerEmail,
                    cartData: savedCart.cartData as string,
                    totalPrice: savedCart.totalPrice,
                    shop: savedCart.shop,
                });
                console.log(`✅ Cart saved and notifications scheduled for shop: ${shop}`);
            } else {
                console.log(`⚠️ Notifications already scheduled for cart: ${savedCart.id}`);
            }
        }

    } catch (error) {
        console.error("Error saving cart:", error);
        return new Response("Error", { status: 500 });
    }

    return new Response("OK", { status: 200 });
};