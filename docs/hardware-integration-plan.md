# 硬體系列整合規劃

## 目標

本文件整理 K、M、P、R、T 系列目前的 Sensor、Input、Output、狀態燈規則、資料欄位與後端整合方向。此階段先統一規格與實作順序，下一階段再依此改韌體與後端。

整合後的目標：

- 每個系列都有清楚的 `series_key`、`device_id`、韌體版本與上傳欄位。
- Sensor 讀值、警示狀態與 RGB 顏色語意一致。
- K、M、R、T 系列以感測資料上傳為主。
- P 系列作為智慧插座，使用 MQTT 接收開關指令並回報狀態。
- 後端先沿用現有 PostgreSQL JSONB readings 表保存資料，再視查詢與後台需求追加正規化資料表。

## 目前系列盤點

| 系列 | 定位 | 板型 / FQBN | Input / Sensor | Output | 目前程式狀態 |
|---|---|---|---|---|---|
| K 系列 | 環境與警示感測 | `MH ET LIVE ESP32MiniKit` / `esp32:esp32:mhetesp32minikit` | DHT22、GY-SGP30、MQ AO/DO、火焰 AO/DO | RGB LED | 主程式為本機 Sensor 測試模式，不連 WiFi；已有舊版 HTTP 上傳實測紀錄 |
| M 系列 | 綠能展示與環境感測 | ESP32 NodeMCU-32S / `esp32:esp32:nodemcu-32s` | DHT22、GY-SGP30、MQ AO/DO、火焰 AO/DO、ACS712 充電電流、I2C OLED | RGB LED、OLED | 目前以 `sensor_read_test` 做完整整合測試，尚未建立正式主程式上傳 |
| R 系列 | 環境與氣體感測 | ESP32 MiniKit / `esp32:esp32:mhetesp32minikit` | DHT22、GY-SGP30、MQ AO/DO | RGB LED | 已有整合測試，尚未建立正式 WiFi / API 上傳主程式 |
| T 系列 | 環境、氣體與人體偵測 | 暫用 ESP32 MiniKit / `esp32:esp32:mhetesp32minikit` | DHT22、GY-SGP30、MQ AO/DO、SR501 PIR | RGB LED、板上狀態 LED | 已有正式 HTTP 上傳主程式，每 10 秒 POST readings |
| P 系列 | 智慧插座 | Seeed Studio XIAO ESP32C3 / `esp32:esp32:XIAO_ESP32C3` | ACS712 電流輸入 `A1/GPIO3` | 繼電器控制 `A0/GPIO2` | 已完成腳位與輸出循環測試，待建立 MQTT 控制韌體 |

## 腳位整理

| 系列 | DHT22 | I2C SDA/SCL | MQ AO/DO | 火焰 AO/DO | PIR | ACS712 | RGB | 繼電器 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| K | `GPIO4` | `GPIO21/GPIO22` | `GPIO33/GPIO25` | `GPIO35/GPIO26` | 無 | 無 | `GPIO16/17/18` | 無 |
| M | `GPIO4` | `GPIO21/GPIO22` | `GPIO33/GPIO25` | `GPIO35/GPIO26` | 無 | `GPIO34` | `GPIO16/17/18` | 無 |
| R | `GPIO4` | `GPIO21/GPIO22` | `GPIO33/GPIO25` | 無 | 無 | 無 | `GPIO16/17/18` | 無 |
| T | `GPIO4` | `GPIO21/GPIO22` | `GPIO33/GPIO25` | 無 | `GPIO27` | 無 | `GPIO16/17/18` | 無 |
| P | 無 | 無 | 無 | 無 | 無 | `A1/GPIO3` | 無 | `A0/GPIO2` |

安全限制：

- ESP32 GPIO 只接受 3.3V 邏輯，任何 `AO`、`DO`、`OUT` 可能為 5V 的模組都需分壓或電平轉換。
- `GPIO34`、`GPIO35`、`SVP`、`SVN` 只能輸入，不能控制 RGB、繼電器或其他輸出。
- RGB LED 每個色道都要串接 `220-330 ohm` 限流電阻。
- P 系列若接市電插座，韌體只能處理控制邏輯；繼電器、保險絲、外殼、線徑、絕緣與負載規格需另外確認。開發階段先用 LED 或低壓負載測試。

