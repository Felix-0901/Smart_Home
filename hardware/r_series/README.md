# R 系列

## 系列資訊

- `seriesKey`: `r_series`
- 已讀取晶片：ESP32D0WDQ5，revision 1
- USB-to-Serial：待確認實體晶片；macOS 目前顯示 USB serial port
- 序列埠：目前偵測到 `/dev/cu.usbserial-02WVZ1NM`
- 板型：ESP32 MiniKit，沿用 K / T 系列同款 `MH ET LIVE ESP32MiniKit`
- FQBN：`esp32:esp32:mhetesp32minikit`
- 韌體格式：Arduino CLI sketch
- 上傳 API：`/api/series/r_series/readings`
- 資料表：`series_r_series_readings`
- 本地後端：`http://localhost:3003`

## 硬體配置

R 系列使用以下模組：

- DHT22 溫溼度模組
- GY-SGP30 空氣品質感測模組
- RGB LED
- MQ 氣體感測模組

目前腳位配置沿用 K / T 系列已驗證的 ESP32 MiniKit 安全腳位。MQ 類比輸入使用 `IO33`，數位輸入使用 `IO25`。

## 腳位表

| 用途 | 板子絲印 | 程式 GPIO | 備註 |
|---|---:|---:|---|
| DHT22 data | `IO4` | `GPIO4` | 一般數位腳 |
| I2C SDA | `IO21` | `GPIO21` | GY-SGP30 SDA |
| I2C SCL | `IO22` | `GPIO22` | GY-SGP30 SCL |
| MQ 類比輸入 | `IO33` | `GPIO33` | ADC1，WiFi 使用時可讀類比 |
| MQ 數位輸入 | `IO25` | `GPIO25` | 只在 3.3V-safe 時接 |
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

建議先這樣處理：

- DHT22：使用 3.3V
- GY-SGP30：使用 3.3V
- MQ 氣體模組：可用 5V 供電，但 `AO` 需要分壓；`DO` 先不要接，或確認只有 3.3V 後再接
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

後續 RGB 測試程式會預設共陰：

```cpp
constexpr bool RGB_COMMON_ANODE = false;
```

若 LED 是共陽，需改成：

```cpp
constexpr bool RGB_COMMON_ANODE = true;
```

R 系列預計 RGB 狀態燈規則：

| 顏色 | 狀態 |
|---|---|
| 藍色 | 啟動、WiFi 連線中或資料上傳中 |
| 綠色 | Sensor 正常、WiFi 正常、後端上傳成功 |
| 黃色 | MQ 氣體模組 `DO` 觸發 |
| 紫色 | Sensor 異常，例如 DHT22 失敗、GY-SGP30 失敗或 MQ `gas_raw == 0` |
| 青色 | WiFi 未連上，但已可讀 Sensor |
| 白色 | WiFi 已連上，但後端 API / PostgreSQL 上傳失敗 |

狀態優先順序：

```text
黃色氣體警示 > 紫色 Sensor 異常 > 青色 WiFi 未連上 > 白色後端上傳失敗 > 綠色正常 > 藍色暫態
```

## 單元測試

測試前先接上 ESP32，確認序列埠：

```bash
ls /dev/cu.*
arduino-cli board list
```

目前使用 FQBN：

```text
esp32:esp32:mhetesp32minikit
```

### GY-SGP30 測試

測試程式：

```text
hardware/r_series/tests/sgp30_test/sgp30_test.ino
```

接線：

```text
GY-SGP30 VCC -> 3V3
GY-SGP30 GND -> GND
GY-SGP30 SDA -> IO21
GY-SGP30 SCL -> IO22
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/sgp30_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-02WVZ1NM --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/sgp30_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-02WVZ1NM -c baudrate=115200
```

2026-05-24 Sensor-only 測試結果：

```text
port=/dev/cu.usbserial-02WVZ1NM
dht_ok=true 一次，之後多數為 false
temperature_c=23.20
humidity_percent=43.40
sgp30_ok=true
eco2_ppm=400-460
tvoc_ppb=0
gas_raw=738-864
gas_voltage=0.595-0.696
gas_analog_ok=true
gas_do=1，曾短暫為 0
gas_detected=false，曾短暫為 true
```

