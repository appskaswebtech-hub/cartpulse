import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import db from "../db.server";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, ngrok-skip-browser-warning",
    "Content-Type": "application/json",
};

export const action = async ({ request }: ActionFunctionArgs) => {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    return new Response(null, { status: 405, headers: corsHeaders });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop) {
        return new Response(
            JSON.stringify({ notification: null }),
            { headers: corsHeaders }
        );
    }

    try {
        const pendingNotification = await db.cartNotification.findFirst({
            where: {
                status: "pending",
                channel: "push",
                cart: {
                    shop,
                    isRecovered: false,
                },
            },
            include: { cart: true },
            orderBy: { createdAt: "desc" },
        });

        if (!pendingNotification) {
            return new Response(
                JSON.stringify({ notification: null }),
                { headers: corsHeaders }
            );
        }

        await db.cartNotification.update({
            where: { id: pendingNotification.id },
            data: { status: "sent", sentAt: new Date() },
        });

        return new Response(
            JSON.stringify({
                notification: {
                    title: "You left something behind!",
                    body: `Complete your purchase — $${pendingNotification.cart.totalPrice} waiting in your cart`,
                },
            }),
            { headers: corsHeaders }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ notification: null }),
            { headers: corsHeaders }
        );
    }
};