## 韌體結構規範

正式主程式建議統一分成下列區塊：

1. 常數設定：`SERIES_KEY`、`DEVICE_ID`、`FIRMWARE_VERSION`、腳位、讀取週期、上傳週期。
2. 初始化：Serial、GPIO、ADC、I2C、Sensor、RGB / OLED、WiFi 或 MQTT。
3. `readSensors()`：只讀取 Sensor，回傳結構化結果，不直接改輸出。
4. `evaluateStatus()`：依 Sensor 與網路狀態產生 `rgb_status`、警示旗標與錯誤旗標。
5. `applyOutputs()`：只負責 RGB、OLED、繼電器等輸出。
6. `buildPayload()`：輸出固定 JSON 欄位。
7. `sendReading()` 或 `publishTelemetry()`：負責 HTTP POST 或 MQTT publish。

各系列先保留獨立 `.ino`，不要急著抽共用函式庫。等 K、M、R、T、P 的欄位與流程穩定後，再評估是否建立 `hardware/common/`。

## RGB 狀態燈規範

K、M、R、T 系列有 RGB LED 時，統一使用下列語意：

| 顏色 | `rgb_status` | 意義 |
|---|---|---|
| 紅色 | `red_flame_warning` | 火焰 / 紅外線模組觸發，最高優先 |
| 黃色 | `yellow_gas_warning` | MQ `DO` 觸發氣體警示 |
| 紫色 | `purple_sensor_error` | DHT22、SGP30、MQ 類比、OLED 或其他必要 Sensor 異常 |
| 藍色 | `blue_transient` / `blue_motion_detected` | 啟動、上傳中、MQTT 連線中；T 系列也可表示人體偵測 |
| 青色 | `cyan_network_offline` | Sensor 可讀，但 WiFi / MQTT 未連上 |
| 白色 | `white_backend_error` | 網路已連上，但 HTTP API、PostgreSQL 或 MQTT broker 回應失敗 |
| 綠色 | `green_normal` | Sensor、網路、上傳皆正常，且沒有警示 |
| 關閉 | `off` | 開機前、測試結束或故障保護狀態 |

優先順序：

```text
紅色火焰警示 > 黃色氣體警示 > 紫色 Sensor 異常 > 藍色人體/暫態 > 青色網路離線 > 白色後端錯誤 > 綠色正常
```

M、K 有火焰模組，所以紅色可由 `flame_detected=true` 觸發。R、T 目前沒有火焰模組，紅色狀態保留不用。T 系列的 `blue_motion_detected` 只在無警示、無 Sensor error、網路狀態允許時顯示。

## 上傳欄位規範

所有系列上傳時使用現有格式：

```json
{
  "values": {},
  "metadata": {}
}
```

`metadata` 建議固定包含：

| 欄位 | 說明 |
|---|---|
| `series_key` | 例如 `k_series` |
| `device_id` | 例如 `k-series-001`，同系列多台設備時用來區分 |
| `board` | 實際板型或晶片 |
| `firmware_version` | 韌體版本 |
| `transport` | `http`、`mqtt` 或 `serial_test` |
| `source` | `firmware`、`mqtt_bridge`、`local_test` |

共用 `values` 欄位命名：

| 類型 | 欄位 |
|---|---|
| DHT22 | `dht_ok`、`temperature_c`、`humidity_percent`、`heat_index_c` |
| GY-SGP30 | `sgp30_ok`、`eco2_ppm`、`tvoc_ppb` |
| MQ | `mq_raw`、`mq_voltage`、`mq_analog_ok`、`mq_do`、`gas_detected` |
| 火焰模組 | `flame_raw`、`flame_voltage`、`flame_do`、`flame_detected` |
| SR501 | `pir_level`、`motion_detected`、`motion_latched` |
| RGB | `rgb_status` |
| 網路 | `wifi_rssi`、`network_ok`、`upload_ok`、`post_status_code` |
| M 系列電流 | `current_raw`、`current_adc_voltage`、`current_sensor_voltage`、`charge_current_a`、`charge_current_ma` |
| P 系列插座 | `relay_on`、`relay_command_id`、`current_raw`、`load_current_a`、`load_power_w`、`load_detected`、`mqtt_connected` |

