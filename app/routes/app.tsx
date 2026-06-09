  import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
  import { Outlet, useLoaderData, useRouteError } from "react-router";
  import { boundary } from "@shopify/shopify-app-react-router/server";
  import { AppProvider } from "@shopify/shopify-app-react-router/react";
  import { authenticate } from "../shopify.server";
  import { getShopPlanFromDB } from "../utils/planUtils";
  import { BillingGate } from "../components/BillingGate";
  import { useLocation } from "react-router";
  import { LanguageProvider, useTranslation } from "../i18n/LanguageContext";
  import { detectLocaleFromAcceptLanguage } from "../i18n";

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

    const detectedLocale = detectLocaleFromAcceptLanguage(request.headers.get("accept-language"));

    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      showGate,
      isDevShop,
      detectedLocale,
    };
  };

  function AppLayout() {
    const { showGate } = useLoaderData<typeof loader>();
    const location = useLocation();
    const { t } = useTranslation();

    const isBillingPage = location.pathname === "/app/billing" ||
      location.pathname === "/app/billing-return";

    return (
      <>
        <s-app-nav>
          <s-link href="/app/carts">{t.nav.abandonedCarts}</s-link>
          <s-link href="/app/outreach">{t.nav.emailOutreach}</s-link>
          <s-link href="/app/email-settings">{t.nav.emailSettings}</s-link>
          <s-link href="/app/billing">{t.nav.billing}</s-link>
        </s-app-nav>
        <BillingGate show={showGate && !isBillingPage} />
        <Outlet />
      </>
    );
  }

  export default function App() {
    const { apiKey, detectedLocale } = useLoaderData<typeof loader>();

    return (
      <AppProvider embedded apiKey={apiKey}>
        <LanguageProvider detectedLocale={detectedLocale}>
          <AppLayout />
        </LanguageProvider>
      </AppProvider>
    );
  }

  export function ErrorBoundary() {
    return boundary.error(useRouteError());
  }

  export const headers: HeadersFunction = (headersArgs) => {
    return boundary.headers(headersArgs);
  };
