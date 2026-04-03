/**
 * UNiNUS Notification Center — Lovelace Custom Card v1.3.5
 *
 * Full notification panel matching original design:
 * - NOTIFICATIONS header with legend
 * - Red bell icon + blue badge (+ optional text label)
 * - Color-coded pill items with square icon boxes
 * - Inline acknowledge + snooze actions
 * - Frontend-local dropdown state (no cross-browser coupling)
 */
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
      max_items: 20,
      button_label: "",
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    const feed = this._hass?.states?.[this._config.entity];
    return feed?.state > 0 ? 5 : 2;
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
          font-size: 14px; font-weight: 600;
          color: var(--primary-text-color, #212121);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .desc {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-top: 2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* ── Divider + Timer ── */
        .divider {
          width: 1px; height: 34px;
          background: rgba(0,0,0,0.1);
          flex-shrink: 0;
        }
        .timer {
          flex-shrink: 0;
          opacity: 0.35;
        }
        .timer ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color, #727272); }

        /* ── Snooze bar ── */
        .snooze-bar {
          width: 100%;
          display: grid;
          gap: 8px;
          padding-top: 10px;
          margin-top: 6px;
          border-top: 1px solid rgba(0,0,0,0.06);
        }
        .ack-row {
          display: flex;
          align-items: center;
        }
        .snooze-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex-wrap: wrap;
        }
        .snooze-label {
          font-size: 10px; font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--secondary-text-color, #727272);
          padding-top: 7px;
          flex: 0 0 auto;
        }
        .snooze-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          flex: 1 1 220px;
          min-width: 0;
        }
        .snooze-btn, .ack-btn {
          padding: 5px 14px;
          border-radius: 18px;
          border: 1px solid rgba(0,0,0,0.1);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-size: 12px; font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .snooze-btn:hover, .ack-btn:hover {
          background: var(--secondary-background-color, #f0f0f0);
          border-color: var(--primary-color, #03a9f4);
        }
        .ack-btn {
          font-weight: 700;
          border-color: rgba(76, 175, 80, 0.25);
        }
        .ack-btn:hover {
          border-color: #4caf50;
          color: #2e7d32;
        }
        .ack-btn[disabled] {
          opacity: 0.55;
          cursor: default;
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
            <div class="title">NOTIFICATIONS</div>
            <div class="legend">
              <div class="legend-item"><div class="legend-dot critical"></div>Critical</div>
              <div class="legend-item"><div class="legend-dot warning"></div>Warning</div>
              <div class="legend-item"><div class="legend-dot info"></div>Info</div>
            </div>
          </div>
          <div class="bell-btn ${isCritical ? "critical" : ""}" id="bell">
            <ha-icon icon="${isCritical ? "mdi:alert-circle" : "mdi:bell"}"></ha-icon>
            ${hasButtonLabel ? `<span class="bell-label">${this._esc(buttonLabel)}</span>` : ""}
            ${count > 0 ? `<div class="bell-badge">${count}</div>` : ""}
          </div>
        </div>

        <div class="panel" id="panel" style="display:${this._config.show_panel !== false && dropdownOpen ? "block" : "none"}">
          ${count === 0
            ? '<div class="empty">沒有通知</div>'
            : `<div class="notif-list">${items.map(n => {
                const pri = n.priority || "info";
                const icon = n.icon || iconMap[pri] || "mdi:bell";
                return `
                  <div class="notif-item pri-${pri} ${n.acknowledged ? "ack" : ""}" data-entity="${n.tap_action_entity || ""}" data-source="${n.source_id}">
                    <div class="icon-box"><ha-icon icon="${icon}"></ha-icon></div>
                    <div class="body">
                      <div class="name">${this._esc(n.name)}</div>
                      ${n.description ? `<div class="desc">${this._esc(n.description)}</div>` : ""}
                    </div>
                    <div class="divider"></div>
                    <div class="timer"><ha-icon icon="mdi:timer-outline"></ha-icon></div>
                    <div class="snooze-bar">
                      <div class="ack-row">
                        <button class="ack-btn" data-source="${n.source_id}" ${n.acknowledged ? "disabled" : ""}>${n.acknowledged ? "Acknowledged" : "Acknowledge"}</button>
                      </div>
                      <div class="snooze-row">
                        <span class="snooze-label">SNOOZE:</span>
                        <div class="snooze-actions">
                          <button class="snooze-btn" data-hours="1">1h</button>
                          <button class="snooze-btn" data-hours="4">4h</button>
                          <button class="snooze-btn" data-hours="24">Tomorrow</button>
                          <button class="snooze-btn" data-hours="48">Day after</button>
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
        this._dropdownOpen = !this._dropdownOpen;
        this._render();
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
        !path.includes(panelEl)
      ) {
        this._dropdownOpen = false;
        this._render();
      }
    };
    setTimeout(() => document.addEventListener("click", this._clickOutsideHandler, true), 0);

    this.shadowRoot.querySelectorAll(".ack-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sourceId = btn.dataset.source;
        if (sourceId && !btn.disabled) {
          this._hass.callService("ha_notification_center", "acknowledge", { source_id: sourceId });
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
        }
      };
    });

    this.shadowRoot.querySelectorAll(".notif-item[data-entity]").forEach((item) => {
      const entity = item.dataset.entity;
      if (entity) {
        item.querySelector(".body").style.cursor = "pointer";
        item.querySelector(".body").onclick = () => {
          this._hass.navigatePath(`/config/devices/dashboard?entity=${entity}`);
        };
      }
    });
  }

  _esc(str) {
    if (!str) return "";
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
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
          <div class="section-desc">控制 bell/chip、展開面板與顯示筆數。若只想在 icon 旁顯示文字，可填「按鈕文字」。</div>
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
      ...config,
    };
    this.attachShadow({ mode: "open" });
    this._expandedSnooze = null;
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
    };
  }

  set hass(hass) {
    this._hass = hass;
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
      open: this._dropdownOpen === true,
      expandedSnooze: this._expandedSnooze || null,
    });
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

  _toggleSnooze(sourceId) {
    this._expandedSnooze = this._expandedSnooze === sourceId ? null : sourceId;
    this._render();
  }

  _handleChipClick() {
    this._dropdownOpen = !this._dropdownOpen;
    this._render();
  }

  _handleClickOutside(e) {
    const dropdown = this.shadowRoot.getElementById("dropdown");
    const chip = this.shadowRoot.getElementById("chip");
    if (!dropdown || !chip || !this._dropdownOpen) return;
    const path = e.composedPath ? e.composedPath() : [];
    if (!path.includes(dropdown) && !path.includes(chip)) {
      this._dropdownOpen = false;
      this._render();
    }
  }

  _handleAcknowledge(sourceId, e) {
    e.stopPropagation();
    this._hass.callService("ha_notification_center", "acknowledge", { source_id: sourceId });
  }

  _handleSnooze(sourceId, hours, e) {
    e.stopPropagation();
    this._hass.callService("ha_notification_center", "snooze", {
      source_id: sourceId,
      duration_hours: hours
    });
    this._expandedSnooze = null;
  }

  _handleTap(eid) {
    if (!eid) return;
    // Try to toggle the source entity directly
    const state = this._hass.states[eid];
    if (state) {
      const domain = eid.split(".")[0];
      if (domain === "binary_sensor" || domain === "sensor") {
        // For sensors, navigate to the entity
        window.history.pushState({}, "", `/config/dashboard/devices/device/${state.attributes.device_id || eid}`);
        window.dispatchEvent(new Event("location-changed"));
      } else {
        const service = state.state === "on" ? "turn_off" : "turn_on";
        this._hass.callService(domain, service, { entity_id: eid });
      }
    }
  }

  render() {
    if (!this._hass || !this._config) return "";
    const entity = this._hass.states[this._config.entity || "sensor.notification_feed"];
    if (!entity) return "";

    const label = String(this._config.label || "").trim();
    const hasLabel = label.length > 0;
    const notifications = entity.attributes.notifications || [];
    const dropdownOpen = this._dropdownOpen === true;
    const count = parseInt(entity.state) || 0;

    const prio = {
      critical: { color: "var(--error-color, #db4437)", label: "Critical", bg: "rgba(219,68,55,0.08)" },
      warning: { color: "var(--warning-color, #ff9800)", label: "Warning", bg: "rgba(255,152,0,0.08)" },
      info: { color: "var(--info-color, #2196f3)", label: "Info", bg: "rgba(33,150,243,0.08)" }
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
      const isSnoozeOpen = this._expandedSnooze === item.source_id;
      const isAcked = item.acknowledged === true;
      const ago = item.timestamp ? this._timeAgo(item.timestamp) : "";

      itemsHtml += `
        <div class="notif-item ${isAcked ? "acked" : ""}" data-priority="${item.priority}">
          <div class="notif-content" data-entity="${eid}">
            <div class="notif-avatar" style="background:${style.color}">
              <ha-icon icon="${item.icon || "mdi:bell-outline"}"></ha-icon>
            </div>
            <div class="notif-text">
              <div class="notif-title">${item.name || ""}</div>
              ${item.description ? `<div class="notif-desc">${item.description}</div>` : ""}
            </div>
            <div class="notif-actions">
              ${ago ? `<span class="notif-time">${ago}</span>` : ""}
              <button class="icon-btn ack-btn" data-source="${item.source_id}" title="Acknowledge">
                <ha-icon icon="mdi:check-circle${isAcked ? "" : "-outline"}"></ha-icon>
              </button>
              <button class="icon-btn snooze-btn" data-source="${item.source_id}" title="Snooze">
                <ha-icon icon="mdi:timer-outline"></ha-icon>
              </button>
            </div>
          </div>
          <div class="snooze-panel" style="display:${isSnoozeOpen ? "flex" : "none"}">
            <button data-hours="1" data-source="${item.source_id}">1h</button>
            <button data-hours="4" data-source="${item.source_id}">4h</button>
            <button data-hours="24" data-source="${item.source_id}">Tomorrow</button>
            <button data-hours="48" data-source="${item.source_id}">Day after</button>
          </div>
        </div>`;
    });

    const dropdownVisible = dropdownOpen && count > 0;
    const emptyState = dropdownOpen && count === 0
      ? `<div class="empty-state"><ha-icon icon="mdi:bell-check-outline"></ha-icon><span>No notifications</span></div>`
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
        .ack-btn:hover { color: #4caf50; }

        /* Snooze panel */
        .snooze-panel {
          display: flex; gap: 4px; padding: 6px 10px 8px 46px;
          background: rgba(0,0,0,0.02);
          border-top: 1px solid var(--divider-color, rgba(0,0,0,0.06));
          flex-wrap: wrap;
        }
        .snooze-panel button {
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          border-radius: 8px; background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-size: 11px; font-weight: 600; padding: 3px 10px;
          cursor: pointer; transition: all 0.15s;
        }
        .snooze-panel button:hover { background: var(--primary-color, #03a9f4); color: #fff; border-color: var(--primary-color, #03a9f4); }

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
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 0) return "now";
    const m = Math.floor(diff / 60000);
    if (m < 1) return "now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
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
      el.addEventListener("click", () => this._handleTap(el.dataset.entity));
    });

    // Acknowledge buttons
    this.shadowRoot.querySelectorAll(".ack-btn").forEach(el => {
      el.addEventListener("click", (e) => this._handleAcknowledge(el.dataset.source, e));
    });

    // Snooze toggle buttons
    this.shadowRoot.querySelectorAll(".snooze-btn").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggleSnooze(el.dataset.source);
      });
    });

    // Snooze option buttons
    this.shadowRoot.querySelectorAll(".snooze-panel button").forEach(el => {
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
    ];
  }

  _labels() {
    return {
      entity: "通知 feed 實體",
      label: "按鈕文字（選填）",
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
          <div class="section-desc">可替 chip 的 bell icon 加上文字標籤，例如「告警訊息」。</div>
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
