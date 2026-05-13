import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { getShopPlanFromDB } from "../utils/planUtils";
import { BillingGate } from "../components/BillingGate";
import { useLocation } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const response = await admin.graphql(`#graphql
    query {
      shop {
        plan {
          partnerDevelopment
        }
      }
    }
  `);

  const data = await response.json();
  const isDevShop = data?.data?.shop?.plan?.partnerDevelopment === true;

  const record = await getShopPlanFromDB(shop);
  const hasPlan = ["basic", "pro", "advanced"].includes(record.plan);
  const showGate = !isDevShop && !hasPlan;
  // const showGate = true; // force gate for testing

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    showGate,
    isDevShop,
  };
};

export default function App() {
  const { apiKey, showGate } = useLoaderData<typeof loader>();
  const location = useLocation();

  const isBillingPage = location.pathname === "/app/billing" ||
    location.pathname === "/app/billing-return";

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app/carts">Abandoned Carts</s-link>
        <s-link href="/app/billing">Billing</s-link>
      </s-app-nav>
      <BillingGate show={showGate && !isBillingPage} />
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};