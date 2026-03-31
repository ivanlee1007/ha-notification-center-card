class NotificationChipCard extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.attachShadow({ mode: "open" });
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._hass || !this._config) return;
    const entity = this._hass.states[this._config.entity || "sensor.notification_feed"];
    if (!entity) return;

    const notifications = entity.attributes.notifications || [];
    const dropdownOpen = entity.attributes.dropdown_open === true;
    const count = parseInt(entity.state) || 0;

    const prio = { critical: { color: "var(--error-color, #db4437)", label: "CRITICAL" }, warning: { color: "var(--warning-color, #ff9800)", label: "WARNING" }, info: { color: "var(--info-color, #2196f3)", label: "INFO" } };
    const order = { critical: 0, warning: 1, info: 2 };
    const sorted = [...notifications].sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
    const presentPrios = [...new Set(sorted.map(n => n.priority))];

    // Determine chip color
    let chipColor = "var(--secondary-text-color, #727272)";
    let chipBg = "var(--card-background-color, #fff)";
    if (sorted.some(n => n.priority === "critical")) { chipColor = "var(--error-color, #db4437)"; chipBg = "color-mix(in srgb, var(--error-color, #db4437) 22%, var(--card-background-color, #fff))"; }
    else if (sorted.some(n => n.priority === "warning")) { chipColor = "var(--warning-color, #ff9800)"; chipBg = "color-mix(in srgb, var(--warning-color, #ff9800) 22%, var(--card-background-color, #fff))"; }
    else if (count > 0) { chipColor = "var(--info-color, #2196f3)"; chipBg = "color-mix(in srgb, var(--info-color, #2196f3) 22%, var(--card-background-color, #fff))"; }

    const snoozeUntil = (sourceId, hours) => {
      const until = new Date(Date.now() + hours * 3600000);
      this._hass.callService("ha_notification_center", "snooze", { source_id: sourceId, duration_hours: hours });
    };

    const snoozeBtns = (sourceId) => {
      const now = new Date();
      const pad = n => String(n).padStart(2, "0");
      const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
      const h1 = new Date(Date.now() + 3600000);
      const h4 = new Date(Date.now() + 14400000);
      const tom = new Date(now); tom.setDate(tom.getDate()+1); tom.setHours(8,0,0,0);
      const dat = new Date(now); dat.setDate(dat.getDate()+2); dat.setHours(8,0,0,0);
      return `<div class="snooze-bar">
        <span class="snooze-label">Snooze:</span>
        <button data-slug="${sourceId}" data-hours="1">1h</button>
        <button data-slug="${sourceId}" data-hours="4">4h</button>
        <button data-slug="${sourceId}" data-hours="24">Tomorrow</button>
        <button data-slug="${sourceId}" data-hours="48">Day after</button>
      </div>`;
    };

    const legend = ["critical","warning","info"].filter(p => presentPrios.includes(p)).map(p => {
      const s = prio[p];
      return `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span><span class="legend-label">${p}</span></span>`;
    }).join("");

    let itemsHtml = "";
    sorted.forEach(item => {
      const style = prio[item.priority] || prio.info;
      const eid = item.tap_action_entity || "";
      itemsHtml += `<div class="notif-item" style="background:color-mix(in srgb, ${style.color} 8%, var(--card-background-color, #fff));">
        <div class="notif-content" data-entity="${eid}">
          <div class="notif-avatar" style="background:${style.color};box-shadow:0 2px 8px color-mix(in srgb, ${style.color} 40%, transparent);">
            <ha-icon icon="${item.icon || "mdi:bell-outline"}"></ha-icon>
          </div>
          <div class="notif-text">
            <div class="notif-title">${item.name || ""}</div>
            ${item.description ? `<div class="notif-desc">${item.description}</div>` : ""}
          </div>
          <button class="snooze-toggle" data-toggle="${item.source_id}" title="Snooze">
            <ha-icon icon="mdi:timer-outline"></ha-icon>
          </button>
        </div>
        <div class="snooze-options" id="snooze-${item.source_id}" style="display:none;">
          ${snoozeBtns(item.source_id)}
        </div>
      </div>`;
    });

    const dropdownDisplay = dropdownOpen && count > 0 ? "block" : "none";

    this.shadowRoot.innerHTML = `
      <style>
        :host { position: relative; display: inline-block; z-index: 1; }
        .chip {
          width: 40px; height: 40px; border-radius: 50%;
          background: ${chipBg}; display: flex; align-items: center; justify-content: center;
          cursor: pointer; position: relative; transition: background 0.15s;
        }
        .chip:hover { filter: brightness(0.95); }
        .chip ha-icon { --mdc-icon-size: 24px; color: ${chipColor}; }
        .badge {
          position: absolute; top: -4px; right: -4px;
          min-width: 18px; height: 18px; border-radius: 9px;
          padding: 0 4px; font-size: 11px; font-weight: 700;
          line-height: 18px; text-align: center; color: white;
          background: var(--primary-color, #03a9f4);
          display: ${count > 0 ? "block" : "none"};
        }
        .dropdown {
          position: absolute; top: calc(100% + 8px); left: 0;
          width: 320px; background: transparent;
          border-radius: 0; border: none; box-shadow: none;
          overflow: visible; z-index: 999;
          display: ${dropdownDisplay};
        }
        .legend-bar {
          background: var(--card-background-color, #fff);
          border-radius: 14px; padding: 10px 14px; margin-bottom: 8px;
          display: flex; justify-content: space-between; align-items: center;
          box-shadow: 0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12);
        }
        .legend-items { display: flex; gap: 10px; align-items: center; }
        .legend-item { display: inline-flex; align-items: center; gap: 4px; }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .legend-label { font-size: 10px; font-weight: 600; color: var(--secondary-text-color, #727272); text-transform: capitalize; }
        .legend-count { font-size: 11px; font-weight: 700; color: var(--secondary-text-color, #727272); letter-spacing: 0.04em; }
        .notif-item {
          border-radius: 16px; margin-bottom: 8px; overflow: hidden;
          box-shadow: inset 0 0 12px color-mix(in srgb, var(--info-color, #2196f3) 12%, transparent),
                     0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10);
        }
        .notif-content {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 6px 10px 12px; cursor: pointer; transition: background 0.15s;
        }
        .notif-content:hover { background: rgba(128,128,128,0.08); }
        .notif-avatar {
          width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .notif-avatar ha-icon { --mdc-icon-size: 22px; color: white; }
        .notif-text { flex: 1; min-width: 0; text-align: left; }
        .notif-title { font-size: 13px; font-weight: 600; color: var(--primary-text-color, #212121); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
        .notif-desc { font-size: 11px; color: var(--secondary-text-color, #727272); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .snooze-toggle {
          display: inline-flex; align-items: center; justify-content: center;
          border: none; background: transparent; padding: 6px;
          color: var(--secondary-text-color, #727272); opacity: 0.6; cursor: pointer;
          border-radius: 8px; transition: opacity 0.15s, background 0.15s;
          border-left: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          margin-left: 4px;
        }
        .snooze-toggle:hover { opacity: 1; background: rgba(128,128,128,0.1); }
        .snooze-toggle ha-icon { --mdc-icon-size: 18px; }
        .snooze-options {
          padding: 8px 12px;
          background: var(--secondary-background-color, #f2f2f2);
          border-top: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
        }
        .snooze-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--secondary-text-color, #727272); letter-spacing: 0.06em; margin-right: 2px; }
        .snooze-options button {
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          border-radius: 6px; background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-size: 11px; font-weight: 600; padding: 4px 8px;
          cursor: pointer; white-space: nowrap;
        }
        .snooze-options button:hover { background: var(--divider-color, rgba(0,0,0,0.08)); }
      </style>
      <div class="chip" id="chip">
        <ha-icon icon="${count > 0 ? (dropdownOpen ? "mdi:bell-ring" : "mdi:bell-badge") : "mdi:bell-outline"}"></ha-icon>
        <span class="badge">${count}</span>
      </div>
      <div class="dropdown" id="dropdown">
        ${count > 0 ? `<div class="legend-bar"><div class="legend-items">${legend}</div><span class="legend-count">${sorted.length} active</span></div>` : ""}
        ${itemsHtml}
      </div>
    `;

    // Event handlers
    this.shadowRoot.getElementById("chip").addEventListener("click", () => {
      this._hass.callService("ha_notification_center", "toggle_dropdown");
    });

    this.shadowRoot.querySelectorAll(".notif-content[data-entity]").forEach(el => {
      el.addEventListener("click", () => {
        const eid = el.dataset.entity;
        if (eid) this._hass.callService("browser_mod", "popup", { title: "Notification", content: eid });
      });
    });

    this.shadowRoot.querySelectorAll(".snooze-toggle[data-toggle]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const slug = el.dataset.toggle;
        const panel = this.shadowRoot.getElementById(`snooze-${slug}`);
        if (panel) panel.style.display = panel.style.display === "none" ? "block" : "none";
      });
    });

    this.shadowRoot.querySelectorAll(".snooze-options button[data-slug]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this._hass.callService("ha_notification_center", "snooze", {
          source_id: el.dataset.slug,
          duration_hours: parseInt(el.dataset.hours)
        });
      });
    });
  }

  getCardSize() { return 1; }
}

customElements.define("notification-chip-card", NotificationChipCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "notification-chip-card",
  name: "Notification Chip Card",
  description: "Notification bell chip with dropdown panel and snooze"
});
