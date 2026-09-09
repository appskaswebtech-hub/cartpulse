import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export const action = async ({ request }: ActionFunctionArgs) => {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    let payload: any;
    try {
        payload = JSON.parse(await request.text());
    } catch {
        return new Response("Invalid body", { status: 400, headers: corsHeaders });
    }

    const { shop, email, name, lineItems, totalPrice, currency } = payload;
    const cartToken = typeof payload.cartToken === "string" ? payload.cartToken.split("?")[0] : payload.cartToken;

    if (!shop || !cartToken || !Array.isArray(lineItems) || lineItems.length === 0) {
        return new Response("Missing fields", { status: 400, headers: corsHeaders });
    }

    const session = await db.session.findFirst({ where: { shop } });
    if (!session) {
        return new Response("Unknown shop", { status: 404, headers: corsHeaders });
    }

    try {
        await Promise.all(
            lineItems.map((item: any) => {
                const variantId = String(item.variant_id ?? item.id);
                return db.cartActivity.upsert({
                    where: { shop_cartToken_variantId: { shop, cartToken, variantId } },
                    update: {
                        title: item.title ?? item.product_title,
                        quantity: item.quantity ?? 1,
                        price: String(item.price ?? "0"),
                        imageUrl: item.image || undefined,
                        currency: currency || "INR",
                        customerEmail: email || undefined,
                        customerName: name || undefined,
                    },
                    create: {
                        shop,
                        cartToken,
                        variantId,
                        productId: item.product_id ? String(item.product_id) : null,
                        title: item.title ?? item.product_title ?? "Product",
                        quantity: item.quantity ?? 1,
                        price: String(item.price ?? "0"),
                        imageUrl: item.image || null,
                        currency: currency || "INR",
                        customerEmail: email || null,
                        customerName: name || null,
                    },
                });
            }),
        );
    } catch (error) {
        console.error("Error capturing cart activity:", error);
        return new Response("Error", { status: 500, headers: corsHeaders });
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
};
