/**
 * UNiNUS Notification Center — Lovelace Custom Card v1.0.3
 *
 * Full notification panel matching original design:
 * - NOTIFICATIONS header with legend
 * - Red bell icon + blue badge
 * - Color-coded pill items with square icon boxes
 * - Inline snooze buttons (1h / 4h / Tomorrow / Day after)
 * - Timer icon + scrollable list
 */
class HaNotificationCenterCard extends HTMLElement {
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
    const dropdownOpen = feed?.attributes?.dropdown_open ?? true;

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
        .panel { display: none; margin-top: 16px; }
        

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
          display: flex;
          align-items: center;
          gap: 6px;
          padding-top: 10px;
          margin-top: 6px;
          border-top: 1px solid rgba(0,0,0,0.06);
        }
        .snooze-label {
          font-size: 10px; font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--secondary-text-color, #727272);
          margin-right: 4px;
        }
        .snooze-btn {
          padding: 5px 14px;
          border-radius: 18px;
          border: 1px solid rgba(0,0,0,0.1);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-size: 12px; font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .snooze-btn:hover {
          background: var(--secondary-background-color, #f0f0f0);
          border-color: var(--primary-color, #03a9f4);
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

        <div class="panel" id="panel">
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
                      <span class="snooze-label">SNOOZE:</span>
                      <button class="snooze-btn" data-hours="1">1h</button>
                      <button class="snooze-btn" data-hours="4">4h</button>
                      <button class="snooze-btn" data-hours="24">Tomorrow</button>
                      <button class="snooze-btn" data-hours="48">Day after</button>
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
      bell.onclick = () => {
        this._hass.callService("ha_notification_center", "toggle_dropdown", {});
      };
    }

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

customElements.define("ha-notification-center-card", HaNotificationCenterCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "custom:ha-notification-center-card",
  name: "UNiNUS Notification Center",
  description: "通知中心面板 — 含 snooze 功能",
  preview: true,
});
