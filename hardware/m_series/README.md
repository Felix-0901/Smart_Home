# M 系列

## 系列資訊

- `seriesKey`: `m_series`
- 原始參考程式：本機參考資料中的 `m_collection/m_collection.ino`
- 板型：ESP32 NodeMCU-32S
- FQBN：`esp32:esp32:nodemcu-32s`
- 韌體格式：Arduino CLI sketch
- 目前開發模式：ESP32 先使用 USB 供電；TP4056、18650 與太陽能板先作為綠能儲電展示，不直接供電給 ESP32。

## 硬體配置

M 系列使用以下模組：

- 18650 鋰電池
- TP4056 USB Type-C 鋰電池充電保護模組
- 太陽能板
- DHT22 溫溼度模組
- GY-SGP30 空氣品質感測模組
- MQ 類比氣體感測模組
- 火焰模組
- RGB LED
- I2C OLED 顯示器（目前測到位址 `0x3C`）
- ACS712 電流偵測模組（已接線；目前未接太陽能板，數值只用來檢查接線與方向）

目前 `sensor_read_test` 會讀取 DHT22、GY-SGP30、MQ、火焰模組與 ACS712，控制 RGB LED 顯示狀態，並讓 OLED 輪播各 Sensor 數值。ACS712 目前以 `GPIO34` 讀取，OLED 會多一頁顯示充電電流。

## 腳位表

| 用途 | NodeMCU-32S 腳位 | 程式 GPIO | 備註 |
|---|---:|---:|---|
| DHT22 data | `GPIO4` | `GPIO4` | 一般數位腳 |
| I2C SDA | `GPIO21` | `GPIO21` | GY-SGP30 SDA；OLED SDA 共用 |
| I2C SCL | `GPIO22` | `GPIO22` | GY-SGP30 SCL；OLED SCL 共用 |
| MQ 類比輸入 | `GPIO33` | `GPIO33` | ADC1 |
| MQ 數位輸入 | `GPIO25` | `GPIO25` | MQ 使用 3.3V 供電時可直接接 |
| 火焰模組類比輸入 | `GPIO35` | `GPIO35` | ADC input only |
| 火焰模組數位輸入 | `GPIO26` | `GPIO26` | 只在 3.3V-safe 時接 |
| ACS712 類比輸入 | `GPIO34` | `GPIO34` | ADC input only；已接線，建議分壓後接入 |
| RGB LED R | `GPIO16` | `GPIO16` | 已接線；必須串接限流電阻 |
| RGB LED G | `GPIO17` | `GPIO17` | 已接線；必須串接限流電阻 |
| RGB LED B | `GPIO18` | `GPIO18` | 已接線；必須串接限流電阻 |

## 重要安全限制

ESP32 GPIO 只能承受 3.3V。任何 Sensor 的 `AO`、`DO`、`OUT` 若輸出 5V，都不能直接接 ESP32。

目前 MQ 模組若使用 `3V3` 供電，可先這樣接：

```text
MQ VCC -> 3V3
MQ GND -> GND
MQ AO  -> GPIO33
MQ DO  -> GPIO25
```

若後續 MQ 改用 5V 供電，`AO` 與 `DO` 都必須先分壓或電平轉換後再接 ESP32。

ACS712 若使用 5V 供電，`OUT` 也建議先分壓或確認輸出不會超過 3.3V，再接 `GPIO34`。目前程式假設 `OUT -> 10kΩ -> GPIO34`、`GPIO34 -> 20kΩ -> GND` 的分壓接法，並以 ACS712-05B 的 `185mV/A` 作為初始換算值；若實際是 20A 或 30A 版本，需調整程式內的 `ACS712_SENSITIVITY_V_PER_A`。

OLED 目前接在 I2C 匯流排上，需使用 `3V3` 供電。若 OLED 模組接 `5V` 會讓 SDA / SCL 上拉到 5V，就不能直接接 ESP32。

## 建議接線