此輪測試中 GY-SGP30 與 MQ 類比輸入穩定；MQ DO 大多為 HIGH，曾短暫 LOW。DHT22 只在剛開始讀到一次，後續多數為 `dht_ok=false`，需檢查 DHT22 的 `VCC`、`GND`、`OUT -> IO4` 接觸，必要時確認 DATA 是否有上拉電阻或更換線材後再測。

2026-05-24 Sensor-only 重測結果：

```text
port=/dev/cu.usbserial-02WVZ1NM
dht_ok=true / false 間歇出現
temperature_c=23.30-23.40
humidity_percent=43.30-43.60
sgp30_ok=true
eco2_ppm=416-515
tvoc_ppb=0-37
gas_raw=656-868
gas_voltage=0.529-0.699
gas_analog_ok=true
gas_do=1 為主，最後短暫出現 0
gas_detected=false 為主，最後短暫 true
```

此輪重測中 GY-SGP30 與 MQ 類比輸入仍正常，MQ `DO` 大多維持 HIGH；最後曾短暫 LOW。DHT22 仍然間歇性失敗，問題集中在 DHT22 接線、上拉或模組穩定性。

2026-05-24 重插 DHT22 後 Sensor-only 測試結果：

```text
port=/dev/cu.usbserial-02WVZ1NM
dht_ok=true 為主，仍偶發 false
temperature_c=23.60-23.70
humidity_percent=42.70-43.10
sgp30_ok=true
eco2_ppm=418-484
tvoc_ppb=0-30
gas_raw=704-925
gas_voltage=0.567-0.745
gas_analog_ok=true
gas_do=0 為主，曾短暫為 1
gas_detected=true 為主，曾短暫 false
```

重插後 DHT22 成功率明顯改善，但仍不是完全穩定。GY-SGP30 與 MQ 類比輸入正常。MQ `DO` 在 `0` / `1` 間切換且以 LOW 為主，代表數位警報門檻接近目前環境讀值，可調整 MQ 模組可變電阻讓一般環境下維持 `gas_do=1`。

正常情況會先看到 I2C 掃描結果：

```text
I2C device found at 0x58
```

接著每秒輸出：

```text
eco2_ppm=400, tvoc_ppb=0
```

SGP30 剛上電時需要暖機，前幾分鐘的 `eCO2` / `TVOC` 只能當作連線測試，不適合作為穩定空氣品質數據。

2026-05-24 GY-SGP30 單元測試結果：

```text
port=/dev/cu.usbserial-02WVZ1NM
chip=ESP32D0WDQ5 revision 1
mac=a0:b7:65:66:e6:40
eco2_ppm=400-418
tvoc_ppb=0
```

此測試已確認 R 系列 GY-SGP30 在 `SDA=IO21`、`SCL=IO22` 可正常讀取。測試時 Serial Monitor 主要抓到連續空氣品質讀值，未重新抓完整開機 I2C 掃描段；若後續接線調整後讀不到，再使用下方最小化 I2C 掃描測試確認是否仍可看到 `0x58`。

