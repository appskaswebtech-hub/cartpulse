import { useTranslation } from "../i18n/LanguageContext";
import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  EmailSettingsHero,
  EmailSettingsIcon,
} from "../components/EmailSettingsVisuals";
import pageStylesheet from "../styles/email-settings.css?url";

export const links = () => [{ rel: "stylesheet", href: pageStylesheet }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const settings = await db.merchantSettings.findUnique({
    where: { shop: session.shop },
  });

  return {
    defaultEmail: process.env.GMAIL_USER ?? "",
    fromName: settings?.emailFromName ?? "",
    fromAddress: settings?.emailFromAddress ?? "",
    hasPassword: !!settings?.emailAppPassword,
    emailEnabled: settings?.emailEnabled ?? false,
    pushEnabled: settings?.pushEnabled ?? false,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const fromName = formData.get("fromName") as string;
  const fromAddress = formData.get("fromAddress") as string;
  const appPassword = formData.get("appPassword") as string;

  const data: any = {
    emailFromName: fromName,
    emailFromAddress: fromAddress,
    // Checkboxes post nothing when unticked, so absence means off.
    emailEnabled: formData.get("emailEnabled") === "on",
    pushEnabled: formData.get("pushEnabled") === "on",
  };
  if (appPassword.trim())
    data.emailAppPassword = appPassword.trim().replace(/\s/g, "");

  await db.merchantSettings.upsert({
    where: { shop: session.shop },
    update: data,
    create: { shop: session.shop, ...data },
  });

  return { success: true };
};

export default function EmailSettings() {
  const { tr, locale } = useTranslation();

  const {
    defaultEmail,
    fromName,
    fromAddress,
    hasPassword,
    emailEnabled,
    pushEnabled,
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [provider, setProvider] = useState<string>(fromAddress ? "gmail" : "");
  const [showPassword, setShowPassword] = useState(false);
  const isSaving = fetcher.state !== "idle";
  const saved = fetcher.data?.success;

  return (
    <div className="email-settings-shell">
      <div className="email-settings-page">
        <header className="email-settings-header">
          <span className="email-settings-title-icon">
            <EmailSettingsIcon name="mail" />
          </span>
          <div>
            <h1>{tr("Email Settings")}</h1>
            <p>
              {tr("Configure the email address used to send recovery emails.")}
            </p>
          </div>
        </header>
        <div className="email-settings-default" role="note">
          <EmailSettingsIcon name="info" />
          <p>
            <strong>
              {tr(" Default sender: ")}
              <span>{defaultEmail}</span>
            </strong>
            {tr(" ")}
            {tr(" — override below to use your own Gmail. ")}
          </p>
        </div>
        <EmailSettingsHero />
        <fetcher.Form method="POST">
          <section
            className="email-settings-card email-settings-switches"
            aria-labelledby="email-settings-sending-title"
          >
            <div className="email-settings-card-heading">
              <span className="email-settings-heading-icon">
                <EmailSettingsIcon name="mail" />
              </span>
              <div>
                <h2 id="email-settings-sending-title">
                  {tr("What CartPulse sends")}
                </h2>
                <p>
                  {tr(
                    " Abandoned carts are always recorded in your reports. These switches only control whether shoppers are contacted. ",
                  )}
                </p>
              </div>
            </div>
            <div className="email-settings-switch-list">
              <label className="email-settings-toggle">
                <span className="email-settings-heading-icon">
                  <EmailSettingsIcon name="mail" />
                </span>
                <span className="email-settings-toggle-copy">
                  <strong>{tr("Send recovery emails")}</strong>
                  <span>
                    {tr(
                      " A first reminder and a final notice to shoppers who leave a cart. ",
                    )}
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  name="emailEnabled"
                  defaultChecked={emailEnabled}
                />
              </label>
              <label className="email-settings-toggle">
                <span className="email-settings-heading-icon">
                  <EmailSettingsIcon name="bell" />
                </span>
                <span className="email-settings-toggle-copy">
                  <strong>{tr("Send browser push notifications")}</strong>
                  <span>
                    {tr(
                      " Only reaches shoppers who allowed notifications on your storefront. ",
                    )}
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  name="pushEnabled"
                  defaultChecked={pushEnabled}
                />
              </label>
            </div>
          </section>
          <section
            className="email-settings-card email-settings-sender"
            aria-labelledby="email-settings-sender-title"
          >
            <div className="email-settings-card-heading email-settings-sender-heading">
              <svg
                className="email-settings-heading-wave"
                viewBox="0 0 600 90"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="sender-wave" x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor="#a1e7c7" />
                    <stop offset="1" stopColor="#effcf7" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 90C170 12 205 90 300 42S470-8 600 34V90Z"
                  fill="url(#sender-wave)"
                />
              </svg>
              <span className="email-settings-heading-icon">
                <EmailSettingsIcon name="send" />
              </span>
              <h2 id="email-settings-sender-title">
                {tr("Custom Sender Email")}
              </h2>
            </div>
            <div className="email-settings-sender-body">
              <div className="email-settings-provider">
                <label className="cp-label" htmlFor="email-provider">
                  {tr(" Email Provider ")}
                </label>
                <div className="email-settings-select">
                  <EmailSettingsIcon name="mail" />
                  <select
                    id="email-provider"
                    className="cp-input"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                  >
                    <option value="">
                      {tr("\u2014 Select a provider \u2014")}
                    </option>
                    <option value="gmail">Gmail</option>
                  </select>
                </div>
                <p className="cp-hint">{tr("More providers coming soon.")}</p>
              </div>
              {provider === "gmail" && (
                <>
                  <div className="email-settings-gmail-grid">
                    <div>
                      <label className="cp-label" htmlFor="sender-name">
                        {tr(" From Name ")}
                      </label>
                      <input
                        id="sender-name"
                        className="cp-input"
                        name="fromName"
                        defaultValue={fromName}
                        placeholder={tr("My Store")}
                      />
                      <p className="cp-hint">
                        {tr("Shown as sender name in inbox")}
                      </p>
                    </div>
                    <div>
                      <label className="cp-label" htmlFor="sender-address">
                        {tr(" Gmail Address ")}
                      </label>
                      <input
                        id="sender-address"
                        className="cp-input"
                        name="fromAddress"
                        type="email"
                        defaultValue={fromAddress}
                        placeholder={tr("store@gmail.com")}
                      />
                      <p className="cp-hint">{tr("Must be a Gmail account")}</p>
                    </div>
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <label className="cp-label" htmlFor="sender-password">
                      {tr(" App Password ")}
                      {hasPassword && (
                        <span
                          style={{
                            marginLeft: "8px",
                            background: "#DCFCE7",
                            color: "#166534",
                            fontSize: "10px",
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontWeight: "600",
                          }}
                        >
                          {tr(" Saved ")}
                        </span>
                      )}
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        className="cp-input"
                        id="sender-password"
                        name="appPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder={
                          hasPassword
                            ? tr("Leave blank to keep existing")
                            : tr("xxxx xxxx xxxx xxxx")
                        }
                        style={{ paddingRight: "44px" }}
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword
                            ? tr("Hide app password")
                            : tr("Show app password")
                        }
                        aria-pressed={showPassword}
                        className="email-settings-password-visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: "absolute",
                          right: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#9ca3af",
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          {showPassword ? (
                            <>
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </>
                          ) : (
                            <>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                    <p className="cp-hint">
                      {tr(" Get it from")}
                      {tr(" ")}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#534AB7" }}
                      >
                        {tr(" myaccount.google.com/apppasswords ")}
                      </a>
                      {tr(" ")}
                      {tr(" — requires 2-Step Verification ")}
                    </p>
                  </div>
                </>
              )}

              <div className="email-settings-save-row">
                {saved && (
                  <div className="email-settings-saved" role="status">
                    <EmailSettingsIcon name="check" />
                    {tr(" Settings saved ")}
                  </div>
                )}
                <button
                  className="btn-save"
                  type="submit"
                  disabled={isSaving || !provider}
                >
                  <EmailSettingsIcon name="save" />
                  {isSaving ? tr("Saving\u2026") : tr("Save Settings")}
                </button>
              </div>
            </div>
          </section>
        </fetcher.Form>
        <p className="email-settings-privacy">
          <EmailSettingsIcon name="lock" />
          {tr(" App passwords are stored securely and never shared. ")}
        </p>
      </div>
    </div>
  );
}
