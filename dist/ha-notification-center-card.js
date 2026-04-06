/**
 * UNiNUS Notification Center — Lovelace Custom Card
 * Copyright 2026 ivanlee1007
 * Licensed under the Apache License, Version 2.0
 */
const NOTIFICATION_CARD_I18N = {
  en: {
    notifications: "NOTIFICATIONS",
    critical: "Critical",
    warning: "Warning",
    info: "Info",
    noNotifications: "No notifications",
    acknowledge: "Acknowledge",
    acknowledged: "Acknowledged",
    snooze: "SNOOZE:",
    tomorrow: "Tomorrow",
    dayAfter: "Day after",
    ackTitle: "Acknowledge",
    snoozeTitle: "Snooze",
    moreActions: "More actions",
    moreInfo: "More Info",
    clear: "Clear",
    now: "now",
    minutesAgo: (n) => `${n}m`,
    hoursAgo: (n) => `${n}h`,
    daysAgo: (n) => `${n}d`,
  },
  "zh-Hant": {
    notifications: "告警訊息",
    critical: "緊急",
    warning: "警告",
    info: "資訊",
    noNotifications: "目前沒有通知",
    acknowledge: "確認",
    acknowledged: "已確認",
    snooze: "稍後提醒：",
    tomorrow: "明天",
    dayAfter: "後天",
    ackTitle: "確認",
    snoozeTitle: "稍後提醒",
    moreActions: "更多操作",
    moreInfo: "更多資訊",
    clear: "清除",
    now: "剛剛",
    minutesAgo: (n) => `${n} 分鐘前`,
    hoursAgo: (n) => `${n} 小時前`,
    daysAgo: (n) => `${n} 天前`,
  },
};

function getNotificationCardLang(hass) {
  const raw = String(hass?.locale?.language || hass?.language || navigator.language || "en").toLowerCase();
  if (raw.startsWith("zh-tw") || raw.startsWith("zh-hant") || raw.startsWith("zh-hk") || raw.startsWith("zh-mo")) {
    return "zh-Hant";
  }
  return "en";
}

function notificationCardT(hass, key) {
  const lang = getNotificationCardLang(hass);
  return NOTIFICATION_CARD_I18N[lang]?.[key] ?? NOTIFICATION_CARD_I18N.en[key] ?? key;
}

function notificationCardTimeAgo(hass, ts) {
  const t = (key) => notificationCardT(hass, key);
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 0) return t("now");
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("now");
  if (m < 60) return t("minutesAgo")(m);
  const h = Math.floor(m / 60);
  if (h < 24) return t("hoursAgo")(h);
  const d = Math.floor(h / 24);
  return t("daysAgo")(d);
}

class HaNotificationCenterCard extends HTMLElement {
  disconnectedCallback() {
    if (this._clickOutsideHandler) {
      document.removeEventListener("click", this._clickOutsideHandler, true);
      this._clickOutsideHandler = null;
    }
  }

  setConfig(config) {
    this._config = {
      show_chip: true,
      show_panel: true,
      default_open: false,
      auto_open_critical: false,
      always_expand: false,
      max_items: 50,
      entity: "sensor.notification_feed",
      critical_entity: "binary_sensor.notification_any_critical",
      button_label: "",
      ...config,
    };
  }

