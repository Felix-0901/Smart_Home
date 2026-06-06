# Smart Home App

## 模組簡介

`app/` 是 Smart Home 專題的行動應用程式，使用 React Native / Expo 建立。第一版提供註冊登入、產品編號綁定裝置、房屋與空間管理、P 系列智慧插座控制、即時資料查看、歷史資料查詢、Homi Agent 與個人資料管理。

APP 不直接連 MQTT broker，也不保存 `DEVICE_API_TOKEN` 或 AI key。APP 只透過後端 APP API 操作資料、P 系列 relay 與 Homi Agent。

目前 UI 依 Open Design 內的 `Smart Home` iOS APP prototype 整理，使用 iOS grouped list、large title、segmented control、bottom sheet 與 P 系列 switch 風格；資料抓取與控制邏輯仍維持原本後端 API 流程。

Homi 是 APP 內建 Agent，不只是聊天介面。APP 會把訊息送到後端 `/api/app/agent/messages`，後端回傳受控 action 後，APP 會執行導頁、套用數據查詢、聚焦 P 系列插座、播放彩色游標點擊 Switch 動畫，並直接送出 relay 控制。

Homi executor 目前支援：

```text
首頁：聚焦 P 系列插座、展開插座清單、點擊指定插座 Switch
裝置：綁定產品編號、開啟指定裝置設定、修改裝置暱稱、指定房屋與空間
數據：切換裝置、感測欄位、時間區間、顯示模式並自動查詢
個人：切換依系列/依空間顯示、開關開發者模式、導向帳號或房屋管理
房屋：新增/重新命名房屋、新增/重新命名空間、進入指定房屋
```

Homi 不會直接操作刪除帳號、修改密碼、刪除房屋、刪除空間或刪除裝置等高風險功能。這些功能只會導頁或提醒使用者自行確認。

Homi 的對話策略：

- 明確操作：使用者指定裝置暱稱、產品編號、房屋、空間或明確開關意圖時，Homi 才執行受控 action。
- 數據圖表：若要 Homi 自動打開數據頁並套用查詢，必須指定裝置暱稱或產品編號；只說空間、系列或感測欄位時會先詢問。
- 教學導覽：使用者問「如何新增產品」、「怎麼修改個人資料」、「要如何新增空間」時，Homi 會導到對應頁面並用游標提示操作位置。
- 廣義詢問：使用者問「客廳目前環境如何」時，Homi 會用文字列出該空間裝置狀態，最後詢問是否要查看特定裝置的長期或即時數據。

Homi 對話紀錄以「本月」為範圍。APP 進入 Homi 時會從後端載入目前月份的聊天紀錄，重開 APP 不會清空；跨月後會開始新的月份 thread，後端也會清理本月以前的 Homi 對話紀錄。模型上下文不會無限制塞入完整歷史，後端會保留最近對話並把較舊內容壓縮成摘要。

## 使用技術

- React Native
- Expo
- Expo Router
- TypeScript
- Expo SecureStore
- `@expo/vector-icons`

## 資料夾結構

```text
app/
├── app/
│   ├── (auth)/
│   ├── (tabs)/
│   ├── houses/
│   ├── _layout.tsx
│   └── index.tsx
├── assets/
├── src/
│   ├── config/
│   ├── features/
│   ├── services/
│   ├── shared/
│   ├── theme/
│   └── types/
├── .env.example
├── app.json
├── package.json
└── tsconfig.json
```

## 本地開發流程

先在根目錄啟動後端與資料庫：

```bash
docker compose up -d --build
```

建立 APP 需要的資料表與 Demo 裝置：

```bash
cd backend
npm run db:setup
npm run db:seed-demo-devices
```

啟動 APP：

```bash
cd ../app
npm install
npm run ios
```

iOS Simulator 可使用：

```text
http://localhost:3003
```

若使用 Android Emulator，請把 `EXPO_PUBLIC_API_BASE_URL` 改成可從模擬器連到後端的網址。

## 環境變數

範本放在 `app/.env.example`：

```text
EXPO_PUBLIC_API_BASE_URL=http://localhost:3003
```

APP 只允許放公開設定。不要把後端資料庫密碼、`DEVICE_API_TOKEN`、MQTT 密碼或 JWT secret 放進 APP。

AI 供應商連線資訊只設定在後端環境變數，不放在 `app/.env`。

## 建置 / 啟動方式

型別檢查：

```bash
npm run typecheck
```

啟動 Expo：

```bash
npm start
```

啟動 iOS Simulator：

```bash
npm run ios
```

啟動 Android Emulator：

```bash
npm run android
```

## 部署細節

第一版以 Expo 本地展示與模擬器測試為主。若後續要發佈到 TestFlight 或正式商店，需再補 EAS Build 設定、bundle identifier、app icon、splash、隱私權文字與正式 API domain。

正式環境的 APP API 端點應使用 HTTPS，例如：

```text
EXPO_PUBLIC_API_BASE_URL=https://你的後端網域
```

## 常見問題

如果登入或綁定產品失敗，先確認：

- 後端 `/health` 正常
- 已執行 `npm run db:setup`
- 已執行 `npm run db:seed-demo-devices`
- APP 的 `EXPO_PUBLIC_API_BASE_URL` 指向可連線的後端網址
- 產品編號使用 seed 建立的 `K-DEMO-0001`、`M-DEMO-0001`、`P-DEMO-0001`、`R-DEMO-0001`、`T-DEMO-0001`

如果 P 系列 relay 控制失敗，先確認：

- Docker Compose 的 `mosquitto` 服務正在執行
- 後端 `MQTT_ENABLED=true`
- P 系列韌體的 `DEVICE_ID` 與 seed 的 `p-series-001` 對應

如果 Homi 操作不符合預期，先確認：

- 後端 `AI_ENABLED=true` 且 `AI_API_KEY` 設在 `backend/.env` 或部署環境，不是 `.env.example`
- APP 已登入，且帳號已綁定 Demo 裝置或真實產品
- 使用的房屋、空間、裝置暱稱確實存在；不存在時 Homi 應該先詢問釐清
- 模糊 prompt 例如 `打開插座` 應該詢問要控制哪一台，不應直接控制第一台 P 系列
