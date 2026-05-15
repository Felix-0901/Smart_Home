# K 系列

## 系列資訊

- `seriesKey`: `k_series`
- 已讀取晶片：ESP32-D0WD-V3，revision v3.0
- USB-to-Serial：Silicon Labs CP2104
- 序列埠：`/dev/cu.usbserial-020JE15F`
- 初步確認板型：MINI KIT ESP32，Arduino CLI 對應 `MH ET LIVE ESP32MiniKit`
- FQBN：`esp32:esp32:mhetesp32minikit`
- 韌體格式：Arduino CLI sketch
- 上傳 API：`/api/series/k_series/readings`
- 本地後端：`http://localhost:3003`

## Mini Kit 腳位基準

此系列以你提供的 `LIVE MINI KIT ESP32` 背面絲印為準，不使用一般 ESP32 DevKit 圖上的腳位。

優先使用的安全腳位：

| 用途 | Mini Kit 絲印 | 程式 GPIO | 備註 |
|---|---:|---:|---|
| DHT22 data | `IO4` | `GPIO4` | 一般數位腳 |
| I2C SDA | `IO21` | `GPIO21` | GY-SGP30 SDA |
| I2C SCL | `IO22` | `GPIO22` | GY-SGP30 SCL |
| MQ 類比輸入 | `IO34` | `GPIO34` | ADC input only |
| MQ 數位輸入 | `IO25` | `GPIO25` | 只在 3.3V-safe 時接 |
| 火焰模組類比輸入 | `IO35` | `GPIO35` | ADC input only |
| 火焰模組數位輸入 | `IO26` | `GPIO26` | 只在 3.3V-safe 時接 |
| RGB LED R | `IO16` | `GPIO16` | 必須串接限流電阻 |
| RGB LED G | `IO17` | `GPIO17` | 必須串接限流電阻 |
| RGB LED B | `IO18` | `GPIO18` | 必須串接限流電阻 |

先避免使用：

- `SD1`、`SD2`、`SD3`、`CLK`、`CMD`、`SDD`：通常跟 Flash/SDIO 有關，不拿來接 Sensor
- `TDI`、`TDO/TD0`、`TMS`、`TCK`：JTAG 腳，必要時才使用
- `IO0`、`IO2`、`IO5`：開機 strapping 腳，外接模組可能影響開機
- `TXD`、`RXD`：USB Serial 會用到，除非需要 UART，先不要接 Sensor

`IO34`、`IO35`、`SVP`、`SVN` 是 input only，不能拿來輸出控制 LED 或繼電器。

照片中的 Sensor 初步判斷：

- DHT22 / AM2302 溫溼度模組
- MQ 系列氣體感測模組，模組上可見 `VCC GND DO AO`
- GY-SGP30 空氣品質感測模組，讀取 `eCO2` 與 `TVOC`
- MH-Sensor-Series 火焰 / 紅外線類比模組，模組上可見 `VCC GND DO AO`
- 4 腳 RGB LED，需確認共陽或共陰後接線

## 重要安全限制

ESP32 GPIO 只能承受 3.3V。任何 Sensor 的 `AO`、`DO` 若輸出 5V，都不能直接接 ESP32。

MQ 氣體感測模組通常需要 5V 供應加熱器，但它的 `AO` 在 5V 供電時可能輸出 0-5V。若 MQ 用 5V 供電，`AO` 必須先經過分壓後再接 ESP32 ADC。

建議先這樣處理：

- DHT22 / AM2302：使用 3.3V
- GY-SGP30：使用 3.3V
- 火焰 / 紅外線模組：優先使用 3.3V
- MQ 氣體模組：可用 5V 供電，但 `AO` 需要分壓；`DO` 先不要接，或經過電平轉換

## 建議接線

