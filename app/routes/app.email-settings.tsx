import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Page } from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);

    const settings = await db.merchantSettings.findUnique({
        where: { shop: session.shop },
    });

    return {
        defaultEmail: process.env.GMAIL_USER ?? "",
        fromName: settings?.emailFromName ?? "",
        fromAddress: settings?.emailFromAddress ?? "",
        hasPassword: !!(settings?.emailAppPassword),
    };
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();

    const fromName = formData.get("fromName") as string;
    const fromAddress = formData.get("fromAddress") as string;
    const appPassword = formData.get("appPassword") as string;

    const data: any = { emailFromName: fromName, emailFromAddress: fromAddress };
    if (appPassword.trim()) data.emailAppPassword = appPassword.trim().replace(/\s/g, "");

    await db.merchantSettings.upsert({
        where: { shop: session.shop },
        update: data,
        create: { shop: session.shop, ...data },
    });

    return { success: true };
};

export default function EmailSettings() {
    const { defaultEmail, fromName, fromAddress, hasPassword } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();

    const [provider, setProvider] = useState<string>(fromAddress ? "gmail" : "");
    const [showPassword, setShowPassword] = useState(false);
    const isSaving = fetcher.state !== "idle";
    const saved = fetcher.data?.success;

    return (
        <Page>
            <style>{`
                .cp-card { background: #fff; border-radius: 16px; padding: 28px; border: 1px solid #f0f0f0; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
                .cp-input { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 11px 14px; font-size: 14px; color: #111; outline: none; box-sizing: border-box; font-family: inherit; background: #fff; }
                .cp-input:focus { border-color: #534AB7; box-shadow: 0 0 0 3px rgba(83,74,183,0.1); }
                .cp-label { font-size: 12px; font-weight: 600; color: #374151; display: block; margin-bottom: 6px; }
                .cp-hint { font-size: 11px; color: #9ca3af; margin-top: 5px; }
                .btn-save { background: linear-gradient(135deg,#534AB7,#7F77DD); color: #fff; border: none; border-radius: 10px; padding: 11px 28px; font-size: 14px; font-weight: 600; cursor: pointer; }
                .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>

            <div>
                {/* Header */}
                <div style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                        <div style={{ width: "32px", height: "32px", background: "#EEEDFE", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                        </div>
                        <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0, color: "#111" }}>Email Settings</h1>
                    </div>
                    <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>Configure the email address used to send recovery emails</p>
                </div>

                {/* Default email info */}
                <div style={{ background: "#F0EFFE", border: "1px solid #D4D0F9", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p style={{ margin: 0, fontSize: "13px", color: "#534AB7" }}>
                        Default sender: <strong>{defaultEmail}</strong> — override below to use your own Gmail.
                    </p>
                </div>

                {/* Form */}
                <fetcher.Form method="POST">
                    <div className="cp-card">
                        <h3 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: "600", color: "#111" }}>Custom Sender Email</h3>

                        {/* Provider dropdown */}
                        <div style={{ marginBottom: "20px" }}>
                            <label className="cp-label">Email Provider</label>
                            <select
                                className="cp-input"
                                value={provider}
                                onChange={(e) => setProvider(e.target.value)}
                                style={{ cursor: "pointer" }}
                            >
                                <option value="">— Select a provider —</option>
                                <option value="gmail">Gmail</option>
                            </select>
                            <p className="cp-hint">More providers coming soon</p>
                        </div>

                        {/* Gmail fields — only shown when Gmail selected */}
                        {provider === "gmail" && (
                            <>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                                    <div>
                                        <label className="cp-label">From Name</label>
                                        <input className="cp-input" name="fromName" defaultValue={fromName} placeholder="My Store" />
                                        <p className="cp-hint">Shown as sender name in inbox</p>
                                    </div>
                                    <div>
                                        <label className="cp-label">Gmail Address</label>
                                        <input className="cp-input" name="fromAddress" type="email" defaultValue={fromAddress} placeholder="store@gmail.com" />
                                        <p className="cp-hint">Must be a Gmail account</p>
                                    </div>
                                </div>

                                <div style={{ marginBottom: "20px" }}>
                                    <label className="cp-label">
                                        App Password
                                        {hasPassword && <span style={{ marginLeft: "8px", background: "#DCFCE7", color: "#166534", fontSize: "10px", padding: "2px 8px", borderRadius: "10px", fontWeight: "600" }}>Saved</span>}
                                    </label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            className="cp-input"
                                            name="appPassword"
                                            type={showPassword ? "text" : "password"}
                                            placeholder={hasPassword ? "Leave blank to keep existing" : "xxxx xxxx xxxx xxxx"}
                                            style={{ paddingRight: "44px" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                {showPassword
                                                    ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                                                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                                                }
                                            </svg>
                                        </button>
                                    </div>
                                    <p className="cp-hint">
                                        Get it from <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: "#534AB7" }}>myaccount.google.com/apppasswords</a> — requires 2-Step Verification
                                    </p>
                                </div>
                            </>
                        )}

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            {saved && (
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#166534", fontSize: "13px", fontWeight: "500" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                    Settings saved
                                </div>
                            )}
                            <button className="btn-save" disabled={isSaving || !provider} style={{ marginLeft: "auto" }}>
                                {isSaving ? "Saving…" : "Save Settings"}
                            </button>
                        </div>
                    </div>
                </fetcher.Form>

                <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    App passwords are stored securely and never shared.
                </p>
            </div>
        </Page>
    );
}
