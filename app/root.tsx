import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { resolveRequestLocale } from "./i18n";
import { LanguageProvider, useTranslation } from "./i18n/LanguageContext";
import { AppProvider } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";
import es from "@shopify/polaris/locales/es.json";
import nl from "@shopify/polaris/locales/nl.json";
import fr from "@shopify/polaris/locales/fr.json";
import it from "@shopify/polaris/locales/it.json";

export const loader = ({ request }: LoaderFunctionArgs) => ({
  locale: resolveRequestLocale(request),
});

function LocalizedPolaris({ children }: { children: React.ReactNode }) {
  const { locale } = useTranslation();
  return (
    <AppProvider i18n={{ en, es, nl, fr, it }[locale]}>{children}</AppProvider>
  );
}

export default function App() {
  const { locale } = useLoaderData<typeof loader>();
  return (
    <html lang={locale} style={{ backgroundColor: "#fcfdfd" }}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/@shopify/polaris@13.9.5/build/esm/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body style={{ backgroundColor: "#fcfdfd", minHeight: "100vh" }}>
        <LanguageProvider detectedLocale={locale}>
          <LocalizedPolaris>
            <Outlet />
          </LocalizedPolaris>
        </LanguageProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