| 模組 | 模組腳位 | ESP32 腳位 | 說明 |
|---|---:|---:|---|
| DHT22 / AM2302 | `+` / `VCC` | `3V3` | 不要接 5V |
| DHT22 / AM2302 | `OUT` | `GPIO4` | 溫溼度資料 |
| DHT22 / AM2302 | `-` / `GND` | `GND` | 共地 |
| GY-SGP30 | `VCC` | `3V3` | 不要接 5V |
| GY-SGP30 | `GND` | `GND` | 共地 |
| GY-SGP30 | `SCL` | `GPIO22` | I2C SCL |
| GY-SGP30 | `SDA` | `GPIO21` | I2C SDA |
| MQ 氣體模組 | `VCC` | `VCC` | Mini Kit 的 `VCC` 通常是 USB 5V，供 MQ 加熱器使用 |
| MQ 氣體模組 | `GND` | `GND` | 共地 |
| MQ 氣體模組 | `AO` | `GPIO34` | 若 MQ 用 5V 供電，必須先分壓 |
| MQ 氣體模組 | `DO` | `GPIO25` | 若 DO 是 5V，需電平轉換；不確定時先不接 |
| 火焰 / 紅外線模組 | `VCC` | `3V3` | 若 3.3V 不穩再另行調整 |
| 火焰 / 紅外線模組 | `GND` | `GND` | 共地 |
| 火焰 / 紅外線模組 | `AO` | `GPIO35` | 類比輸入 |
| 火焰 / 紅外線模組 | `DO` | `GPIO26` | 數位輸入 |
| RGB LED | `R` | `GPIO16` | 串接 220-330 ohm 電阻 |
| RGB LED | `G` | `GPIO17` | 串接 220-330 ohm 電阻 |
| RGB LED | `B` | `GPIO18` | 串接 220-330 ohm 電阻 |
| RGB LED | 共用腳 | `GND` 或 `3V3` | 共陰接 `GND`，共陽接 `3V3` |

MQ `AO` 分壓範例：

