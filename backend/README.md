# Backend

## 模組簡介

`backend/` 用來放智慧家庭系統的後端服務。此模組會負責接收硬體上傳的感測資料、驗證資料格式、寫入 PostgreSQL，提供 APP 註冊登入、產品綁定、歷史資料查詢與 P 系列智慧插座控制 API。

## 使用技術

- Node.js
- TypeScript
- Express
- PostgreSQL
- MQTT bridge
- JWT / refresh token
- Docker Compose 本地測試資料庫

## 資料夾結構

```text
backend/
├── Dockerfile
├── package.json
├── src/
│   ├── config.ts
│   ├── db/
│   ├── http/
│   ├── mqtt/
│   ├── services/
│   └── server.ts
└── README.md
```

## 本地開發流程

啟動根目錄的 Docker 測試環境：

```bash
docker compose up -d
```

本地後端 API：

```text
http://localhost:3003
```

確認後端連線：

```bash
curl http://localhost:3003/health
```

若要在本機直接啟動後端開發模式：

```bash
npm install
npm run dev
```

本機直接執行後端時，資料庫連線字串可使用：

```text
postgresql://smart_home:smart_home_password@localhost:5432/smart_home
```

如果後端程式也放進 Docker Compose 網路中，容器內連線主機要使用：

```text
postgresql://smart_home:smart_home_password@postgres:5432/smart_home
```

## 環境變數

後端預計需要：

```text
DATABASE_URL=postgresql://smart_home:smart_home_password@localhost:5432/smart_home
DEVICE_API_TOKEN=local-dev-device-token
CORS_ORIGIN=*
APP_PUBLIC_URL=http://localhost:3003
APP_JWT_SECRET=local-dev-app-jwt-secret-change-me-32chars
APP_ACCESS_TOKEN_TTL_SECONDS=900
APP_REFRESH_TOKEN_TTL_DAYS=30
MQTT_ENABLED=true
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_TOPIC_PREFIX=smart-home
TZ=Asia/Taipei
PGTZ=Asia/Taipei
```

本地開發值放在 `backend/.env`。正式部署時請在 Coolify 設定正式值，不要提交正式 Token 或密碼。

時間欄位使用 PostgreSQL `TIMESTAMPTZ`，本地 Docker 與後端連線預設以 `Asia/Taipei` 顯示。API 回傳的 `received_at` 會以文字格式保留 `+08` 時區，例如 `2026-05-16 01:23:45.123456+08`。

## 建置 / 啟動方式

型別檢查：

```bash
npm run typecheck
```

建立基礎資料表：

```bash
npm run db:setup
```

建立 Demo 產品編號：

```bash
npm run db:seed-demo-devices
```

檢查資料庫連線：

```bash
npm run db:check
```

建立某個硬體系列與對應資料表：

```bash
npm run db:create-series -- k_series K系列
```

啟動本地開發伺服器：

```bash
npm run dev
```

使用 Docker 啟動完整本地環境：

```bash
docker compose up -d --build
```

## API

健康檢查：

```bash
curl http://localhost:3003/health
```

上傳某個硬體系列的感測資料：

```bash
curl -X POST http://localhost:3003/api/series/room_sensor/readings \
  -H 'content-type: application/json' \
  -H 'x-device-token: local-dev-device-token' \
  -d '{"values":{"temperature":26.4,"humidity":61},"metadata":{"source":"local-test"}}'
```

`seriesKey` 只能使用小寫英文、數字與底線。每個系列會建立自己的資料表，命名格式為：

```text
series_{seriesKey}_readings
```

P 系列智慧插座開關指令：

```bash
curl -X POST http://localhost:3003/api/devices/p-series-001/relay \
  -H 'content-type: application/json' \
  -H 'x-device-token: local-dev-device-token' \
  -d '{"relay_on":true}'
```

後端會發布 retained MQTT command 到：

```text
smart-home/p_series/p-series-001/command
```

查詢某台設備最新資料：

