import type { ActionFunctionArgs } from "react-router";
import { savePushSubscription } from "../push.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { shop, subscription } = await request.json();

    if (!shop || !subscription) {
        return new Response(
            JSON.stringify({ error: "Missing shop or subscription" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        await savePushSubscription(shop, subscription);
        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error: any) {
        console.error("❌ Push subscribe error:", error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};