```text
MQ AO -- 10k -- ESP32 GPIO34 -- 20k -- GND
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

如何判斷共用腳：

- 4 腳 RGB LED 通常最長腳是共用腳
- 共用腳接 `GND` 後，單一顏色腳經電阻接 `3V3` 會亮，通常是共陰
- 共用腳接 `3V3` 後，單一顏色腳經電阻接 `GND` 會亮，通常是共陽

單元測試程式：

```text
hardware/k_series/tests/rgb_led_test/rgb_led_test.ino
```

測試程式預設為共陰。如果你的 LED 是共陽，請把測試程式中的：

```cpp
constexpr bool COMMON_ANODE = false;
```

改成：

```cpp
constexpr bool COMMON_ANODE = true;
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/k_series/tests/rgb_led_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-020JE15F --fqbn esp32:esp32:mhetesp32minikit hardware/k_series/tests/rgb_led_test
```

K 系列 RGB 狀態燈規則：

| 顏色 | 狀態 |
|---|---|
| 藍色 | 啟動、WiFi 連線中或資料上傳中 |
| 綠色 | Sensor 正常、WiFi 正常、後端上傳成功，且未觸發警示 |
| 黃色 | MQ 氣體模組 `DO` 觸發 |
| 紅色 | 火焰 / 紅外線模組 `DO` 觸發 |
| 紫色 | Sensor 異常，例如 DHT22 失敗、GY-SGP30 失敗、MQ `gas_raw <= 5` |
| 青色 | WiFi 未連上，但已接 Sensor 讀取正常且未觸發警示 |
| 白色 | WiFi 已連上，但後端 API / PostgreSQL 上傳失敗 |

狀態優先順序：

```text
紅色火焰警示 > 黃色氣體警示 > 紫色 Sensor 異常 > 青色 WiFi 未連上 > 白色後端上傳失敗 > 綠色正常 > 藍色暫態
```

MQ 類比異常判斷：

```text
gas_raw <= 5
```

K 系列 MQ 正常時曾讀到約 `300-500`。若封裝後 `gas_raw` 連續為 `0`，通常代表 `AO -> IO34` 線材、接觸點或麵包板導通異常，即使 `DO` 沒觸發也不能視為正常。

2026-05-15 狀態燈規則更新後測試結果：

```text
gas_raw=10-20
gas_analog_ok=true
gas_detected=false
flame_detected=false
temperature_c=26.5-26.6
eco2_ppm=400
wifi_rssi=-50
```

新版韌體已開始上傳 `gas_analog_ok` 欄位。若 `gas_raw <= 5`，狀態燈會顯示紫色；目前最新資料判定 MQ 類比線未達異常門檻。

正式主程式已整合 RGB 狀態燈邏輯。若主程式正常上傳且沒有警示，封蓋後應顯示綠色。若 RGB 完全不亮，先確認：

- 共用腳是否接對，K 系列程式目前預設 `RGB_COMMON_ANODE=false`，也就是共陰接法
- 每個顏色通道是否都有串接 `220-330 ohm` 電阻
- `R -> IO16`、`G -> IO17`、`B -> IO18` 是否接到正確孔位
- 若 LED 是共陽，需將主程式與 RGB 測試程式的 `RGB_COMMON_ANODE` / `COMMON_ANODE` 改為 `true`

## 整合測試

整合測試會同時讀取 DHT22、MQ、GY-SGP30、火焰 / 紅外線模組，並依狀態控制 RGB LED。此測試不連 WiFi，也不會上傳後端。

單元測試程式：

```text
hardware/k_series/tests/integration_test/integration_test.ino
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/k_series/tests/integration_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-020JE15F --fqbn esp32:esp32:mhetesp32minikit hardware/k_series/tests/integration_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-020JE15F -c baudrate=115200
```

2026-05-15 初次整合測試結果：

```text
dht_ok=true
temperature_c=26.00-26.10
humidity_percent=36.10-37.50
gas_raw=428-576
gas_do=1
gas_detected=false
flame_raw=4095
flame_do=1
flame_detected=false
sgp30_ok=true
eco2_ppm=400-548
tvoc_ppb=0-27
```

目前可判斷 DHT22、MQ、GY-SGP30、火焰 / 紅外線模組皆可同時讀取。此測試未觸發氣體或火焰警示，RGB LED 依規則應顯示綠色；若實際顏色不正確，需確認 RGB LED 是共陰或共陽，並調整 `RGB_COMMON_ANODE`。

## GY-SGP30 測試

GY-SGP30 使用 I2C，K 系列接線如下：

```text
GY-SGP30 VCC -> 3V3
GY-SGP30 GND -> GND
GY-SGP30 SDA -> IO21
GY-SGP30 SCL -> IO22
```

不要接到 `VCC/5V`。如果模組板有標示 `VIN` 且確認板上有穩壓與電平轉換，才可以另行評估；目前 K 系列先一律用 `3V3`。

單元測試程式：

```text
hardware/k_series/tests/sgp30_test/sgp30_test.ino
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/k_series/tests/sgp30_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-020JE15F --fqbn esp32:esp32:mhetesp32minikit hardware/k_series/tests/sgp30_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-020JE15F -c baudrate=115200
```

正常會看到：

```text
eco2_ppm=400, tvoc_ppb=0
```

SGP30 剛上電時需要暖機，前幾分鐘的 `eCO2` / `TVOC` 只能當作連線測試，不適合作為穩定空氣品質數據。

2026-05-15 初次測試結果：

```text
eco2_ppm=400-418
tvoc_ppb=0-19
```

穩定後多數讀值為 `eco2_ppm=400`、`tvoc_ppb=0`。目前可判斷 I2C 接線與 SGP30 讀取正常。

## 火焰 / 紅外線模組測試

K 系列接線如下：

```text
火焰 / 紅外線模組 VCC -> 3V3
火焰 / 紅外線模組 GND -> GND
火焰 / 紅外線模組 AO  -> IO35
火焰 / 紅外線模組 DO  -> IO26
```

單元測試程式：

```text
hardware/k_series/tests/flame_test/flame_test.ino
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/k_series/tests/flame_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-020JE15F --fqbn esp32:esp32:mhetesp32minikit hardware/k_series/tests/flame_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-020JE15F -c baudrate=115200
```

正常會看到：

```text
flame_raw=...
do_level=...
```

多數此類模組的 `DO` 是低電位觸發；測試程式暫以 `do_level=0` 視為觸發。

2026-05-15 初次測試結果：

```text
flame_raw=4095
approx_adc_voltage=3.300V
do_level=1
flame_detected_by_do=false
```

停止監看前曾短暫看到 `flame_raw` 降到約 `3123-3271`，`do_level` 仍維持 `1`。目前可判斷 AO/DO 皆有讀值，但尚未做安全的觸發測試。

## 設定方式

先查 Mac 的區網 IP：

```bash
ipconfig getifaddr en0
```

如果你用有線網路，可能是：

```bash
ipconfig getifaddr en1
```

編輯 `config.h`：

```cpp
#define WIFI_SSID "你的 WiFi 名稱"
#define WIFI_PASSWORD "你的 WiFi 密碼"
#define API_URL "http://你的 Mac 區網 IP:3003/api/series/k_series/readings"
#define DEVICE_API_TOKEN "local-dev-device-token"
```

ESP32 不能使用 `localhost` 連到你的 Mac；`localhost` 對 ESP32 來說是 ESP32 自己。

## 後端上傳測試

K 系列主程式會每 10 秒上傳一筆資料到：

```text
/api/series/k_series/readings
```

本地測試時，`config.h` 的 `API_URL` 使用 Mac 區網 IP，例如：

```text
http://192.168.0.7:3003/api/series/k_series/readings
```

`config.h` 會包含 WiFi 密碼，因此已加入 `.gitignore`，不要提交。

2026-05-15 初次 WiFi / 後端 / PostgreSQL 上傳測試結果：

```text
WiFi SSID: elevenbook_WIFI
POST status: 201
資料表: series_k_series_readings
初次查詢資料筆數: 9
```

最新資料範例：

```text
temperature_c=25.6-25.7
humidity_percent=38.8-39.1
eco2_ppm=400
tvoc_ppb=0-21
gas_raw=269-304
flame_raw=4095
wifi_rssi=-64 到 -53
```

查詢資料庫：

```bash
docker compose exec postgres psql -U smart_home -d smart_home
```

```sql
SELECT id, values, metadata, received_at
FROM series_k_series_readings
ORDER BY id DESC
LIMIT 5;
```

2026-05-15 封蓋後確認結果：

```text
資料筆數: 29 -> 32
最新寫入時間: 2026-05-15 09:55:58 UTC
temperature_c=25.8-26.0
humidity_percent=44.8-45.3
eco2_ppm=400-457
tvoc_ppb=0-32
gas_raw=290-430
gas_detected=false
flame_raw=4095
flame_detected=false
wifi_rssi=-70 到 -50
```

封蓋後資料仍約每 10 秒持續寫入 PostgreSQL。DHT22、MQ、GY-SGP30、火焰 / 紅外線模組與 WiFi 上傳皆正常。

2026-05-15 封裝前再次確認結果：

```text
資料筆數: 81 -> 84
latest_received_at: 2026-05-15 10:09:46 UTC
temperature_c=26.2-26.3
humidity_percent=42.4-42.8
eco2_ppm=400-532
tvoc_ppb=0-139
gas_raw=0
gas_detected=false
flame_raw=4095
flame_detected=false
wifi_rssi=-54 到 -49
```

DHT22、GY-SGP30、火焰 / 紅外線模組、WiFi 與 PostgreSQL 寫入正常。MQ 數位輸出仍為未觸發，但 MQ 類比值 `gas_raw` 連續為 `0`，和先前正常讀值約 `300-500` 不一致；封裝前需檢查 MQ `AO -> IO34` 線材、接觸點與麵包板導通。

## 編譯

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/k_series
```