若 `SDA=IO21`、`SCL=IO22` 掃不到 GY-SGP30，可先使用最小化 I2C 掃描測試：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/i2c_21_22_scan
arduino-cli upload -p /dev/cu.usbserial-02WVZ1NM --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/i2c_21_22_scan
arduino-cli monitor -p /dev/cu.usbserial-02WVZ1NM -c baudrate=115200
```

此測試不使用 Adafruit SGP30 函式庫，只用 `Wire.begin(21, 22)` 掃描 I2C ACK。若 GY-SGP30 接通，應看到：

```text
found address 0x58
```

### DHT22 測試

測試程式：

```text
hardware/r_series/tests/dht22_test/dht22_test.ino
```

接線：

```text
DHT22 + / VCC -> 3V3
DHT22 - / GND -> GND
DHT22 OUT / DATA -> IO4
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/dht22_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-02WVZ1NM --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/dht22_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-02WVZ1NM -c baudrate=115200
```

正常情況每 `2s` 會輸出：

```text
temperature_c=...
humidity_percent=...
heat_index_c=...
```

2026-05-24 DHT22 單元測試結果：

```text
port=/dev/cu.usbserial-02WVZ1NM
temperature_c=27.60-28.00
humidity_percent=38.40-41.20
heat_index_c=27.23-27.75
```

測試期間未看到 `DHT22 read failed`，已確認 R 系列 DHT22 在 `OUT=IO4` 可正常讀取。

### MQ 氣體模組測試

測試程式：

```text
hardware/r_series/tests/mq_test/mq_test.ino
```

接線：

```text
MQ VCC -> VCC / 5V
MQ GND -> GND
MQ AO -> IO33
MQ DO -> IO25
```

如果 MQ 用 5V 供電，`AO` 必須先分壓後才能接 `IO33`；`DO` 也要確認是 3.3V-safe 才能接 `IO25`。

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/mq_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-02WVZ1NM --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/mq_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-02WVZ1NM -c baudrate=115200
```

正常情況每 `1s` 會輸出：

```text
gas_raw=...
approx_adc_voltage=...
do_level=...
gas_detected_by_do=...
```

MQ Sensor 需要暖機，剛上電的 `gas_raw` 只能用來確認接線和讀值，不適合作為穩定氣體濃度判斷。

