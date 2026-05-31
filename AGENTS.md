# 專案結構與資料夾命名

## 目標
- 所有學生專案使用一致的根目錄模組命名，方便閱讀、維護、部署與交接
- 先判斷專案實際需要的產品型態，再建立對應資料夾；不是每個專案都要同時有 `app/`、`web/`、`backend/`、`docs/` 等資料夾
- 不建立沒有實際用途的空資料夾，也不為了套模板而新增不會使用的模組
- 參考 `EmoChess` 的 monorepo 方式：根目錄放總覽文件，只建立實際需要的模組資料夾，且各模組各自維護 README

## 根目錄模組命名
- 需要行動應用程式時，建立 `app/`；預設使用 Flutter，若專案明確需要 React Native，才使用 React Native
- 需要一般網站或前台 Web 時，建立 `web/`；使用 Node.js 生態系框架，例如 Next.js、Nuxt、Vite React 或其他專案指定框架
- 需要後台管理系統或後端服務時，建立 `backend/`；若是管理後台介面，預設使用 Next.js；若是純 API 服務，使用 Node.js 後端框架並在 README 清楚標示
- 需要補充文件、規格、流程圖或交接資料時，建立 `docs/`
- 需要集中管理資料庫 schema、migration、seed 或 SQL 檔案時，建立 `database/`；若框架已有固定位置，例如 Prisma 在 `backend/prisma/`，可不另外建立
- 需要集中管理部署、Docker、CI/CD、反向代理或雲端設定時，建立 `infra/`；若部署檔只服務單一模組，可放在該模組內

## 建立規則
- 建立資料夾前先依需求判斷模組類型：只有 App 就只建立 `app/`，只有 Web 就只建立 `web/`，只有後台或 API 就只建立 `backend/`
- App 專案放在 `app/`，不要命名為 `flutter/`、`mobile/`、`ios/`、`android/` 或專案名稱
- Web 前台放在 `web/`，不要命名為 `frontend/`、`client/`、`react/` 或專案名稱
- 後台管理系統或後端服務放在 `backend/`，不要命名為 `admin/`、`server/`、`api/` 或專案名稱，除非使用者明確指定
- 同一專案同時有 App、Web 與後台時，維持 `app/`、`web/`、`backend/` 三個根目錄模組
- 不要把多個框架混在同一個模組根目錄；每個模組都要能獨立安裝依賴、啟動、建置與部署
- 每個存在的模組都必須有自己的 `README.md`，並在根目錄 README 的「專案結構」與「前端 / 後端詳細文件連結」中連到該模組

## 框架預設
- `app/` 優先使用 Flutter，除非需求、既有程式碼或使用者指定 React Native
- `web/` 使用 Node.js 生態系框架，依需求選擇 Next.js、Nuxt、Vite React 等，不使用純靜態 HTML 當作預設架構
- `backend/` 若是後台管理介面，優先使用 Next.js
- `backend/` 若是純 API，優先使用 Node.js + TypeScript，並依需求搭配 Express、NestJS、Prisma 或其他必要套件
- 資料庫與第三方服務金鑰只放在後端或部署環境變數，不放在 App 或前台 Web 的公開程式碼

## 命名原則
- 根目錄模組名稱一律使用小寫英文與固定名稱：`app`、`web`、`backend`、`docs`、`database`、`infra`
- 不使用空白、中文、底線、版本號或框架名稱作為資料夾名稱
- 專案名稱只出現在 README、package/app metadata 或部署設定，不作為模組資料夾名稱

# 硬體系列開發流程

## 目標
- 每個硬體系列都要能獨立記錄板型、腳位、接線、測試程式、整合韌體與後端上傳結果
- 先確認硬體事實，再寫接線與程式；不要只依照常見 Google 圖片或相似開發板假設腳位
- 每個系列都先做單元測試，再做整合測試，最後才測 WiFi、API 與資料庫寫入