下一階段改程式時，建議把目前混用的 `gas_raw` / `mq_raw` 統一成 `mq_raw`。若需要保留舊查詢相容，可在短期內同時上傳 `gas_raw` 與 `mq_raw`，後續再移除舊欄位。

## 各系列整合方向

### K 系列

- 保留目前主程式本機 Sensor 測試能力。
- 下一階段把 HTTP 上傳邏輯以同一套 `readSensors()` / `evaluateStatus()` / `buildPayload()` 接回來。
- 欄位改成標準命名，特別是 MQ 欄位。
- RGB 邏輯沿用目前規則，但狀態字串對齊本文件。

### M 系列

- 將 `sensor_read_test` 升級成正式 `hardware/m_series/m_series.ino`。
- OLED 保留輪播 DHT22、SGP30、MQ、火焰、充電電流與系統狀態。
- ACS712 欄位保留 `charge_current_a` 語意，避免和 P 系列負載電流混淆。
- 初版可先 Serial + OLED + RGB，本地穩定後再加 HTTP 上傳。

### R 系列

- 將 `tests/integration_test` 升級成正式 `hardware/r_series/r_series.ino`。
- 不需要火焰與 PIR 欄位。
- 初版狀態優先順序為黃、紫、青、白、綠；藍色只作啟動或上傳中暫態。
- 建立 `config.h.example` 後再加 HTTP 上傳。

### T 系列

- 已有 HTTP 上傳主程式，下一階段以它作為 K / R 的後端上傳參考。
- 補上標準 `metadata.device_id`、`values.rgb_status`、`values.network_ok`、`values.upload_ok`。
- PIR 鎖存邏輯保留，避免 2 秒或 10 秒週期漏掉短暫人體偵測。
- 若升級 Arduino ESP32 core 3.x，需同步修正 RGB PWM 寫法，參考 K / R 的相容寫法。

### P 系列

- 建立正式 `hardware/p_series/p_series.ino`。
- 使用 MQTT，而不是 HTTP 輪詢，作為智慧插座控制通道。
- `A0/GPIO2` 控制繼電器，`A1/GPIO3` 讀 ACS712。
- 韌體需在收到 MQTT command 後立即切換繼電器，並發布 state / telemetry。
- 電流換算需先校正 ACS712 型號、零點、分壓比例與負載測試資料；未校正前 `load_current_a` 與 `load_power_w` 只可標示為估算或先不啟用。

## P 系列 MQTT 規劃

Topic 命名：

```text
smart-home/p_series/{device_id}/command
smart-home/p_series/{device_id}/state
smart-home/p_series/{device_id}/telemetry
smart-home/p_series/{device_id}/availability
```

建議設定：

| Topic | 發布者 | 訂閱者 | retained | QoS | 用途 |
|---|---|---|---|---:|---|
| `command` | 後端 | P 系列 ESP32 | 是 | 1 | 保存最後一次目標開關狀態 |
| `state` | P 系列 ESP32 | 後端 | 是 | 1 | 回報目前繼電器狀態與最後指令 |
| `telemetry` | P 系列 ESP32 | 後端 | 否 | 0 或 1 | 定期回報電流、負載與 RSSI |
| `availability` | P 系列 ESP32 / broker LWT | 後端 | 是 | 1 | `online` / `offline` |

Command payload：

```json
{
  "command_id": "cmd-20260601-0001",
  "relay_on": true,
  "issued_at": "2026-06-01T12:00:00+08:00",
  "source": "backend"
}
```

State payload：

```json
{
  "relay_on": true,
  "relay_command_id": "cmd-20260601-0001",
  "current_raw": 3670,
  "load_current_a": null,
  "load_power_w": null,
  "mqtt_connected": true
}
```

Availability 使用純文字：

```text
online
offline
```

P 系列 `config.h.example` 需包含：

```cpp
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define MQTT_HOST "YOUR_MQTT_HOST"
#define MQTT_PORT 1883
#define MQTT_USERNAME "YOUR_MQTT_USERNAME"
#define MQTT_PASSWORD "YOUR_MQTT_PASSWORD"
#define DEVICE_ID "p-series-001"
```

`config.h` 必須繼續由 `.gitignore` 排除，不提交真實 WiFi 或 MQTT 憑證。

## 後端初版規劃

目前後端已支援：

```text
POST /api/series/:seriesKey/readings
```

此 API 會自動建立：

