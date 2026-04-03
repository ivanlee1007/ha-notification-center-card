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

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  disconnectedCallback() {
    if (this._clickOutsideHandler) {
      document.removeEventListener("click", this._clickOutsideHandler, true);
      this._clickOutsideHandler = null;
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
          position: absolute; top: calc(100% + 10px); left: 50%; transform: translateX(-50%);
          width: 340px; max-height: 420px; overflow-y: auto;
          background: var(--card-background-color, #fff);
          border-radius: 16px; border: none;
          box-shadow: 0 8px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12);
          z-index: 9999; padding: 10px;
          display: ${dropdownVisible ? "block" : "none"};
          animation: dropdown-in 0.2s ease;
        }
        @keyframes dropdown-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
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
  }

  getCardSize() { return 1; }
}

customElements.define("notification-chip-card", NotificationChipCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "notification-chip-card",
  name: "Notification Chip Card",
  description: "Notification bell chip with dropdown panel, snooze, and acknowledge",
  preview: true
});
