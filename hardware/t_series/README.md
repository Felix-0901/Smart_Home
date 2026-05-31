# T 系列

## 系列資訊

- `seriesKey`: `t_series`
- 晶片：ESP32-D0WD-V3
- 晶片讀取結果：ESP32-D0WD-V3，revision v3.1，MAC `a0:b7:65:66:e6:40`
- USB-to-Serial：待接板確認；macOS 目前顯示 USB serial port
- 序列埠：`/dev/cu.usbserial-02WVZ1NM`
- 板型：待接板確認；若和 K 系列同板，使用 `MH ET LIVE ESP32MiniKit`
- FQBN：暫用 K 系列同款板設定 `esp32:esp32:mhetesp32minikit`
- 韌體格式：Arduino CLI sketch
- 上傳 API：`/api/series/t_series/readings`
- 資料表：`series_t_series_readings`
- 本地後端：`http://localhost:3003`

## 硬體配置

T 系列使用以下模組：

- DHT22 溫溼度模組
- MQ 氣體感測模組
- GY-SGP30 空氣品質感測模組
- RGB LED
- SR501 人體紅外線感測器

目前腳位配置沿用 K 系列已驗證的 ESP32 Mini Kit 安全腳位，並將 SR501 放在 `GPIO27`。若 T 系列板子外露絲印和 K 系列不同，需依實際絲印修正接線與程式常數。

## 腳位表

| 用途 | 板子絲印 | 程式 GPIO | 備註 |
|---|---:|---:|---|
| DHT22 data | `IO4` | `GPIO4` | 一般數位腳 |
| I2C SDA | `IO21` | `GPIO21` | GY-SGP30 SDA |
| I2C SCL | `IO22` | `GPIO22` | GY-SGP30 SCL |
| MQ 類比輸入 | `IO33` | `GPIO33` | ADC1，WiFi 使用時可讀類比 |
| MQ 數位輸入 | `IO25` | `GPIO25` | 只在 3.3V-safe 時接 |
| SR501 OUT | `IO27` | `GPIO27` | 偵測到人體時通常輸出 HIGH |
| RGB LED R | `IO16` | `GPIO16` | 必須串接限流電阻 |
| RGB LED G | `IO17` | `GPIO17` | 必須串接限流電阻 |
| RGB LED B | `IO18` | `GPIO18` | 必須串接限流電阻 |

先避免使用：

- `SD1`、`SD2`、`SD3`、`CLK`、`CMD`、`SDD`：通常跟 Flash/SDIO 有關，不拿來接 Sensor
- `TDI`、`TDO/TD0`、`TMS`、`TCK`：JTAG 腳，必要時才使用
- `IO0`、`IO2`、`IO5`：開機 strapping 腳，外接模組可能影響開機
- `TXD`、`RXD`：USB Serial 會用到，除非需要 UART，先不要接 Sensor

`IO34`、`IO35`、`SVP`、`SVN` 是 input only，不能拿來輸出控制 LED、繼電器或其他輸出訊號。

## 重要安全限制

ESP32 GPIO 只能承受 3.3V。任何 Sensor 的 `AO`、`DO`、`OUT` 若輸出 5V，都不能直接接 ESP32。

MQ 氣體感測模組通常需要 5V 供應加熱器，但它的 `AO` 在 5V 供電時可能輸出 0-5V。若 MQ 用 5V 供電，`AO` 必須先經過分壓後再接 ESP32 ADC。

SR501 常見模組可用 5V 供電，`OUT` 通常約 3.3V 邏輯輸出；實際接線前仍建議用三用電表確認 `OUT` 不超過 3.3V。

建議先這樣處理：

- DHT22：使用 3.3V
- GY-SGP30：使用 3.3V
- MQ 氣體模組：可用 5V 供電，但 `AO` 需要分壓；`DO` 先不要接，或確認只有 3.3V 後再接
- SR501：使用 5V/VIN 供電，確認 `OUT` 是 3.3V-safe 後接 `GPIO27`
- RGB LED：每個顏色通道各串一顆 `220-330 ohm` 限流電阻

## 建議接線

