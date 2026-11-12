import type { LoaderFunctionArgs } from "react-router";

export const loader = async ({}: LoaderFunctionArgs) => {
  const dashboardUrl = process.env.SUPPORT_DASHBOARD_URL || "http://localhost:3000";
  const apiKey = process.env.SUPPORT_INCOMING_API_KEY || "";
  const appId = process.env.SUPPORT_APP_ID || "cartpulse";

  const script = `
(function () {
  var DASHBOARD_URL = ${JSON.stringify(dashboardUrl)};
  var API_KEY = ${JSON.stringify(apiKey)};
  var APP_ID = ${JSON.stringify(appId)};
  var POLL_MS = 5000;

  var shop = (window.Shopify && window.Shopify.shop) || "unknown-shop";
  var storageKey = "supportChat_" + shop;

  function loadState() {
    try {
      var raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {}
  }

  var state = loadState();
  var pollTimer = null;

  var style = document.createElement("style");
  style.textContent =
    ".sc-bubble{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#1d4ed8;color:#fff;border:none;box-shadow:0 8px 24px rgba(0,0,0,.2);cursor:pointer;font-size:24px;z-index:2147483000;}" +
    ".sc-panel{position:fixed;bottom:92px;right:24px;width:340px;max-height:480px;background:#fff;border-radius:20px;box-shadow:0 12px 32px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden;font-family:Arial,Helvetica,sans-serif;z-index:2147483000;}" +
    ".sc-header{background:#1d4ed8;color:#fff;padding:14px 16px;font-size:15px;font-weight:600;}" +
    ".sc-body{flex:1;overflow-y:auto;padding:12px;background:#f8fafc;}" +
    ".sc-msg{padding:8px 12px;border-radius:14px;margin-bottom:8px;font-size:13px;max-width:85%;line-height:1.4;}" +
    ".sc-msg.mine{background:#dbeafe;margin-left:auto;}" +
    ".sc-msg.theirs{background:#e5e7eb;margin-right:auto;}" +
    ".sc-form{padding:12px;border-top:1px solid #e5e7eb;background:#fff;}" +
    ".sc-input,.sc-textarea{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:10px;font-size:13px;margin-bottom:8px;}" +
    ".sc-textarea{resize:none;height:56px;}" +
    ".sc-btn{width:100%;padding:9px;border:none;border-radius:10px;background:#0f172a;color:#fff;font-size:13px;font-weight:600;cursor:pointer;}" +
    ".sc-btn:disabled{opacity:.5;cursor:not-allowed;}" +
    ".sc-error{color:#dc2626;font-size:12px;margin-bottom:6px;}";
  document.head.appendChild(style);

  var bubble = document.createElement("button");
  bubble.className = "sc-bubble";
  bubble.setAttribute("aria-label", "Chat with support");
  bubble.textContent = "\\u{1F4AC}";
  document.body.appendChild(bubble);

  var panel = document.createElement("div");
  panel.className = "sc-panel";
  panel.style.display = "none";
  document.body.appendChild(panel);

  bubble.addEventListener("click", function () {
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
    if (panel.style.display === "flex") render();
  });

  function render() {
    panel.innerHTML = "";
    var header = document.createElement("div");
    header.className = "sc-header";
    header.textContent = "Chat with support";
    panel.appendChild(header);

    var body = document.createElement("div");
    body.className = "sc-body";
    panel.appendChild(body);

    if (!state || !state.messageId) {
      renderForm(body);
    } else {
      renderThread(body);
      startPolling();
    }
  }

  function renderForm(body) {
    var wrap = document.createElement("div");
    wrap.className = "sc-form";

    var errorEl = document.createElement("div");
    errorEl.className = "sc-error";
    errorEl.style.display = "none";

    var nameInput = document.createElement("input");
    nameInput.className = "sc-input";
    nameInput.placeholder = "Your name";

    var emailInput = document.createElement("input");
    emailInput.className = "sc-input";
    emailInput.placeholder = "Your email";

    var messageInput = document.createElement("textarea");
    messageInput.className = "sc-textarea";
    messageInput.placeholder = "How can we help?";

    var sendBtn = document.createElement("button");
    sendBtn.className = "sc-btn";
    sendBtn.textContent = "Send message";

    sendBtn.addEventListener("click", function () {
      var name = nameInput.value.trim();
      var email = emailInput.value.trim();
      var message = messageInput.value.trim();
      if (!name || !email || !message) {
        errorEl.textContent = "Please fill in all fields.";
        errorEl.style.display = "block";
        return;
      }

      sendBtn.disabled = true;
      fetch(DASHBOARD_URL + "/api/messages/incoming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: API_KEY,
          appId: APP_ID,
          shop: shop,
          name: name,
          email: email,
          message: message,
        }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data.messageId) {
            errorEl.textContent = data.error || "Unable to send message.";
            errorEl.style.display = "block";
            sendBtn.disabled = false;
            return;
          }
          state = { messageId: data.messageId, name: name, email: email };
          saveState(state);
          render();
        })
        .catch(function () {
          errorEl.textContent = "Unable to send message. Please try again.";
          errorEl.style.display = "block";
          sendBtn.disabled = false;
        });
    });

    wrap.appendChild(errorEl);
    wrap.appendChild(nameInput);
    wrap.appendChild(emailInput);
    wrap.appendChild(messageInput);
    wrap.appendChild(sendBtn);

    var placeholder = document.createElement("div");
    placeholder.style.cssText = "color:#64748b;font-size:13px;padding:8px;";
    placeholder.textContent = "Send us a message and we'll get back to you here.";
    body.appendChild(placeholder);

    panel.appendChild(wrap);
  }

  function renderThread(body) {
    body.setAttribute("data-thread", "1");
    fetchReplies(body);

    var form = document.createElement("div");
    form.className = "sc-form";

    var textarea = document.createElement("textarea");
    textarea.className = "sc-textarea";
    textarea.placeholder = "Type a follow-up...";

    var btn = document.createElement("button");
    btn.className = "sc-btn";
    btn.textContent = "Reply";

    btn.addEventListener("click", function () {
      var text = textarea.value.trim();
      if (!text) return;
      btn.disabled = true;
      fetch(DASHBOARD_URL + "/api/messages/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: API_KEY,
          messageId: state.messageId,
          name: state.name,
          body: text,
        }),
      })
        .then(function () {
          textarea.value = "";
          btn.disabled = false;
          fetchReplies(body);
        })
        .catch(function () {
          btn.disabled = false;
        });
    });

    form.appendChild(textarea);
    form.appendChild(btn);
    panel.appendChild(form);
  }

  function fetchReplies(body) {
    fetch(DASHBOARD_URL + "/api/messages/replies?messageId=" + state.messageId, {
      headers: { "x-api-key": API_KEY },
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.originalMessage) return;
        body.innerHTML = "";

        var original = document.createElement("div");
        original.className = "sc-msg mine";
        original.textContent = data.originalMessage.body;
        body.appendChild(original);

        (data.replies || []).forEach(function (reply) {
          var el = document.createElement("div");
          el.className = "sc-msg " + (reply.sender === "shop" ? "mine" : "theirs");
          el.textContent = reply.body;
          body.appendChild(el);
        });

        body.scrollTop = body.scrollHeight;
      })
      .catch(function () {});
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      if (panel.style.display !== "flex") return;
      var body = panel.querySelector("[data-thread]");
      if (body) fetchReplies(body);
    }, POLL_MS);
  }
})();
`;

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
};
