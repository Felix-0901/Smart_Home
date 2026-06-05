# Smart Home App

## 模組簡介

`app/` 是 Smart Home 專題的行動應用程式，使用 React Native / Expo 建立。第一版提供註冊登入、產品編號綁定裝置、房屋與空間管理、P 系列智慧插座控制、即時資料查看、歷史資料查詢與個人資料管理。

APP 不直接連 MQTT broker，也不保存 `DEVICE_API_TOKEN`。APP 只透過後端 APP API 操作資料與 P 系列 relay。

目前 UI 依 Open Design 內的 `Smart Home` iOS APP prototype 整理，使用 iOS grouped list、large title、segmented control、bottom sheet 與 P 系列 switch 風格；資料抓取與控制邏輯仍維持原本後端 API 流程。

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