  static getConfigElement() {
    return document.createElement("ha-notification-center-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:ha-notification-center-card",
      entity: "sensor.notification_feed",
      critical_entity: "binary_sensor.notification_any_critical",
      show_chip: true,
      show_panel: true,
      default_open: false,
      auto_open_critical: false,
      always_expand: false,
      max_items: 20,
      button_label: "",
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._syncOpenState();
    const renderKey = this._buildRenderKey();
    if (renderKey !== this._lastRenderKey) {
      this._lastRenderKey = renderKey;
      this._render();
    }
  }

  getCardSize() {
    const feed = this._hass?.states?.[this._config.entity];
    return feed?.state > 0 ? 5 : 2;
  }

  _buildRenderKey() {
    if (!this._hass || !this._config) return "init";
    const feed = this._hass.states?.[this._config.entity];
    const anyCritical = this._hass.states?.[this._config.critical_entity];
    return JSON.stringify({
      feedState: feed?.state ?? null,
      criticalState: anyCritical?.state ?? null,
      notifications: feed?.attributes?.notifications || [],
      maxItems: this._config.max_items ?? 50,
      showPanel: this._config.show_panel !== false,
      showChip: this._config.show_chip !== false,
      defaultOpen: this._config.default_open === true,
      autoOpenCritical: this._config.auto_open_critical === true,
      alwaysExpand: this._config.always_expand === true,
      buttonLabel: this._config.button_label || "",
      open: this._dropdownOpen === true,
      expandedActions: this._expandedActions || null,
    });
  }

  _toggleActions(sourceId) {
    this._expandedActions = this._expandedActions === sourceId ? null : sourceId;
    this._render();
  }

  _syncOpenState() {
    if (!this._hass || !this._config) return;
    const feed = this._hass.states?.[this._config.entity];
    const anyCritical = this._hass.states?.[this._config.critical_entity];
    const count = feed ? parseInt(feed.state) || 0 : 0;
    const hasItems = count > 0;
    const isCritical = anyCritical?.state === "on";

    if (this._openStateInitialized !== true) {
      this._openStateInitialized = true;
      if (this._config.auto_open_critical === true && isCritical && hasItems) {
        this._dropdownOpen = true;
      } else if (this._config.default_open === true) {
        this._dropdownOpen = true;
      } else if (typeof this._dropdownOpen !== "boolean") {
        this._dropdownOpen = false;
      }
    } else if (this._config.auto_open_critical === true && isCritical && this._lastCriticalState !== true && hasItems) {
      this._dropdownOpen = true;
    }

    this._lastCriticalState = isCritical;
  }

  _render() {
    if (!this._hass) return;

    const feed = this._hass.states[this._config.entity];
    const anyCritical = this._hass.states[this._config.critical_entity];
    const count = feed ? parseInt(feed.state) || 0 : 0;
    const isCritical = anyCritical?.state === "on";
    const buttonLabel = String(this._config.button_label || "").trim();
    const hasButtonLabel = buttonLabel.length > 0;
    const notifications = feed?.attributes?.notifications || [];
    const dropdownOpen = this._dropdownOpen === true;
    const t = (key) => notificationCardT(this._hass, key);

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    const priorityOrder = { critical: 0, warning: 1, info: 2 };
    const sorted = [...notifications].sort(
      (a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
    );
    const items = sorted.slice(0, this._config.max_items);

    const iconMap = {
      critical: "mdi:alert-circle",
      warning: "mdi:alert",
      info: "mdi:information",
    };

    const listEl = this.shadowRoot?.querySelector?.(".notif-list");
    const prevScrollTop = listEl ? listEl.scrollTop : 0;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: var(--ha-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif); }

        /* ══ Card ══ */
        .card {
          background: var(--card-background-color, #fff);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.08);
        }

        /* ══ Header ══ */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        .header-left { flex: 1; }
        .title {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--primary-text-color, #212121);
          margin-bottom: 10px;
        }
        .legend { display: flex; gap: 14px; }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 500;
          color: var(--secondary-text-color, #727272);
        }
        .legend-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .legend-dot.critical { background: #db4437; }
        .legend-dot.warning  { background: #ff9800; }
        .legend-dot.info     { background: #2196f3; }

        /* ══ Bell Button ══ */
        .bell-btn {
          position: relative;
          min-width: 52px; height: 52px;
          padding: 0 ${hasButtonLabel ? "16px" : "0"};
          border-radius: 14px;
          background: #db4437;
          display: inline-flex; align-items: center; justify-content: center;
          gap: ${hasButtonLabel ? "8px" : "0"};
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(219,68,55,0.35);
          transition: transform 0.15s;
          border: none; outline: none;
          flex-shrink: 0;
          box-sizing: border-box;
        }
        .bell-btn:hover { transform: scale(1.06); }
        .bell-btn ha-icon { --mdc-icon-size: 26px; color: #fff; flex-shrink: 0; }
        .bell-label {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          line-height: 1;
        }
        .bell-badge {
          position: absolute;
          top: -7px; right: -7px;
          min-width: 22px; height: 22px;
          border-radius: 11px;
          background: #2196f3;
          color: #fff;
          font-size: 12px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          padding: 0 6px;
          box-shadow: 0 2px 8px rgba(33,150,243,0.45);
        }
        .bell-btn.critical { animation: pulse 2s infinite; }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 4px 14px rgba(219,68,55,0.35); }
          50% { box-shadow: 0 4px 22px rgba(219,68,55,0.6); }
        }

        /* ══ Panel ══ */
        .panel { margin-top: 16px; }
        

        /* ══ Notification List ══ */
        .notif-list {
          max-height: 420px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.15) transparent;
        }
        .notif-list::-webkit-scrollbar { width: 7px; }
        .notif-list::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.15);
          border-radius: 4px;
        }

        /* ══ Notification Item ══ */
        .notif-item {
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          flex-wrap: wrap;
        }
        .notif-item:last-child { margin-bottom: 0; }
        .notif-item.pri-critical { background: color-mix(in srgb, #db4437 10%, var(--card-background-color, #fff)); }
        .notif-item.pri-warning  { background: color-mix(in srgb, #ff9800 10%, var(--card-background-color, #fff)); }
        .notif-item.pri-info     { background: color-mix(in srgb, #2196f3 10%, var(--card-background-color, #fff)); }
        .notif-item.ack { opacity: 0.45; }

        /* ── Square icon box ── */
        .icon-box {
          width: 42px; height: 42px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .pri-critical .icon-box { background: #db4437; }
        .pri-warning  .icon-box { background: #ff9800; }
        .pri-info     .icon-box { background: #2196f3; }
        .icon-box ha-icon { --mdc-icon-size: 22px; color: #fff; }

        /* ── Body ── */
        .body {
          flex: 1;
          min-width: 0;
        }
        .name {
          font-size: 15px; font-weight: 700;
          color: var(--primary-text-color, #212121);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .desc {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-top: 4px;
          line-height: 1.45;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* ── Time ── */
        .notif-time {
          font-size: 11px;
          color: var(--secondary-text-color, #9e9e9e);
          white-space: nowrap;
          display: block;
        }

        /* ── Actions ── */
        .item-tools {
          flex-shrink: 0;
          align-self: flex-start;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        .more-btn {
          padding: 4px 10px;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.52);
          color: var(--secondary-text-color, #6f6f6f);
          font-size: 10px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .more-btn:hover {
          background: rgba(255,255,255,0.76);
          border-color: rgba(0,0,0,0.12);
          color: var(--primary-text-color, #212121);
        }
        .more-panel {
          width: 100%;
          display: grid;
          gap: 8px;
          padding-top: 10px;
          margin-top: 8px;
          border-top: 1px solid rgba(0,0,0,0.05);
          opacity: 0.88;
        }
        .ack-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .snooze-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex-wrap: wrap;
        }
        .snooze-label {
          font-size: 10px; font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--secondary-text-color, #727272);
          padding-top: 5px;
          flex: 0 0 auto;
        }
        .snooze-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          flex: 1 1 220px;
          min-width: 0;
        }
        .snooze-btn, .ack-btn, .clear-btn, .action-btn, .more-info-btn {
          padding: 3px 10px;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.58);
          color: var(--secondary-text-color, #616161);
          font-size: 10px; font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          box-shadow: none;
        }
        .snooze-btn:hover, .ack-btn:hover, .clear-btn:hover, .more-info-btn:hover {
          background: rgba(255,255,255,0.8);
          border-color: rgba(0,0,0,0.12);
          color: var(--primary-text-color, #212121);
        }
        .ack-btn {
          font-weight: 500;
          border-color: rgba(76, 175, 80, 0.14);
          background: rgba(76, 175, 80, 0.045);
          color: #2f6f33;
        }
        .ack-btn:hover {
          border-color: rgba(76, 175, 80, 0.22);
          background: rgba(76, 175, 80, 0.08);
          color: #1b5e20;
        }
        .clear-btn {
          border-color: rgba(244, 67, 54, 0.14);
          background: rgba(244, 67, 54, 0.045);
          color: #c62828;
        }
        .clear-btn:hover {
          border-color: rgba(244, 67, 54, 0.22);
          background: rgba(244, 67, 54, 0.08);
          color: #b71c1c;
        }
        .action-btn, .more-info-btn {
          border-color: rgba(33,150,243,0.18);
          background: rgba(33,150,243,0.05);
          color: #1565c0;
        }
        .action-btn:hover {
          background: rgba(255,255,255,0.8);
          border-color: rgba(33,150,243,0.6);
          color: #0d47a1;
        }

        /* ── Action Detail Row ── */
        .action-detail-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 4px 4px 0;
          border-top: 1px solid rgba(0,0,0,0.05);
          margin-top: 2px;
        }
        .action-detail-text {
          font-size: 10px;
          color: var(--secondary-text-color, #9e9e9e);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .action-detail-text .action-type {
          color: var(--primary-text-color, #212121);
          font-weight: 500;
        }

        /* ── Empty ── */
        .empty {
          padding: 40px 16px;
          text-align: center;
          color: var(--secondary-text-color, #727272);
          font-size: 14px;
        }
      </style>

      <div class="card">
        <div class="header">
          <div class="header-left">
            <div class="title">${t("notifications")}</div>
            <div class="legend">
              <div class="legend-item"><div class="legend-dot critical"></div>${t("critical")}</div>
              <div class="legend-item"><div class="legend-dot warning"></div>${t("warning")}</div>
              <div class="legend-item"><div class="legend-dot info"></div>${t("info")}</div>
            </div>
          </div>
          <div class="bell-btn ${isCritical ? "critical" : ""}" id="bell">
            <ha-icon icon="${isCritical ? "mdi:alert-circle" : "mdi:bell"}"></ha-icon>
            ${hasButtonLabel ? `<span class="bell-label">${this._esc(buttonLabel)}</span>` : ""}
            ${count > 0 ? `<div class="bell-badge">${count}</div>` : ""}
          </div>
        </div>

        <div class="panel" id="panel" style="display:${(this._config.show_panel !== false && (dropdownOpen || this._config.always_expand === true) ? "block" : "none")}">
          ${count === 0
            ? `<div class="empty">${t("noNotifications")}</div>`
            : `<div class="notif-list">${items.map(n => {
                const pri = n.priority || "info";
                const icon = n.icon || iconMap[pri] || "mdi:bell";
                const isActionsOpen = this._expandedActions === n.source_id;
                return `
                  <div class="notif-item pri-${pri} ${n.acknowledged ? "ack" : ""}" data-entity="${n.tap_action_entity || ""}" data-source="${n.source_id}" data-tap-action="${n.tap_action || "more-info"}" data-tap-nav-path="${n.tap_action_navigation_path || ""}" data-tap-url-path="${n.tap_action_url_path || ""}" data-tap-svc-domain="${n.tap_action_service_domain || ""}" data-tap-svc="${n.tap_action_service || ""}" data-tap-svc-data='${JSON.stringify(n.tap_action_service_data || {})}'>
                    <div class="icon-box"><ha-icon icon="${icon}"></ha-icon></div>
                    <div class="body">
                      <div class="name">${this._esc(n.name)}</div>
                      ${n.description ? `<div class="desc">${this._esc(n.description)}</div>` : ""}
                    </div>
                    <div class="item-tools">
                      <span class="notif-time">${n.timestamp ? notificationCardTimeAgo(this._hass, n.timestamp) : ""}</span>
                      <button class="more-btn" data-source="${n.source_id}" aria-expanded="${isActionsOpen ? "true" : "false"}">${t("moreActions")}</button>
                    </div>
                    <div class="more-panel" style="display:${isActionsOpen ? "grid" : "none"}">
                      <div class="ack-row">
                        <button class="ack-btn" data-source="${n.source_id}" ${n.acknowledged ? "disabled" : ""}>${n.acknowledged ? t("acknowledged") : t("acknowledge")}</button>
                        ${(!(n.tap_action && n.tap_action !== "more-info")) ? `<button class="more-info-btn" data-source="${n.source_id}" data-entity="${n.tap_action_entity || ""}">${t("moreInfo")}</button>` : ""}
                        ${n.type === "manual" ? `<button class="clear-btn" data-source="${n.source_id}">${t("clear")}</button>` : ""}
                      </div>
                      ${(n.tap_action && n.tap_action !== "more-info") ? `<div class="action-detail-row">
                        <div class="action-detail-text">${this._getActionDetailText(n)}</div>
                        <button class="action-btn" data-source="${n.source_id}">執行</button>
                      </div>` : ""}
                      <div class="snooze-row">
                        <span class="snooze-label">${t("snooze")}</span>
                        <div class="snooze-actions">
                          <button class="snooze-btn" data-hours="1">1h</button>
                          <button class="snooze-btn" data-hours="4">4h</button>
                          <button class="snooze-btn" data-hours="24">${t("tomorrow")}</button>
                          <button class="snooze-btn" data-hours="48">${t("dayAfter")}</button>
                        </div>
                      </div>
                    </div>
                  </div>`;
              }).join("")}</div>`
          }
        </div>
      </div>
    `;

    // ── Events ──
    const bell = this.shadowRoot.getElementById("bell");
    if (bell) {
      bell.onclick = (e) => {
        e.stopPropagation();
        if (this._config.always_expand !== true) {
          this._dropdownOpen = !this._dropdownOpen;
          if (!this._dropdownOpen) this._expandedActions = null;
          this._render();
        }
      };
    }

    if (this._clickOutsideHandler) {
      document.removeEventListener("click", this._clickOutsideHandler, true);
    }
    this._clickOutsideHandler = (e) => {
      const bellEl = this.shadowRoot?.getElementById("bell");
      const panelEl = this.shadowRoot?.getElementById("panel");
      const path = e.composedPath ? e.composedPath() : [];
      if (
        this._dropdownOpen &&
        bellEl &&
        panelEl &&
        !path.includes(bellEl) &&
        !path.includes(panelEl) &&
        this._config.always_expand !== true
      ) {
        this._dropdownOpen = false;
        this._expandedActions = null;
        this._render();
      }
    };
    setTimeout(() => document.addEventListener("click", this._clickOutsideHandler, true), 0);

    this.shadowRoot.querySelectorAll(".more-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sourceId = btn.dataset.source;
        if (sourceId) this._toggleActions(sourceId);
      };
    });

    this.shadowRoot.querySelectorAll(".ack-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sourceId = btn.dataset.source;
        if (sourceId && !btn.disabled) {
          this._hass.callService("ha_notification_center", "acknowledge", { source_id: sourceId });
          this._expandedActions = null;
          this._render();
        }
      };
    });

    this.shadowRoot.querySelectorAll(".action-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sourceId = btn.dataset.source;
        const notifItem = this.shadowRoot.querySelector(`.notif-item[data-source="${sourceId}"]`);
        if (!notifItem || !this._hass) return;
        const tapAction = notifItem.dataset.tapAction || "more-info";
        const entity = notifItem.dataset.entity || "";
        const navPath = notifItem.dataset.tapNavPath || "";
        const urlPath = notifItem.dataset.tapUrlPath || "";
        const svcDomain = notifItem.dataset.tapSvcDomain || "";
        const svc = notifItem.dataset.tapSvc || "";
        let svcData = {};
        try { svcData = JSON.parse(notifItem.dataset.tapSvcData || "{}"); } catch (e) {}
        if (tapAction === "url" && urlPath) {
          window.open(urlPath, "_blank");
        } else if (tapAction === "navigate" && navPath) {
          this._hass.navigatePath(navPath);
        } else if ((tapAction === "call_service" || tapAction === "more-info") && sourceId && this._hass) {
          this._hass.callService("ha_notification_center", "execute_tap_action", { source_id: sourceId });
        }
      };
    });

    this.shadowRoot.querySelectorAll(".more-info-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sourceId = btn.dataset.source;
        const entityId = btn.dataset.entity || "";
        if (entityId && this._hass) {
          this.fireEvent("hass-more-info", { entityId: entityId });
        }
      };
    });

    this.shadowRoot.querySelectorAll(".clear-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sourceId = btn.dataset.source;
        if (sourceId) {
          this._hass.callService("ha_notification_center", "clear_notification", { source_id: sourceId });
          this._expandedActions = null;
          this._render();
        }
      };
    });

    this.shadowRoot.querySelectorAll(".snooze-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sourceId = btn.closest(".notif-item")?.dataset.source;
        if (sourceId) {
          this._hass.callService("ha_notification_center", "snooze", {
            source_id: sourceId,
            duration_hours: parseInt(btn.dataset.hours),
          });
          this._expandedActions = null;
          this._render();
        }
      };
    });

    // Event delegation for notification body clicks (survives DOM rebuilds)
    if (!this._bodyClickBound) {
      this._bodyClickBound = true;
      this.shadowRoot.addEventListener("click", (ev) => {
        // Body/icon click → more-info only (action moved to dedicated button)
        const item = ev.target.closest(".notif-item .body, .notif-item .icon-box, .notif-item .name");
        if (!item) return;
        const notifItem = item.closest(".notif-item");
        if (!notifItem) return;
        ev.stopPropagation();
        const entity = notifItem.dataset.entity || "";
        if (entity && this._hass) {
          this.fireEvent("hass-more-info", { entityId: entity });
        }
      });
    }
    // Set cursor pointer on body elements
    this.shadowRoot.querySelectorAll(".notif-item .body").forEach((el) => {
      el.style.cursor = "pointer";
    });

    const nextListEl = this.shadowRoot.querySelector(".notif-list");
    if (nextListEl && prevScrollTop > 0) {
      nextListEl.scrollTop = prevScrollTop;
    }

    this._lastRenderKey = this._buildRenderKey();
  }

  _getActionDetailText(n) {
    if (n.tap_action === "call_service") {
      const actions = n.tap_action_action || [];
      if (actions.length > 0) {
        const a0 = actions[0];
        const actName = a0.action || "?";
        const entities = (a0.target && a0.target.entity_id) ? a0.target.entity_id.join(", ") : (a0.target && a0.target.entity_id ? a0.target.entity_id : "");
        return `<span class="action-type">類型: 執行服務</span> 動作: ${actName} 目標: ${entities || "-"}`;
      }
      return `<span class="action-type">類型: 執行服務</span> (無動作資訊)`;
    }
    if (n.tap_action === "url") {
      try {
        const u = new URL(n.tap_action_url_path.startsWith("http") ? n.tap_action_url_path : "http://" + n.tap_action_url_path);
        return `<span class="action-type">類型: 開啟連結</span> 網址: ${u.hostname}${u.pathname.length > 16 ? u.pathname.substring(0,16)+"…" : u.pathname}`;
      } catch { return `<span class="action-type">類型: 開啟連結</span> 網址: ${n.tap_action_url_path || "?"}`; }
    }
    if (n.tap_action === "navigate") {
      return `<span class="action-type">類型: 導航</span> 路徑: ${n.tap_action_navigation_path || "?"}`;
    }
    return `<span class="action-type">類型: ${n.tap_action || "?"}</span>`;
  }
  _getTapActionLabel(n) {
    if (n.tap_action_service_domain && n.tap_action_service) {
      return n.tap_action_service_domain + "." + n.tap_action_service;
    }
    if (n.tap_action_service) return n.tap_action_service;
    if (n.tap_action_url_path) {
      try {
        const u = new URL(n.tap_action_url_path.startsWith("http") ? n.tap_action_url_path : "http://" + n.tap_action_url_path);
        return u.hostname + (u.pathname.length > 12 ? u.pathname.substring(0, 12) + "…" : u.pathname);
      } catch { return n.tap_action_url_path.length > 15 ? n.tap_action_url_path.substring(0, 15) + "…" : n.tap_action_url_path; }
    }
    if (n.tap_action_navigation_path) return "→ " + n.tap_action_navigation_path.split("/").pop();
    return "執行 " + (n.name || "?");
  }

  _esc(str) {
    if (!str) return "";
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
  }

  fireEvent(type, detail, options) {
    const event = new Event(type, {
      bubbles: options?.bubbles ?? true,
      cancelable: options?.cancelable ?? true,
      composed: options?.composed ?? true
    });
    event.detail = detail;
    this.dispatchEvent(event);
  }

}

class HaNotificationCenterCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      type: "custom:ha-notification-center-card",
      entity: "sensor.notification_feed",
      critical_entity: "binary_sensor.notification_any_critical",
      show_chip: true,
      show_panel: true,
      default_open: false,
      auto_open_critical: false,
      always_expand: false,
      max_items: 20,
      button_label: "",
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._syncForms();
  }

  _sourceSchema() {
    return [
      {
        name: "entity",
        selector: { entity: { domain: "sensor" } },
      },
      {
        name: "critical_entity",
        selector: { entity: { domain: "binary_sensor" } },
      },
    ];
  }

  _displaySchema() {
    return [
      {
        name: "button_label",
        selector: { text: {} },
      },
      {
        name: "show_chip",
        selector: { boolean: {} },
      },
      {
        name: "show_panel",
        selector: { boolean: {} },
      },
      {
        name: "default_open",
        selector: { boolean: {} },
      },
      {
        name: "auto_open_critical",
        selector: { boolean: {} },
      },
      {
        name: "always_expand",
        selector: { boolean: {} },
      },
      {
        name: "auto_open_critical",
        selector: { boolean: {} },
      },
      {
        name: "max_items",
        selector: { number: { min: 1, max: 100, step: 1, mode: "box" } },
      },
    ];
  }

  _labels() {
    return {
      entity: "通知 feed 實體",
      critical_entity: "Critical 狀態實體",
      button_label: "按鈕文字（選填）",
      show_chip: "顯示 bell/chip 按鈕",
      show_panel: "允許展開通知面板",
      default_open: "預設展開卡片",
      auto_open_critical: "有緊急事件時自動展開",
      always_expand: "永遠展開卡片",
      max_items: "最多顯示筆數",
    };
  }

  _handleValueChanged(ev) {
    const value = ev.detail?.value;
    if (!value) return;
    this._config = {
      ...this._config,
      ...value,
    };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  _ensureEditor() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    if (this._initialized) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .wrap {
          display: grid;
          gap: 16px;
        }
        .section {
          display: grid;
          gap: 10px;
          padding: 16px;
          border-radius: 16px;
          background: var(--secondary-background-color, rgba(127,127,127,0.08));
        }
        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--primary-text-color);
        }
        .section-desc {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }
        .hint {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }
      </style>
      <div class="wrap">
        <div class="section">
          <div class="section-title">資料來源</div>
          <div class="section-desc">設定卡片要讀哪個 feed sensor 與 critical 狀態 binary sensor。多數情況保留預設即可。</div>
          <ha-form id="source-form"></ha-form>
        </div>
        <div class="section">
          <div class="section-title">顯示選項</div>
          <div class="section-desc">控制 bell/chip、展開面板、預設展開策略與顯示筆數。若只想在 icon 旁顯示文字，可填「按鈕文字」。</div>
          <ha-form id="display-form"></ha-form>
        </div>
        <div class="hint">這是 HA 原生 visual editor；你仍然可以切回 YAML 直接編輯。</div>
      </div>
    `;

    this._sourceForm = this.shadowRoot.getElementById("source-form");
    this._displayForm = this.shadowRoot.getElementById("display-form");

    this._sourceForm.addEventListener("value-changed", (ev) => this._handleValueChanged(ev));
    this._displayForm.addEventListener("value-changed", (ev) => this._handleValueChanged(ev));

    this._initialized = true;
  }

  _syncForms() {
    if (!this._initialized || !this._config) return;

    const computeLabel = (schema) => this._labels()[schema.name] || schema.name;

    this._sourceForm.hass = this._hass;
    this._sourceForm.schema = this._sourceSchema();
    this._sourceForm.data = this._config;
    this._sourceForm.computeLabel = computeLabel;

    this._displayForm.hass = this._hass;
    this._displayForm.schema = this._displaySchema();
    this._displayForm.data = this._config;
    this._displayForm.computeLabel = computeLabel;
  }

  _render() {
    if (!this._config) return;
    this._ensureEditor();
    this._syncForms();
  }
}

if (!customElements.get("ha-notification-center-card")) {
  customElements.define("ha-notification-center-card", HaNotificationCenterCard);
}
if (!customElements.get("ha-notification-center-card-editor")) {
  customElements.define("ha-notification-center-card-editor", HaNotificationCenterCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "custom:ha-notification-center-card")) {
  window.customCards.push({
    type: "custom:ha-notification-center-card",
    name: "UNiNUS Notification Center",
    description: "通知中心面板 — 含 snooze 功能",
    preview: true,
  });
}

/**
 * Bundled companion card so the primary HACS resource also registers
 * `custom:notification-chip-card`. Users no longer need to add a second
 * Lovelace resource manually.
 */

class NotificationChipCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      label: "",
      default_open: false,
      auto_open_critical: false,
      ...config,
    };
    this.attachShadow({ mode: "open" });
    this._expandedActions = null;
    this._clickOutsideHandler = null;
  }

  static getConfigElement() {
    return document.createElement("notification-chip-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:notification-chip-card",
      entity: "sensor.notification_feed",
      label: "",
      default_open: false,
      auto_open_critical: false,
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._syncOpenState();
    const renderKey = this._buildRenderKey();
    if (renderKey !== this._lastRenderKey) {
      this._lastRenderKey = renderKey;
      this._render();
    }
  }

  disconnectedCallback() {
    if (this._clickOutsideHandler) {
      document.removeEventListener("click", this._clickOutsideHandler, true);
      this._clickOutsideHandler = null;
    }
  }

  _currentNotifications() {
    const entity = this._hass?.states?.[this._config?.entity || "sensor.notification_feed"];
    return entity?.attributes?.notifications || [];
  }

  _buildRenderKey() {
    if (!this._hass || !this._config) return "init";
    const entity = this._hass.states[this._config.entity || "sensor.notification_feed"];
    return JSON.stringify({
      entityState: entity?.state ?? null,
      notifications: entity?.attributes?.notifications || [],
      label: this._config.label || "",
      defaultOpen: this._config.default_open === true,
      autoOpenCritical: this._config.auto_open_critical === true,
      open: this._dropdownOpen === true,
      expandedActions: this._expandedActions || null,
    });
  }

  _syncOpenState() {
    if (!this._hass || !this._config) return;
    const entity = this._hass.states[this._config.entity || "sensor.notification_feed"];
    const notifications = entity?.attributes?.notifications || [];
    const hasItems = (parseInt(entity?.state, 10) || 0) > 0;
    const hasCritical = notifications.some((item) => item.priority === "critical");

    if (this._openStateInitialized !== true) {
      this._openStateInitialized = true;
      if (this._config.auto_open_critical === true && hasCritical && hasItems) {
        this._dropdownOpen = true;
      } else if (this._config.default_open === true) {
        this._dropdownOpen = true;
      } else if (typeof this._dropdownOpen !== "boolean") {
        this._dropdownOpen = false;
      }
    } else if (this._config.auto_open_critical === true && hasCritical && this._lastHasCritical !== true && hasItems) {
      this._dropdownOpen = true;
    }

    this._lastHasCritical = hasCritical;
  }

  _positionDropdown() {
    const dropdown = this.shadowRoot?.getElementById("dropdown");
    if (!dropdown || getComputedStyle(dropdown).display === "none") return;

    dropdown.classList.remove("align-right");
    const rect = dropdown.getBoundingClientRect();
    const margin = 8;
    if (rect.right > window.innerWidth - margin) {
      dropdown.classList.add("align-right");
    }
  }

  _toggleActions(sourceId) {
    this._expandedActions = this._expandedActions === sourceId ? null : sourceId;
    this._render();
  }

  _handleChipClick() { 
    this._dropdownOpen = !this._dropdownOpen;
    if (!this._dropdownOpen) this._expandedActions = null;
    this._render();
  }

  _handleClickOutside(e) {
    const dropdown = this.shadowRoot.getElementById("dropdown");
    const chip = this.shadowRoot.getElementById("chip");
    if (!dropdown || !chip || !this._dropdownOpen) return;
    const path = e.composedPath ? e.composedPath() : [];
    if (!path.includes(dropdown) && !path.includes(chip)) {
      this._dropdownOpen = false;
      this._expandedActions = null;
      this._render();
    }
  }

  _handleAcknowledge(sourceId, e) {
    e.stopPropagation();
    this._hass.callService("ha_notification_center", "acknowledge", { source_id: sourceId });
    this._expandedActions = null;
    this._render();
  }

  _handleSnooze(sourceId, hours, e) {
    e.stopPropagation();
    this._hass.callService("ha_notification_center", "snooze", {
      source_id: sourceId,
      duration_hours: hours
    });
    this._expandedActions = null;
    this._render();
  }

  _handleTap(item) {
    const tapAction = item.dataset.tapAction || "more-info";
    const eid = item.dataset.entity || "";
    const sourceId = item.dataset.source || item.closest(".notif-item")?.dataset.source || "";
    const navPath = item.dataset.tapNavPath || "";
    const urlPath = item.dataset.tapUrlPath || "";
    const svcDomain = item.dataset.tapSvcDomain || "";
    const svc = item.dataset.tapSvc || "";
    let svcData = {};
    try { svcData = JSON.parse(item.dataset.tapSvcData || "{}"); } catch (e) {}

    if (tapAction === "url" && urlPath) {
      window.open(urlPath, "_blank");
    } else if (tapAction === "navigate" && navPath) {
      this._hass.navigatePath(navPath);
    } else if (tapAction === "call_service" && sourceId && this._hass) {
      this._hass.callService("ha_notification_center", "execute_tap_action", { source_id: sourceId });
    } else if (tapAction === "call_service" && svcDomain && svc && this._hass) {
      this._hass.callService(svcDomain, svc, svcData);
    } else {
      // default: more-info
      if (eid && this._hass) {
        this.fireEvent("hass-more-info", { entityId: eid });
      }
    }
  }

  render() {
    if (!this._hass || !this._config) return "";
    const entity = this._hass.states[this._config.entity || "sensor.notification_feed"];
    if (!entity) return "";

    const t = (key) => notificationCardT(this._hass, key);
    const label = String(this._config.label || "").trim();
    const hasLabel = label.length > 0;
    const notifications = entity.attributes.notifications || [];
    const dropdownOpen = this._dropdownOpen === true;
    const count = parseInt(entity.state) || 0;

    const prio = {
      critical: { color: "var(--error-color, #db4437)", label: t("critical"), bg: "rgba(219,68,55,0.08)" },
      warning: { color: "var(--warning-color, #ff9800)", label: t("warning"), bg: "rgba(255,152,0,0.08)" },
      info: { color: "var(--info-color, #2196f3)", label: t("info"), bg: "rgba(33,150,243,0.08)" }
    };
    const order = { critical: 0, warning: 1, info: 2 };
    const sorted = [...notifications].sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
    const presentPrios = [...new Set(sorted.map(n => n.priority))];

    // Chip color
    let chipColor = "var(--secondary-text-color, #9e9e9e)";
    let chipBg = "rgba(158,158,158,0.12)";
    if (sorted.some(n => n.priority === "critical")) {
      chipColor = "#db4437";
      chipBg = "rgba(219,68,55,0.15)";
    } else if (sorted.some(n => n.priority === "warning")) {
      chipColor = "#ff9800";
      chipBg = "rgba(255,152,0,0.15)";
    } else if (count > 0) {
      chipColor = "#2196f3";
      chipBg = "rgba(33,150,243,0.15)";
    }

    // Legend
    const legend = ["critical", "warning", "info"]
      .filter(p => presentPrios.includes(p))
      .map(p => {
        const s = prio[p];
        const c = sorted.filter(n => n.priority === p).length;
        return `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.label}<span class="legend-count">${c}</span></span>`;
      }).join("");

    // Notification items
    let itemsHtml = "";
    sorted.forEach(item => {
      const style = prio[item.priority] || prio.info;
      const eid = item.tap_action_entity || "";
      const isActionsOpen = this._expandedActions === item.source_id;
      const isAcked = item.acknowledged === true;
      const ago = item.timestamp ? this._timeAgo(item.timestamp) : "";

      itemsHtml += `
        <div class="notif-item ${isAcked ? "acked" : ""}" data-priority="${item.priority}" data-source="${item.source_id || ""}">
          <div class="notif-content" data-source="${item.source_id || ""}" data-entity="${eid}" data-tap-action="${item.tap_action || "more-info"}" data-tap-nav-path="${item.tap_action_navigation_path || ""}" data-tap-url-path="${item.tap_action_url_path || ""}" data-tap-svc-domain="${item.tap_action_service_domain || ""}" data-tap-svc="${item.tap_action_service || ""}" data-tap-svc-data='${JSON.stringify(item.tap_action_service_data || {})}'>
            <div class="notif-avatar" style="background:${style.color}">
              <ha-icon icon="${item.icon || "mdi:bell-outline"}"></ha-icon>
            </div>
            <div class="notif-text">
              <div class="notif-title">${item.name || ""}</div>
              ${item.description ? `<div class="notif-desc">${item.description}</div>` : ""}
            </div>
            <div class="notif-actions">
              ${ago ? `<span class="notif-time">${ago}</span>` : ""}
              <button class="icon-btn more-btn" data-source="${item.source_id}" title="${t("moreActions")}">
                <ha-icon icon="mdi:dots-horizontal"></ha-icon>
              </button>
            </div>
          </div>
          <div class="more-panel" style="display:${isActionsOpen ? "flex" : "none"}">
            <button class="ack-action-btn" data-source="${item.source_id}" ${isAcked ? "disabled" : ""}>${isAcked ? t("acknowledged") : t("acknowledge")}</button>
            <button data-hours="1" data-source="${item.source_id}">1h</button>
            <button data-hours="4" data-source="${item.source_id}">4h</button>
            <button data-hours="24" data-source="${item.source_id}">${t("tomorrow")}</button>
            <button data-hours="48" data-source="${item.source_id}">${t("dayAfter")}</button>
          </div>
        </div>`;
    });

    const dropdownVisible = dropdownOpen && count > 0;
    const emptyState = dropdownOpen && count === 0
      ? `<div class="empty-state"><ha-icon icon="mdi:bell-check-outline"></ha-icon><span>${t("noNotifications")}</span></div>`
      : "";

    return `
      <style>
        :host { position: relative; display: inline-block; }
        .chip {
          min-width: 40px; height: 40px; border-radius: 20px;
          padding: 0 ${hasLabel ? "14px" : "0"};
          background: ${chipBg}; display: inline-flex; align-items: center; justify-content: center;
          gap: ${hasLabel ? "8px" : "0"};
          cursor: pointer; transition: all 0.2s; position: relative;
          box-sizing: border-box;
        }
        .chip:hover { filter: brightness(0.92); transform: scale(1.05); }
        .chip:active { transform: scale(0.95); }
        .chip ha-icon { --mdc-icon-size: 22px; color: ${chipColor}; transition: color 0.2s; flex-shrink: 0; }
        .chip-label {
          font-size: 13px;
          font-weight: 600;
          color: ${chipColor};
          white-space: nowrap;
          line-height: 1;
        }
        .badge {
          position: absolute; top: -3px; right: -3px;
          min-width: 18px; height: 18px; border-radius: 9px;
          padding: 0 5px; font-size: 10px; font-weight: 700;
          line-height: 18px; text-align: center; color: #fff;
          background: ${count > 0 ? (sorted.some(n => n.priority === "critical") ? "#db4437" : sorted.some(n => n.priority === "warning") ? "#ff9800" : "#2196f3") : "transparent"};
          display: ${count > 0 ? "block" : "none"};
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          animation: ${count > 0 ? "badge-pop 0.3s ease" : "none"};
        }
        @keyframes badge-pop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }

        /* Dropdown */
        .dropdown {
          position: absolute; top: calc(100% + 10px); left: 0; right: auto;
          width: min(360px, calc(100vw - 16px)); max-height: 420px; overflow-y: auto;
          background: var(--card-background-color, #fff);
          border-radius: 16px; border: none;
          box-shadow: 0 8px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12);
          z-index: 9999; padding: 10px;
          display: ${dropdownVisible ? "block" : "none"};
          animation: dropdown-in 0.2s ease;
        }
        .dropdown.align-right {
          left: auto;
          right: 0;
        }
        @keyframes dropdown-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dropdown::-webkit-scrollbar { width: 4px; }
        .dropdown::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 2px; }

        /* Legend */
        .legend-bar {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 4px; margin-bottom: 6px;
          border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.08));
        }
        .legend-items { display: flex; gap: 12px; }
        .legend-item { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--secondary-text-color, #757575); text-transform: capitalize; }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .legend-count { font-size: 10px; color: var(--secondary-text-color, #9e9e9e); margin-left: 2px; }

        /* Notification item */
        .notif-item {
          border-radius: 12px; margin-bottom: 6px; overflow: hidden;
          transition: all 0.15s;
          background: var(--primary-background-color, #f5f5f5);
        }
        .notif-item:last-child { margin-bottom: 0; }
        .notif-item[data-priority="critical"] { background: rgba(219,68,55,0.06); border-left: 3px solid #db4437; }
        .notif-item[data-priority="warning"] { background: rgba(255,152,0,0.06); border-left: 3px solid #ff9800; }
        .notif-item[data-priority="info"] { background: rgba(33,150,243,0.06); border-left: 3px solid #2196f3; }
        .notif-item.acked { opacity: 0.55; }

        .notif-content {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 6px 8px 10px; cursor: pointer; transition: background 0.15s;
        }
        .notif-content:hover { background: rgba(128,128,128,0.06); }

        .notif-avatar {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .notif-avatar ha-icon { --mdc-icon-size: 20px; color: #fff; }

        .notif-text { flex: 1; min-width: 0; }
        .notif-title { font-size: 13px; font-weight: 600; color: var(--primary-text-color, #212121); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .notif-desc { font-size: 11px; color: var(--secondary-text-color, #757575); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }

        .notif-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
        .notif-time { font-size: 10px; color: var(--secondary-text-color, #9e9e9e); white-space: nowrap; margin-right: 4px; }
        .icon-btn {
          display: inline-flex; align-items: center; justify-content: center;
          border: none; background: transparent; padding: 4px;
          color: var(--secondary-text-color, #9e9e9e); cursor: pointer;
          border-radius: 6px; transition: all 0.15s;
        }
        .icon-btn:hover { background: rgba(128,128,128,0.12); color: var(--primary-text-color, #212121); }
        .icon-btn ha-icon { --mdc-icon-size: 18px; }
        .more-btn:hover { color: var(--primary-text-color, #212121); }

        /* More actions panel */
        .more-panel {
          display: flex; gap: 4px; padding: 6px 10px 8px 46px;
          background: rgba(0,0,0,0.02);
          border-top: 1px solid var(--divider-color, rgba(0,0,0,0.06));
          flex-wrap: wrap;
        }
        .more-panel button {
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          border-radius: 8px; background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-size: 11px; font-weight: 600; padding: 3px 10px;
          cursor: pointer; transition: all 0.15s;
        }
        .more-panel button:hover { background: var(--primary-color, #03a9f4); color: #fff; border-color: var(--primary-color, #03a9f4); }
        .ack-action-btn {
          border-color: rgba(76,175,80,0.18) !important;
          color: #2e7d32 !important;
          background: rgba(76,175,80,0.05) !important;
        }
        .ack-action-btn:hover {
          border-color: rgba(76,175,80,0.28) !important;
          background: rgba(76,175,80,0.12) !important;
          color: #1b5e20 !important;
        }
        .ack-action-btn[disabled] {
          opacity: 0.55;
          cursor: default;
        }

        /* Empty state */
        .empty-state {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 24px 16px; color: var(--secondary-text-color, #9e9e9e);
        }
        .empty-state ha-icon { --mdc-icon-size: 36px; opacity: 0.4; }
        .empty-state span { font-size: 13px; font-weight: 500; }
      </style>

      <div class="chip" id="chip">
        <ha-icon icon="${count > 0 ? (dropdownOpen ? "mdi:bell-ring" : "mdi:bell-badge") : "mdi:bell-outline"}"></ha-icon>
        ${hasLabel ? `<span class="chip-label">${label}</span>` : ""}
        <span class="badge">${count}</span>
      </div>

      <div class="dropdown" id="dropdown">
        ${count > 0 ? `<div class="legend-bar"><div class="legend-items">${legend}</div></div>` : ""}
        ${itemsHtml}
        ${emptyState}
      </div>
    `;
  }

  _timeAgo(ts) {
    return notificationCardTimeAgo(this._hass, ts);
  }

  fireEvent(type, detail, options) {
    const event = new Event(type, {
      bubbles: options?.bubbles ?? true,
      cancelable: options?.cancelable ?? true,
      composed: options?.composed ?? true
    });
    event.detail = detail;
    this.dispatchEvent(event);
  }

  _render() {
    this.shadowRoot.innerHTML = this.render();

    // Chip click → toggle dropdown
    this.shadowRoot.getElementById("chip")?.addEventListener("click", () => this._handleChipClick());

    // Click outside → close dropdown
    if (this._clickOutsideHandler) {
      document.removeEventListener("click", this._clickOutsideHandler, true);
    }
    this._clickOutsideHandler = (e) => this._handleClickOutside(e);
    setTimeout(() => document.addEventListener("click", this._clickOutsideHandler, true), 100);

    // Tap notification → action
    this.shadowRoot.querySelectorAll(".notif-content[data-entity]").forEach(el => {
      el.addEventListener("click", () => this._handleTap(el));
    });

    // More-actions toggle buttons
    this.shadowRoot.querySelectorAll(".more-btn").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggleActions(el.dataset.source);
      });
    });

    // Acknowledge buttons
    this.shadowRoot.querySelectorAll(".ack-action-btn").forEach(el => {
      el.addEventListener("click", (e) => {
        this._handleAcknowledge(el.dataset.source, e);
      });
    });

    // Action option buttons
    this.shadowRoot.querySelectorAll(".more-panel button[data-hours]").forEach(el => {
      el.addEventListener("click", (e) => this._handleSnooze(el.dataset.source, parseInt(el.dataset.hours), e));
    });

    this._positionDropdown();
    this._lastRenderKey = this._buildRenderKey();
  }

  getCardSize() { return 1; }
}

class NotificationChipCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      type: "custom:notification-chip-card",
      entity: "sensor.notification_feed",
      label: "",
      default_open: false,
      auto_open_critical: false,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._syncForms();
  }

  _sourceSchema() {
    return [
      {
        name: "entity",
        selector: { entity: { domain: "sensor" } },
      },
    ];
  }

  _displaySchema() {
    return [
      {
        name: "label",
        selector: { text: {} },
      },
      {
        name: "default_open",
        selector: { boolean: {} },
      },
      {
        name: "auto_open_critical",
        selector: { boolean: {} },
      },
    ];
  }

  _labels() {
    return {
      entity: "通知 feed 實體",
      label: "按鈕文字（選填）",
      default_open: "預設展開卡片",
      auto_open_critical: "有緊急事件時自動展開",
    };
  }

  _handleValueChanged(ev) {
    const value = ev.detail?.value;
    if (!value) return;
    this._config = {
      ...this._config,
      ...value,
    };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  _ensureEditor() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    if (this._initialized) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .wrap { display: grid; gap: 16px; }
        .section {
          display: grid;
          gap: 10px;
          padding: 16px;
          border-radius: 16px;
          background: var(--secondary-background-color, rgba(127,127,127,0.08));
        }
        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--primary-text-color);
        }
        .section-desc {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }
        .hint {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }
      </style>
      <div class="wrap">
        <div class="section">
          <div class="section-title">資料來源</div>
          <div class="section-desc">指定 chip 要讀取的通知 feed sensor。</div>
          <ha-form id="source-form"></ha-form>
        </div>
        <div class="section">
          <div class="section-title">顯示選項</div>
          <div class="section-desc">可替 chip 的 bell icon 加上文字標籤，並設定預設展開或遇到緊急事件時自動展開。</div>
          <ha-form id="display-form"></ha-form>
        </div>
        <div class="hint">這是符合 Home Assistant 規範的簡易 editor，可直接設定實體與按鈕文字。</div>
      </div>
    `;

    this._sourceForm = this.shadowRoot.getElementById("source-form");
    this._displayForm = this.shadowRoot.getElementById("display-form");

    this._sourceForm.addEventListener("value-changed", (ev) => this._handleValueChanged(ev));
    this._displayForm.addEventListener("value-changed", (ev) => this._handleValueChanged(ev));

    this._initialized = true;
  }

  _syncForms() {
    if (!this._initialized || !this._config) return;

    const computeLabel = (schema) => this._labels()[schema.name] || schema.name;

    this._sourceForm.hass = this._hass;
    this._sourceForm.schema = this._sourceSchema();
    this._sourceForm.data = this._config;
    this._sourceForm.computeLabel = computeLabel;

    this._displayForm.hass = this._hass;
    this._displayForm.schema = this._displaySchema();
    this._displayForm.data = this._config;
    this._displayForm.computeLabel = computeLabel;
  }

  _render() {
    if (!this._config) return;
    this._ensureEditor();
    this._syncForms();
  }
}

if (!customElements.get("notification-chip-card")) {
  customElements.define("notification-chip-card", NotificationChipCard);
}
if (!customElements.get("notification-chip-card-editor")) {
  customElements.define("notification-chip-card-editor", NotificationChipCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "notification-chip-card")) {
  window.customCards.push({
    type: "notification-chip-card",
    name: "Notification Chip Card",
    description: "Notification bell chip with dropdown panel, snooze, and acknowledge",
    preview: true
  });
}
