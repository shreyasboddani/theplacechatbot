(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || script.dataset.thePlaceLoaded === "true") return;
  script.dataset.thePlaceLoaded = "true";

  function validUrl(value) {
    try {
      var parsed = new URL(value, script.src);
      var local =
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]";
      if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  var scriptUrl = validUrl(script.src);
  if (!scriptUrl) return;
  var requestedUrl = script.getAttribute("data-chatbot-url");
  var chatbotUrl = validUrl(
    requestedUrl || new URL("/embed", scriptUrl.origin).toString(),
  );
  if (!chatbotUrl || chatbotUrl.origin !== scriptUrl.origin) {
    if (window.console && typeof window.console.warn === "function") {
      window.console.warn(
        "The Place chatbot loader: data-chatbot-url must use the loader's origin.",
      );
    }
    return;
  }

  var position =
    script.getAttribute("data-position") === "bottom-left"
      ? "bottom-left"
      : "bottom-right";
  var requestedTheme = script.getAttribute("data-theme");
  var theme =
    requestedTheme === "dark" || requestedTheme === "auto"
      ? requestedTheme
      : "light";
  var requestedLabel = (script.getAttribute("data-label") || "Ask The Place").trim();
  var label = requestedLabel.slice(0, 40) || "Ask The Place";

  chatbotUrl.searchParams.set("launcher", "hidden");
  chatbotUrl.searchParams.set("position", position);
  chatbotUrl.searchParams.set("theme", theme);

  var host = document.createElement("div");
  host.setAttribute("data-the-place-chatbot", "");
  host.style.position = "fixed";
  host.style.zIndex = "2147482000";
  host.style.bottom = "18px";
  host.style[position === "bottom-left" ? "left" : "right"] = "18px";
  host.style.fontFamily =
    'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  var root = host.attachShadow ? host.attachShadow({ mode: "closed" }) : host;
  var style = document.createElement("style");
  style.textContent =
    ":host{all:initial}" +
    "*,*::before,*::after{box-sizing:border-box}" +
    ".tp-launcher{display:flex;align-items:center;gap:10px;min-height:56px;padding:7px 20px 7px 7px;color:#fff;background:#003b59;border:1px solid rgba(255,255,255,.18);border-radius:999px;box-shadow:0 14px 38px rgba(0,59,89,.3);cursor:pointer;font:700 14px/1 system-ui,-apple-system,Segoe UI,sans-serif}" +
    ".tp-launcher:hover{transform:translateY(-2px)}" +
    ".tp-launcher:focus-visible,.tp-close:focus-visible{outline:3px solid #e15a9a;outline-offset:3px}" +
    ".tp-logo{display:grid;width:108px;height:40px;padding:7px 8px;place-items:center;background:#fff;border-radius:999px}" +
    ".tp-logo img{display:block;width:91px;height:auto}" +
    ".tp-panel{position:relative;display:none;width:min(390px,calc(100vw - 28px));height:min(650px,calc(100vh - 90px));margin-bottom:12px;overflow:hidden;background:#fff;border:1px solid rgba(37,33,62,.14);border-radius:20px;box-shadow:0 28px 80px rgba(19,21,42,.28)}" +
    ".tp-panel[data-open=true]{display:block;animation:tp-pop .2s ease-out}" +
    ".tp-frame{display:block;width:100%;height:100%;border:0;background:#fbfaf8}" +
    ".tp-close{position:absolute;z-index:2;top:10px;right:10px;display:grid;width:34px;height:34px;place-items:center;padding:0;color:#fff;background:#292f4c;border:1px solid rgba(255,255,255,.18);border-radius:9px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18)}" +
    ".tp-close:hover{background:#b92f70}" +
    ".tp-close svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}" +
    "@keyframes tp-pop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}" +
    "@media(max-width:560px){.tp-panel{position:fixed;inset:0;width:100vw;height:100dvh;margin:0;border:0;border-radius:0}.tp-launcher{min-height:50px}}" +
    "@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}";

  var panel = document.createElement("div");
  panel.className = "tp-panel";
  panel.setAttribute("data-open", "false");

  var closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "tp-close";
  closeButton.setAttribute("aria-label", "Close The Place assistant");
  closeButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var iframe = document.createElement("iframe");
  iframe.className = "tp-frame";
  iframe.title = "The Place information assistant";
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox",
  );
  iframe.src = chatbotUrl.toString();

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "tp-launcher";
  launcher.setAttribute("aria-label", "Open The Place assistant");
  launcher.setAttribute("aria-expanded", "false");
  var logo = document.createElement("span");
  logo.className = "tp-logo";
  var logoImage = document.createElement("img");
  logoImage.src = new URL(
    "/branding/the-place-logo.png",
    scriptUrl.origin,
  ).toString();
  logoImage.alt = "";
  logoImage.width = 171;
  logoImage.height = 32;
  logo.appendChild(logoImage);
  var labelSpan = document.createElement("span");
  labelSpan.textContent = label;
  launcher.appendChild(logo);
  launcher.appendChild(labelSpan);

  function setOpen(open) {
    panel.setAttribute("data-open", open ? "true" : "false");
    launcher.style.display = open ? "none" : "flex";
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      closeButton.focus();
    } else {
      launcher.focus();
    }
  }

  launcher.addEventListener("click", function () {
    setOpen(true);
  });
  closeButton.addEventListener("click", function () {
    setOpen(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && panel.getAttribute("data-open") === "true") {
      setOpen(false);
    }
  });

  panel.appendChild(iframe);
  panel.appendChild(closeButton);
  root.appendChild(style);
  root.appendChild(panel);
  root.appendChild(launcher);
  (document.body || document.documentElement).appendChild(host);
})();
