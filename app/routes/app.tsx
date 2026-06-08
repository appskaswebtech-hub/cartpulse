import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { detectLocaleFromAcceptLanguage } from "../i18n";
import { LanguageProvider, useTranslation } from "../i18n/LanguageContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const detectedLocale = detectLocaleFromAcceptLanguage(request.headers.get("accept-language"));
  return { apiKey: process.env.SHOPIFY_API_KEY || "", detectedLocale };
};

function AppNav() {
  const { t } = useTranslation();

  return (
    <>
      <s-app-nav>
        <s-link href="/app/carts">{t.nav.abandonedCarts}</s-link>
        <s-link href="/app/reports">{t.nav.reports}</s-link>
      </s-app-nav>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 0" }}>
        <LanguageSwitcher />
      </div>
    </>
  );
}

export default function App() {
  const { apiKey, detectedLocale } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <LanguageProvider detectedLocale={detectedLocale}>
        <AppNav />
        <Outlet />
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