```text
series_{seriesKey}_readings
```

初版整合先沿用這個資料模型：

- K、M、R、T 系列透過 HTTP POST 寫入各自 readings 表。
- P 系列 MQTT 訊息由後端 MQTT bridge 訂閱後，轉寫入 `series_p_series_readings`。
- `metadata.kind` 用來區分 `telemetry`、`state`、`availability`、`command_issued`、`command_ack`。

後端下一階段要新增：

| 功能 | 建議實作 |
|---|---|
| MQTT broker | Docker Compose 加 Mosquitto |
| MQTT bridge | 後端加入 MQTT client，啟動時訂閱 `smart-home/+/+/state`、`telemetry`、`availability` |
| P 系列開關 API | `POST /api/devices/:deviceId/relay`，body 使用 `{ "relay_on": true }` |
| 指令發布 | 後端產生 `command_id`，寫入 readings，發布 retained command 到 MQTT |
| 最新狀態查詢 | `GET /api/devices/:deviceId/latest`，先從 readings 表查最新 state / telemetry |
| 管理後台資料來源 | 初版直接查 PostgreSQL readings；需要高效率列表時再新增 `devices` / `device_latest_states` |

初版不建議讓 App 或管理 UI 直接連 MQTT broker。App / 管理 UI 只呼叫後端 API，由後端負責權限、指令紀錄與 MQTT 發布。

## 資料庫儲存策略

短期策略：

- 繼續使用每個系列一張 readings 表。
- `values` 放實際讀值與狀態。
- `metadata` 放設備、韌體、傳輸方式與事件類型。
- 需要最新資料時，以 `received_at DESC` 查最新一筆。

中期策略：

- 新增 `devices` 表保存 `device_id`、`series_key`、顯示名稱、板型與啟用狀態。
- 新增 `device_latest_states` 表保存每台設備最新狀態，避免後台列表每次掃 JSONB readings。
- 新增 `device_commands` 表保存 P 系列開關指令與 ack 狀態。

初版先不做中期資料表，避免過早設計。等 P 系列 MQTT 與 K/M/R/T 上傳都跑通後，再依後台查詢需求追加。

## 實作順序

2026-06-01 初步整合已建立以下入口：

- `backend/src/mqtt/bridge.ts`：後端 MQTT bridge。
- `POST /api/devices/:deviceId/relay`：P 系列智慧插座開關 API。
- `GET /api/devices/:deviceId/latest`：設備最新資料查詢 API。
- `infra/mosquitto/mosquitto.conf`：本地 Mosquitto 設定。
- `hardware/k_series/k_series.ino`、`hardware/m_series/m_series.ino`、`hardware/r_series/r_series.ino`、`hardware/t_series/t_series.ino`：HTTP readings 韌體。
- `hardware/p_series/p_series.ino`：MQTT 智慧插座韌體。

1. 確認本文件的欄位命名、RGB 顏色語意與 MQTT topic。
2. 為 P 系列新增 `config.h.example` 與 MQTT 控制主程式。
3. 在 `docker-compose.yml` 加 Mosquitto，後端加 MQTT client 與 P 系列 relay API。
4. 讓 P 系列先用 LED 或低壓負載測 MQTT command -> relay output -> state 回報。
5. 將 T 系列主程式補齊標準欄位，作為 HTTP 上傳範本。
6. 將 K、R 整合測試升級為正式 HTTP 上傳主程式。
7. 將 M 系列 `sensor_read_test` 升級為正式主程式，先保留 OLED，再加 HTTP 上傳。
8. 補後台查詢 API 或管理 UI，顯示每台設備最新狀態與 readings。

## 完成條件

第一階段完成條件：

- 每個系列的正式主程式都能輸出標準欄位。
- RGB 狀態字串與實體顏色符合本文件。
- K、M、R、T 至少可透過 Serial 驗證完整 payload；T 維持 HTTP 上傳成功。
- P 系列可透過 MQTT retained command 控制繼電器，並回報 state / availability。
- 後端能把 HTTP readings 與 P 系列 MQTT 訊息寫入 PostgreSQL。

第二階段完成條件：

- 後台可查每個 `device_id` 最新狀態。
- P 系列按下開關後，後台可看到 command、state ack 與最新 telemetry。
- README 與各系列變更紀錄同步更新。
