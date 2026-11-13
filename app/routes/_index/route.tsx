import { useTranslation } from "../../i18n/LanguageContext";
import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Shopify does not always send `shop` on an embedded document request — an
  // app opened from the admin sidebar can arrive with only `host`, `id_token`
  // or `embedded`. Any of them means this is a real admin load, so hand off to
  // the app (which authenticates properly) instead of showing the login form.
  const EMBEDDED_PARAMS = [
    "shop",
    "host",
    "id_token",
    "embedded",
    "session",
    "appLoadId",
  ];
  const isAdminLoad = EMBEDDED_PARAMS.some((param) =>
    url.searchParams.has(param),
  );

  if (isAdminLoad) {
    const query = url.searchParams.toString();
    throw redirect(query ? `/app/carts?${query}` : "/app/carts");
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { tr, locale } = useTranslation();

  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>
          {tr("A short heading about [your app]")}
        </h1>
        <p className={styles.text}>
          {tr(
            " A tagline about [your app] that describes your value proposition. ",
          )}
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>{tr("Shop domain")}</span>
              <input className={styles.input} type="text" name="shop" />
              <span>{tr("e.g: my-shop-domain.myshopify.com")}</span>
            </label>
            <button className={styles.button} type="submit">
              {tr(" Log in ")}
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>{tr("Product feature")}</strong>
            {tr(
              ". Some detail about your feature and its benefit to your customer. ",
            )}
          </li>
          <li>
            <strong>{tr("Product feature")}</strong>
            {tr(
              ". Some detail about your feature and its benefit to your customer. ",
            )}
          </li>
          <li>
            <strong>{tr("Product feature")}</strong>
            {tr(
              ". Some detail about your feature and its benefit to your customer. ",
            )}
          </li>
        </ul>
      </div>
    </div>
  );
}
