import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sweepDueCartActivities } from "../cartActivity.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { topic, shop, payload } = await authenticate.webhook(request);

    if (topic !== "CARTS_UPDATE") {
        return new Response("Unhandled topic", { status: 404 });
    }

    const cart = payload as any;

    if (!cart.token || !cart.line_items?.length) {
        return new Response("Empty cart", { status: 200 });
    }

    try {
        await Promise.all(
            cart.line_items.map((item: any) => {
                const variantId = String(item.variant_id);
                return db.cartActivity.upsert({
                    where: { shop_cartToken_variantId: { shop, cartToken: cart.token, variantId } },
                    update: {
                        title: item.title,
                        quantity: item.quantity ?? 1,
                        price: item.price ?? "0",
                        currency: cart.currency ?? "INR",
                    },
                    create: {
                        shop,
                        cartToken: cart.token,
                        variantId,
                        productId: item.product_id ? String(item.product_id) : null,
                        title: item.title,
                        quantity: item.quantity ?? 1,
                        price: item.price ?? "0",
                        currency: cart.currency ?? "INR",
                    },
                });
            }),
        );
    } catch (error) {
        console.error("Error saving cart activity:", error);
        return new Response("Error", { status: 500 });
    }

    if (process.env.APP_URL) {
        sweepDueCartActivities(shop, process.env.APP_URL).catch((err) =>
            console.error("Error sweeping cart activities:", err),
        );
    }

    return new Response("OK", { status: 200 });
};
