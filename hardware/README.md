# Hardware

## 模組簡介

`hardware/` 用來放各組硬體的韌體程式、接線紀錄、板子設定與感測器測試程式。之後每一組硬體建議用獨立子資料夾管理，避免不同板子的程式碼混在一起。

## 使用技術

實際工具會依板子決定：

- Arduino CLI
- PlatformIO
- esptool.py
- avrdude

## 資料夾結構

```text
hardware/
├── README.md
├── k_series/
├── m_series/
├── p_series/
├── r_series/
└── t_series/
```

後續建議結構：

```text
hardware/
├── k_series/
├── m_series/
├── r_series/
└── t_series/
```

每個硬體子資料夾建議包含：

- 韌體程式碼
- 接線腳位表
- 使用的板子型號
- 使用的感測器或模組
- 燒錄方式
- Serial log 範例

## 本地開發流程

先接上硬體 USB，再確認序列埠：

```bash
ls /dev/cu.*
```

確認板子型號後，再決定使用 Arduino CLI 或 PlatformIO 建立對應專案。

## 環境變數

硬體程式碼不應直接寫入正式 API Token、資料庫密碼或私密金鑰。若硬體需要連線後端，應使用測試環境 URL 或透過設定檔處理。

## 建置 / 啟動方式

各系列的編譯、燒錄與監看方式記錄在各自 README：

- [K 系列](k_series/README.md)
- [M 系列](m_series/README.md)
- [P 系列](p_series/README.md)
- [R 系列](r_series/README.md)
- [T 系列](t_series/README.md)

跨系列的 Sensor 欄位、RGB 狀態燈、P 系列 MQTT 與後端整合方向記錄在：

- [硬體系列整合規劃](../docs/hardware-integration-plan.md)

目前正式韌體入口：

- `k_series/k_series.ino`：K 系列 HTTP readings 韌體
- `m_series/m_series.ino`：M 系列 HTTP readings + OLED 韌體
- `p_series/p_series.ino`：P 系列 MQTT 智慧插座韌體
- `r_series/r_series.ino`：R 系列 HTTP readings 韌體
- `t_series/t_series.ino`：T 系列 HTTP readings 韌體

## 部署細節

硬體燒錄不需要開啟 Arduino IDE，後續可用 CLI 完成編譯、上傳與 Serial Monitor。

## 常見問題

如果找不到板子，先檢查：

- USB 線是否支援資料傳輸
- macOS 是否看到 `/dev/cu.*`
- 是否需要安裝 USB-to-Serial 驅動
- 板子是否需要按住 BOOT 或 RESET 進入燒錄模式
