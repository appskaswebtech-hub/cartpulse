import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError, useLocation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import SupportChatWidget from "../components/SupportChatWidget";
import { getShopPlanFromDB } from "../utils/planUtils";
import { BillingGate } from "../components/BillingGate";
import { APP_CSS } from "../styles/theme";
import { detectLocaleFromAcceptLanguage } from "../i18n";
import { LanguageProvider } from "../i18n/LanguageContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

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
  const showGate = !hasPlan;

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    showGate,
    isDevShop,
    detectedLocale: detectLocaleFromAcceptLanguage(request.headers.get("accept-language")),
  };
};

export default function App() {
  const { apiKey, showGate, detectedLocale } = useLoaderData<typeof loader>();
  const location = useLocation();

  const isBillingPage =
    location.pathname === "/app/billing" || location.pathname === "/app/billing-return";

  return (
    <AppProvider embedded apiKey={apiKey}>
      {/* Design system, injected once for every page under /app. */}
      <style dangerouslySetInnerHTML={{ __html: APP_CSS }} />

      <s-app-nav>
        {/*
          Clicking the app name in the admin sidebar goes to the app's home
          route, which defaults to "/". This override points it at the
          abandoned carts page; it is hidden from the rendered menu, and only
          one link may carry rel="home". App Bridge's types omit `rel`, so it
          is spread in.
        */}
        <s-link href="/app/carts" {...({ rel: "home" } as Record<string, string>)}>
          Abandoned Carts
        </s-link>
        <s-link href="/app/carts">Abandoned Carts</s-link>
        <s-link href="/app/cart-activity">Cart Activity</s-link>
        <s-link href="/app/size-charts">Size Charts</s-link>
        <s-link href="/app/outreach">Email Outreach</s-link>
        <s-link href="/app/email-settings">Email Settings</s-link>
        <s-link href="/app/reports">Reports</s-link>
        <s-link href="/app/billing">Billing</s-link>
      </s-app-nav>

      <LanguageProvider detectedLocale={detectedLocale}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 0" }}>
          <LanguageSwitcher />
        </div>
        <BillingGate show={showGate && !isBillingPage} />
        <Outlet />
      </LanguageProvider>
      <SupportChatWidget />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
