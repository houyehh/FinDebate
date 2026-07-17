# 開發進度

## 2026-07-18 任務 1：專案骨架

### 做了什麼
- 初始化 Git repository。
- 建立 FastAPI 後端骨架，提供 `GET /api/health` 回傳 `{"status":"ok"}`。
- 建立 React（Vite）+ Tailwind CSS 前端骨架，首頁顯示 API health 狀態。
- 建立 Vite proxy，讓前端以 `/api/health` 呼叫本機後端。
- 新增 `.env.example`，秘密一律預期由環境變數提供。
- 新增後端 pytest 測試與前端 Vitest/Testing Library 測試。

### 關鍵決定
- Tailwind 使用 3.x 經典 PostCSS 設定，避免 Tailwind 4 的 plugin 設定差異干擾第一階段驗收。
- 第 1 項只完成 healthcheck 與骨架，不提前實作 ticker、LLM、SQLite 等後續功能。

### 驗收結果
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，1 passed。
- 實際啟動 uvicorn 後呼叫 `http://127.0.0.1:8000/api/health`：通過，回傳 `health ok`。
- `npm.cmd test`：通過，前端可渲染 `API: ok`。
- `npm.cmd run build`：通過。

### 遇到的問題
- pip 與 npm 初次安裝套件時被網路 sandbox 擋住，已依規則用升級權限完成安裝。
- Vite/Vitest 在 Windows sandbox 中讀取 Node resolution path 會被攔，前端測試與 build 使用升級權限執行後通過。
- 已建立本地 commit `97356a6 chore: scaffold healthcheck app`。
- `git push` 失敗，原因是目前尚未提供 GitHub remote URL，也沒有設定 push destination；已保留本地 commit。

### 下一步
- 任務 2：實作 F1 標的驗證，使用 yfinance 驗證 `NVDA`、`2330.TW`、`BTC-USD` 並處理無效 ticker 的友善錯誤。

## 2026-07-18 任務 2：F1 標的驗證

### 做了什麼
- 新增 yfinance 市場資料服務，負責 ticker 正規化、即時價格、幣別、名稱與近 30 筆日收盤價整理。
- 新增 `GET /api/tickers/{ticker}`，有效 ticker 回傳名稱、價格、幣別與 30 天價格走勢；無效 ticker 回傳包含範例的友善錯誤。
- 首頁加入 ticker 搜尋框、範例 ticker 按鈕、loading/error 狀態、價格摘要與 SVG 折線圖。
- 新增後端 ticker API 測試、前端查詢 UI 測試，以及 `scripts/verify_task2.py` 真實 yfinance 驗收腳本。

### 關鍵決定
- API 以最後一筆有效收盤價作為價格 fallback，優先使用 yfinance `fast_info.last_price` 與 `info.currentPrice`。
- 幣別優先取 yfinance 回傳值；台股 `.TW` 與加密貨幣 `-USD` 保留明確 fallback。
- 單元測試使用 mock 避免日常測試受外部網路波動影響，另用獨立驗收腳本跑真實 ticker。

### 驗收結果
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，3 passed。
- `npm.cmd test`：通過，2 passed。
- `npm.cmd run build`：通過。
- `.\.venv\Scripts\python.exe scripts\verify_task2.py`：通過。
  - `NVDA` 回傳 `NVIDIA Corporation`、價格、`USD`、21 筆歷史資料。
  - `2330.TW` 回傳 `Taiwan Semiconductor Manufacturing Company Limited`、價格、`TWD`、21 筆歷史資料。
  - `BTC-USD` 回傳 `Bitcoin USD`、價格、`USD`、30 筆歷史資料。
  - `FAKETICKER` 被拒絕並回傳友善錯誤。

### 遇到的問題
- 新增 yfinance 時需要網路下載依賴，已依規則用升級權限完成。
- yfinance 對無效 ticker 會在 stderr/logger 額外輸出 Yahoo 錯誤；API response 已包裝成友善錯誤，不把原始錯誤暴露給前端。
- 已建立本地 commit `5c61e6a feat: add ticker validation`。
- `git push` 失敗，原因是目前尚未提供 GitHub remote URL，也沒有設定 push destination；已保留本地 commit。

### 下一步
- 任務 3：實作 F2 第一輪辯論，先不接 web search，用模型知識跑通 Bull/Bear 各 3 個符合 schema 的論點。
