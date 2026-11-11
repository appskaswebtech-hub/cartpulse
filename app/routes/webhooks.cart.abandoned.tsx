import type { ActionFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import db from "../db.server";
import { scheduleCartNotifications } from "../queue.server";
import { getEntitlement } from "../lib/billing.server";

/**
 * Webhooks carry no billing context, so the entitlement is resolved with the
 * shop's offline session. Carts are always recorded; only the paid action
 * (sending recovery notifications) is gated.
 */
async function shopIsEntitled(shop: string): Promise<boolean> {
  try {
    const { admin, session } = await unauthenticated.admin(shop);
    const entitlement = await getEntitlement(admin, {
      check: async ({ plans, isTest }) => {
        const response = await admin.graphql(
          `#graphql
            query ActiveSubscriptions {
              currentAppInstallation {
                activeSubscriptions { name status test }
              }
            }`
        );
        const body = await response.json();
        const subs = body?.data?.currentAppInstallation?.activeSubscriptions ?? [];
        return {
          hasActivePayment: subs.some(
            (sub: any) =>
              sub.status === "ACTIVE" &&
              plans.includes(sub.name) &&
              (isTest || sub.test === false)
          ),
        };
      },
    });
    return Boolean(session) && entitlement.entitled;
  } catch (error) {
    console.error("Entitlement check failed for", shop, error);
    return false;
  }
}

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

            // Merchant switch first — it is free to read and settles most cases.
            const settings = await db.merchantSettings.findUnique({ where: { shop } });
            // Off until the merchant opts in, so a shop with no settings row sends nothing.
            const channelsOn = settings
                ? settings.emailEnabled || settings.pushEnabled
                : false;
            const entitled = channelsOn && (await shopIsEntitled(shop));

            if (!channelsOn) {
                console.log(`Cart saved, notifications skipped (turned off in settings): ${shop}`);
            } else if (!entitled) {
                console.log(`Cart saved, notifications skipped (no active plan): ${shop}`);
            } else if (!existingNotifications) {
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