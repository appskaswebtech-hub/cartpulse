import type { LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const appUrl = `https://${url.host}`;

    const script = `
(function () {
  var CAPTURE_URL = ${JSON.stringify(appUrl)} + "/api/cart-activity-capture";

  function send(cart, account) {
    if (!cart || !cart.items || !cart.items.length) return;
    var shop = window.Shopify && window.Shopify.shop;
    if (!shop || !cart.token) return;

    var customer = account && account.customer;
    var name = customer
      ? (customer.name || ((customer.first_name || "") + " " + (customer.last_name || "")).trim())
      : null;

    var payload = {
      shop: shop,
      cartToken: String(cart.token).split("?")[0],
      email: (customer && customer.email) || null,
      name: name || null,
      lineItems: cart.items,
      totalPrice: cart.total_price,
      currency: cart.currency,
    };

    fetch(CAPTURE_URL, { method: "POST", body: JSON.stringify(payload), keepalive: true }).catch(function () {});
  }

  function getAccount() {
    // The app embed block (Liquid) provides this on stores using new
    // customer accounts, where /account.json no longer works.
    if (window.__cartPulseCustomer && window.__cartPulseCustomer.email) {
      return Promise.resolve({ customer: window.__cartPulseCustomer });
    }
    return fetch("/account.json", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function capture() {
    fetch("/cart.js", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        getAccount().then(function (account) { send(cart, account); });
      })
      .catch(function () {});
  }

  document.addEventListener("shopify:cart:lines-update", capture);
  document.addEventListener("shopify:cart:update", capture);

  function isCartAddUrl(u) {
    return typeof u === "string" && u.indexOf("/cart/add") !== -1;
  }

  // Standard storefront events aren't dispatched by every theme, so also
  // watch the network calls every "add to cart" button actually makes.
  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url);
    var result = origFetch.apply(this, arguments);
    if (isCartAddUrl(url)) {
      result.then(function () { setTimeout(capture, 300); }).catch(function () {});
    }
    return result;
  };

  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (isCartAddUrl(url)) {
      this.addEventListener("loadend", function () { setTimeout(capture, 300); });
    }
    return origOpen.apply(this, arguments);
  };

  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (form && form.action && isCartAddUrl(form.action)) {
      setTimeout(capture, 500);
    }
  }, true);
})();
`.trim();

    return new Response(script, {
        headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
};
