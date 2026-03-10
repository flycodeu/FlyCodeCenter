const cleanupKey = "__jarvisRobotCleanup";
const expressionOrder = ["dot", "arc", "cross", "heart", "wink", "sleepy", "surprised", "focus", "angry", "loading"];
const primaryActions = ["wave", "nod", "pulse", "shake"];
const actionClasses = {
  wave: "is-waving",
  nod: "is-nodding",
  shake: "is-shaking",
  pulse: "is-pulsing",
  scan: "is-scanning"
};
const actionDurations = {
  wave: 1000,
  nod: 760,
  shake: 700,
  pulse: 800,
  scan: 980
};

const getPerfFlags = () => {
  const perfTier = document.documentElement.dataset.perf || "high";
  return {
    isLowPerf: perfTier === "low",
    isCompactViewport: window.matchMedia("(max-width: 900px)").matches
  };
};

const initJarvisOrb = () => {
  const host = document.getElementById("jarvis-bot");
  const trigger = document.getElementById("jarvis-bot-trigger");
  const status = document.getElementById("jarvis-bot-status");
  const menu = document.getElementById("jarvis-bot-menu");
  if (!(host instanceof HTMLElement) || !(trigger instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) {
    return () => {};
  }

  const { isLowPerf, isCompactViewport } = getPerfFlags();
  if (isLowPerf || isCompactViewport) {
    host.hidden = true;
    return () => {};
  }
  host.hidden = false;

  const eventNs = host.dataset.eventNamespace || "jarvis";
  const route = host.dataset.targetRoute || "/jarvis";
  const defaultText = host.dataset.defaultText || "已待命";
  const activeText = host.dataset.activeText || "连接中";
  const defaultState = host.dataset.defaultState || "idle";
  let expressionIndex = 0;
  let actionIndex = 0;
  let isMusicOn = false;
  let statusTimer = 0;
  let blinkTimer = 0;
  let actionTimer = 0;
  let longPressTimer = 0;
  let menuOpen = false;

  const setStatus = (text, timeout = 0) => {
    if (!(status instanceof HTMLElement)) return;
    status.textContent = String(text || "").trim() || defaultText;
    if (statusTimer) window.clearTimeout(statusTimer);
    if (timeout > 0) {
      statusTimer = window.setTimeout(() => {
        status.textContent = host.dataset.state === "active" ? activeText : defaultText;
      }, timeout);
    }
  };

  const emit = (name, detail) => {
    window.dispatchEvent(new CustomEvent(`${eventNs}:${name}`, { detail }));
  };

  const setState = (state, source = "orb") => {
    const next = state === "active" ? "active" : "idle";
    host.dataset.state = next;
    host.classList.toggle("is-active", next === "active");
    setStatus(next === "active" ? activeText : defaultText);
    emit("state-change", { state: next, source });
  };

  const setExpression = (name) => {
    if (!expressionOrder.includes(name)) return;
    host.dataset.expression = name;
    expressionIndex = expressionOrder.indexOf(name);
  };

  const nextExpression = () => {
    setExpression(expressionOrder[(expressionIndex + 1) % expressionOrder.length]);
  };

  const blink = () => {
    host.classList.add("is-blink");
    window.setTimeout(() => host.classList.remove("is-blink"), 170);
  };

  const scheduleBlink = () => {
    const baseDelay = isLowPerf ? 2800 : 1400;
    const randomJitter = isLowPerf ? 2600 : 2200;
    blinkTimer = window.setTimeout(() => {
      blink();
      scheduleBlink();
    }, baseDelay + Math.random() * randomJitter);
  };

  const clearActions = () => {
    if (actionTimer) window.clearTimeout(actionTimer);
    Object.values(actionClasses).forEach((className) => host.classList.remove(className));
  };

  const runAction = (actionId) => {
    const className = actionClasses[actionId];
    if (!className) return;
    clearActions();
    host.classList.add(className);
    actionTimer = window.setTimeout(() => {
      host.classList.remove(className);
    }, actionDurations[actionId] ?? 760);
    emit("action", { actionId, source: "orb" });
  };

  const openMenu = (x, y) => {
    const rect = menu.getBoundingClientRect();
    const left = Math.max(10, Math.min(x, window.innerWidth - (rect.width || 260) - 10));
    const top = Math.max(10, Math.min(y, window.innerHeight - (rect.height || 240) - 10));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.hidden = false;
    menuOpen = true;
  };

  const closeMenu = () => {
    if (!menuOpen) return;
    menu.hidden = true;
    menuOpen = false;
  };

  const handlers = {
    "start-chat": () => {
      setStatus("正在打开对话...", 1200);
      window.location.assign(route);
    },
    "toggle-music": () => {
      isMusicOn = !isMusicOn;
      host.classList.toggle("is-music-on", isMusicOn);
      setExpression(isMusicOn ? "heart" : "dot");
      setStatus(isMusicOn ? "音乐模式已开启（模拟）" : "音乐模式已关闭", 1600);
    },
    "wallpaper-next": () => {
      window.dispatchEvent(new CustomEvent("jarvis:wallpaper-next", { detail: { source: "orb" } }));
      setStatus("已切换到下一张壁纸", 1200);
    }
  };

  const runPrimary = () => {
    closeMenu();
    const action = primaryActions[actionIndex % primaryActions.length];
    actionIndex += 1;
    runAction(action);
    blink();
    nextExpression();
    setStatus(`执行动作：${action}`, 900);
  };

  const clearLongPress = () => {
    if (!longPressTimer) return;
    window.clearTimeout(longPressTimer);
    longPressTimer = 0;
  };

  const onMenuClick = (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("button[data-action]") : null;
    if (!(target instanceof HTMLButtonElement)) return;
    const action = String(target.dataset.action || "").trim();
    const handler = handlers[action];
    if (typeof handler === "function") {
      handler();
    }
    closeMenu();
  };

  const onPrimaryPointerDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    runPrimary();
  };

  const onTouchLongPressStart = (event) => {
    if (event.pointerType !== "touch") return;
    clearLongPress();
    longPressTimer = window.setTimeout(() => {
      openMenu(event.clientX, event.clientY);
    }, 460);
  };

  const onContextMenu = (event) => {
    event.preventDefault();
    openMenu(event.clientX, event.clientY);
  };

  const onDocumentPointerDown = (event) => {
    const target = event.target;
    if (target instanceof Node && (host.contains(target) || menu.contains(target))) return;
    closeMenu();
  };

  const onDocumentKeydown = (event) => {
    if (event.key === "Escape") closeMenu();
  };

  const onSpeak = (event) => {
    if (!(event instanceof CustomEvent)) return;
    const text = String(event.detail?.text || "").trim();
    if (text) setStatus(text, 2100);
  };

  const onWallpaperUpdated = (event) => {
    if (!(event instanceof CustomEvent)) return;
    const name = String(event.detail?.name || "").trim();
    if (name) setStatus(`壁纸已切换：${name}`, 1400);
  };

  trigger.addEventListener("pointerdown", onPrimaryPointerDown);
  trigger.addEventListener("pointerdown", onTouchLongPressStart);
  trigger.addEventListener("pointerup", clearLongPress);
  trigger.addEventListener("pointercancel", clearLongPress);
  trigger.addEventListener("pointermove", clearLongPress);
  host.addEventListener("contextmenu", onContextMenu);
  menu.addEventListener("click", onMenuClick);
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  document.addEventListener("keydown", onDocumentKeydown);
  window.addEventListener(`${eventNs}:speak`, onSpeak);
  window.addEventListener("jarvis:wallpaper-updated", onWallpaperUpdated);

  setState(defaultState, "orb-init");
  scheduleBlink();

  return () => {
    clearLongPress();
    clearActions();
    if (statusTimer) window.clearTimeout(statusTimer);
    if (blinkTimer) window.clearTimeout(blinkTimer);
    trigger.removeEventListener("pointerdown", onPrimaryPointerDown);
    trigger.removeEventListener("pointerdown", onTouchLongPressStart);
    trigger.removeEventListener("pointerup", clearLongPress);
    trigger.removeEventListener("pointercancel", clearLongPress);
    trigger.removeEventListener("pointermove", clearLongPress);
    host.removeEventListener("contextmenu", onContextMenu);
    document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    document.removeEventListener("keydown", onDocumentKeydown);
    window.removeEventListener(`${eventNs}:speak`, onSpeak);
    window.removeEventListener("jarvis:wallpaper-updated", onWallpaperUpdated);
    menu.removeEventListener("click", onMenuClick);
  };
};

export function bootJarvisOrb() {
  if (typeof window[cleanupKey] === "function") {
    window[cleanupKey]();
  }
  window[cleanupKey] = initJarvisOrb();
}

if (!window.__flyJarvisOrbLifecycleBound) {
  window.__flyJarvisOrbLifecycleBound = true;
  document.addEventListener("astro:before-swap", () => {
    if (typeof window[cleanupKey] === "function") {
      window[cleanupKey]();
      window[cleanupKey] = null;
    }
  });
}