| 模組 | 模組腳位 | ESP32 腳位 | 說明 |
|---|---:|---:|---|
| DHT22 | `+` / `VCC` | `3V3` | 不要接 5V |
| DHT22 | `OUT` / `DATA` | `IO4` | 溫溼度資料 |
| DHT22 | `-` / `GND` | `GND` | 共地 |
| GY-SGP30 | `VCC` | `3V3` | 不要接 5V |
| GY-SGP30 | `GND` | `GND` | 共地 |
| GY-SGP30 | `SDA` | `IO21` | I2C SDA |
| GY-SGP30 | `SCL` | `IO22` | I2C SCL |
| MQ 氣體模組 | `VCC` | `VCC` / `5V` | 供 MQ 加熱器使用 |
| MQ 氣體模組 | `GND` | `GND` | 共地 |
| MQ 氣體模組 | `AO` | `IO33` | 若 MQ 用 5V 供電，必須先分壓 |
| MQ 氣體模組 | `DO` | `IO25` | 若 DO 是 5V，需電平轉換；不確定時先不接 |
| SR501 | `VCC` | `VCC` / `5V` | 依模組規格供電 |
| SR501 | `GND` | `GND` | 共地 |
| SR501 | `OUT` | `IO27` | 偵測到人體時通常為 HIGH |
| RGB LED | `R` | `IO16` | 串接 `220-330 ohm` 電阻 |
| RGB LED | `G` | `IO17` | 串接 `220-330 ohm` 電阻 |
| RGB LED | `B` | `IO18` | 串接 `220-330 ohm` 電阻 |
| RGB LED | 共用腳 | `GND` 或 `3V3` | 共陰接 `GND`，共陽接 `3V3` |

MQ `AO` 分壓範例：

```text
MQ AO -- 10k -- ESP32 IO33 -- 20k -- GND
```

這會把 5V 約降到 3.3V。沒有分壓前不要把 5V 類比輸出直接接到 ESP32。

## RGB LED 接線

RGB LED 必須每個顏色通道各串一顆限流電阻，建議 `220-330 ohm`。不要把 LED 腳位直接接到 ESP32 GPIO。

建議腳位：

```text
RGB R -> 220-330 ohm -> IO16
RGB G -> 220-330 ohm -> IO17
RGB B -> 220-330 ohm -> IO18
```

如果是共陰 RGB LED：

```text
共用腳 -> GND
```

如果是共陽 RGB LED：

```text
共用腳 -> 3V3
```

程式目前預設共陰：

```cpp
constexpr bool RGB_COMMON_ANODE = false;
```

若你的 LED 是共陽，請把主程式、RGB 測試程式與整合測試中的設定改成：

```cpp
constexpr bool RGB_COMMON_ANODE = true;
```

T 系列 RGB 狀態燈規則：

| 顏色 | 狀態 |
|---|---|
| 藍色 | 啟動、WiFi 連線中、資料上傳中，或 SR501 偵測到人體 |
| 綠色 | Sensor 正常、WiFi 正常、後端上傳成功，且未觸發警示 |
| 黃色 | MQ 氣體模組 `DO` 觸發 |
| 紫色 | Sensor 異常，例如 DHT22 失敗、GY-SGP30 失敗、MQ `gas_raw == 0` |
| 青色 | WiFi 未連上，但已可讀 Sensor |
| 白色 | WiFi 已連上，但後端 API / PostgreSQL 上傳失敗 |

狀態優先順序：

```text
黃色氣體警示 > 紫色 Sensor 異常 > 藍色人體偵測 > 青色 WiFi 未連上 > 白色後端上傳失敗 > 綠色正常
```

## 單元測試

測試前先接上 ESP32，確認序列埠：

```bash
ls /dev/cu.*
arduino-cli board list
```

以下指令暫用 K 系列同款板的 FQBN：

```text
esp32:esp32:mhetesp32minikit
```

若 T 系列板子不是 `MH ET LIVE ESP32MiniKit`，需先換成 `arduino-cli board list` 顯示的 FQBN。

### GPIO 腳位自測

測試程式：