## 燒錄

先插上 ESP32，再確認序列埠：

```bash
ls /dev/cu.*
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-020JE15F --fqbn esp32:esp32:mhetesp32minikit hardware/k_series
```

如果上傳時卡住，按住 ESP32 的 `BOOT` 再重試，看到開始寫入後放開。

## Serial Monitor

```bash
arduino-cli monitor -p /dev/cu.usbserial-XXXX -c baudrate=115200
```

正常情況會看到：

- WiFi 連線成功
- SGP30 是否偵測到
- 每 10 秒送出一筆 JSON
- HTTP POST status

## 變更紀錄

- 2026-05-15：新增規定後補記 K 系列 README 變更紀錄；將原本誤判的 BME280 / BMP280 修正為 GY-SGP30，主程式改讀 `eco2_ppm` 與 `tvoc_ppb`，並新增 `tests/sgp30_test/`。
- 2026-05-15：補上 GY-SGP30 接線、單元測試、編譯、燒錄與監看方式；初次測試讀到 `eco2_ppm=400-418`、`tvoc_ppb=0-19`，穩定後多數為 `400/0`。
- 2026-05-15：新增火焰 / 紅外線模組單元測試，記錄 `AO -> IO35`、`DO -> IO26` 接線與測試流程；初次測試讀到 `flame_raw=4095`、`do_level=1`，停止前短暫降到約 `3123-3271`，尚未做觸發測試。
- 2026-05-15：新增 RGB LED 接線規劃，使用 `R -> IO16`、`G -> IO17`、`B -> IO18`，並新增 `tests/rgb_led_test/`。
- 2026-05-15：新增 K 系列整合測試 `tests/integration_test/`，制定 RGB 狀態燈規則：綠色正常、黃色氣體警示、紅色火焰警示、紫色感測器錯誤、藍色啟動；初次整合測試確認 DHT22、MQ、GY-SGP30、火焰 / 紅外線模組皆可同時讀取。
- 2026-05-15：完成 `elevenbook_WIFI` WiFi 連線、後端 API 上傳與 PostgreSQL 寫入測試，主程式回傳 `POST status: 201`，確認 `series_k_series_readings` 有資料寫入。
- 2026-05-15：封蓋後再次確認資料仍持續寫入 PostgreSQL，DHT22、MQ、GY-SGP30、火焰 / 紅外線模組與 WiFi 上傳皆正常。
- 2026-05-15：將 RGB LED 狀態燈邏輯正式整合進 K 系列主程式，主程式會依 WiFi / 上傳 / Sensor / 警示狀態切換顏色；新增青色狀態代表 WiFi 未連上但 Sensor 讀取正常；燒錄後 PostgreSQL 仍持續收到資料，但 USB serial 暫時未重新枚舉，若 RGB 仍不亮需檢查共陽 / 共陰與實體接線。
- 2026-05-15：封裝前再次確認時 DHT22、GY-SGP30、火焰 / 紅外線模組與 WiFi 上傳正常，但 MQ 類比值 `gas_raw` 連續為 `0`，需檢查 `AO -> IO34` 接線後再封裝。
- 2026-05-15：補完整 RGB 狀態燈規劃與優先順序，新增白色代表後端上傳失敗，並將 MQ `gas_raw <= 5` 納入紫色 Sensor 異常判斷，避免 MQ 類比線異常時仍顯示綠色。
- 2026-05-15：燒錄新版 RGB 狀態燈規則後，資料庫確認新版 payload 已包含 `gas_analog_ok=true`，最新 MQ `gas_raw=10-20`，未達異常門檻。
- 2026-05-15：依照 `LIVE MINI KIT ESP32` 背面絲印修正腳位配置，避免使用未外露或不適合的 GPIO。
- 2026-05-15：確認 MQ 氣體模組 `AO -> IO34`、`DO -> IO25` 測試通過。
- 2026-05-15：確認 DHT22 `DATA -> IO4` 測試通過。
