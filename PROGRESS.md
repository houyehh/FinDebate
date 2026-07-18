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

## 2026-07-18 任務 3：F2 第一輪辯論（先不接 web search）

### 做了什麼
- 依 OpenAI 官方 docs 確認 `gpt-5.6` alias、Responses API 與 Structured Outputs 支援狀態。
- 新增 OpenAI SDK 依賴，並在 `.env.example` 加上 `OPENAI_MODEL=gpt-5.6`。
- 新增第一輪辯論服務：Bull/Bear 各自獨立產生 3 個 opening claims，輸出固定 JSON schema。
- 後端用 Pydantic 驗證模型輸出，schema 驗證失敗時自動重試 1 次。
- 新增 `POST /api/debates/round-one`，輸入 ticker 後回傳 Bull/Bear 兩組第一輪論點與價格快照。
- 前端加入「開始辯論」按鈕、生成 loading 狀態，以及 Bull/Bear 左右分欄開場卡片。

### 關鍵決定
- 任務 3 嚴格不接 web search；prompt 明確要求使用模型知識與既有價格快照。
- OpenAI 呼叫使用 Responses API 的 `text.format` JSON schema，並在後端再次用 Pydantic 驗證。
- 沒有 `OPENAI_API_KEY` 時，API 回傳 503 友善錯誤，不在前端白屏或洩漏秘密。

### 驗收結果
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，5 passed。
- `npm.cmd test`：通過，3 passed。
- `npm.cmd run build`：通過。
- Mock 驗收已確認輸入 `NVDA` 時，Bull 與 Bear 各回 3 個符合 schema 的論點。

### 遇到的問題
- 目前環境沒有 `OPENAI_API_KEY`，且 `.env` 不存在，因此無法執行真實 OpenAI API 驗收；已用 mock 測試覆蓋 schema、retry 與 UI 流程。
- 已建立本地 commit `1382235 feat: add round one debate generation`。
- `git push` 失敗，原因是目前尚未提供 GitHub remote URL，也沒有設定 push destination；已保留本地 commit。

### 下一步
- 任務 4：實作第二輪反駁並接上 web search，要求雙方各 2 個 rebuttals，且所有論點與反駁都附真實可點擊來源。

## 2026-07-18 任務 4：F2 第二輪反駁 + web search

### 做了什麼
- 依 OpenAI 官方 quickstart 確認 Responses API 可用內建 `web_search` tool。
- 新增第二輪反駁 schema：每方固定 2 個 rebuttals，包含 `target_claim_id`、`rebuttal`、`evidence`、`source_url`。
- 第二輪 OpenAI 呼叫啟用 web search；第一輪仍維持不啟用工具。
- 後端動態限制 `target_claim_id` 必須是對方第一輪論點 ID，驗證失敗時自動重試 1 次。
- 新增 `POST /api/debates/two-round`，產生第一輪開場與第二輪反駁。
- 前端「開始辯論」改呼叫兩輪 endpoint，並新增第二輪反駁區；每張反駁卡片顯示「反駁 → 對方論點 #ID」且可跳到原論點。

### 關鍵決定
- 第二輪才接 web search，符合任務 3/4 的分段要求。
- `source_url` 在第二輪 schema 中為必填，前端直接以可點擊連結呈現。
- Mock 測試檢查雙方各 2 個 rebuttals、target ID 正確、source URL 為可點擊 URL 格式。

### 驗收結果
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，7 passed。
- `npm.cmd test`：通過，3 passed。
- `npm.cmd run build`：通過。
- Mock 驗收已確認 Bull/Bear 各有 2 個 rebuttals，且 `target_claim_id` 指向對方第一輪論點。

### 遇到的問題
- 目前環境仍沒有 `OPENAI_API_KEY`，因此無法執行真實 OpenAI web search 驗收；已用 mock 測試覆蓋 schema、retry、target validation 與 UI 流程。
- 已建立本地 commit `0c2a4ae feat: add rebuttal round`。
- `git push` 失敗，原因是目前尚未提供 GitHub remote URL，也沒有設定 push destination；已保留本地 commit。