```text
hardware/t_series/tests/gpio_self_test/gpio_self_test.ino
```

此測試用來確認 ESP32 常見外露 GPIO 的基本狀態。開機預設只做被動掃描，不會主動輸出 HIGH，避免在 Sensor 還接著時誤傷外部模組。

被動掃描會輸出：

- `base`：一般輸入讀值
- `pullup`：啟用內部上拉後讀值
- `pulldown`：啟用內部下拉後讀值
- `adc_raw`：可 ADC 腳位的類比讀值
- `result`：內部上下拉是否可正常改變讀值，或是否疑似被外部電路拉高 / 拉低

安全限制：

- `IO34`、`IO35`、`SVP/IO36`、`SVN/IO39` 是 input only，只能讀取，不能輸出
- `IO0`、`IO2`、`IO5`、`IO12`、`IO15` 是開機 strapping 腳，此測試只讀取，不主動輸出
- `TXD`、`RXD` 是 USB Serial 腳，監看 Serial 時不要拿來接 Sensor
- `GPIO6-11` 通常連到 Flash / SDIO，不列入測試，也不要拿來接外部模組

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/gpio_self_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-02WVZ1NM --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/gpio_self_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-02WVZ1NM -c baudrate=115200
```

Serial 指令：

```text
s    重新執行被動掃描
w    逐一輸出安全腳位 HIGH/LOW，需用 LED+電阻或三用電表確認實際電壓
o16  只測單一安全輸出腳，例如 GPIO16
```

若要執行 `w` 或 `oNN` 輸出測試，建議先拔掉所有 Sensor，只保留 USB。每個待測 GPIO 可用三用電表量測：

```text
GPIO HIGH -> 約 3.3V
GPIO LOW  -> 約 0V
```

或使用 LED 測試：

```text
GPIO -> 220-330 ohm 電阻 -> LED -> GND
```

### DHT22 測試

測試程式：

```text
hardware/t_series/tests/dht22_test/dht22_test.ino
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/dht22_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/dht22_test
```

### MQ 氣體模組測試

測試程式：

```text
hardware/t_series/tests/mq_test/mq_test.ino
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/mq_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/mq_test
```

若 `gas_raw` 一直是 `0`，可使用 ADC 掃描測試確認線材與腳位：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/mq_adc_scan
arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/mq_adc_scan
```

### GY-SGP30 測試

測試程式：

```text
hardware/t_series/tests/sgp30_test/sgp30_test.ino
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/sgp30_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/sgp30_test
```

SGP30 剛上電時需要暖機，前幾分鐘的 `eCO2` / `TVOC` 只能當作連線測試，不適合作為穩定空氣品質數據。

### RGB LED 測試

測試程式：

```text
hardware/t_series/tests/rgb_led_test/rgb_led_test.ino
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/rgb_led_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/rgb_led_test
```

### SR501 測試

測試程式：

```text
hardware/t_series/tests/sr501_test/sr501_test.ino
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/sr501_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/sr501_test
```

SR501 上電後通常需要 `30-60` 秒暖機。正常會看到：

```text
pir_level=0, motion_detected=false
pir_level=1, motion_detected=true
```

目前 SR501 單元測試會暫時使用開發板內建 LED 顯示狀態：

```text
motion_detected=true  -> 內建 LED 亮
motion_detected=false -> 內建 LED 滅
```

SR501 診斷測試目前每 `5ms` 讀取一次 `GPIO27`，每 `100ms` 輸出一次 Serial log。若偵測狀態改變，會立即輸出：

```text
CHANGE gpio27_level=1, motion_detected=true
CHANGE gpio27_level=0, motion_detected=false
```

若看到 `line_state=externally_driven_high`，代表 SR501 的 `OUT` 已輸出 HIGH 並被 ESP32 讀到。若看到 `line_state=externally_driven_low`，代表線路目前被外部拉低。若看到 `line_state=floating_or_disconnected`，代表 `IO27` 可能沒有接到 SR501 `OUT`，或線路浮接。

