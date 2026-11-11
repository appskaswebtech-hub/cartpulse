import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * Opening the app from the Shopify admin lands here. The abandoned carts page
 * is the app's home, so send the merchant straight there — keeping Shopify's
 * embedded params (host, shop, id_token) so the target loads authenticated.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const query = url.searchParams.toString();

  return redirect(query ? `/app/carts?${query}` : "/app/carts");
};