### 下一步
- 任務 5：實作裁判查核與評分，每個論點與反駁都有證據、來源、邏輯三項分數，並能標記 `unverifiable`。

## 2026-07-18 任務 5：F3 裁判查核與評分

### 做了什麼
- 新增裁判評分 schema：每個 claim/rebuttal 都有 `evidence_score`、`source_score`、`logic_score`、`flag`、`flag_reason`。
- 新增 Judge agent 呼叫，使用 web search 查核來源與可驗證性，並要求 JSON schema 輸出。
- 後端驗證裁判輸出必須完整覆蓋所有辯論項目且 item id 不可重複；驗證失敗自動重試 1 次。
- Bull/Bear 總分由後端依每項三個小分加總，避免模型輸出總分與細項不一致。
- 新增 `POST /api/debates/judged`，回傳完整兩輪辯論與裁判評分。
- 前端新增裁判總分對比條、裁判總評、每張論點/反駁卡片的小分與 `unverifiable` 旗標顯示。

### 關鍵決定
- Rebuttal 本身沒有 PRD 指定的 id，後端固定產生 `BULL-REB-1`、`BULL-REB-2`、`BEAR-REB-1`、`BEAR-REB-2` 供裁判與前端對應。
- 第 5 項先顯示裁判分數；任務 6 會改成「站邊前隱藏，送出後揭曉」。
- 裁判不輸出投資結論，只輸出證據品質總評。

### 驗收結果
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，9 passed。
- `npm.cmd test`：通過，3 passed。
- `npm.cmd run build`：通過。
- Mock 驗收已確認每個論點與反駁都有三項小分。
- 人工捏造論點 fixture 已確認可被標記為 `unverifiable`。

### 遇到的問題
- 目前環境仍沒有 `OPENAI_API_KEY`，因此無法執行真實 Judge agent + web search 驗收；已用 mock 測試覆蓋 schema、retry、完整覆蓋檢查、`unverifiable` flag 與 UI 流程。
- 已建立本地 commit `6bb7b4f feat: add judge scoring`。
- `git push` 失敗，原因是目前尚未提供 GitHub remote URL，也沒有設定 push destination；已保留本地 commit。

### 下一步
- 任務 6：實作 F4 盲判站邊，站邊送出前隱藏裁判分數，送出後揭曉並寫入 SQLite。

## 2026-07-18 任務 6：F4 盲判站邊

### 做了什麼
- 新增 SQLite database layer，建立 `debates`、`verdicts`、`settlements` 三張表。
- 新增 `POST /api/verdicts`，送出站邊時寫入完整 debate、judge scoring、使用者 side/confidence/note、價格快照與裁判一致性。
- `verdicts` 額外記錄 `judge_side` 與 `judge_agreement`，滿足 F4「與裁判是否一致」需求。
- 前端改成盲判流程：辯論完成後先隱藏裁判分數，只顯示站邊面板。
- 使用者送出 `看多` / `看空` / `中立觀望`、信心度與理由後，才揭曉裁判評分並顯示是否與裁判同邊。
- 新增「跳過站邊，直接看評分」按鈕，跳過時不呼叫 `/api/verdicts`，本場不計入戰績。

### 關鍵決定
- 送出站邊時才持久化 debate/verdict，避免使用者跳過站邊也被計入戰績。
- `price_at_verdict` 優先重新抓當下 ticker 價格；抓取失敗時 fallback 到 debate 生成時價格，避免記錄流程中斷。
- 裁判傾向以 Bull/Bear 總分較高者判定；若平手則為 `neutral`。

### 驗收結果
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，10 passed。
- `npm.cmd test`：通過，3 passed。
- `npm.cmd run build`：通過。
- 前端測試已確認送出站邊前畫面沒有 `裁判評分`，送出後才揭曉。
- 後端測試已確認 SQLite 可查到完整 debate 與 verdict 紀錄，並正確保存 `judge_agreement`。

### 遇到的問題
- pytest 的 `tmp_path` 在目前 Windows sandbox 讀不到使用者 Temp 目錄，已改用 workspace 內 ignored 的 `data/test_*.db` 作為測試資料庫。
- 已建立本地 commit `886558c feat: add blind verdict persistence`。
- `git push` 失敗，原因是目前尚未提供 GitHub remote URL，也沒有設定 push destination；已保留本地 commit。