若 `SDA=IO21`、`SCL=IO22` 掃不到 GY-SGP30，可先使用 I2C 腳位掃描測試：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/sgp30_pin_scan
arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/sgp30_pin_scan
arduino-cli monitor -p /dev/cu.usbserial-XXXX -c baudrate=115200
```

掃描測試會依序測：

```text
SDA=IO21, SCL=IO22
SDA=IO22, SCL=IO21
SDA=IO19, SCL=IO23
SDA=IO32, SCL=IO33
SDA=IO25, SCL=IO26
SDA=IO27, SCL=IO26
```

若看到 `found=0x58`，代表該組腳位有偵測到 GY-SGP30。

若懷疑 SGP30 函式庫或測試程式有問題，可使用最小化 I2C 掃描測試：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/i2c_21_22_scan
arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/i2c_21_22_scan
arduino-cli monitor -p /dev/cu.usbserial-XXXX -c baudrate=115200
```

此測試不使用 Adafruit SGP30 函式庫，只用 `Wire.begin(21, 22)` 掃描 I2C ACK。若 GY-SGP30 接通，應看到 `found address 0x58`。

## 整合測試

整合測試會同時讀取 DHT22、MQ、GY-SGP30、SR501，並依狀態控制 RGB LED。此測試不連 WiFi，也不會上傳後端。

測試程式：

```text
hardware/t_series/tests/integration_test/integration_test.ino
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/integration_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:mhetesp32minikit hardware/t_series/tests/integration_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-XXXX -c baudrate=115200
```

正常 log 會包含：

```text
dht_ok=true
temperature_c=...
humidity_percent=...
gas_raw=...
gas_analog_ok=true
gas_detected=false
pir_level=...
motion_detected=...
sgp30_ok=true
eco2_ppm=...
tvoc_ppb=...
```

2026-05-23 全部 Sensor 安裝後整合測試結果：

```text
dht_ok=true
temperature_c=25.60-26.00
humidity_percent=34.40-35.20
gas_raw=1507-1585
gas_voltage=1.214-1.277
gas_analog_ok=true
gas_do=1
gas_detected=false
sgp30_ok=true
eco2_ppm=400-495
tvoc_ppb=0-41
pir_level=0
motion_detected=false
motion_latched=false
```

DHT22、MQ 類比、MQ 數位、GY-SGP30 在全裝狀態皆可讀取。SR501 在高頻單元測試中已確認可觸發：

```text
CHANGE gpio27_level=1, motion_detected=true
CHANGE gpio27_level=0, motion_detected=false
```

整合測試已改為在每次輸出間每 `20ms` 取樣 SR501 並鎖存觸發，避免短暫 HIGH 被 `2s` Serial 輸出間隔漏掉。此次整合監看期間未觸發 SR501，因此 `motion_detected=false`。

整合測試開機會先執行 RGB 自測：

```text
red -> green -> blue -> white -> off
```

進入 Sensor 狀態模式後，Serial log 會輸出 `rgb_status`：

```text
green_normal          -> Sensor 正常、無警示、無人體偵測
yellow_gas_warning    -> MQ DO 觸發
purple_sensor_error   -> DHT22 / GY-SGP30 / MQ 類比異常
blue_motion_detected  -> SR501 偵測到人體
```

若只需要同時確認所有 Sensor，並讓 RGB 固定紅、綠、藍依序顯示，可使用：

```text
hardware/t_series/tests/all_sensors_rgb_cycle_test/all_sensors_rgb_cycle_test.ino
```

此測試每 `2s` 讀取一次 DHT22、MQ、GY-SGP30、SR501，並讓 RGB 依序顯示：

```text
red -> green -> blue
```

Serial log 會輸出 `rgb_color` 與各 Sensor 狀態。

2026-05-23 全 Sensor + RGB 紅綠藍循環測試結果：

```text
rgb_color=red/green/blue
dht_ok=true
temperature_c=26.00-26.10
humidity_percent=33.20-33.30
gas_raw=1458-1535
gas_voltage=1.175-1.237
gas_analog_ok=true
gas_do=1
gas_detected=false
pir_level=0
motion_detected=false
motion_latched=false
sgp30_ok=true
eco2_ppm=400-408
tvoc_ppb=0-2
```

