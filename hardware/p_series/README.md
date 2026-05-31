# P 系列

## 系列資訊

- `seriesKey`: `p_series`
- 原始參考程式：`/Users/felix/Downloads/智能節能 全面啟動！/p_collection/p_collection.ino`
- 晶片：`ESP32-C3` revision v0.4，MAC `34:85:18:05:86:c0`
- USB-to-Serial：ESP32-C3 內建 `USB-Serial/JTAG`
- 序列埠：`/dev/cu.usbmodem314301`
- 板型：Seeed Studio XIAO ESP32C3；此系列不是 K 系列的 `MH ET LIVE ESP32MiniKit`
- FQBN：`esp32:esp32:XIAO_ESP32C3`
- 韌體格式：Arduino CLI sketch

## 硬體配置

原始 `p_collection.ino` 會讀取 ACS712 電流感測器、連線 WiFi、呼叫舊 PHP API，並依 API 回傳值控制 `A0`。

目前先不直接燒錄原始程式，原因如下：

- 原始程式包含明文 WiFi 密碼，不適合納入專案版本控制
- 本機尚未安裝 `ACS712.h` 函式庫，原始程式目前無法編譯
- 目前先以最小化輸出循環測試確認 `A0` / `A1` 腳位寫法可在 ESP32-C3 FQBN 下編譯、燒錄與執行

P 系列測試會優先沿用原始程式的 Arduino-style 腳位寫法：

- `A0`：開關輸出控制
- `A1`：ACS712 類比輸入

## 腳位表

| 用途 | 板子絲印 | 程式 GPIO | 備註 |
|---|---:|---:|---|
| 開關輸出測試 | `A0` / `D0` | `GPIO2` | 沿用原始 `p_collection.ino` 的控制腳；繼電器 `IN` 目前接此腳 |
| ACS712 電流輸入 | `A1` / `D1` | `GPIO3` | 沿用原始 `p_collection.ino` 的讀取腳；感測器 `OUT` 接此腳 |

注意事項：

- 不同板型的 `A0` / `A1` 會對應不同實體 GPIO，必須以實際 `arduino-cli board list` 辨識出的 FQBN 為準
- 目前 P 系列已用 `esp32:esp32:XIAO_ESP32C3` 燒錄成功
- 若板型選錯，程式仍可能編譯，但 `A0` 可能不是你接線的那個孔位
- 若 `A0` 在某個 ESP32 variant 中對應 input-only 腳，該 FQBN 就不適合 P 系列原始接法

ESP32 GPIO 只能承受 3.3V。若接的是繼電器模組，控制腳 `IN` 必須是 3.3V-safe，並且與 ESP32 共地。

## 建議接線

若要測試循環開啟 / 關閉：

| 模組 | 模組腳位 | ESP32 腳位 | 說明 |
|---|---:|---:|---|
| 繼電器 / 開關模組 | `IN` | `A0` / `D0` / `GPIO2` | 沿用原始 P 系列程式控制腳 |
| 繼電器 / 開關模組 | `GND` | `GND` | 必須共地 |
| 繼電器 / 開關模組 | `VCC` | 依模組規格 | 常見 5V 繼電器需外部 5V 或板上 `VCC` |

若只是確認板子可燒錄，可先用 LED 測試：

```text
GPIO2 / A0 / D0 -> 220-330 ohm 電阻 -> LED 正腳
LED 負腳 -> GND
```

## 單元測試

測試程式：

```text
hardware/p_series/tests/output_cycle_test/output_cycle_test.ino
```

測試行為：

- `A0` 每 2 秒切換一次 `HIGH` / `LOW`
- `A1` 每次切換時讀取一次 `analogRead(A1)` 並輸出到 Serial
- Serial 會印出目前板型下 `A0` / `A1` 實際解析成的 pin number，方便確認 FQBN 是否選對

編譯：

```bash
arduino-cli compile --fqbn 'esp32:esp32:XIAO_ESP32C3' hardware/p_series/tests/output_cycle_test
```

燒錄前先確認序列埠：

```bash
ls /dev/cu.*
arduino-cli board list
```

燒錄範例：

```bash
arduino-cli upload -p /dev/cu.usbmodem314301 --fqbn 'esp32:esp32:XIAO_ESP32C3' hardware/p_series/tests/output_cycle_test
```