若 `gas_raw` 一直是 `0`，可使用 ADC 掃描測試確認線材與腳位：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/mq_adc_scan
arduino-cli upload -p /dev/cu.usbserial-02WVZ1NM --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/mq_adc_scan
arduino-cli monitor -p /dev/cu.usbserial-02WVZ1NM -c baudrate=115200
```

2026-05-24 MQ 氣體模組初次測試結果：

```text
port=/dev/cu.usbserial-02WVZ1NM
mq_test gas_raw=0-160
mq_test approx_adc_voltage=0.000-0.129V
mq_test do_level=1
mq_test gas_detected_by_do=false
mq_adc_scan GPIO32=289-320
mq_adc_scan GPIO33=0
mq_adc_scan GPIO25=1
```

`DO -> IO25` 目前可讀到 HIGH，代表數位警報未觸發。`AO -> IO33` 尚未確認穩定，因為 `mq_test` 讀值會掉到 `0`，且 ADC 掃描時 `GPIO33` 持續為 `0`，但 `GPIO32` 有穩定非零讀值。下一步需檢查 MQ `AO` 分壓後是否真的接到 `IO33`，或是否誤接到 `IO32`。

2026-05-24 更換 MQ Sensor 後測試結果：

```text
port=/dev/cu.usbserial-02WVZ1NM
gas_raw=209-458
approx_adc_voltage=0.168-0.369V
do_level=1
gas_detected_by_do=false
```

更換 MQ Sensor 後，`AO -> IO33` 已可連續讀到穩定非零值，測試期間未再出現連續 `gas_raw=0`。`DO -> IO25` 維持 HIGH，代表目前未觸發氣體警報。MQ Sensor 仍需暖機，後續整合測試時可用非零讀值判斷接線正常，但不要把剛上電讀值當作校準後的濃度。

### RGB LED 測試

測試程式：

```text
hardware/r_series/tests/rgb_led_test/rgb_led_test.ino
```

接線：

```text
RGB R -> 220-330 ohm -> IO16
RGB G -> 220-330 ohm -> IO17
RGB B -> 220-330 ohm -> IO18
```

共陰 RGB LED：

```text
共用腳 -> GND
```

共陽 RGB LED：

```text
共用腳 -> 3V3
```

測試程式預設共陰：

```cpp
constexpr bool COMMON_ANODE = false;
```

若 LED 是共陽，需改成：

```cpp
constexpr bool COMMON_ANODE = true;
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/rgb_led_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-02WVZ1NM --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/rgb_led_test
```

燒錄後 RGB LED 會每 `1s` 依序循環：

```text
red -> green -> blue
```

2026-05-24 RGB LED 測試結果：

```text
port=/dev/cu.usbserial-02WVZ1NM
serial_cycle=red -> green -> blue
mode=common cathode
```

測試程式已燒錄並持續輸出 `red -> green -> blue` 循環。需以肉眼確認實際 LED 顏色是否和 Serial 顯示一致；若顏色順序不同，代表 `R` / `G` / `B` 接線需要互換。

## 整合測試

整合測試會同時讀取 DHT22、GY-SGP30、MQ，並依狀態控制 RGB LED。此測試不連 WiFi，也不會上傳後端。

測試程式：

```text
hardware/r_series/tests/integration_test/integration_test.ino
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/integration_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-02WVZ1NM --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/integration_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-02WVZ1NM -c baudrate=115200
```

整合測試開機會先執行 RGB 自測：

```text
red -> green -> blue -> off
```

進入 Sensor 狀態模式後，正常 log 會包含：

```text
dht_ok=true
temperature_c=...
humidity_percent=...
gas_raw=...
gas_analog_ok=true
gas_detected=false
sgp30_ok=true
eco2_ppm=...
tvoc_ppb=...
rgb_status=green_normal
```

RGB 狀態：

```text
green_normal          -> Sensor 正常、MQ DO 未觸發
yellow_gas_warning    -> MQ DO 觸發
purple_sensor_error   -> DHT22 / GY-SGP30 / MQ 類比異常
```

2026-05-24 整合測試結果：

```text
port=/dev/cu.usbserial-02WVZ1NM
dht_ok=true
temperature_c=23.10-23.20
humidity_percent=41.90-42.30
gas_raw=768-816
gas_voltage=0.619-0.658
gas_analog_ok=true
gas_do=0
gas_detected=true
sgp30_ok=true
eco2_ppm=400
tvoc_ppb=0
rgb_status=yellow_gas_warning
```

DHT22、GY-SGP30 與 MQ 類比輸入皆可正常讀取。MQ 數位輸入 `DO -> IO25` 目前持續為 LOW，因此整合測試判定 `gas_detected=true`，RGB 狀態為黃色氣體警示。若現場沒有氣體觸發，需調整 MQ 模組上的可變電阻閾值，直到一般環境下 `gas_do=1`，再保留氣體接近測試時 `gas_do=0`。

2026-05-30 整合重測結果：

```text
port=/dev/cu.usbserial-02WVZ1NM
chip=ESP32-D0WD-V3 revision v3.1
mac=a0:b7:65:66:e6:40
dht_ok=true
temperature_c=27.60
humidity_percent=39.40-39.80
gas_raw=689-724
gas_voltage=0.555-0.583
gas_analog_ok=true
gas_do=1
gas_detected=false
sgp30_ok=true
eco2_ppm=400-422
tvoc_ppb=0-9
rgb_status=green_normal
```

此輪重測已確認 DHT22、GY-SGP30、MQ 類比、MQ 數位輸入皆正常；整合狀態為 `green_normal`。RGB 程式已輸出正常狀態，實際 LED 顏色需以目視確認是否為綠色。

2026-05-30 目前連線板整合測試結果：

```text
port=/dev/cu.usbserial-02GW5RZ2
chip=ESP32-D0WD-V3 revision v3.1
mac=e0:8c:fe:33:0d:f0
dht_ok=true
temperature_c=27.70
humidity_percent=38.70-38.90
gas_raw=957-971
gas_voltage=0.771-0.782
gas_analog_ok=true
gas_do=1
gas_detected=false
sgp30_ok=true
eco2_ppm=400-407
tvoc_ppb=0
rgb_status=green_normal
```

此輪測試的 MAC 與前一筆 R 系列記錄 `a0:b7:65:66:e6:40` 不同，代表目前接上的板子可能不是先前那塊 R 系列板，或板子已更換。以目前連線板與 R 系列接線來看，DHT22、GY-SGP30、MQ 類比、MQ 數位輸入與 RGB 狀態程式皆正常。

## Sensor-only 測試

此測試只讀取 DHT22、GY-SGP30、MQ，不控制 RGB LED，適合單純確認 Sensor 是否正常。

測試程式：

```text
hardware/r_series/tests/sensor_read_test/sensor_read_test.ino
```

編譯：

```bash
arduino-cli compile --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/sensor_read_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-02WVZ1NM --fqbn esp32:esp32:mhetesp32minikit hardware/r_series/tests/sensor_read_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-02WVZ1NM -c baudrate=115200
```

## 設定方式

正式韌體：

```text
hardware/r_series/r_series.ino
```

此韌體整合 DHT22、GY-SGP30、MQ 與 RGB 狀態燈，並輸出標準 `values` / `metadata` JSON。若存在 `config.h`，會透過 HTTP POST 上傳到：

```text
/api/series/r_series/readings
```

設定檔範本：

```bash
cp hardware/r_series/config.h.example hardware/r_series/config.h
```

`config.h` 會包含 WiFi 密碼與後端 token，已由 `.gitignore` 排除，不可提交。

## 變更紀錄

- 2026-06-01：新增正式整合韌體 `r_series.ino` 與 `config.h.example`，整合 DHT22、GY-SGP30、MQ、RGB 狀態燈與 HTTP readings 上傳欄位；尚未進行硬體實測。
- 2026-05-30：使用目前連線板 `/dev/cu.usbserial-02GW5RZ2` 重測 R 系列整合測試，記錄 MAC `e0:8c:fe:33:0d:f0` 與前次不同；目前 DHT22、GY-SGP30、MQ 與 RGB 狀態皆正常。
- 2026-05-24：建立 R 系列 README，規劃初始腳位，新增 GY-SGP30 測試流程。
- 2026-05-24：完成 GY-SGP30 單元測試，確認 `IO21` / `IO22` 可正常讀取 `eco2_ppm` 與 `tvoc_ppb`。
- 2026-05-24：新增 DHT22 單元測試流程，使用 `OUT -> IO4`。
- 2026-05-24：完成 DHT22 單元測試，確認 `OUT=IO4` 可正常讀取溫度、濕度與熱指數。
- 2026-05-24：修正 R 系列模組清單，移除 SR501，改為 MQ 氣體感測模組，規劃 `AO -> IO33`、`DO -> IO25` 並新增 MQ 測試程式。
- 2026-05-24：執行 MQ 初次測試，`DO -> IO25` 可讀 HIGH，`AO -> IO33` 尚未穩定，需檢查是否接到 `IO33` 或誤接 `IO32`。
- 2026-05-24：更換 MQ Sensor 後重新測試，確認 `AO -> IO33` 可穩定讀取非零值，`DO -> IO25` 可讀 HIGH。
- 2026-05-24：新增 RGB LED 紅、綠、藍循環測試，使用 `R -> IO16`、`G -> IO17`、`B -> IO18`。
- 2026-05-24：燒錄 RGB LED 測試，Serial 已確認程式依序輸出 `red -> green -> blue`。
- 2026-05-24：新增 R 系列整合測試，同時讀取 DHT22、GY-SGP30、MQ 並控制 RGB 狀態燈。
- 2026-05-24：完成 R 系列整合測試，DHT22、GY-SGP30、MQ 類比皆正常，MQ DO 持續觸發所以 RGB 顯示黃色警示。
- 2026-05-24：新增 Sensor-only 測試，只讀取 DHT22、GY-SGP30、MQ，不控制 RGB LED。
- 2026-05-24：執行 Sensor-only 測試，GY-SGP30 與 MQ 穩定，DHT22 後續多數讀取失敗，需檢查接線或上拉。
- 2026-05-24：重跑 Sensor-only 測試，GY-SGP30 與 MQ 類比正常，DHT22 仍間歇性讀取失敗。
- 2026-05-24：重插 DHT22 後再次測試，DHT22 成功率改善但仍偶發失敗，MQ DO 以 LOW 為主且偶爾回 HIGH。
- 2026-05-30：修正 RGB PWM 程式以支援 Arduino ESP32 core `3.3.6`，`integration_test`、`rgb_led_test`、`sensor_read_test` 已可編譯通過；硬體尚未重測，因為 macOS 未偵測到 ESP32 USB serial port。
- 2026-05-30：完成 R 系列整合重測，DHT22、GY-SGP30、MQ 與 RGB 狀態邏輯皆正常，狀態為 `green_normal`。