此測試期間 DHT22、MQ、GY-SGP30 皆正常讀取；SR501 未觸發但讀值穩定為 LOW；RGB Serial 已依序輸出 `red -> green -> blue`。

## 設定方式

需要 WiFi 或後端上傳時，先複製設定範本：

```bash
cp hardware/t_series/config.h.example hardware/t_series/config.h
```

查 Mac 的區網 IP：

```bash
ipconfig getifaddr en0
```

如果使用有線網路，可能是：

```bash
ipconfig getifaddr en1
```

編輯 `config.h`：

```cpp
#define WIFI_SSID "你的 WiFi 名稱"
#define WIFI_PASSWORD "你的 WiFi 密碼"
#define API_URL "http://你的 Mac 區網 IP:3003/api/series/t_series/readings"
#define DEVICE_API_TOKEN "local-dev-device-token"
#define DEVICE_ID "t-series-001"
```

ESP32 不能使用 `localhost` 連到 Mac；`localhost` 對 ESP32 來說是 ESP32 自己。`config.h` 會包含 WiFi 密碼，因此已由 `.gitignore` 排除，不可提交。

## 後端上傳測試

T 系列主程式會每 10 秒上傳一筆資料到：

```text
/api/series/t_series/readings
```

後端會自動建立資料表：

```text
series_t_series_readings
```

測試前先確認本地服務正常：

```bash
docker compose ps
curl http://localhost:3003/health
```

編譯主程式：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/t_series
```

燒錄主程式：

```bash
arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:mhetesp32minikit hardware/t_series
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-XXXX -c baudrate=115200
```

ESP32 Serial Monitor 需看到：

```text
POST status: 201
```

查詢資料庫：

```bash
docker compose exec postgres psql -U smart_home -d smart_home
```

```sql
SELECT id, values, metadata, received_at
FROM series_t_series_readings
ORDER BY id DESC
LIMIT 5;
```

## 變更紀錄

| 日期 | 內容 |
|---|---|
| 2026-06-01 | 更新正式主程式為標準欄位版本，補上 `DEVICE_ID`、`metadata.device_id`、`rgb_status`、MQ 欄位命名與 Arduino ESP32 core 3.x RGB PWM 相容寫法；尚未進行硬體實測 |
| 2026-05-24 | 讀取新接 ESP32-D0WD-V3 revision v3.1，序列埠 `/dev/cu.usbserial-02WVZ1NM`，新增 GPIO 腳位自測程式 |
| 2026-05-23 | 完成全 Sensor + RGB 紅綠藍循環測試，DHT22、MQ、GY-SGP30 正常，SR501 未觸發但可讀 |
| 2026-05-23 | 新增全 Sensor + RGB 紅綠藍循環測試 |
| 2026-05-23 | 整合測試加入 RGB 開機自測與 `rgb_status` Serial 輸出 |
| 2026-05-23 | 全部 Sensor 安裝後完成整合測試；DHT22、MQ、GY-SGP30 正常，SR501 單元測試可觸發，整合測試新增 20ms SR501 鎖存 |
| 2026-05-22 | 新增最小化 `IO21/IO22` I2C 掃描測試，用於排除 SGP30 函式庫因素 |
| 2026-05-22 | 將 RGB 單元測試腳位恢復為 `R=IO16`、`G=IO17`、`B=IO18` |
| 2026-05-22 | 暫時將 RGB 單元測試改為 `R=IO21`、`G=IO17`、`B=IO22`，用於診斷 IO21/IO22 是否可輸出 |
| 2026-05-22 | 新增 GY-SGP30 I2C 腳位掃描測試，用於排查 SDA/SCL 接腳問題 |
| 2026-05-22 | 將 SR501 單元測試改為每 5ms 高頻讀取、每 100ms 輸出，並加入線路狀態診斷 |
| 2026-05-16 | 更新 SR501 單元測試說明，偵測到人體時使用開發板內建 LED 亮起 |
| 2026-05-16 | 建立 T 系列主程式、單元測試、整合測試與接線文件 |
