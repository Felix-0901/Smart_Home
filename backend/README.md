# Backend

## 模組簡介

`backend/` 用來放智慧家庭系統的後端服務。此模組會負責接收硬體上傳的感測資料、驗證資料格式、寫入 PostgreSQL，並在之後提供 App 查詢 API。

## 使用技術

- Node.js
- TypeScript
- Express
- PostgreSQL
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
```

本地開發值放在 `backend/.env`。正式部署時請在 Coolify 設定正式值，不要提交正式 Token 或密碼。

## 建置 / 啟動方式

型別檢查：

```bash
npm run typecheck
```

建立基礎資料表：

```bash
npm run db:setup
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

## 部署細節

後端已提供 `Dockerfile`，之後可部署到 Coolify。正式 domain 確認後，請在 Coolify 設定：

```text
DATABASE_URL=正式 PostgreSQL 連線字串
DEVICE_API_TOKEN=正式硬體上傳 token
CORS_ORIGIN=https://App 或後台網域
APP_PUBLIC_URL=https://固定 API domain
```

## 常見問題

如果後端連不到資料庫，先確認：

- Docker Desktop 已啟動
- `docker compose ps` 顯示 `postgres` 為 running
- `DATABASE_URL` 的 host 在本機開發時是 `localhost`
- `DATABASE_URL` 的 host 在容器內開發時是 `postgres`
