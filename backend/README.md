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
AI_ENABLED=true
AI_PROVIDER=openai_compatible
AI_BASE_URL=https://liangjiewis.com
AI_API_KEY=<placeholder>
AI_MODEL=gpt-5.4
AI_FALLBACK_MODEL=gpt-4o-mini
AI_PREMIUM_MODEL=gpt-5.4
TZ=Asia/Taipei
PGTZ=Asia/Taipei
```

本地開發值放在 `backend/.env`。正式部署時請在 Coolify 設定正式值，不要提交正式 Token 或密碼。

`AI_API_KEY` 只允許放在後端環境變數或 Coolify Secret，不可放進 APP 或 README。`AI_BASE_URL` 若沒有以 `/v1` 結尾，後端會自動呼叫 `${AI_BASE_URL}/v1/chat/completions`。

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
GET /api/app/agent/history
POST /api/app/agent/messages
POST /api/app/agent/action-results
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

Homi Agent 使用 `POST /api/app/agent/messages` 接收使用者訊息、最近聊天紀錄與 APP 狀態。後端會建立使用者 context，優先呼叫 AI planner 產生受控 `actions`，再由後端 action policy 審核裝置、路由、欄位與操作權限；只有 AI 失敗時才使用本地 fallback planner。Relay 控制必須鎖定目前使用者擁有的單一 P 系列裝置，且使用者訊息必須明確指定產品編號、裝置暱稱或實際房屋/空間；否則即使模型選了某台裝置，後端也會改成釐清問題。APP 播放游標點擊 Switch 後會直接呼叫既有 `POST /api/app/devices/:deviceId/relay`，並透過 `POST /api/app/agent/action-results` 回報結果。

Homi v1 正式工具分層如下：

```text
導覽工具：navigate
資料工具：set_data_query
首頁插座工具：focus_home_relay、request_relay_confirmation
裝置工具：claim_device、open_device_settings、set_device_profile
房屋空間工具：open_house_detail、create_house、create_space、rename_house、rename_space
偏好工具：set_preference
回饋工具：say、ask_clarification、show_toast
```

後端 prompt 會提供 `appCapabilities`，列出每個頁面可操作元件、target ID、使用者目前擁有的房屋、空間、裝置與可查詢感測欄位。模型只能輸出白名單 action；後端會再次確認 `deviceId`、`houseId`、`spaceId` 屬於目前使用者，且 `relay` 只能用在 P 系列。刪除裝置、刪除房屋、刪除空間、刪除帳號、登出、修改密碼與修改 email 不提供直接工具，Homi 只能導頁或提示使用者自行操作。

Homi 的操作規則：

- 若要由 Homi 打開數據頁並套用圖表、表格或原始資料查詢，使用者必須指定裝置暱稱、產品編號或 `deviceId`。只說房屋、空間、系列或感測欄位時，Homi 不能猜裝置。
- 「客廳目前環境如何」或「客廳有哪些裝置」這類廣義空間問題，Homi 只用文字整理該空間所有裝置的即時摘要，最後再詢問是否要查看特定裝置的長期或即時數據。
- 「要如何新增產品」、「如何修改個人資料」、「怎麼新增房屋空間」這類教學問題，Homi 會導向相關頁面並用游標提示操作位置；不會擅自填入或修改敏感資料。
- 低風險偏好設定，例如顯示模式或開發者模式，在使用者明確要求開啟/關閉時可直接執行。

建議測試 prompt：

```text
Homi，帶我看 P-DEMO-0001 近 24 小時的功率圖表
Homi，幫我查 6 月 1 日到 6 月 5 日 T-DEMO-0001 有沒有人
Homi，打開客廳智慧插座
Homi，客廳目前環境如何
Homi，客廳有哪些裝置
Homi，帶我看客廳 7 天 eCO2
Homi，要如何新增產品
Homi，要如何修改個人資料
Homi，把裝置顯示模式改成空間
Homi，幫我新增一棟房屋叫做展示場
Homi，在展示場新增一個空間叫做客廳
Homi，把 P-DEMO-0001 放到展示場的客廳
Homi，打開插座
```

`帶我看客廳 7 天 eCO2` 應該要求指定裝置暱稱或產品編號，不應直接猜某台裝置。最後一個 prompt 應該回覆釐清問題，不能直接控制第一台 P 系列。

Homi 的聊天歷史以「本月」為範圍。APP 開啟 Homi 時會呼叫 `GET /api/app/agent/history` 載入目前月份的 thread 與訊息；送訊息時如果沒有 `threadId`，後端會自動接回同一使用者本月最新 thread。跨月後會建立新的 thread，並清理同一使用者本月以前的 Homi thread，避免聊天紀錄無限制累積。

Homi 會將最近 10 則對話完整放入後端 prompt context。當同一 thread 的訊息超過門檻時，較舊的對話會壓縮到 `app_agent_threads.context_summary`，保留前情摘要但不把整段歷史無限制送進模型。

Homi 會將對話與 action 執行狀態寫入：

```text
app_agent_threads
app_agent_messages
app_agent_action_runs
```

這些資料表只儲存訊息、action JSON、結果與錯誤，不儲存 AI API key。

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