| 模組 | 模組腳位 | ESP32 / TP4056 腳位 | 說明 |
|---|---:|---:|---|
| DHT22 | `VCC` | `3V3` | 不要接 5V |
| DHT22 | `GND` | `GND` | 共地 |
| DHT22 | `DATA` | `GPIO4` | 可加 `10k` 上拉到 `3V3` |
| GY-SGP30 | `VCC` | `3V3` | 不要接 5V |
| GY-SGP30 | `GND` | `GND` | 共地 |
| GY-SGP30 | `SDA` | `GPIO21` | I2C SDA |
| GY-SGP30 | `SCL` | `GPIO22` | I2C SCL |
| OLED | `VCC` | `3V3` | 不要接 5V |
| OLED | `GND` | `GND` | 共地 |
| OLED | `SDA` | `GPIO21` | 與 GY-SGP30 共用 I2C SDA |
| OLED | `SCL` | `GPIO22` | 與 GY-SGP30 共用 I2C SCL |
| MQ 模組 | `VCC` | `3V3` | 先用安全測試接法 |
| MQ 模組 | `GND` | `GND` | 共地 |
| MQ 模組 | `AO` | `GPIO33` | 類比輸入 |
| MQ 模組 | `DO` | `GPIO25` | 數位輸入 |
| 火焰模組 | `VCC` | `3V3` | 先用安全測試接法 |
| 火焰模組 | `GND` | `GND` | 共地 |
| 火焰模組 | `AO` | `GPIO35` | 類比輸入 |
| 火焰模組 | `DO` | `GPIO26` | 數位輸入 |
| RGB LED | `R` | `GPIO16` | 每個顏色通道都要串接限流電阻 |
| RGB LED | `G` | `GPIO17` | 每個顏色通道都要串接限流電阻 |
| RGB LED | `B` | `GPIO18` | 每個顏色通道都要串接限流電阻 |
| RGB LED | 共用腳 | `GND` | 目前程式以共陰 RGB 設定；若是共陽需改 `RGB_COMMON_ANODE` |
| ACS712 | `VCC` | `5V` | 若 `OUT` 可能超過 3.3V，需分壓 |
| ACS712 | `GND` | `GND` | 共地 |
| ACS712 | `OUT` | `GPIO34` | 建議先分壓後接入 |
| TP4056 | `B+` | ACS712 `IP+` | 充電電流方向假設 |
| ACS712 | `IP-` | 18650 正極 | 若充電時數值為負，可對調 `IP+` / `IP-` 或在程式反相 |
| 18650 | 負極 | TP4056 `B-` | 電池端 |
| 太陽能板 | 正極 | TP4056 `+` | TP4056 充電輸入 |
| 太陽能板 | 負極 | TP4056 `-` | TP4056 充電輸入 |

TP4056 的 `OUT+` / `OUT-` 先不接 ESP32。若要用 18650 供 ESP32，需要在 TP4056 後方加 5V 升壓模組。

## 單元測試

### I2C 掃描測試

若 GY-SGP30 在整合讀取中顯示 `sgp30_ok=false`，先使用最小化 I2C 掃描測試：

```text
hardware/m_series/tests/i2c_21_22_scan/i2c_21_22_scan.ino
```

編譯：

```bash
arduino-cli compile --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series/tests/i2c_21_22_scan
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series/tests/i2c_21_22_scan
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-XXXX -c baudrate=115200
```

若 GY-SGP30 接線正確，應看到：

```text
found address 0x58
```

若 OLED 也接上，應同時看到 OLED 位址 `0x3C`：

```text
found address 0x3C
found address 0x58
```

2026-05-31 使用新 NodeMCU-32S 測試結果：

```text
Port: /dev/cu.usbserial-31420
MAC: 94:b5:55:fb:fa:f8
idle_levels sda=1, scl=1
I2C scan on SDA=GPIO21, SCL=GPIO22
Expected GY-SGP30 address: 0x58
found address 0x58
```

此結果確認 GY-SGP30 在新板子的 `GPIO21` / `GPIO22` 可正常被 I2C 掃描找到。

2026-05-31 OLED 接上後 I2C 掃描結果：

```text
Port: /dev/cu.usbserial-31430
idle_levels sda=1, scl=1
I2C scan on SDA=GPIO21, SCL=GPIO22
Expected GY-SGP30 address: 0x58
found address 0x3C
found address 0x58
```

此結果確認 OLED 位址為 `0x3C`，可與 GY-SGP30 `0x58` 共用 `GPIO21` / `GPIO22`。

### Sensor 讀取測試

測試程式：

```text
hardware/m_series/tests/sensor_read_test/sensor_read_test.ino
```

此測試會每 2 秒輸出：

