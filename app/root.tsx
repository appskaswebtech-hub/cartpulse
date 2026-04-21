import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { AppProvider } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";

export default function App() {
  return (
    <html lang="en">
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
      <body>
        <AppProvider i18n={en}>
          <Outlet />
        </AppProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}