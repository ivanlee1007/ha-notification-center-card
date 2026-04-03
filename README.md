# UNiNUS Notification Center Card

[![HACS Dashboard](https://img.shields.io/badge/HACS-Dashboard-orange.svg)](https://hacs.xyz)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

UNiNUS Notification Center 的 Lovelace 卡片，已從 integration repo 拆分為獨立的 **HACS Dashboard** repo。

目前卡片已支援：
- 卡片內直接 Acknowledge
- Snooze
- bell/chip icon 旁顯示文字
- dropdown open/close 改為每個瀏覽器自己的前端 local state（不再互相影響）
- 符合 HA 規範的簡易 Visual Editor（ha-form），並依「資料來源 / 顯示選項」分組

> 這個 repo 只提供前端卡片。後端通知資料、service、storage、sensor/binary_sensor 來自：
> `https://github.com/ivanlee1007/ha-notification-center`

---

## 安裝

### 1) 先安裝 Integration

先安裝後端整合：

- Repo: `https://github.com/ivanlee1007/ha-notification-center`
- HACS 類別：**Integration**

安裝後重啟 Home Assistant，並完成 Config Flow。

### 2) 再安裝 Dashboard Card

1. HACS → **Dashboard** → 右上角 `⋮` → **自訂儲存庫**
2. URL: `https://github.com/ivanlee1007/ha-notification-center-card`
3. 類別：**Dashboard**
4. 安裝 `UNiNUS Notification Center Card`

安裝完成後，HACS 會將檔案放在：

- `www/community/ha-notification-center-card/ha-notification-center-card.js`

Lovelace resource 一般應為：

```text
/hacsfiles/ha-notification-center-card/ha-notification-center-card.js
```

> 這支主檔現在會同時註冊：
>
> - `custom:ha-notification-center-card`
> - `custom:notification-chip-card`
>
> 也就是說，**不需要再額外手動新增第二條 `notification-chip-card.js` resource**。

如果你的 HA 沒自動加，手動到：

- **設定 → 儀表板 → 資源**

新增：

```text
/hacsfiles/ha-notification-center-card/ha-notification-center-card.js
```

類型選：`JavaScript Module`

---

## 使用方式

```yaml
type: custom:ha-notification-center-card
show_chip: true
show_panel: true
max_items: 20
button_label: 告警訊息
entity: sensor.ha_notification_center_feed
critical_entity: binary_sensor.ha_notification_center_any_critical
```

> 若你使用目前的 UNiNUS Notification Center integration 預設實體，通常應改成：

```yaml
type: custom:ha-notification-center-card
entity: sensor.notification_feed
critical_entity: binary_sensor.notification_any_critical
```

### 可用參數

| 參數 | 預設值 | 說明 |
|---|---|---|
| `show_chip` | `true` | 顯示通知晶片 |
| `show_panel` | `true` | 顯示浮動通知面板 |
| `max_items` | `50` | 最多顯示幾筆通知 |
| `button_label` | `""` | 在右上角 bell icon 旁顯示文字說明；留白則維持純 icon |
| `entity` | `sensor.notification_feed` | 通知 feed sensor |
| `critical_entity` | `binary_sensor.notification_any_critical` | critical 狀態 binary sensor |

> dropdown 開合狀態現在由每張卡片在前端各自維護，所以多個瀏覽器同時開同一個 dashboard 時，不會再互相影響面板開闔。

---

## 相依條件

這張卡片會讀取以下實體：

- `sensor.notification_feed`
- `binary_sensor.notification_any_critical`

這些都由 integration repo 提供。

---

## 問題排查

### 視覺化編輯器

現在兩張卡都支援 HA 原生樣式的簡易設定頁：

- 依欄位分組顯示（資料來源 / 顯示選項）
- 使用 `ha-form` + HA selector
- 保留 YAML 編輯作為 fallback

- `ha-notification-center-card`
- `notification-chip-card`

使用方式：在 Lovelace 編輯模式中打開卡片設定，就會看到 HA 的 visual editor，而不是只能改 YAML。

### 卡片顯示 `Custom element doesn't exist`

先確認：

1. 這個 repo 是以 **Dashboard** 類型裝進 HACS
2. 資源路徑是否存在：

```text
/hacsfiles/ha-notification-center-card/ha-notification-center-card.js
```

3. 瀏覽器強制重新整理：`Ctrl+Shift+R`
4. 開發者工具執行：

```js
customElements.get("ha-notification-center-card")
```

有定義才算載入成功。

### 如果你使用 `notification-chip-card`

`notification-chip-card` 現在已經包含在主 resource：

```text
/hacsfiles/ha-notification-center-card/ha-notification-center-card.js
```

它也支援：
- 在 bell icon 旁顯示文字
- 直接 acknowledge
- 前端 local dropdown 狀態

```yaml
type: custom:notification-chip-card
entity: sensor.notification_feed
label: 告警訊息
```

> 若你過去曾手動加過 `/hacsfiles/ha-notification-center-card/notification-chip-card.js`，現在可以移除那條額外 resource，避免重複載入。

### 卡片載入了但沒資料

代表前端正常，請檢查 integration 是否已安裝並產生：

- `sensor.notification_feed`
- `binary_sensor.notification_any_critical`

---

## Repo 結構

```text
ha-notification-center-card/
├── dist/
│   └── ha-notification-center-card.js
├── hacs.json
└── README.md
```
