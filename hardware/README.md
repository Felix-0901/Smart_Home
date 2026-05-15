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
└── k_series/
```

後續建議結構：

```text
hardware/
├── k_series/
├── room-sensor/
├── door-sensor/
└── relay-controller/
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

尚未建立韌體專案。後續每組硬體需要在各自子資料夾補上編譯與燒錄指令。

## 部署細節

硬體燒錄不需要開啟 Arduino IDE，後續可用 CLI 完成編譯、上傳與 Serial Monitor。

## 常見問題

如果找不到板子，先檢查：

- USB 線是否支援資料傳輸
- macOS 是否看到 `/dev/cu.*`
- 是否需要安裝 USB-to-Serial 驅動
- 板子是否需要按住 BOOT 或 RESET 進入燒錄模式