### 下一步
- 任務 7：實作 F5 戰績與回測 + demo seed，每次打開戰績頁自動刷新未結算項目。

## 2026-07-18 任務 7：F5 戰績與回測 + demo seed

### 做了什麼
- verdict 寫入時自動建立 `1d`、`7d`、`30d` 三個 pending settlement。
- 新增 pending settlement refresh：到期後用 yfinance 抓目標日期附近真實收盤價，計算漲跌幅與 win/loss/draw。
- 新增 `GET /api/records`，每次讀取戰績前會先刷新未結算項目。
- 新增統計儀表板資料：總判斷數、7 日勝率、多空中立分佈、校準度、與裁判一致率、同邊/不同邊勝率。
- 前端新增「戰績」頁，顯示統計卡片與歷史判斷表，未到期欄位顯示「待結算」。
- 新增 `scripts/demo_seed.py --demo-seed`，寫入 5 筆 demo verdict 並用真實歷史價格刷新結算。

### 關鍵決定
- 主要勝負週期使用 7 日；1 日與 30 日仍顯示在列表中。
- ±1% 內視為 draw；看多遇上漲超過 1% 為 win，看空遇下跌超過 1% 為 win，中立若超過 ±1% 視為 loss。
- 非交易日以目標日期附近可取得的收盤價計算，優先使用目標日之前最近收盤價，避免週末 demo 無法結算。

### 驗收結果
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，11 passed。
- `npm.cmd test`：通過，4 passed。
- `npm.cmd run build`：通過。
- `.\.venv\Scripts\python.exe scripts\demo_seed.py --demo-seed`：通過，寫入 5 筆 demo verdict。
- demo seed 後 scoreboard 統計：總判斷數 5，7 日勝率 20.0%，高信心勝率 33.3%，低信心勝率 0.0%，與裁判一致率 80.0%。
- 手算核對一筆：`NVDA` 看多，判斷價 `210.96`，7 日價 `202.81`，漲跌幅 `(202.81 - 210.96) / 210.96 = -3.8633%`，看多判定為 `loss`，與系統一致。

### 遇到的問題
- demo seed 會建立本機 `data/app.db`，此檔案已被 `.gitignore` 排除，不會提交。
- 已建立本地 commit `68c9c5f feat: add scoreboard backtesting`。
- `git push` 失敗，原因是目前尚未提供 GitHub remote URL，也沒有設定 push destination；已保留本地 commit。

### 下一步
- 任務 8：實作 F6 中英切換，UI 文案切換並將語言偏好存入 localStorage。

## 2026-07-18 任務 8：F6 中英切換

### 做了什麼
- 新增前端簡單 i18n dictionary：`zh-Hant` 與 `en`。
- 右上角新增 `繁中 / EN` 切換，語言偏好存入 `localStorage`。
- 首頁、盲判、裁判評分、反駁卡、戰績頁主要 UI 文案改由 dictionary 控制。
- 新辯論 request 不再固定 `zh-Hant`，會依目前 UI 語言送出 `language`，後端既有 prompt 會依語言輸出中文或英文。

### 關鍵決定
- 不引入重型 i18n 框架，維持 PRD 要求的簡單 dictionary。
- 後端不新增語言狀態；語言偏好只存在前端 localStorage，生成時由 request 明確帶給後端。

### 驗收結果
- `npm.cmd test`：通過，5 passed。
- `npm.cmd run build`：通過。
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，11 passed。
- 前端測試已確認切換 EN 後 UI label 變成 `Ticker`，並且新辯論 request body 帶 `language: "en"`。

### 遇到的問題
- 無新增阻塞。
- 已建立本地 commit `221ece3 feat: add bilingual UI`。
- `git push` 失敗，原因是目前尚未提供 GitHub remote URL，也沒有設定 push destination；已保留本地 commit。

### 下一步
- 任務 9：UI 打磨，調整配色、間距、圖表美化，並將三頁截圖存入 `screenshots/`。