- I2C 掃描結果，GY-SGP30 正常應出現 `0x58`
- DHT22 溫度、濕度、體感溫度
- GY-SGP30 `eCO2`、`TVOC`
- MQ `AO` raw / voltage 與 `DO`
- 火焰模組 `AO` raw / voltage 與 `DO`
- RGB 狀態：啟動時自測紅、綠、藍、白、關閉，之後依警示狀態顯示顏色
- OLED 輪播頁面：DHT22、GY-SGP30、MQ、火焰模組、充電電流、系統狀態
- ACS712 電流欄位：`current_raw`、`current_adc_voltage`、`current_sensor_voltage`、`charge_current_a`、`charge_current_ma`

RGB 狀態規則：

| 狀態 | RGB 顏色 | 判斷條件 |
|---|---|---|
| 一般正常 | 綠色 | DHT22、GY-SGP30、MQ 類比讀值正常，且沒有氣體或火焰警示 |
| 氣體警示 | 黃色 | MQ `DO=0` |
| 火焰警示 | 紅色 | 火焰模組 `DO=0` |
| Sensor 錯誤 | 紫色 | DHT22、GY-SGP30 或 MQ 類比讀值異常 |

編譯：

```bash
arduino-cli compile --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series/tests/sensor_read_test
```

燒錄前先確認序列埠：

```bash
ls /dev/cu.*
arduino-cli board list
```

燒錄範例：

```bash
arduino-cli upload -p /dev/cu.usbserial-130 --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series/tests/sensor_read_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-130 -c baudrate=115200
```

2026-05-31 實測 Serial log 摘要：

```text
i2c_idle_sda=1, i2c_idle_scl=1, i2c_addresses=none
dht_ok=true, temperature_c=27.80, humidity_percent=42.10
sgp30_ok=false, eco2_ppm=null, tvoc_ppb=null
mq_raw=734, mq_voltage=0.592, mq_do=1
flame_raw=2483, flame_voltage=2.001, flame_do=1
current_raw=225, current_voltage=0.181
```

測試結果：

- ESP32 NodeMCU-32S 已可用 `esp32:esp32:nodemcu-32s` 編譯與燒錄，序列埠為 `/dev/cu.usbserial-130`。
- DHT22 可正常讀取溫濕度。
- MQ `AO` / `DO` 有讀值，但 `AO` 讀值波動較大，需確認麵包板接點與供電穩定性。
- 火焰模組 `AO` / `DO` 有讀值，`DO` 會隨模組門檻與環境狀態變化。
- GY-SGP30 目前 I2C 掃描沒有找到 `0x58`，需優先檢查 `VCC -> 3V3`、`GND -> GND`、`SDA -> GPIO21`、`SCL -> GPIO22`。
- ACS712 目前未接線；`current_raw` / `current_voltage` 是 GPIO34 浮接讀值，不可視為有效電流資料。

2026-05-31 更換新 NodeMCU-32S 後完整 Sensor 測試摘要：

```text
Port: /dev/cu.usbserial-31420
MAC: 94:b5:55:fb:fa:f8
i2c_idle_sda=1, i2c_idle_scl=1, i2c_addresses=none
dht_ok=true, temperature_c=26.00, humidity_percent=40.20
sgp30_ok=false, eco2_ppm=null, tvoc_ppb=null
mq_raw=818, mq_voltage=0.659, mq_do=1
flame_raw=1314, flame_voltage=1.059, flame_do=0
current_raw=0, current_voltage=0.000
```

測試結果：

- DHT22 可正常讀取溫濕度。
- MQ `AO` / `DO` 有讀值。
- 火焰模組 `AO` / `DO` 有讀值。
- ACS712 目前未接線；`current_raw` / `current_voltage` 是 GPIO34 浮接讀值，不可視為有效電流資料。
- GY-SGP30 在最小化 I2C 掃描時可回應 `0x58`，但完整 Sensor 接線下再次變成 `i2c_addresses=none`。此現象優先檢查 SGP30 的 `3V3` / `GND` 是否被其他模組共用電源軌影響，以及 MQ 模組若接 `3V3` 是否造成 3.3V 供電不穩。

2026-05-31 修正 I2C 掃描流程後完整 Sensor 測試摘要：

```text
i2c_idle_sda=1, i2c_idle_scl=1, i2c_addresses=0x58
dht_ok=true, temperature_c=25.80, humidity_percent=40.90
sgp30_ok=true, eco2_ppm=424, tvoc_ppb=0
mq_raw=651, mq_voltage=0.525, mq_do=0
flame_raw=1410, flame_voltage=1.136, flame_do=0
current_raw=0, current_voltage=0.000
```

