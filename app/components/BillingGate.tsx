import { useNavigate } from "react-router";

interface Props {
    show: boolean;
}

export function BillingGate({ show }: Props) {
    const navigate = useNavigate();

    if (!show) return null;

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 10, 40, 0.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(3px)",
        }}>
            <div style={{
                background: "#ffffff",
                borderRadius: "16px",
                width: "90%",
                maxWidth: "360px",
                boxShadow: "0 16px 60px rgba(83,74,183,0.2)",
                overflow: "hidden",
            }}>
                {/* Header */}
                <div style={{
                    background: "linear-gradient(135deg, #534AB7 0%, #7F77DD 100%)",
                    padding: "22px 28px",
                    textAlign: "center",
                }}>
                    <div style={{
                        width: "44px",
                        height: "44px",
                        background: "rgba(255,255,255,0.15)",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 10px",
                    }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>
                    <h2 style={{ color: "#fff", margin: "0 0 4px", fontSize: "18px", fontWeight: "700" }}>
                        Unlock CartPulse
                    </h2>
                    <p style={{ color: "rgba(255,255,255,0.75)", margin: 0, fontSize: "13px" }}>
                        Choose a plan to recover abandoned carts
                    </p>
                </div>

                {/* Body */}
                <div style={{ padding: "20px 24px 24px" }}>
                    {[
                        "Abandoned cart tracking",
                        "Manual email outreach",
                        "Recovery analytics",
                        "Unsubscribe management",
                    ].map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 0", borderBottom: i < 3 ? "1px solid #f5f5f8" : "none" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span style={{ fontSize: "13px", color: "#374151" }}>{f}</span>
                        </div>
                    ))}

                    <div style={{ background: "#F0EFFE", borderRadius: "8px", padding: "10px 14px", margin: "16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "12px", color: "#534AB7", fontWeight: "600" }}>Starting at</span>
                        <span style={{ fontSize: "18px", fontWeight: "700", color: "#534AB7" }}>$9.99<span style={{ fontSize: "12px", fontWeight: "500" }}>/mo</span></span>
                    </div>

                    <button
                        onClick={() => navigate("/app/billing")}
                        style={{
                            width: "100%",
                            background: "linear-gradient(135deg, #534AB7, #7F77DD)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "10px",
                            padding: "12px",
                            fontSize: "14px",
                            fontWeight: "700",
                            cursor: "pointer",
                            boxShadow: "0 4px 16px rgba(83,74,183,0.3)",
                        }}
                    >
                        Choose a Plan →
                    </button>
                </div>
            </div>
        </div>
    );
}
