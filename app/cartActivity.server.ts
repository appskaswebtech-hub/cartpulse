import db from "./db.server";
import { sendCartActivityEmail } from "./email.server";
import { DEFAULT_SUBJECT, DEFAULT_BODY } from "./cartActivityDefaults";

type Activity = {
    id: string;
    shop: string;
    cartToken: string;
    variantId: string;
    title: string;
    quantity: number;
    price: string;
    imageUrl: string | null;
    customerEmail: string | null;
    customerName: string | null;
    currency: string;
    scheduledSubject?: string | null;
    scheduledBody?: string | null;
};

export async function getCartActivitySettings(shop: string) {
    const settings = await db.cartActivitySettings.findUnique({ where: { shop } });
    if (settings) return settings;
    return db.cartActivitySettings.create({
        data: { shop, sendMode: "manual", body: DEFAULT_BODY, subject: DEFAULT_SUBJECT },
    });
}

function groupByCart(activities: Activity[]) {
    const groups = new Map<string, Activity[]>();
    for (const activity of activities) {
        const key = `${activity.shop}::${activity.cartToken}`;
        const group = groups.get(key) ?? [];
        group.push(activity);
        groups.set(key, group);
    }
    return Array.from(groups.values());
}

function buildEmail(group: Activity[], subject: string, body: string, baseUrl: string) {
    const first = group[0];
    const name = first.customerName ?? "there";
    const total = group.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
    const productNames = group.map((i) => i.title).join(", ");

    const cartUrl = `https://${first.shop}/cart/` +
        group.map((i) => `${i.variantId}:${i.quantity}`).join(",");

    const productRowsHtml = group.map((i, idx) => {
        const topBorder = idx > 0 ? "border-top:1px solid #ece9e1;" : "";
        const vPad = idx === 0 ? "22" : "18";
        return `
      <tr>
        <td width="112" valign="top" style="padding:${vPad}px 20px ${vPad}px 0;${topBorder}">
          ${i.imageUrl
            ? `<img src="${i.imageUrl}" width="112" height="112" alt="${i.title.replace(/"/g, "&quot;")}" style="display:block;border-radius:2px;object-fit:cover;border:1px solid #ece9e1;" />`
            : `<div style="width:112px;height:112px;background-color:#f7f6f3;border-radius:2px;border:1px solid #ece9e1;"></div>`
        }
        </td>
        <td valign="top" style="padding:${vPad}px 0;${topBorder}font-family:Arial,Helvetica,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#2a2a26;">${i.title}</td></tr>
            <tr><td style="padding:0 0 10px;font-size:11px;letter-spacing:0.5px;color:#a3a19a;text-transform:uppercase;">Quantity ${i.quantity}</td></tr>
            <tr><td style="padding:0;font-size:13px;color:#5a5a53;">${i.currency} ${(Number(i.price) * i.quantity).toFixed(2)}</td></tr>
          </table>
        </td>
      </tr>
    `;
    }).join("");

    const productCardsHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #2a2a26;">
        ${productRowsHtml}
        <tr>
          <td colspan="2" style="padding:18px 0;border-top:1px solid #ece9e1;border-bottom:1px solid #ece9e1;font-family:Arial,Helvetica,sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0;font-size:11px;letter-spacing:1px;color:#a3a19a;text-transform:uppercase;">Total</td>
                <td align="right" style="padding:0;font-family:Georgia,'Times New Roman',serif;font-size:17px;color:#2a2a26;">${first.currency} ${total.toFixed(2)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td colspan="2" align="center" style="padding:24px 0 0;">
            <a href="${cartUrl}" style="display:inline-block;background-color:#2a2a26;color:#ffffff;text-decoration:none;padding:16px 44px;font-size:12px;letter-spacing:2px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;">Return to Cart</a>
          </td>
        </tr>
      </table>
    `.replace(/\n\s*/g, "");

    const html = subject && body
        ? body
            .replace(/\[name\]/g, name)
            .replace(/\[products\]/g, productNames)
            .replace(/\[total\]/g, total.toFixed(2))
            .replace(/\n/g, "<br>")
            .replace(/\[cartlink\]/g, productCardsHtml)
        : "";

    const unsubscribeUrl = `${baseUrl}/unsubscribe?shop=${encodeURIComponent(first.shop)}&email=${encodeURIComponent(first.customerEmail!)}`;

    return { html, unsubscribeUrl };
}

async function sendGroup(group: Activity[], baseUrl: string, sentVia: "auto" | "manual", subjectOverride?: string, bodyOverride?: string) {
    const first = group[0];
    if (!first.customerEmail) return;

    const settings = await getCartActivitySettings(first.shop);
    const merchantSettings = await db.merchantSettings.findUnique({ where: { shop: first.shop } });

    const subject = subjectOverride ?? settings.subject;
    const body = bodyOverride ?? settings.body;
    const { html, unsubscribeUrl } = buildEmail(group, subject, body, baseUrl);

    await sendCartActivityEmail({
        to: first.customerEmail,
        subject,
        html,
        unsubscribeUrl,
        fromName: merchantSettings?.emailFromName,
        fromAddress: merchantSettings?.emailFromAddress,
        appPassword: merchantSettings?.emailAppPassword,
    });

    await db.cartActivity.updateMany({
        where: { id: { in: group.map((a) => a.id) } },
        data: { status: "reminded", remindedAt: new Date(), sentVia },
    });
}

export async function sendCartActivityReminder(
    activityIds: string[],
    baseUrl: string,
    subjectOverride?: string,
    bodyOverride?: string,
) {
    const activities = await db.cartActivity.findMany({ where: { id: { in: activityIds } } });
    const groups = groupByCart(activities.filter((a) => a.customerEmail));

    await Promise.allSettled(groups.map((group) => sendGroup(group, baseUrl, "manual", subjectOverride, bodyOverride)));
}

// Runs opportunistically (on webhook delivery and on page load) since this app
// has no background worker process to fire exactly at the 60-minute mark.
export async function sweepDueCartActivities(shop: string, baseUrl: string) {
    const settings = await getCartActivitySettings(shop);
    const dueBefore = new Date(Date.now() - settings.delayMinutes * 60_000);

    const due = await db.cartActivity.findMany({
        where: {
            shop,
            status: "pending",
            customerEmail: { not: null },
            addedAt: { lte: dueBefore },
        },
    });

    if (due.length > 0) {
        if (settings.sendMode === "auto") {
            const groups = groupByCart(due);
            await Promise.allSettled(groups.map((group) => sendGroup(group, baseUrl, "auto")));
        } else {
            await db.cartActivity.updateMany({
                where: { id: { in: due.map((a) => a.id) } },
                data: { status: "awaiting_manual" },
            });
        }
    }

    await processScheduledSends(shop, baseUrl);
}

export async function processScheduledSends(shop: string, baseUrl: string) {
    const due = await db.cartActivity.findMany({
        where: {
            shop,
            status: "scheduled",
            customerEmail: { not: null },
            scheduledSendAt: { lte: new Date() },
        },
    });

    const groups = groupByCart(due);
    await Promise.allSettled(
        groups.map((group) =>
            sendGroup(group, baseUrl, "manual", group[0].scheduledSubject ?? undefined, group[0].scheduledBody ?? undefined),
        ),
    );
}