測試結果：

- GY-SGP30 已可在完整測試程式中掃到 `0x58` 並讀取 `eCO2` / `TVOC`。
- DHT22 可正常讀取溫濕度。
- MQ 腳位仍會輸出 raw / DO；若 MQ 模組當下已拔除，此讀值是浮接腳位讀值，不可視為有效氣體資料。
- 火焰模組有 raw 值輸出，需依實際觸發條件再校正門檻；ACS712 目前未接線，`current_raw` / `current_voltage` 需忽略。

2026-05-31 MQ 接回後完整 Sensor 測試摘要：

```text
Port: /dev/cu.usbserial-31430
i2c_idle_sda=1, i2c_idle_scl=1, i2c_addresses=0x58
dht_ok=true, temperature_c=30.00, humidity_percent=43.00
sgp30_ok=true, eco2_ppm=424-443, tvoc_ppb=24-41
mq_raw=2134-2158, mq_voltage=1.720-1.739, mq_do=1
flame_raw=0-2724, flame_voltage=0.000-2.195, flame_do=0-1
current_raw=0-66, current_voltage=0.000-0.053  # ACS712 未接線，此欄位為浮接讀值
```

測試結果：DHT22、GY-SGP30、MQ 與火焰模組皆有輸出；GY-SGP30 在完整接線下維持 `0x58` 與 `sgp30_ok=true`。ACS712 目前未接線，`current_raw` / `current_voltage` 為浮接讀值，需忽略。

2026-05-31 RGB LED 接上後完整 Sensor 測試摘要：

```text
Port: /dev/cu.usbserial-31430
MAC: 94:b5:55:fb:fa:f8
i2c_idle_sda=1, i2c_idle_scl=1, i2c_addresses=0x58
dht_ok=true, temperature_c=28.90, humidity_percent=41.20-41.50
sgp30_ok=true, eco2_ppm=400, tvoc_ppb=0
mq_raw=967-978, mq_voltage=0.779-0.788, mq_do=1, gas_detected=false
flame_raw=0-619, flame_voltage=0.000-0.499, flame_do=0, flame_detected=true
rgb_status=red_flame_warning
current_connected=false, current_raw=null, current_voltage=null
```

測試結果：DHT22、GY-SGP30、MQ 與火焰模組皆可讀取，RGB 已由程式控制。由於火焰模組目前輸出 `DO=0`，程式判斷為 `flame_detected=true`，RGB 狀態為紅色火焰警告；若現場沒有火焰，下一步需調整火焰模組可變電阻或確認此模組的 `DO` 是否為高電位觸發。ACS712 未接線，電流欄位已改為 `null`。

2026-05-31 OLED 與 RGB 整合後完整 Sensor 測試摘要：

```text
Port: /dev/cu.usbserial-31430
MAC: 94:b5:55:fb:fa:f8
i2c_idle_sda=1, i2c_idle_scl=1, i2c_addresses=0x3C|0x58
dht_ok=true, temperature_c=27.40, humidity_percent=39.20-42.00
sgp30_ok=true, eco2_ppm=400-440, tvoc_ppb=0-1
mq_raw=387-455, mq_voltage=0.312-0.367, mq_do=1, gas_detected=false
flame_raw=3824-4061, flame_voltage=3.082-3.273, flame_do=1, flame_detected=false
rgb_status=green_normal
oled_ok=true, oled_page=1-5
current_connected=false, current_raw=null, current_voltage=null
```

測試結果：DHT22、GY-SGP30、MQ、火焰模組、RGB LED 與 OLED 皆正常輸出。OLED 已整合進 `sensor_read_test`，每 2 秒輪播 DHT22、GY-SGP30、MQ、火焰模組與系統狀態；目前沒有氣體或火焰警示，RGB 顯示綠色正常狀態。

2026-05-31 ACS712 接線後、未接太陽能板的完整 Sensor 測試摘要：