## 系列資料夾
- 每個系列建立在 `hardware/{series_key}/`，例如 `hardware/k_series/`
- `series_key` 使用小寫英文、數字與底線，需和後端 API / 資料表一致
- 每個系列資料夾必須有自己的 `README.md`
- 每個系列的測試程式放在 `hardware/{series_key}/tests/{component_name}_test/`
- 每個系列的整合測試放在 `hardware/{series_key}/tests/integration_test/`
- 若有 WiFi、API token 或本地 IP 設定，放在 `config.h`，並確認已被 `.gitignore` 排除；可提供 `config.h.example`

## 硬體辨識
- 接上開發板後先使用 `ls /dev/cu.*` 與 `arduino-cli board list` 找序列埠
- 若 Arduino CLI 無法辨識板型，使用 Arduino ESP32 core 內建的 `esptool` 讀取晶片資訊
- 需在系列 README 記錄已確認的晶片、USB-to-Serial、序列埠、FQBN 與 pinout 來源
- 板型名稱要以實際板子與背面絲印為準；若外觀不是標準 DevKit，不要寫成標準 DevKit
- 若使用者提供 pinout 圖或板子背面絲印，腳位配置必須優先依該圖修正

## 腳位配置
- 腳位表必須使用該板子實際外露的絲印名稱與程式 GPIO 對照，例如 `IO34` / `GPIO34`
- 避免使用未外露腳位、Flash/SDIO 腳、UART 腳、JTAG 腳與開機 strapping 腳，除非已確認安全
- `IO34`、`IO35`、`SVP`、`SVN` 這類 ESP32 input only 腳只能作輸入，不能控制 LED、繼電器或輸出訊號
- ESP32 GPIO 只能承受 3.3V；任何可能輸出 5V 的 Sensor `AO` / `DO` 都要先分壓或電平轉換
- RGB LED 每個顏色通道都必須串接限流電阻，並在 README 記錄共陽或共陰設定

## 測試順序
- 每新增一個 Sensor，先建立單元測試 sketch，只測該 Sensor，不混入 WiFi、後端或其他元件
- 單元測試通過後，立即把接線、測試指令、讀值範圍與結果寫入該系列 README
- 所有 Sensor 單元測試通過後，再建立或更新整合測試
- 整合測試需同時讀取所有已安裝 Sensor，並輸出可直接判斷的 serial log
- 若有狀態燈或告警邏輯，先在整合測試中制定顏色/狀態規則並記錄到 README

## 後端與資料庫
- 每個系列使用自己的 `series_key` 上傳到 `/api/series/{series_key}/readings`
- 每個系列對應自己的資料表，格式為 `series_{series_key}_readings`
- 測 WiFi 前先確認本地後端 `/health` 正常，PostgreSQL 容器 healthy
- ESP32 不可使用 `localhost` 連 Mac 後端；本地測試必須使用 Mac 區網 IP
- ESP32 只支援 2.4GHz WiFi；若 SSID 是 5GHz，需改用 2.4GHz 網路
- 上傳測試要確認 Serial Monitor 出現 `POST status: 201`，並用 PostgreSQL 查詢資料表筆數與最新資料
- README 可記錄 SSID 名稱、API URL、資料表與測試結果，但不可記錄 WiFi 密碼、token 或其他敏感值

## K 系列經驗
- K 系列板子最後確認為 `LIVE MINI KIT ESP32` / `MH ET LIVE ESP32MiniKit`，不是一般 ESP32 DevKit
- K 系列使用 `CP2104` USB-to-Serial，序列埠曾為 `/dev/cu.usbserial-020JE15F`
- K 系列 pinout 以使用者提供的板子背面絲印為準，修正過原本不適用的 GPIO 假設
- K 系列 Sensor 曾把 BME280 誤判為 GY-SGP30，後續修正為讀取 `eco2_ppm` 與 `tvoc_ppb`
- K 系列 MQ 類比輸入曾因線材或接觸問題讀到 `0`；舊接線 `AO -> IO34` 可讀，但後續為改善封蓋穩定性改為 `AO -> IO33`
- K 系列開發證明最穩定流程是：確認板型與 pinout、單一 Sensor 測試、記錄 README、整合測試、WiFi 上傳、資料庫查詢

