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
    ".tp-launcher:focus-visible,.tp-close:focus-visible,.tp-resize:focus-visible{outline:3px solid #e15a9a;outline-offset:3px}" +
    ".tp-logo{display:grid;width:108px;height:40px;padding:7px 8px;place-items:center;background:#fff;border-radius:999px}" +
    ".tp-logo img{display:block;width:91px;height:auto}" +
    ".tp-panel{position:relative;display:none;width:min(390px,calc(100vw - 28px));height:min(650px,calc(100vh - 90px));margin-bottom:12px;overflow:hidden;background:#fff;border:1px solid rgba(37,33,62,.14);border-radius:20px;box-shadow:0 28px 80px rgba(19,21,42,.28)}" +
    ".tp-panel[data-open=true]{display:block;animation:tp-pop .2s ease-out}" +
    ".tp-frame{display:block;width:100%;height:100%;border:0;background:#fbfaf8}" +
    ".tp-close{position:absolute;z-index:2;top:10px;display:grid;width:34px;height:34px;place-items:center;padding:0;color:#fff;background:#292f4c;border:1px solid rgba(255,255,255,.18);border-radius:9px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18)}" +
    ".tp-close-bottom-right{right:10px}.tp-close-bottom-left{left:10px}" +
    ".tp-close:hover{background:#b92f70}" +
    ".tp-close svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}" +
    ".tp-resize{position:absolute;z-index:3;top:0;display:grid;width:27px;height:27px;place-items:center;padding:0;color:#fff;background:#003b59;border:0;cursor:nwse-resize;touch-action:none}" +
    ".tp-resize-bottom-right{left:0;border-radius:19px 0 8px}.tp-resize-bottom-left{right:0;border-radius:0 19px 0 8px;cursor:nesw-resize}" +
    ".tp-resize span{width:10px;height:10px;border-top:2px solid currentColor;border-left:2px solid currentColor}" +
    ".tp-resize-bottom-left span{border-right:2px solid currentColor;border-left:0}" +
    ".tp-resize:hover{background:#7d4b8e}" +
    "@keyframes tp-pop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}" +
    "@media(max-width:560px){.tp-panel{position:fixed;inset:0;width:100vw!important;height:100dvh!important;margin:0;border:0;border-radius:0}.tp-resize{display:none}.tp-launcher{min-height:50px}}" +
    "@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}";

  var panel = document.createElement("div");
  panel.className = "tp-panel";
  panel.setAttribute("data-open", "false");

  var closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "tp-close tp-close-" + position;
  closeButton.setAttribute("aria-label", "Close The Place assistant");
  closeButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var resizeButton = document.createElement("button");
  resizeButton.type = "button";
  resizeButton.className = "tp-resize tp-resize-" + position;
  resizeButton.setAttribute(
    "aria-label",
    "Resize chat. Drag the corner, or use arrow keys while focused.",
  );
  resizeButton.title =
    "Resize chat. Drag the corner, or use arrow keys while focused.";
  resizeButton.innerHTML = '<span aria-hidden="true"></span>';

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

  function constrainPanelSize(width, height) {
    var maximumWidth = Math.max(280, Math.min(720, window.innerWidth - 36));
    var maximumHeight = Math.max(360, Math.min(860, window.innerHeight - 90));
    var minimumWidth = Math.min(300, maximumWidth);
    var minimumHeight = Math.min(420, maximumHeight);
    return {
      width: Math.round(Math.min(Math.max(width, minimumWidth), maximumWidth)),
      height: Math.round(
        Math.min(Math.max(height, minimumHeight), maximumHeight),
      ),
    };
  }

  function applyPanelSize(width, height) {
    var size = constrainPanelSize(width, height);
    panel.style.width = size.width + "px";
    panel.style.height = size.height + "px";
  }

  var resizeStart = null;
  resizeButton.addEventListener("pointerdown", function (event) {
    if (event.button !== 0 || window.innerWidth <= 560) return;
    var bounds = panel.getBoundingClientRect();
    resizeStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: bounds.width,
      height: bounds.height,
    };
    if (typeof resizeButton.setPointerCapture === "function") {
      resizeButton.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  });
  resizeButton.addEventListener("pointermove", function (event) {
    if (!resizeStart || resizeStart.pointerId !== event.pointerId) return;
    var widthDelta =
      position === "bottom-right"
        ? resizeStart.x - event.clientX
        : event.clientX - resizeStart.x;
    applyPanelSize(
      resizeStart.width + widthDelta,
      resizeStart.height + resizeStart.y - event.clientY,
    );
  });
  function stopResize(event) {
    if (!resizeStart || resizeStart.pointerId !== event.pointerId) return;
    resizeStart = null;
    if (typeof resizeButton.releasePointerCapture === "function") {
      resizeButton.releasePointerCapture(event.pointerId);
    }
  }
  resizeButton.addEventListener("pointerup", stopResize);
  resizeButton.addEventListener("pointercancel", stopResize);
  resizeButton.addEventListener("keydown", function (event) {
    var bounds = panel.getBoundingClientRect();
    var step = event.shiftKey ? 40 : 16;
    var width = bounds.width;
    var height = bounds.height;
    if (event.key === "ArrowRight") width += step;
    else if (event.key === "ArrowLeft") width -= step;
    else if (event.key === "ArrowUp") height += step;
    else if (event.key === "ArrowDown") height -= step;
    else return;
    event.preventDefault();
    applyPanelSize(width, height);
  });
  window.addEventListener("resize", function () {
    if (!panel.style.width || window.innerWidth <= 560) return;
    var bounds = panel.getBoundingClientRect();
    applyPanelSize(bounds.width, bounds.height);
  });

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
  panel.appendChild(resizeButton);
  panel.appendChild(closeButton);
  root.appendChild(style);
  root.appendChild(panel);
  root.appendChild(launcher);
  (document.body || document.documentElement).appendChild(host);
})();