```text
Port: /dev/cu.usbserial-31430
MAC: 94:b5:55:fb:fa:f8
i2c_idle_sda=1, i2c_idle_scl=1, i2c_addresses=0x3C|0x58
dht_ok=true, temperature_c=26.40-26.60, humidity_percent=39.00-44.50
sgp30_ok=true, eco2_ppm=400-626, tvoc_ppb=0-28
mq_raw=251-299, mq_voltage=0.202-0.241, mq_do=1, gas_detected=false
flame_raw=3741-4095, flame_voltage=3.015-3.300, flame_do=1, flame_detected=false
rgb_status=green_normal
oled_ok=true, oled_page=1-6
current_connected=true, current_raw=1937-2089, current_adc_voltage=1.561-1.683
current_sensor_voltage=2.341-2.525, current_zero_sensor_voltage=2.500
charge_current_a=-0.857-0.000
```

測試結果：DHT22、GY-SGP30、MQ、火焰模組、RGB LED、OLED 與 ACS712 類比輸入皆有回報。因目前未接太陽能板，`charge_current_a` 不代表太陽能充電；目前出現負值，代表電流方向與「充電方向」相反、零點偏移，或電池 / TP4056 端存在放電路徑。後續接上太陽能板後，需確認照光時 `charge_current_a` 是否往正值增加；若照光時仍為負值，需對調 ACS712 `IP+` / `IP-` 或在程式中反相。

2026-05-31 TP4056 Type-C 供電、未接太陽能板的電流測試摘要：

```text
Port: /dev/cu.usbserial-31430
i2c_idle_sda=0, i2c_idle_scl=0, i2c_addresses=none
dht_ok=true, temperature_c=25.50-25.70, humidity_percent=40.50
sgp30_ok=false, eco2_ppm=null, tvoc_ppb=null
mq_raw=459-468, mq_voltage=0.370-0.377, mq_do=1, gas_detected=false
flame_raw=4095, flame_voltage=3.300, flame_do=1, flame_detected=false
rgb_status=purple_sensor_error
oled_ok=false
current_connected=true, current_raw=1965-1967
current_adc_voltage=1.584-1.585, current_sensor_voltage=2.375-2.378
charge_current_a=-0.674--0.661
```

測試結果：TP4056 插 Type-C 時，ACS712 有量到約 `-660mA` 等級的電流，表示電流感測路徑有電流通過；負號代表目前方向與程式定義的「充電正方向」相反，後續可對調 ACS712 `IP+` / `IP-` 或在程式中反相。此測試同時發現 I2C `SDA` / `SCL` 被拉低，OLED 與 GY-SGP30 暫時讀不到，需優先檢查 `GPIO21` / `GPIO22`、OLED、GY-SGP30 與新接線是否有鬆脫、短路或電源軌被拉低。

2026-05-31 程式反相後 TP4056 Type-C 供電電流測試摘要：

```text
Port: /dev/cu.usbserial-31430
i2c_addresses=0x58 / 0x3C / 0x3C|0x58  # 位址間歇出現
dht_ok=true, temperature_c=26.80, humidity_percent=41.00-46.80
sgp30_ok=true/false
oled_ok=true/false
mq_raw=383-933, mq_do=1, gas_detected=false
flame_raw=3995-4034, flame_do=1, flame_detected=false
rgb_status=green_normal / purple_sensor_error
current_connected=true
current_raw=1958-2032
charge_current_a=0.236-0.720
charge_current_ma=236-720
```

測試結果：程式已將 ACS712 電流方向反相，TP4056 插 Type-C 時電流顯示為正值，約 `+236mA` 到 `+720mA`。I2C 目前有間歇性不穩，OLED `0x3C` 與 GY-SGP30 `0x58` 有時只出現其中一個，需整理 `GPIO21` / `GPIO22`、3.3V 與 GND 連接後再重測。

### RGB LED 直接腳位測試

若 `sensor_read_test` 顯示 `rgb_status` 但實體 RGB LED 沒有亮，先燒錄最小化 RGB 腳位測試：

```text
hardware/m_series/tests/rgb_led_test/rgb_led_test.ino
```

編譯：

```bash
arduino-cli compile --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series/tests/rgb_led_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-31430 --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series/tests/rgb_led_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-31430 -c baudrate=115200
```

此測試會先用共陰邏輯測 `red HIGH`、`green HIGH`、`blue HIGH`、`white HIGH`，再用共陽邏輯測 `red LOW`、`green LOW`、`blue LOW`、`white LOW`。若兩段都完全不亮，優先檢查 RGB LED 共腳是否接錯、R/G/B 腳位順序是否接錯、限流電阻是否串在顏色通道上，以及是否接到正確的 `GPIO16`、`GPIO17`、`GPIO18`。

2026-05-31 RGB LED 直接腳位測試：

