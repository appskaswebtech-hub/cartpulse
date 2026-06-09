(async function () {
    const shop = window.Shopify?.shop;
    if (!shop) return;

    if (!("Notification" in window)) return;

    try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.log("CartPulse: Push permission denied");
            return;
        }

        console.log("CartPulse: Notifications enabled!");
        localStorage.setItem("cartpulse_notifications", "enabled");
        localStorage.setItem("cartpulse_shop", shop);

        // Poll every 2 minutes for pending notifications
        setInterval(async () => {
            try {
                const res = await fetch(
                    "https://unreproducible-chemiluminescent-jacquiline.ngrok-free.dev/api/pending-notification?shop=" + shop,
                    { method: "GET", headers: { "ngrok-skip-browser-warning": "true" } }
                );
                const data = await res.json();

                if (data.notification) {
                    new Notification(data.notification.title, {
                        body: data.notification.body,
                        icon: "https://cdn.shopify.com/s/files/1/0000/0000/files/icon.png",
                    });
                }
            } catch (e) {
                // silent fail
            }
        }, 10000);

    } catch (err) {
        console.error("CartPulse: Error setting up notifications:", err);
    }
})();