監看：

```bash
arduino-cli monitor -p /dev/cu.usbmodem314301 -c baudrate=115200
```

2026-05-30 實測 Serial log 摘要：

```text
Switch pin A0 resolved to pin number: 2
Current sense pin A1 resolved to pin number: 3
ON | A0=1 | A1 raw=3674-3739
OFF | A0=0 | A1 raw=3673-3705
```

測試結果：已成功燒錄並看到 `A0` 以 2 秒間隔循環 `HIGH` / `LOW`，`A1` 類比讀值也會隨狀態變化。

## 腳位掃描測試

測試程式：

```text
hardware/p_series/tests/pin_sweep_test/pin_sweep_test.ino
```

此測試會輪流驅動下列候選腳位，每個腳位先 `HIGH` 3 秒，再 `LOW` 3 秒：

- `A0 / D0 / GPIO2`
- `A1 / D1 / GPIO3`
- `A2 / D2 / GPIO4`
- `D3 / GPIO5`
- `D4 / SDA / GPIO6`
- `D5 / SCL / GPIO7`
- `D6 / TX / GPIO21`
- `D7 / RX / GPIO20`
- `D8 / SCK / GPIO8`
- `D9 / MISO / GPIO9`
- `D10 / MOSI / GPIO10`

編譯與燒錄：

```bash
arduino-cli compile --fqbn 'esp32:esp32:XIAO_ESP32C3' hardware/p_series/tests/pin_sweep_test
arduino-cli upload -p /dev/cu.usbmodem314301 --fqbn 'esp32:esp32:XIAO_ESP32C3' hardware/p_series/tests/pin_sweep_test
arduino-cli monitor -p /dev/cu.usbmodem314301 -c baudrate=115200
```

2026-05-30 實測結果：

- `A0` 在 Seeed Studio XIAO ESP32C3 FQBN 下確認解析為 `GPIO2`
- `A1` 在 Seeed Studio XIAO ESP32C3 FQBN 下確認解析為 `GPIO3`
- 繼電器 `IN` 接 `GPIO2` 時，應使用 `A0` / `D0` 控制
- 若繼電器沒有聲音，優先確認繼電器供電、`GND` 是否與 ESP32-C3 共地，以及繼電器模組是否為低電位觸發

## 正式 MQTT 韌體

正式智慧插座韌體：

```text
hardware/p_series/p_series.ino
```

此韌體會連線 WiFi 與 MQTT broker，訂閱：

```text
smart-home/p_series/{device_id}/command
```

後端發布 retained command 後，ESP32-C3 會立即控制 `A0 / GPIO2` 繼電器，並發布：

```text
smart-home/p_series/{device_id}/state
smart-home/p_series/{device_id}/telemetry
smart-home/p_series/{device_id}/availability
```

設定檔範本：

```bash
cp hardware/p_series/config.h.example hardware/p_series/config.h
```

`config.h` 需填入 WiFi、MQTT host 與 `DEVICE_ID`。此檔案已被 `.gitignore` 排除，不可提交真實密碼或 MQTT 憑證。

編譯：

```bash
arduino-cli compile --fqbn 'esp32:esp32:XIAO_ESP32C3' hardware/p_series
```

P 系列韌體需要 Arduino `PubSubClient` 函式庫。若尚未安裝，先執行：

```bash
arduino-cli lib install PubSubClient
```

## 變更紀錄

- 2026-06-01：新增正式 MQTT 智慧插座韌體 `p_series.ino` 與 `config.h.example`，使用 retained command 控制 `A0/GPIO2` 繼電器，並發布 state、telemetry 與 availability。
- 2026-05-30：依 Seeed Studio XIAO ESP32C3 pinout 修正 FQBN 為 `esp32:esp32:XIAO_ESP32C3`，確認 `A0` 解析為 `GPIO2`、`A1` 解析為 `GPIO3`，並成功燒錄 `output_cycle_test`。
- 2026-05-30：新增 `pin_sweep_test` 多腳位掃描測試，並改為 XIAO ESP32C3 的 `D0` 到 `D10` 腳位對照。
- 2026-05-24：新增 P 系列開關輸出循環測試，改以原始 `p_collection.ino` 的 `A0` 控制寫法為準，待實體板型辨識後確認 FQBN。