```bash
curl 'http://localhost:3003/api/devices/p-series-001/latest?seriesKey=p_series' \
  -H 'x-device-token: local-dev-device-token'
```

MQTT bridge 會訂閱 `state`、`telemetry` 與 `availability` topic，並寫入 `series_p_series_readings`。

APP 註冊：

```bash
curl -X POST http://localhost:3003/api/app/auth/register \
  -H 'content-type: application/json' \
  -d '{"displayName":"Demo User","email":"demo@example.com","password":"password123"}'
```

APP 登入：

```bash
curl -X POST http://localhost:3003/api/app/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"demo@example.com","password":"password123"}'
```

以下 APP API 需要 `Authorization: Bearer <accessToken>`：

```text
GET /api/app/me
PATCH /api/app/me
GET /api/app/houses
POST /api/app/houses
GET /api/app/houses/:houseId
PATCH /api/app/houses/:houseId
DELETE /api/app/houses/:houseId
POST /api/app/houses/:houseId/spaces
PATCH /api/app/houses/:houseId/spaces/:spaceId
DELETE /api/app/houses/:houseId/spaces/:spaceId
GET /api/app/devices
POST /api/app/devices/claim
PATCH /api/app/devices/:deviceId
DELETE /api/app/devices/:deviceId
GET /api/app/devices/:deviceId/latest
GET /api/app/devices/:deviceId/readings?from=&to=&metric=&limit=
POST /api/app/devices/:deviceId/relay
```

綁定 Demo 裝置：

```bash
curl -X POST http://localhost:3003/api/app/devices/claim \
  -H 'content-type: application/json' \
  -H 'Authorization: Bearer <accessToken>' \
  -d '{"productCode":"P-DEMO-0001"}'
```

移除 APP 帳號中的裝置綁定：

```bash
curl -X DELETE http://localhost:3003/api/app/devices/<deviceUuid> \
  -H 'Authorization: Bearer <accessToken>'
```

此操作只會刪除 `user_devices` 的帳號綁定關係，不會刪除 `devices` 產品資料或各系列歷史讀值。

修改裝置暱稱或空間時可使用 `PATCH /api/app/devices/:deviceId`，傳入 `alias`、`houseId` 或 `spaceId`；若值為 `null`，代表清除該欄位並回到預設顯示。

新版 APP 使用房屋與空間模型。裝置設定可改傳 `houseId` 與 `spaceId`，後端會確認該房屋與空間屬於目前 APP 使用者；若 `houseId` 為 `null`，會清除房屋與空間設定。

目前 seed 會建立：

```text
K-DEMO-0001 -> k-series-001
M-DEMO-0001 -> m-series-001
P-DEMO-0001 -> p-series-001
R-DEMO-0001 -> r-series-001
T-DEMO-0001 -> t-series-001
```

## 部署細節

後端已提供 `Dockerfile`，之後可部署到 Coolify。正式 domain 確認後，請在 Coolify 設定：

```text
DATABASE_URL=正式 PostgreSQL 連線字串
DEVICE_API_TOKEN=正式硬體上傳 token
CORS_ORIGIN=https://App 或後台網域
APP_PUBLIC_URL=https://固定 API domain
APP_JWT_SECRET=正式 APP JWT secret，至少 32 字元
APP_ACCESS_TOKEN_TTL_SECONDS=900
APP_REFRESH_TOKEN_TTL_DAYS=30
MQTT_BROKER_URL=mqtt://你的 MQTT broker:1883
MQTT_USERNAME=正式 MQTT 帳號或留空
MQTT_PASSWORD=正式 MQTT 密碼或留空
MQTT_TOPIC_PREFIX=smart-home
```

## 常見問題

如果後端連不到資料庫，先確認：

- Docker Desktop 已啟動
- `docker compose ps` 顯示 `postgres` 為 running
- `DATABASE_URL` 的 host 在本機開發時是 `localhost`
- `DATABASE_URL` 的 host 在容器內開發時是 `postgres`