# README 管理

## 目標
- 所有專案 README 結構一致，方便閱讀、維護與交接
- 根目錄 README 放總覽與快速開始
- 前端、後端資料夾各自有更詳細的 README

## 根目錄 README 固定章節
- 專案名稱
- 專案簡介
- 功能列表
- 技術架構
- 專案結構
- 本地測試教學
- 環境變數
- Coolify 部署教學
- 前端 / 後端詳細文件連結

## 子 README 固定章節
- 模組簡介
- 使用技術
- 資料夾結構
- 本地開發流程
- 環境變數
- 建置 / 啟動方式
- 部署細節
- 常見問題

## 撰寫原則
- 一律使用繁體中文
- 不使用 emoji
- 標題命名固定一致
- 指令、路徑、變數名稱用 code format
- 內容以可直接操作為主，不寫空話
- 未驗證的指令或流程不可寫入
- 不可暴露 Token、密碼、金鑰等敏感資訊

## 更新時機
- 新增專案時先建立 README 骨架
- 功能、架構、啟動方式、部署流程變更時同步更新 README
- 前後端若有獨立變更，也要更新各自 README
- 每次新增、刪除或修改任何硬體系列的元件資料、感測器型號、腳位配置、接線方式、測試結果或韌體行為時，必須同步更新該系列資料夾內的 `README.md`，並在 README 的變更紀錄中簡要記錄修改內容與日期；此規則適用所有系列，不限 K 系列

## 檢查重點
- 新人能否依 README 完成本地啟動
- 是否清楚列出必要環境變數
- 是否清楚說明 Coolify 部署流程
- 根 README 是否有前後端 README 連結

# Commit 管理

## Git 操作時機
- 僅在使用者明確要求「提交 / commit」時才建立提交；否則只提供建議或提交訊息草稿
- 提交前先檢查變更內容，確認範圍與目的一致，避免混入無關修改

## 提交切分
- 以「可獨立回滾」為原則，一次提交只做一件事
- 多個不相干目的應拆成多次提交，如格式調整與功能變更分開
- 同一目的但跨多檔案，可合併為一次提交

## 提交訊息格式
- 採 Conventional Commits：`<type>(<scope>): <描述>`
- 描述使用繁體中文、現在式、動詞開頭，不加句號
- 主旨建議 50 字內；若需補充原因、影響或測試方式，可加 body，並以 72 字換行

### type
- `feat`：新增功能
- `fix`：修復錯誤
- `refactor`：重構
- `perf`：效能改善
- `test`：測試
- `docs`：文件
- `style`：格式調整
- `chore`：雜項
- `ci`：CI / workflow

### scope
- 以模組或領域命名，如 `ui`、`api`、`engine`、`auth`
- 不確定時可省略

### 範例
- `feat(ui): 新增棋局回放控制列`
- `fix(api): 修復查詢對局紀錄的分頁錯誤`
- `refactor(engine): 重構評分計算以降低重複邏輯`

## 提交前檢查
- 先執行專案既有的 lint、typecheck、測試
- 檢查 `git status`，確認只包含本次要提交的檔案
- 檢查 staged 與 unstaged diff，確認沒有 Token、金鑰、密碼、憑證、私鑰、cookie、session、webhook URL、個資或 production `.env` 內容
- 若發現敏感資訊，必須先從提交內容排除，改成 placeholder、移到 `.env.example` 的變數名稱或加入 `.gitignore` 後，再重新檢查
- 不提交 Token、金鑰、憑證等敏感資訊
- 提交訊息避免包含個資或環境專屬路徑

## Issue / Ticket
- 若有 issue/ticket，使用一致格式附註，如 `Refs: #123`、`Fixes: #123`
- 若為 breaking change，需在 body 說明行為差異與遷移方式
