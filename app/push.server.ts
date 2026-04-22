import webpush from "web-push";
import db from "./db.server";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushNotification(
  shop: string,
  payload: {
    title: string;
    body: string;
    url: string;
  }
) {
  const subscriptions = await db.pushSubscription.findMany({
    where: { shop },
  });

  console.log(`📲 Sending push to ${subscriptions.length} subscribers`);

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      )
    )
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error(`❌ ${failed.length} push notifications failed`);
  }

  console.log(`✅ Push notifications sent to ${subscriptions.length} subscribers`);
}

export async function savePushSubscription(
  shop: string,
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }
) {
  await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    create: {
      shop,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });

  console.log(`✅ Push subscription saved for shop: ${shop}`);
}