```text
Port: /dev/cu.usbserial-31430
M series RGB LED direct GPIO test
R/G/B pins: GPIO16/GPIO17/GPIO18
common cathode test
red HIGH
green HIGH
blue HIGH
white HIGH
off LOW
common anode test
red LOW
green LOW
blue LOW
white LOW
off HIGH
```

測試結果：程式可正常燒錄並循環切換 `GPIO16`、`GPIO17`、`GPIO18`。若實體 LED 仍完全不亮，需從 RGB LED 接線與共陽/共陰型態排查。

### OLED 顯示測試

測試程式：

```text
hardware/m_series/tests/oled_display_test/oled_display_test.ino
```

此測試使用 U8g2 的 `SSD1306 128x64 I2C` 設定，位址為 `0x3C`。螢幕上應顯示：

```text
M series OLED
I2C: GPIO21/22
ADDR: 0x3C
COUNT: ...
```

編譯：

```bash
arduino-cli compile --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series/tests/oled_display_test
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-31430 --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series/tests/oled_display_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbserial-31430 -c baudrate=115200
```

2026-05-31 OLED 顯示測試結果：

```text
Port: /dev/cu.usbserial-31430
i2c_addresses=0x3C|0x58
oled_found=true
u8g2_begin=true
oled_frame_sent=true
```

測試結果：ESP32 可掃到 OLED `0x3C` 與 GY-SGP30 `0x58`，OLED 測試程式可正常編譯、燒錄並持續送出畫面。若螢幕沒有顯示文字，但 Serial 持續出現 `oled_frame_sent=true`，需確認 OLED 是 SSD1306 還是 SH1106；SH1106 需要改用對應的 U8g2 constructor。

### OLED 面板檢查測試

若整合測試顯示 `oled_ok=true`，但實體 OLED 沒有亮，使用面板檢查測試：

```text
hardware/m_series/tests/oled_panel_check/oled_panel_check.ino
```

此測試會輪流使用 SSD1306 與 SH1106 兩種 U8g2 driver，依序顯示全白畫面、大字與邊框。若其中一種 driver 會亮，需把 `sensor_read_test` 的 OLED constructor 改成該型號；若兩種 driver 都完全不亮，但 Serial 仍掃到 `0x3C`，代表 OLED 的 I2C 邏輯有回應，但面板顯示端、供電或接線仍需排查。

編譯：

```bash
arduino-cli compile --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series/tests/oled_panel_check
```

燒錄：

```bash
arduino-cli upload -p /dev/cu.usbserial-31430 --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series/tests/oled_panel_check
```

2026-05-31 OLED 面板檢查測試結果：

```text
Port: /dev/cu.usbserial-31430
show_full_white driver=SSD1306
show_text driver=SSD1306
show_border driver=SSD1306
clear driver=SSD1306
show_full_white driver=SH1106
show_text driver=SH1106
show_border driver=SH1106
clear driver=SH1106
```

測試結果：程式可正常燒錄並持續對 OLED `0x3C` 送出 SSD1306 / SH1106 測試畫面。此測試期間板子上跑的是 `oled_panel_check`，不是完整 Sensor 整合測試。

## 正式整合韌體

正式韌體：

```text
hardware/m_series/m_series.ino
```

此韌體整合 DHT22、GY-SGP30、MQ、火焰模組、ACS712、RGB LED 與 OLED，並輸出標準 `values` / `metadata` JSON。若存在 `config.h`，會透過 HTTP POST 上傳到：

```text
/api/series/m_series/readings
```

設定檔範本：

```bash
cp hardware/m_series/config.h.example hardware/m_series/config.h
```

`config.h` 會包含 WiFi 密碼與後端 token，已由 `.gitignore` 排除，不可提交。

編譯：

```bash
arduino-cli compile --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series
```

## 變更紀錄

