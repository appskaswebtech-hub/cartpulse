/* CartPulse — size guide button + modal. Product pages only. */
(function () {
  "use strict";

  var configEl = document.querySelector("[data-size-guide-config]");
  if (!configEl) return;

  var config;
  try {
    config = JSON.parse(configEl.textContent);
  } catch (e) {
    return;
  }
  if (!config || !config.handle) return;

  var CM_PER_INCH = 2.54;
  var chart = null;
  var unit = null;
  var loading = false;
  var failed = false;
  var overlay = null;

  document.documentElement.style.setProperty("--cp-sg-accent", config.accentColor || "#1D9E75");

  /* ---------- button placement ---------- */

  // Most specific anchor first; the merchant's own selector always wins.
  var ANCHORS = [
    config.anchorSelector,
    ".product-form__buttons",
    'form[action*="/cart/add"] [name="add"]',
    ".product-form__input",
    ".product__info-container .price",
    ".product-single__meta",
  ];

  function findAnchor() {
    for (var i = 0; i < ANCHORS.length; i++) {
      var selector = ANCHORS[i];
      if (!selector) continue;
      try {
        var el = document.querySelector(selector);
        if (el) return el;
      } catch (e) {
        /* a bad custom selector should never break the page */
      }
    }
    return null;
  }

  function buildTrigger() {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "cp-sg-trigger";
    button.setAttribute("data-cp-size-guide", "");
    button.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<path d="M3 7h18v10H3z"/><path d="M7 7v4M11 7v4M15 7v4M19 7v4"/></svg>' +
      "<span></span>";
    button.querySelector("span").textContent = config.buttonLabel || "Size guide";
    button.addEventListener("click", openModal);
    return button;
  }

  function placeButton() {
    if (document.querySelector("[data-cp-size-guide]")) return true;
    var anchor = findAnchor();
    if (!anchor) return false;
    var trigger = buildTrigger();
    anchor.parentNode.insertBefore(trigger, anchor);
    return true;
  }

  /* ---------- data ---------- */

  function loadChart() {
    if (chart || loading || failed) return Promise.resolve();
    loading = true;

    var url =
      config.proxyUrl +
      "?handle=" +
      encodeURIComponent(config.handle) +
      "&tags=" +
      encodeURIComponent((config.tags || []).join(",")) +
      "&collections=" +
      encodeURIComponent((config.collections || []).join(","));

    return fetch(url, { headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) throw new Error("no chart");
        return response.json();
      })
      .then(function (data) {
        chart = data && data.chart ? data.chart : null;
        if (chart) unit = chart.unitSystem === "in" ? "in" : "cm";
        loading = false;
      })
      .catch(function () {
        loading = false;
        failed = true;
      });
  }

  /* ---------- unit conversion ---------- */

  function convertCell(value, from, to) {
    if (from === to) return value;
    var factor = from === "cm" ? 1 / CM_PER_INCH : CM_PER_INCH;
    return String(value).replace(/\d+(\.\d+)?/g, function (match) {
      return String(Math.round(parseFloat(match) * factor * 10) / 10);
    });
  }

  /* ---------- modal ---------- */

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.className = "cp-sg-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="cp-sg-modal" role="dialog" aria-modal="true" aria-label="Size guide">' +
      '<div class="cp-sg-header"><h2 class="cp-sg-title"></h2>' +
      '<button type="button" class="cp-sg-close" aria-label="Close">&times;</button></div>' +
      '<div class="cp-sg-units"></div>' +
      '<div class="cp-sg-body"></div>' +
      "</div>";

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeModal();
    });
    overlay.querySelector(".cp-sg-close").addEventListener("click", closeModal);
    document.body.appendChild(overlay);
  }

  function renderUnits() {
    var wrap = overlay.querySelector(".cp-sg-units");
    wrap.innerHTML = "";
    if (!chart) return;

    ["cm", "in"].forEach(function (option) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "cp-sg-unit";
      button.textContent = option === "cm" ? "cm" : "in";
      button.setAttribute("aria-pressed", String(unit === option));
      button.addEventListener("click", function () {
        unit = option;
        renderUnits();
        renderBody();
      });
      wrap.appendChild(button);
    });
  }

  function renderBody() {
    var body = overlay.querySelector(".cp-sg-body");
    body.innerHTML = "";

    if (loading) {
      body.innerHTML = '<p class="cp-sg-state">Loading…</p>';
      return;
    }
    if (!chart) {
      body.innerHTML = '<p class="cp-sg-state">No size guide is available for this product.</p>';
      return;
    }

    var table = document.createElement("table");
    table.className = "cp-sg-table";

    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    chart.columns.forEach(function (column) {
      var th = document.createElement("th");
      th.textContent = column;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    chart.rows.forEach(function (row) {
      var tr = document.createElement("tr");
      chart.columns.forEach(function (_, index) {
        var td = document.createElement("td");
        var raw = row[index] == null ? "" : row[index];
        // The first column holds size labels, never measurements.
        td.textContent = index === 0 ? raw : convertCell(raw, chart.unitSystem, unit);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.appendChild(table);

    if (chart.description) {
      var note = document.createElement("p");
      note.className = "cp-sg-note";
      note.textContent = chart.description;
      body.appendChild(note);
    }
  }

  function render() {
    overlay.querySelector(".cp-sg-title").textContent =
      (chart && chart.name) || config.buttonLabel || "Size guide";
    renderUnits();
    renderBody();
  }

  function openModal() {
    if (!overlay) buildOverlay();
    overlay.hidden = false;
    document.addEventListener("keydown", onKeydown);
    render();
    loadChart().then(render);
  }

  function closeModal() {
    if (!overlay) return;
    overlay.hidden = true;
    document.removeEventListener("keydown", onKeydown);
  }

  function onKeydown(event) {
    if (event.key === "Escape") closeModal();
  }

  /* ---------- boot ---------- */

  function boot() {
    if (placeButton()) return;
    // Themes that render the product form late (or swap it on variant change).
    var observer = new MutationObserver(function () {
      if (placeButton()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () {
      observer.disconnect();
    }, 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
