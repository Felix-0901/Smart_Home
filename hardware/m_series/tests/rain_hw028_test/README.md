# HW-028 兩腳雨滴感測板測試

## 接線

這片是 HW-028 雨滴感測板本體，只有兩個接點，沒有 `VCC`、`GND`、`AO`、`DO` 腳位。兩個接點沒有正負極，需要搭配一顆電阻做分壓後讀取類比值。

```text
ESP32 3V3 -> 10kΩ 電阻 -> GPIO32 -> HW-028 任一腳
HW-028 另一腳 -> ESP32 GND
```

不要直接把兩腳雨滴板一端接 `3V3`、另一端接 `GND`，這樣雨滴導通時可能接近短路。中間必須有 `10kΩ` 左右的限流 / 分壓電阻。

## 測試程式

```text
hardware/m_series/tests/rain_hw028_test/rain_hw028_test.ino
```

## 編譯

```bash
arduino-cli compile --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series/tests/rain_hw028_test
```

## 燒錄

```bash
arduino-cli upload -p /dev/cu.usbserial-31430 --fqbn 'esp32:esp32:nodemcu-32s' hardware/m_series/tests/rain_hw028_test
```

## 監看

```bash
arduino-cli monitor -p /dev/cu.usbserial-31430 -c baudrate=115200
```

## 輸出欄位

- `rain_raw`：`GPIO32` 類比讀值
- `rain_voltage`：`GPIO32` 換算電壓
- `rain_level_hint`：依目前 raw 值粗略判斷乾燥、潮濕或導通

此兩腳版本沒有 `DO` 門檻輸出，需先記錄乾燥與滴水時的 `rain_raw` 範圍，再把門檻整合進主程式。
