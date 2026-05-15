# Smart Home

## 專案簡介

這是高中專題延伸整理的智慧家庭專案。專案目標是讓多組硬體感測裝置收集資料，透過後端寫入 PostgreSQL，之後再提供 App 查看感測紀錄、設備狀態與相關統計。

目前階段先處理後端服務、資料庫連線與硬體程式碼整理；App 會在後續階段建立。

## 功能列表

- 硬體感測資料上傳到後端
- 後端接收、驗證並寫入 PostgreSQL
- 本地使用 Docker 啟動 PostgreSQL 測試環境
- 使用 Adminer 或 Docker 內的 `psql` 查看資料庫內容
- 硬體程式碼集中放在 `hardware/`

## 技術架構

- 後端：放在 `backend/`，預計使用 Node.js + TypeScript API 服務
- 資料庫：PostgreSQL
- 本地測試：Docker Compose，包含後端 API、PostgreSQL、Adminer
- 資料庫檢視：Adminer、Docker 內建 `psql`
- 硬體韌體：放在 `hardware/`，後續依板子型號選擇 Arduino CLI、PlatformIO 或廠商工具

## 專案結構

```text
.
├── AGENTS.md
├── README.md
├── backend/
├── hardware/
├── docker-compose.yml
└── .env.example
```

## 本地測試教學

先確認 Docker Desktop 已啟動，然後在專案根目錄執行：

```bash
docker compose up -d
```

查看容器狀態：

```bash
docker compose ps
```

後端 API 本地網址：

```text
http://localhost:3003
```

確認後端與資料庫連線：

```bash
curl http://localhost:3003/health
```

停止本地服務：

```bash
docker compose down
```

若要連進 PostgreSQL：

```bash
docker compose exec postgres psql -U smart_home -d smart_home
```

進入 `psql` 後常用指令：

```sql
\dt
\d table_name
SELECT * FROM table_name LIMIT 20;
\q
```

若偏好網頁介面，啟動 Docker 後開啟：

```text
http://localhost:8080
```

Adminer 登入資訊：

```text
System: PostgreSQL
Server: postgres
Username: smart_home
Password: smart_home_password
Database: smart_home
```

## 環境變數

環境變數範本放在 `.env.example`。目前 Docker Compose 已設定預設值，所以沒有 `.env` 也可以啟動。

實際開發時可以複製一份 `.env`：

```bash
cp .env.example .env
```

不要提交真正的 `.env`、Token、密碼或憑證。

## Coolify 部署教學

後端已提供 `backend/Dockerfile`，之後可用 Coolify 部署成固定 domain。正式部署時至少需要設定：

```text
DATABASE_URL=postgresql://...
DEVICE_API_TOKEN=正式硬體上傳用 token
CORS_ORIGIN=https://你的 App 或後台網域
APP_PUBLIC_URL=https://你的固定 API domain
```

正式 domain 確定後，硬體程式碼會把資料上傳到：

```text
https://你的固定 API domain/api/series/{seriesKey}/readings
```

## 前端 / 後端詳細文件連結

- [後端文件](backend/README.md)
- [硬體文件](hardware/README.md)
