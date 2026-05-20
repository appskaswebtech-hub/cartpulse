import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const email = url.searchParams.get("email");

    if (!shop || !email) {
        return new Response(unsubscribePage("Invalid link", "This unsubscribe link is invalid or expired."), {
            headers: { "Content-Type": "text/html" },
        });
    }

    try {
        await db.emailUnsubscribe.upsert({
            where: { shop_email: { shop, email } },
            update: {},
            create: { shop, email },
        });

        return new Response(
            unsubscribePage(
                "You've been unsubscribed",
                `<strong>${email}</strong> has been removed from future cart recovery emails from this store.`
            ),
            { headers: { "Content-Type": "text/html" } }
        );
    } catch {
        return new Response(
            unsubscribePage("Something went wrong", "Please try again later."),
            { headers: { "Content-Type": "text/html" } }
        );
    }
};

function unsubscribePage(title: string, message: string) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 16px; padding: 40px; max-width: 420px; width: 90%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { width: 56px; height: 56px; background: #E1F5EE; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    h1 { font-size: 20px; font-weight: 700; color: #111; margin: 0 0 10px; }
    p { font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" stroke-width="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
