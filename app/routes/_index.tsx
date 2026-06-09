import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");

  if (shop || host) {
    return redirect(`/app/carts?${url.searchParams.toString()}`);
  }

  // No params: Shopify loaded the app without auth context (top-level nav click).
  // Serve an App Bridge bounce page — it connects to the parent Shopify Admin frame
  // and navigates to /app/carts with a valid session token.
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  return new Response(
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" data-api-key="${apiKey}"></script>
<script>
  window.addEventListener('load', function() {
    if (window.shopify && window.shopify.navigate) {
      window.shopify.navigate('/app/carts');
    } else {
      window.location.href = '/app/carts';
    }
  });
</script>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
};