- 2026-06-01：新增正式整合韌體 `m_series.ino` 與 `config.h.example`，整合 Sensor、RGB、OLED、ACS712 與 HTTP readings 上傳欄位；尚未進行硬體實測。
- 2026-05-31：新增 M 系列 Sensor 測試規劃與 `sensor_read_test`，先測 DHT22、GY-SGP30、MQ、火焰模組與 ACS712，不控制 RGB。
- 2026-05-31：完成第一次 M 系列 Sensor 實測紀錄；DHT22、MQ、火焰模組有讀值，GY-SGP30 I2C 未偵測到；ACS712 尚未接線，後續忽略 `current_raw` / `current_voltage` 浮接讀值。
- 2026-05-31：新增 M 系列最小化 I2C 掃描測試 `i2c_21_22_scan`，用來直接確認 GY-SGP30 是否在 `GPIO21` / `GPIO22` 回應 `0x58`。
- 2026-05-31：更換 NodeMCU-32S 後，於 `/dev/cu.usbserial-31420` 燒錄 I2C 掃描測試，已確認 GY-SGP30 回應 `0x58`。
- 2026-05-31：燒錄完整 Sensor 測試；DHT22、MQ、火焰模組有讀值，ACS712 尚未接線；GY-SGP30 在完整接線下未被 I2C 掃描找到，需檢查共用電源軌與其他模組對 3.3V 的影響。
- 2026-05-31：調整 `sensor_read_test`，當 I2C 掃描重新看到 `0x58` 時會再次初始化 GY-SGP30，避免剛開機未穩定時永久判定失敗。
- 2026-05-31：重新燒錄完整 Sensor 測試後仍未在完整接線下掃到 GY-SGP30，確認不是初始化重試問題；建議下一步逐一拔除 MQ 與火焰模組，定位造成 I2C 消失的元件或電源軌；ACS712 尚未接線。
- 2026-05-31：修正 `sensor_read_test` 的 I2C 掃描流程，對齊最小化掃描測試，在每次掃描前重新設定 `Wire.begin(GPIO21, GPIO22)` 與 100kHz clock。
- 2026-05-31：修正後重新燒錄完整 Sensor 測試，已確認完整測試程式可掃到 GY-SGP30 `0x58`，且 `sgp30_ok=true`。
- 2026-05-31：MQ 接回後於 `/dev/cu.usbserial-31430` 重跑完整 Sensor 測試，確認 DHT22、GY-SGP30、MQ 與火焰模組皆有輸出；ACS712 尚未接線，電流欄位為浮接讀值。
- 2026-05-31：新增 RGB LED PWM 自測與狀態燈邏輯，R/G/B 分別使用 `GPIO16`、`GPIO17`、`GPIO18`，並將 ACS712 設為未接線，Serial 電流欄位固定輸出 `null`。
- 2026-05-31：RGB LED 接上後重新燒錄完整測試，確認 DHT22、GY-SGP30、MQ、火焰模組與 RGB 狀態皆有輸出；目前火焰模組 `DO=0`，RGB 顯示紅色火焰警告。
- 2026-05-31：新增 `rgb_led_test` 最小化 RGB LED 腳位測試，直接切換 `GPIO16`、`GPIO17`、`GPIO18` 的高低電位，以排除 PWM 與整合邏輯干擾。
- 2026-05-31：OLED 接上 `GPIO21` / `GPIO22` I2C 匯流排後，I2C 掃描同時找到 OLED `0x3C` 與 GY-SGP30 `0x58`。
- 2026-05-31：新增 `oled_display_test`，使用 U8g2 測試 `SSD1306 128x64 I2C` OLED，確認可編譯、燒錄並持續送出畫面。
- 2026-05-31：將 OLED 整合進 `sensor_read_test`，新增五頁輪播顯示 DHT22、GY-SGP30、MQ、火焰模組與系統狀態，並重新燒錄完整測試；目前 RGB 狀態為 `green_normal`。
- 2026-05-31：新增 `oled_panel_check`，輪流以 SSD1306 與 SH1106 driver 顯示全白、大字與邊框，用於排查 OLED 有 I2C 回應但實體不亮的狀況。
- 2026-05-31：啟用 ACS712 電流讀取，將 OLED 輪播改為六頁並新增充電電流頁；未接太陽能板時完成整體檢查，ACS712 有類比輸出但目前讀值為負，需在接上太陽能板後再確認充電方向。
- 2026-05-31：TP4056 插 Type-C、未接太陽能板時測到 ACS712 約 `-660mA` 電流，確認電流路徑有通過 ACS712；同時 I2C bus 被拉低，OLED 與 GY-SGP30 暫時讀不到，需先排查 `GPIO21` / `GPIO22` 接線。
- 2026-05-31：將 ACS712 充電電流方向在程式中反相，TP4056 插 Type-C 時改為顯示正電流，約 `+236mA` 到 `+720mA`；I2C 位址仍間歇不穩，需整理接線後再重測。
