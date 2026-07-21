# 開發進度

## 2026-07-21 AI 面 GPT-first 與基本面 grid

### 做了什麼
- Practice / Live 工作台的 `AI 面` 改成 API mode 預設優先呼叫 OpenAI，以 JSON schema 產生建議方向、信心度、多空 thesis、敘事/人為因素、檢查清單。
- 工作台內的 AI Debate 改成 API mode 優先由 OpenAI 根據 evidence pack 產出多空開場、反駁與裁判分數；若 schema、quota、auth、model access 或其他 provider 錯誤失敗，會自動降級為原本 deterministic evidence-pack debate。
- Practice 作答後的教練回饋改成 GPT-first：GPT 會拿到使用者方向、信心、理由、權重、正解、實際回測結果、可見證據與原本規則診斷，生成針對本題作答的個人化回饋；失敗時降級為 deterministic coach。
- 新增 `source` 與 `fallback_reason` 欄位，前端在 AI 面、AI Debate、教練回饋區會顯示目前內容來自 `openai:<model>`、`deterministic_ai_coach` 或 fallback。
- 基本面面板改為分組 grid，分成估值、成長/獲利、財務體質、業務/資料脈絡；長說明改兩行截斷並保留 hover title 與來源連結。

### 關鍵決定
- `OPENAI_DEBATE_MODE=api` 現在代表 AI 工作台功能也會 GPT-first；`demo` 則完全不呼叫 OpenAI。
- 歷史題的 OpenAI AI 面只吃 as-of 前可見資料；作答前不把未來結果交給模型，避免未來資訊洩漏。
- 測試環境固定關閉 OpenAI 呼叫，並用 mock 測 GPT path / fallback path，避免因真實 quota 或網路造成測試不穩。

### 驗收測試
- `.\.venv\Scripts\python.exe -m py_compile backend\app\practice.py backend\app\live_analysis.py`：通過。
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：40 passed，1 個既有 Starlette/httpx deprecation warning。
- `npm.cmd test -- --run`：13 passed。
- `npm.cmd run build`：通過。
- `git diff --check`：無 whitespace error；僅 Windows LF/CRLF 提示。

### 遇到問題
- 需要避免 static practice bank 在 module import 時打 OpenAI，因此 demo bank 與重新公開題目不重複呼叫 GPT；動態題生成和 live analysis 才會在 API mode 嘗試 GPT。
- Live analysis 測試原本 patch 錯模組名稱，已改為 patch `practice._should_use_openai_ai`。

### 下一步
- 若評審或你貼入可用 API key 後，可以用畫面上的 `source` 直接確認 AI 面是否由 OpenAI 產生。
- 若 OpenAI structured output 對大型 AI Debate schema 有 provider-side 限制，可再把 AI Debate schema 拆成多段呼叫以降低失敗率。

## 2026-07-21 皇宮視覺外殼套用

### 做了什麼
- 建立本地備份 tag `backup/pre-palace-visual` 指向 `6d5dac8`，保留視覺改版前的 undo 錨點。
- 新增 `palace-*` 視覺系統：深黑底、金色細框、宮廷感 serif 標題、低調金色導覽與主按鈕。
- 首頁重做成「私人決策殿堂」主視覺，加入 Decision Reliquary 示意面板，讓產品第一眼更像 AI 投資訓練品牌，而不是一般金融表格工具。
- Practice、Live Desk、Portfolio、Review Center 的頁首套用皇宮感外殼；圖表、指標、表格、AI 辯論與資料工作區維持 `terminal-panel`，保留傳統分析軟體的黑底、紅綠漲跌與等寬數字風格。
- 導覽命名調整為「市場回放 / 即時工作台 / 投資追蹤 / 復盤中心」，英文改為 `Market Replay / Live Desk / Portfolio Lab / Review Center`。

### 關鍵決定
- 皇宮奢華感只用在品牌、首頁、頁首與 CTA；資料閱讀區避免過度裝飾，讓 K 線、指標、新聞與 AI 辯論仍然一眼可掃。
- 未引入外部字體載入，先使用系統 serif / sans / mono fallback，降低 demo 現場網路與打包風險。
- 首頁示意卡片改走 i18n 字典，繁中介面不再混入固定英文結果文字。

### 驗收測試
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：37 passed，1 個既有 Starlette/httpx deprecation warning。
- `npm.cmd test -- --run`：13 passed。
- `npm.cmd run build`：通過。
- `git diff --check`：無 whitespace error；僅 Windows LF/CRLF 提示。

### 遇到問題
- 前端測試第一次失敗，原因是某個案例仍在繁中模式，測試卻改找英文 `Portfolio Lab`；已修正為尋找「投資追蹤」。

### 下一步
- 若視覺方向符合預期，可再針對首頁第一屏、錄影開場鏡頭與頁面截圖做最後細節微調。

## 2026-07-21 基本面估值指標補強

### 做了什麼
- 即時基本面擴充估值、獲利與流動性欄位：Market cap、Trailing PE、Forward PE、Price/Sales、PEG、Trailing EPS、Forward EPS、Revenue growth、Gross margin、Operating margin、Profit margin、Debt/equity、Current ratio、ROE、Analyst target/proxy。
- 每個即時基本面指標都帶 Yahoo Finance / yfinance 來源連結，Evidence Pack 也會沿用來源。
- Practice 歷史題新增「Point-in-time valuation」提示；若免費 yfinance 沒有可靠歷史 PE/PS/PEG，不會偷用今天的估值資料，以避免未來資訊洩漏。
- AI 教練的基本面風險判斷也納入 Price/Sales 與 PEG 過高的 warn 訊號。
- 補上繁中欄位翻譯與基本面說明，例如本益比 TTM、預估本益比、股價營收比、PEG、毛利率、營業利益率、流動比率等。

### 關鍵決定
- Live Analysis 可以使用最新 yfinance valuation ratios；Practice 歷史題必須維持 point-in-time 原則，沒有可靠歷史估值就明確標示不可用。
- 不為了畫面完整而捏造 PE 或用現在資料回填過去題目，因為這會破壞產品的訓練可信度。

### 驗收測試
- `.\.venv\Scripts\python.exe -m py_compile backend\app\practice.py backend\app\live_analysis.py` 通過。
- `.\.venv\Scripts\python.exe -m pytest backend\tests\test_practice.py backend\tests\test_live_analysis.py -q` 通過：14 passed。
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q` 通過：37 passed。
- `npm.cmd test -- --run` 通過：13 passed。
- `npm.cmd run build` 通過。

### 遇到問題
- `_to_float` 原本只接受單一值，PEG 需要在 `pegRatio` 與 `trailingPegRatio` 中取第一個有效數字，因此新增 `_first_float` helper。

### 下一步
- 可再把基本面面板分成「估值 / 獲利 / 財務體質」三個小群組，讓資訊更像專業研究工作台。

## 2026-07-21 Home/Review Center 重構與真實新聞來源

### 做了什麼
- 將產品主視覺改為 `Alpha Gym`，Home 改成純產品介紹與功能入口，不再混入即時分析輸入框與工作台。
- 新增獨立 Live Desk / 即時工作台頁面，保留代號/股名搜尋、30 日價格線、即時工作台、AI Debate 與 Portfolio 記錄流程。
- 將 Records 改成 Review Center / 復盤中心，使用 tabs 分開「訓練作答」與「即時判斷」，降低兩種紀錄混在同一張表的混亂感。
- 擴充新聞資料欄位：`source_name`、`source_url`、`published_at`、`summary`，前端新聞面板會顯示新聞標題、摘要、來源、日期與原始新聞連結。
- 將 evidence pack 的新聞證據來源改成優先使用原始新聞 URL；沒有原始 URL 時才退回 Yahoo Finance quote page。
- 新增繁中工作台資料本地化 helper，讓技術面、基本面、新聞/題材與價量欄位在繁中 UI 下顯示中文標籤與主要說明。

### 關鍵決定
- 真實新聞不硬編摘要；若 yfinance 沒有提供摘要，前端明確提示使用原標題與連結查證。
- Practice 的歷史題若找不到 cutoff 前新聞，仍避免顯示未來新聞，維持無未來資訊洩漏的訓練前提。
- Review Center 預設顯示訓練作答，因為產品主軸是投資判斷力訓練；即時判斷則放在第二個 tab。

### 驗收測試
- `.\.venv\Scripts\python.exe -m py_compile backend\app\practice.py backend\app\live_analysis.py backend\app\main.py backend\app\database.py` 通過。
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q` 通過：36 passed。
- `.\.venv\Scripts\python.exe -m pytest backend\tests\test_live_analysis.py backend\tests\test_practice.py -q` 通過：13 passed。
- `npm.cmd test -- --run` 通過：13 passed。
- `npm.cmd run build` 通過。
- 本機確認 `http://127.0.0.1:8020/api/health` 為 ok，`http://127.0.0.1:5184/` 回 200。

### 遇到問題
- 前端測試在 Review Center 分頁後原本仍期待刪除即時判斷紀錄，實際上已切到練習作答 tab；已調整測試流程，分別驗證兩種紀錄的刪除。
- yfinance 新聞格式可能有舊版 `link` 或新版 `content.canonicalUrl.url`，因此 URL parser 做成多欄位兼容。

### 下一步
- 可進一步做首頁視覺細節、比賽影片腳本與 demo walkthrough，讓評審更快理解「判斷訓練」而不是只看到金融 dashboard。

## 2026-07-21 Portfolio CRUD、Records 復盤與 AI Debate 工作台

### 做了什麼
- 新增 evidence pack 與 AI Debate 結構，Practice 與 Live Analysis 都會把技術面、基本面與新聞/題材面證據整理成可追溯的資料包。
- 將工作台的反方檢查改成 AI Debate：包含 Bull/Bear 開場、多空反駁與裁判證據評分；Live Analysis 可在同一個工作台執行 OpenAI 辯論。
- Portfolio 支援手動新增標的，也可以編輯、刪除決策；欄位包含入場價格、時間、狀態、出場價格、理由與檢討筆記。
- Records 頁支援編輯/刪除即時判斷與 Practice 作答紀錄，Practice 編輯後會重新計算勝負與教練回饋。
- 導覽重新整理：標題回到 Home，Home 可選擇練習或即時分析；Live Analysis 移除語意不清的「開始辯論」入口。

### 關鍵決定
- AI 面的內容品質不靠罐頭文案，而是讓每個 AI 辯論論點綁定 evidence refs，回到實際 price action、技術指標、基本面摘要與新聞/題材線索。
- Manual portfolio entry 不強制先跑 live analysis，方便使用者補登既有持倉或手動追蹤假想交易。
- Practice 題目仍保留事後可編輯能力，但編輯作答時會依該題資料重新產生結果與回饋，讓復盤紀錄跟使用者修改後的思考一致。

### 驗收測試
- `.\.venv\Scripts\python.exe -m py_compile backend\app\practice.py backend\app\live_analysis.py backend\app\database.py backend\app\main.py` 通過。
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q` 通過：36 passed。
- `npm.cmd test -- --run` 通過：13 passed。
- `npm.cmd run build` 通過。
- 檢查 `http://127.0.0.1:8020/openapi.json`，確認新 CRUD endpoints 與 AI Debate schema 已在目前後端服務上。

### 遇到問題
- 本機 `8000` port 仍是舊後端；目前前端 fallback 會優先打 `8020`，展示前建議確認後端使用新版服務，或重啟舊 port 讓它載入最新程式。
- 前端測試中「AI suggested side」同時出現在多個區塊，已改用多筆查詢避免測試誤判。

### 下一步
- Demo 可走 Home -> Practice -> AI Debate -> 送出判斷與教練回饋 -> Records 編輯復盤 -> Live Analysis -> Portfolio 新增/追蹤。

## 2026-07-21 即時分析、投資組合與紀錄頁補強

### 做了什麼
- 新增 `GET /api/live-analysis/{ticker}`，使用當天最新 yfinance 價格、K 線、MA10/MA20、布林通道、量能、KD、MACD、基本面與新聞摘要，輸出與練習頁一致的工作台資料。
- 新增 `portfolio_decisions` SQLite 資料表與 `POST /api/portfolio/decisions`、`GET /api/portfolio`，可記錄即時決策的方向、信心、理由、進場價格、AI 方向與後續追蹤報酬。
- 將首頁即時分析改成標的搜尋後直接顯示工作台，使用者可在工作台底部送出當下決策，送出後可到 Portfolio 追蹤。
- Records 頁補上 practice 作答紀錄與教練回饋，讓頁面不只看 7 天回測，也能回看每題判斷理由與回饋。
- AI 面內容在繁中 UI 下改為繁中文案，並顯示 AI 來源、難量化因素、AI 檢查清單，避免看起來像固定罐頭。
- 前端 API 呼叫改為共用 fallback fetch，讓目前前端在 `5184` 時可自動連到可用的本機後端 port。
- 補上 live analysis 與 portfolio 的後端測試、前端流程測試。

### 關鍵決定
- 不把翻譯 API 或 OpenAI key 放在前端；前端可顯示中文，但翻譯/語言控制應由後端或已驗證資料層處理，避免使用者 key 暴露與不可控成本。
- Practice 的歷史題維持防偷看未來資料：歷史題不硬塞最新基本面；Live Analysis 才使用當天最新基本面與新聞。
- AI 面目前以可見指標、基本面與新聞摘要組成規則化分析，確保每次回覆能追溯到本題資料，不是無來源的 canned response。

### 驗收測試
- `.\.venv\Scripts\python.exe -m py_compile backend\app\live_analysis.py backend\app\main.py backend\app\database.py backend\app\practice.py`：通過。
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：35 passed。
- `npm.cmd test -- --run`：11 passed。
- `npm.cmd run build`：通過。
- In-app browser 驗證：搜尋 `NVDA` 後可載入即時工作台；繁中 AI 面顯示中文；送出即時決策後 Portfolio 顯示該筆追蹤；Records 顯示 practice 作答理由與教練回饋。

### 遇到的問題
- 目前本機 `8000` port 仍像是舊後端，新的 endpoints 在 `8020` 可用；前端 fallback 已可自動改打可用後端，但正式展示前建議重啟後端保持 port 一致。
- Vitest/build 在 Windows sandbox 讀取 Vite config 時會被擋，已用核准的 escalated command 完成驗收。

### 下一步
- 將比賽影片主線調整為：Practice 歷史題訓練 → AI 面協助修正判斷 → Live Analysis 即時決策 → Portfolio 後續追蹤 → Records 回看練習回饋。

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

## 2026-07-18 任務 9：UI 打磨與截圖

### 做了什麼
- 調整首頁左右欄位為等寬配置，並在兩個主要卡片加上 `min-w-0`，避免圖表與輸入區在桌面寬度下擠壓或溢出。
- 以目前深色金融風格、Bull 綠色、Bear 紅色、裁判金色/灰色為基礎，確認三個主要頁面的間距、卡片層級與文字可讀性。
- 產出三張桌面截圖：
  - `screenshots/01_home.png`
  - `screenshots/02_debate.png`
  - `screenshots/03_records.png`

### 關鍵決定
- 不新增動畫或額外功能，只做桌面優先的版面穩定與截圖驗收，遵守不做清單。
- 截圖使用 mock API 與 headless Chrome 走完整 UI 流程產生；mock helper 僅作為本次驗收工具，截圖完成後已移除，避免留下非產品程式。

### 驗收結果
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，11 passed。
- `npm.cmd test`：通過，5 passed。
- `npm.cmd run build`：通過。
- 已人工檢視三張截圖：首頁、辯論頁、戰績頁皆非空白、桌面寬度正常，未發現主要 UI 重疊或裁切。

### 遇到的問題
- Vite/Vitest 在 sandbox 內啟動時會因 esbuild 讀取目錄權限失敗，已依規則使用 escalated command 完成前端測試與 build。
- in-app browser 的 screenshot surface 曾產生窄版/裁切畫面，因此改用 headless Chrome CDP 產生最終截圖。
- 已建立本地 commit `7ee0c6b style: polish UI and capture screenshots`。
- `git push` 失敗，原因是目前尚未提供 GitHub remote URL，也沒有設定 push destination；已保留本地 commit。

### 下一步
- 任務 10：撰寫 README，包含安裝步驟、架構圖、demo seed 腳本與 Codex 使用說明段落留空。

## 2026-07-18 任務 10：README

### 做了什麼
- 新增 `README.md`，說明產品用途、技術棧、專案結構與本機執行方式。
- 補上 Mermaid 架構圖，描述 React UI、FastAPI、yfinance、OpenAI Responses API 與 SQLite 的資料流。
- 補上安裝步驟、後端/前端啟動命令、健康檢查、測試命令與主要 API 清單。
- 補上 `scripts/demo_seed.py --demo-seed` 使用說明。
- 新增 `Codex 使用說明` 段落標題並保持留空，等待使用者自行補充。

### 關鍵決定
- README 使用繁體中文撰寫，命令維持 PowerShell 格式，符合目前 Windows workspace。
- 不加入部署、Docker 或 CI/CD 說明，避免超出不做清單。

### 驗收結果
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，11 passed。
- `npm.cmd test`：通過，5 passed。
- `npm.cmd run build`：通過。
- `Select-String -Path README.md -Pattern '架構圖','Demo Seed','Codex 使用說明','uvicorn','npm.cmd run dev'`：通過，必要段落與命令皆存在。

### 遇到的問題
- 前端測試與 build 仍需在 sandbox 外執行，原因同任務 9：Vite/esbuild 在 sandbox 內讀取目錄權限失敗。
- 已建立本地 commit `05962fd docs: add project README`。
- `git push` 失敗，原因是目前尚未提供 GitHub remote URL，也沒有設定 push destination；已保留本地 commit。

### 下一步
- §6 開發任務已全部完成。待使用者提供 GitHub remote URL 後，設定 remote 並推送既有本地 commits。

## 2026-07-18 GitHub remote 設定

### 做了什麼
- 使用使用者提供的 remote URL 設定 `origin`：`https://github.com/houyehh/FinDebate.git`。
- 將本地 `master` 分支推送到 GitHub，並設定 upstream tracking。

### 驗收結果
- `git push -u origin master`：通過，已建立遠端分支 `master -> master`。

### 下一步
- 若後續要改用 `main` 作為預設分支，可再由使用者決定是否重新命名分支。

## 2026-07-18 OpenAI API key 診斷與設定修正

### 做了什麼
- 檢查本機 `.env`，確認有設定 `OPENAI_API_KEY`，且 key 格式為 `sk-proj...`。
- 使用 OpenAI API 做最小診斷，確認 `gpt-5.6` 不是目前帳號可用的有效 model id。
- 列出可見模型後，確認 `gpt-5.6-luna`、`gpt-5.6-sol`、`gpt-5.6-terra` 可 retrieve。
- 將後端預設模型、`.env.example` 與 README 範例改成 `gpt-5.6-luna`。
- 修復 `.env` 被 UTF-8 BOM 影響導致 Python `dotenv` 讀不到第一行 `OPENAI_API_KEY` 的問題，改成 UTF-8 no BOM。

### 關鍵決定
- 選用 `gpt-5.6-luna` 作為目前可驗證存在的預設模型，避免繼續使用不存在的 `gpt-5.6`。
- `.env.example` 保持空白 key，真實 key 僅留在 ignored 的 `.env`。

### 驗收結果
- Python 設定模組已可讀到 `OPENAI_API_KEY`，且 `OPENAI_MODEL` 為 `gpt-5.6-luna`。
- `client.models.retrieve("gpt-5.6-luna")`：通過。
- `client.responses.create(...)`：仍回傳 `429 insufficient_quota`，代表 key/model 已通過本地設定檢查，但帳號或 project 目前沒有可用 API 額度。

### 遇到的問題
- 目前剩餘阻塞是 OpenAI 帳號/project billing 或 quota，不是程式碼讀不到 key。

### 下一步
- 使用者需到 OpenAI Platform 檢查 billing、project credits、limits，或換一把有額度的 API key。

## 2026-07-18 後端 `.env` 載入路徑修正

### 做了什麼
- 修正 `backend/app/settings.py`，不再依賴 uvicorn 啟動時的 current working directory。
- 以 `settings.py` 檔案位置反推專案根目錄，固定讀取 repo root 的 `.env`。
- 增加 fallback：若 OS env 變數是空值或只有空白，會改讀 `.env` 中的值。
- 新增 settings 測試，覆蓋 root `.env` 路徑、空白 OS env fallback、UTF-8 BOM 清理。

### 關鍵決定
- 保留「非空 OS env 優先於 `.env`」的慣例；只有空值才 fallback 到 `.env`。
- 不新增 debug endpoint，避免把環境設定暴露到 API surface。

### 驗收結果
- 從 repo root 執行設定檢查：可讀到 `OPENAI_API_KEY` 與 `OPENAI_MODEL=gpt-5.6-luna`。
- 從 `backend` 目錄執行設定檢查：仍會讀取 repo root `.env`，可讀到 key。
- 模擬空白 OS env：可 fallback 到 `.env` 的 key。
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，14 passed。

### 遇到的問題
- 本機 `127.0.0.1:8000` 仍有舊後端 process 在回應；使用者需要停止原本啟動後端的終端機並重啟，才會吃到新程式碼。

### 下一步
- 重啟後端後，若辯論仍失敗，預期錯誤應從 `OPENAI_API_KEY is not configured` 變成 OpenAI 帳號額度相關的 `429 insufficient_quota`，需由 billing/quota 處理。

## 2026-07-18 API 錯誤 JSON 化與前端容錯

### 做了什麼
- 修正 OpenAI SDK exception 沒被後端捕捉時會變成 plain-text `Internal Server Error` 的問題。
- 新增 `DebateProviderError`，將 OpenAI provider 錯誤轉成 JSON HTTP response。
- 針對 `insufficient_quota`、authentication、model not found、rate limit 等常見錯誤提供更明確的訊息與 HTTP status。
- 前端新增 API response 解析 helper；若後端或 proxy 回傳非 JSON 文字，也會顯示友善 fallback 錯誤，不再出現 `Unexpected token 'I'`。
- 新增測試覆蓋 provider error JSON response 與前端 non-JSON server error fallback。

### 關鍵決定
- 後端仍不暴露 stack trace 或 secret，只回傳可行動的公開錯誤訊息。
- 前端優先顯示後端 JSON `detail.message`，只有 response 不是 JSON 時才使用 i18n fallback。

### 驗收結果
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，16 passed。
- `npm.cmd test`：通過，6 passed。
- `npm.cmd run build`：通過。

### 遇到的問題
- 此修正會消除 `Unexpected token 'I'` 類型的前端解析錯誤；若 OpenAI 帳號仍無額度，UI 應顯示 quota/billing 相關訊息。

### 下一步
- 重啟後端與前端後再次測試辯論流程，確認畫面顯示的是實際 OpenAI provider 錯誤，而不是 JSON parse 錯誤。

## 2026-07-19 BYOK OpenAI 設定頁

### 做了什麼
- 新增 BYOK（Bring Your Own Key）流程，讓使用者可在前端「設定」頁輸入自己的 OpenAI API key 與模型名稱。
- 新增 `GET /api/settings/openai`，回傳 key 是否已設定、masked key preview、目前模型與建議模型清單。
- 新增 `POST /api/settings/openai`，接收新 key/model，寫入 repo root `.env`。
- 前端新增「設定」導覽與設定頁；key 欄位留空時保留既有 key，送出後清空輸入欄位。
- 辯論生成改成每次讀取目前 `OPENAI_MODEL`，不再使用 import time 固定常數，因此設定頁改 model 後下一次辯論即可生效。
- README 補上前端設定頁與 settings API 說明。

### 關鍵決定
- 不把 API key 存在前端 localStorage，也不回傳完整 key；前端只顯示 masked preview。
- 本機版採用後端寫 `.env` 的方式，符合 secret 不進 Git、不進戰績資料庫的原則。
- 模型欄位提供建議清單，但允許自訂 model id，避免不同使用者帳號可用模型不同而被卡住。

### 驗收結果
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，19 passed。
- `npm.cmd test`：通過，7 passed。
- `npm.cmd run build`：通過。

### 遇到的問題
- 這能避免未來所有使用者都吃同一把 key 的 credits，但無法替使用者解決其 OpenAI Platform billing/quota 問題；沒有 API credits 時仍會回 `insufficient_quota`。

### 下一步
- 重啟前後端後，從「設定」頁輸入使用者自己的 key/model，再測試辯論流程。

## 2026-07-19 辯論生成失敗原因追查

### 做了什麼
- 直接呼叫目前 `127.0.0.1:8000/api/debates/judged`，確認仍回 plain 500，代表瀏覽器連到的 8000 不是最新錯誤處理版本。
- 用目前工作樹的 FastAPI TestClient in-process 執行同一個 endpoint，確認最新程式實際回 `429` JSON：OpenAI API quota exceeded。
- 另起乾淨後端 `127.0.0.1:8010`，直接呼叫也確認回 `429` JSON。
- 發現 Vite proxy 經過殘留/舊環境時仍可能把錯誤變成 plain 500；因此新增前端 `VITE_API_BASE_URL`，可直接指定 API base URL 繞過 proxy。
- 後端 CORS 增加 `5174`、`5175`，支援替代前端 port 直連後端。
- README 新增替代 port 啟動方式：後端 8010、前端 5174 + `VITE_API_BASE_URL`。

### 關鍵決定
- 保留原本 8000/5173 預設流程；替代 port 只用於本機舊 process 卡住或 proxy 行為異常時。
- 讓前端支援 API base URL，比硬改 Vite proxy 更穩，且不影響測試預設路徑。

### 驗收結果
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：通過，16 passed。
- `npm.cmd test`：通過，6 passed。
- `npm.cmd run build`：通過。
- `127.0.0.1:8010/api/debates/judged`：回 `429` JSON，訊息為 OpenAI quota/billing。
- `127.0.0.1:5174`：前端可載入，且產出的 App module 已注入 `http://127.0.0.1:8010`。
- CORS preflight `Origin: http://127.0.0.1:5174` → `127.0.0.1:8010/api/debates/judged`：通過。

### 遇到的問題
- Windows `netstat` 顯示 8000 有殘留 PID，但 `taskkill` 回報 PID 不存在；為避免空轉，改走乾淨替代 port。
- 目前真正阻塞仍是 OpenAI 帳號/project quota，不是應用程式流程。

### 下一步
- 使用 `http://127.0.0.1:5174` 測試畫面；若 quota 未處理，預期會顯示 quota/billing 訊息。

## 2026-07-20 預設 API key 選項與 Demo 辯論模式

### 做了什麼
- 設定頁新增「辯論模式」：`OpenAI API` 與 `Demo 模式`。
- 設定頁新增「API key 來源」：`使用預設 API key` 與 `使用自己的 API key`。
- 後端新增 `OPENAI_KEY_SOURCE`、`OPENAI_DEBATE_MODE`、`OPENAI_USER_API_KEY` 設定，讓開發者可保留預設 key，也讓使用者可貼自己的 key。
- 辯論服務新增 Demo 模式：產生固定的兩輪多空辯論與裁判評分，不呼叫 OpenAI，因此 API quota 用完時仍可完整測試與錄影。
- 更新 `.env.example` 與 README，說明預設 key、使用者 key、API 模式、Demo 模式與錄影流程。

### 關鍵決定
- 使用者在前端貼上的 key 寫入 `OPENAI_USER_API_KEY`，不覆蓋開發者預設的 `OPENAI_API_KEY`。
- 儲存設定時不把作業系統環境變數裡的 secret 複寫到 `.env`，避免不必要的 secret 落地。
- Demo 模式仍保留 yfinance 的 ticker 價格快照，但不產生任何 OpenAI API 呼叫，適合比賽影片展示完整 UX。

### 驗收測試
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：21 passed。
- `npm.cmd test`：8 passed。
- `npm.cmd run build`：通過。

### 遇到的問題
- 前端設定頁新增多個「尚未設定」文字後，原測試用單一文字查詢會撞到多個元素；已改成符合新 UI 的斷言。
- 測試發現設定寫入流程可能把 OS env 的預設 key 寫進 `.env`；已改成只保留 `.env` 原本的預設 key。

### 下一步
- 若要拍比賽 demo，建議先切到 `Demo 模式` 完成辯論、盲判與裁判揭曉畫面，再執行 `scripts/demo_seed.py --demo-seed` 展示戰績頁。

## 2026-07-20 修正 5184 前端 port 的 CORS fetch 失敗

### 做了什麼
- 追查 `http://127.0.0.1:5184/` 畫面出現 `Failed to fetch` 的原因。
- 確認後端 `8020` 的 `/api/health` 與 `/api/settings/openai` 都正常，問題不是 API 掛掉。
- 發現後端 CORS 白名單只允許 `5173`、`5174`、`5175`，但目前乾淨前端跑在 `5184`，瀏覽器跨 port 呼叫 `8020` 被擋。
- 後端新增 localhost Vite port regex，允許 `http://127.0.0.1:51xx` 與 `http://localhost:51xx` 的本機開發來源。
- 新增 CORS preflight 測試，覆蓋 `http://127.0.0.1:5184`。

### 關鍵決定
- 保留原本明確白名單，同時補上只限 localhost/127.0.0.1 的 `51xx` regex；不開放任意外部 origin。

### 驗收測試
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：22 passed。
- 實際 preflight `Origin: http://127.0.0.1:5184` → `http://127.0.0.1:8020/api/settings/openai`：回 200，`Access-Control-Allow-Origin` 正確。
- 重新整理 in-app browser 的 `http://127.0.0.1:5184/`：首頁顯示 `API: ok`。

### 遇到的問題
- 本機同時有多個舊後端 process 佔用 `8000`/`8010`，因此用 `8020` 作為乾淨後端驗證目標。
- 因為 `.env` 已切到 Demo 模式，舊 debate endpoint 測試會受本機環境影響；已加測試 fixture 固定一般測試走 API 模式，避免環境污染。

### 下一步
- 使用 `http://127.0.0.1:5184/` 可繼續測試 Demo 模式；若仍看到舊錯誤，直接重新整理頁面即可。

## 2026-07-20 OpenAI Build Week 投稿規則檢查與 README 補強

### 做了什麼
- 使用 Devpost Hackathons 工具查到目前參與的比賽為 `OpenAI Build Week`，狀態為 `submissions_open`，且專案 `Bull vs Bear Arena` 已經有 published/submitted Devpost project。
- 讀取官方規則、提交要求、關鍵日期與最新公告，確認需要 demo video、repo URL、/feedback Session ID、category、英文材料或英文翻譯。
- 檢查本機 README，發現 `Codex 使用說明` 空白，且 README 主要為中文，可能影響規則符合度與評審理解。
- 在 README 補上英文 `English Summary for Judges`，包含專案摘要、Quickstart、Demo Mode 測試路徑、Codex/GPT-5.6 使用說明與 built-with 清單。

### 關鍵決定
- 不重寫整份 README，先補一段完整英文評審入口，快速滿足英文翻譯與 Codex/GPT-5.6 說明需求。
- 保留既有中文 README，避免臨近投稿時大幅改動已驗證的操作說明。

### 驗收測試
- 文件-only 變更，未重跑完整測試；前一輪 CORS 修正後端測試為 22 passed。

### 遇到的問題
- 規則要求 public repo 有 relevant licensing；目前 repo 未看到 `LICENSE` 檔，需由使用者決定授權方式後再補。
- Devpost submission 還需要使用者提供 YouTube demo video URL 與 `/feedback` Session ID，這兩項無法由本機程式自動推定。

### 下一步
- 由使用者確認授權（建議 MIT 或 Apache-2.0）與提供 demo video URL、/feedback Session ID、submitter type、country/category 後，可協助更新 Devpost submission。

## 2026-07-20 投稿素材收尾：License、Demo 影片主檔與填表指南

### 做了什麼
- 補上 MIT `LICENSE`，並在 README 新增 License 區塊，讓 public repo 符合 Devpost 對「relevant licensing」的要求。
- 新增 `submission_assets/voiceover_script_zh_tw.md`，提供約 2 分 30 秒的繁中配音逐字稿，涵蓋產品核心流程、盲判機制、戰績回測，以及 Codex/GPT-5.6 的使用方式。
- 新增 `submission_assets/demo_subtitles_en.srt`，提供英文字幕檔，讓中文配音影片仍有英文翻譯可供評審理解。
- 新增 `submission_assets/devpost_form_guide.md`，整理 Devpost 欄位、建議填法、可直接貼上的 repo URL、測試說明與最後投稿檢查清單。
- 產出本機影片主檔 `submission_assets/generated/bull_vs_bear_arena_demo_silent.mp4`，解析度 1920x1080、長度約 2 分 32 秒；此檔為靜音主檔，已加入畫面字幕與節奏切段。

### 關鍵決定
- 授權選 MIT，原因是簡潔、寬鬆、評審最容易辨識，也適合黑客松公開 repo。
- 影片先交付靜音主檔與逐字稿，保留使用者本人配音；因 OpenAI Build Week 規則要求 demo video 必須有 audio 說明 Codex 與 GPT-5.6，靜音版不可直接當最終投稿影片。
- `submission_assets/generated/` 加入 `.gitignore`，避免把大型生成影格和本機 MP4 塞進 repo；保留可版本控制的腳本型/文字型投稿素材。

### 驗收測試
- 重新查詢 Devpost OpenAI Build Week 提交要求與日期：目前仍為 `submissions_open`，影片必填、網站與 zip 非必填，截止時間為 2026-07-22 00:00 UTC。
- 使用 FFmpeg 驗證輸出影片：長度約 00:02:32、1920x1080、30 fps、H.264 MP4。
- 文件-only 與素材-only 變更，未改動前後端功能；下一步 commit 前會跑後端測試與 diff 檢查。

### 遇到的問題
- HyperFrames doctor 顯示本機缺少 FFmpeg/Chrome headless shell，因此改用暫存目錄的 `ffmpeg-static` 產出可用 MP4。
- 目前 Devpost project 的 `video_url` 仍為空，且 `/feedback Session ID` 需要使用者從 Codex 回饋流程取得，無法由本機自動推定。
- 影片目前沒有音軌；使用者錄完配音後，需要合成音軌並上傳公開 YouTube，才能滿足比賽要求。

### 下一步
- 使用者錄製配音並合成到影片後，上傳為公開 YouTube。
- 填入 Devpost 的 YouTube URL、`/feedback Session ID`、真實 Country of Residence 與 Submitter Type。
- 最終投稿前確認 repo URL 使用 `https://github.com/houyehh/FinDebate`，不要使用舊 repo 連結。

## 2026-07-20 新增判斷力練習題庫

### 做了什麼
- 新增 Practice mode：導覽列加入「練習」，使用者可以像刷題一樣逐題閱讀多空線索、選擇看多/看空/中立、填信心度與判斷理由。
- 後端新增 `practice_attempts` SQLite 表，記錄題號、使用者方向、信心度、理由、參考答案、7 日結果、回饋 JSON 與時間戳。
- 新增 `GET /api/practice`：回傳不含答案的題庫、練習統計與最近作答紀錄。
- 新增 `POST /api/practice/attempts`：送出答案後才揭曉參考方向與 7 日結果，並根據理由文字做回饋分析。
- 題庫目前內建 5 題訓練案例，涵蓋 NVDA、AAPL、BTC-USD、TSLA、2330.TW；題目內容支援繁中/英文切換。
- 回饋分析目前不吃 OpenAI quota，使用本機規則檢查：理由是否太短、是否缺少數據錨點、是否沒有處理反方、是否過度自信、是否過度中立或錯抓主導訊號。
- 前端新增題卡、作答面板、答題後回饋面板、練習統計與最近練習區。

### 關鍵決定
- 先做本機 deterministic 題庫與規則式回饋，避免黑客松 demo 被 OpenAI quota 或外部資料源卡住。
- 練習模式不改動原本「兩輪辯論 → 盲判 → 裁判揭曉 → 戰績回測」主流程，只新增一個可反覆訓練的入口。
- 題目 API 不提前回傳 `answer_side` 或 `outcome_pct`，避免前端在作答前拿到答案。
- 回饋標籤優先顯示使用者當次答案暴露出的問題，再補題目本身的訓練主題。

### 驗收測試
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：25 passed。
- `npm.cmd test`：9 passed。
- `npm.cmd run build`：成功。
- in-app browser 驗證 `http://127.0.0.1:5184/`：可進入「練習」頁，繁中題目正常顯示，送出作答後會出現「可能原因」與「下一題改進」。

### 遇到的問題
- 第一次前端頁面驗證時題目內容仍是英文；已改成前端帶 `language` query，後端依語言回傳本地化題目。
- 手動驗證送出了一筆 NVDA 練習作答，因此本機 `data/app.db` 的練習統計目前會看到 1 次練習紀錄。

### 下一步
- 後續可把練習紀錄彙整成個人弱點曲線，例如「反方處理不足」「證據密度不足」「高信心錯判」的趨勢。
- 若 API quota 穩定，可以再加入可選的 LLM 教練模式，但目前預設保留本機規則回饋，確保 demo 穩定。

## 2026-07-20 練習題庫升級：API 狀態設定入口與隨機技術面題目

### 做了什麼
- 將原本導覽列的「設定」入口移到右上角 `API: ok/error` 狀態按鈕；點擊 API 狀態即可進入 API key、模型與 Demo 模式設定頁。
- 練習題庫新增隨機市場截面題：每次刷新練習頁會從 NVDA、AAPL、TSLA、BTC-USD、2330.TW 抽一個標的與歷史時間點。
- 後端用 yfinance 抓取歷史 OHLCV，計算 5 日均量、KD、MACD，並產生只含作答前可見資料的題目。
- 新增 `practice_questions` SQLite 快取表，隨機題送出時從後端快取讀回答案，不讓前端提前持有 `answer_side`。
- 隨機題答案用抽題日後第 7 個可用交易日漲跌幅判定：大於 +1% 為看多，小於 -1% 為看空，±1% 內為中立。
- 前端練習題卡新增 K 線 / 價量 / KD / MACD SVG 圖表、指標摘要、隨機抽題按鈕。
- yfinance 抓取失敗時會退回內建 OHLCV 範例，避免 demo 因網路或資料源不穩而中斷。

### 關鍵決定
- API 狀態改成設定入口，減少導覽列項目，讓 BYOK/Demo Mode 的入口更直覺。
- 隨機題仍保留原本固定題庫作為備用，避免使用者只看到同一種題型。
- 技術指標只用於練習題，不改動主產品的多空辯論與戰績回測流程。
- 送出答案後更新統計時不重新抽題，避免作答回饋被新題洗掉。

### 驗收測試
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：26 passed。
- `npm.cmd test`：9 passed。
- `npm.cmd run build`：成功。
- `GET /api/practice?language=zh-Hant&refresh_random=true`：回傳隨機市場題，包含 `indicator_summary` 與 `market_window`。
- in-app browser 驗證：導覽列不再顯示「設定」；點擊 `API: ok` 會進設定頁；練習頁顯示隨機題、K 線 / 價量 / KD / MACD 圖表與「隨機抽題」按鈕。

### 遇到的問題
- PowerShell 對 API 回傳中文的顯示有編碼亂碼，但瀏覽器 UTF-8 顯示正常。
- 測試需要避免 yfinance 網路依賴，因此後端測試加入可關閉隨機抽題的環境變數與獨立的指標生成單元測試。

### 下一步
- 可以讓使用者指定隨機抽題的 ticker 範圍與時間區間。
- 可以把技術面題目的答錯原因加入個人弱點統計，例如「追高」「忽略量價背離」「MACD 動能判讀錯誤」。
## 2026-07-21 歷史實測練習、AI 面與股名搜尋

### 做了什麼
- 將 Practice mode 升級成「Historical Judgment Gym」：每題把使用者放回某個歷史 as-of 日期，只顯示該日以前的市場資料，提交後才揭曉 1D / 7D / 30D 真實回測結果。
- 重寫 `backend/app/practice.py`，新增技術面、基本面、籌碼 proxy、AI 面四個 snapshot：
  - 技術面：OHLCV、K 線、MA5 / MA20、RSI、KD、MACD、20 日波動率、量能比。
  - 基本面：以 yfinance 可取得欄位作 snapshot proxy；demo 題使用本機 profile，避免測試或啟動時依賴網路。
  - 籌碼面：明確標示為 chip proxy，使用 volume surge、OBV proxy、price-volume read 等，不宣稱是真實法人籌碼。
  - AI 面：先用 deterministic AI coach 產生多空 thesis、敘事/心理因素、不確定性與使用 AI 的 checklist，避免 OpenAI quota 爆掉時練習流程中斷。
- 使用者作答新增四面向權重：技術面、基本面、籌碼 proxy、AI 面，後端驗證總和必須等於 100%。
- 提交後回傳並顯示：參考答案、目標週期報酬、1D/7D/30D 真實回測、使用者是否與 AI 同邊、權重分配、教練回饋、忽略訊號、下一題訓練重點與建議框架。
- 戰績/練習統計新增 AI 同邊率、同 AI / 不同 AI 正確率、高技術權重與高 AI 權重正確率等能力地圖欄位。
- 新增 `/api/tickers/search?q=...`，支援代號、英文股名、中文股名與關鍵字搜尋，例如 `輝達`、`台積電`、`TSMC`、`Bitcoin`。
- 首頁 ticker 輸入改成搜尋式下拉選單，點選建議會直接查詢對應標的。
- 清理前端 i18n 文案檔，換成可讀繁中/英文；首頁加入「訓練閉環」讓產品主軸更清楚。
- README 英文評審區塊補上 Historical Practice Mode 與 ticker keyword search 說明。

### 關鍵決定
- 嚴格避免價格未來資料洩漏：Practice question response 不包含 `answer_side`、`outcome_pct`、`future_results`，這些只在提交答案後回傳。
- yfinance 不提供完整歷史當日可見基本面資料，因此基本面先標示為 yfinance/latest proxy 或 demo profile；不假裝有完整歷史財報 feed。
- AI 面先採 deterministic coach 作為預設，因為目前使用者 OpenAI API quota 可能不足；這能讓 demo 與練習功能不被 quota 卡死。
- 靜態 demo 題不在模組載入時抓 yfinance，避免測試與啟動變慢或依賴網路。

### 遇到的問題
- 舊 `practice.py` 與 i18n/README 部分中文內容已經有編碼污染；本輪優先重寫 Practice 與 i18n，README 只補可讀英文區塊，未大規模重寫整份文件。
- FastAPI 路由順序若把 `/api/tickers/{ticker}` 放在 `/api/tickers/search` 前面會吃掉 search route，已將 search route 移到動態 route 前。
- 前端測試原本用舊亂碼文案與舊 Practice schema，已重寫測試，改驗收股名下拉、歷史題四面向、權重提交與回測揭曉。

### 驗收測試
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：28 passed，1 warning。
- `npm.cmd test -- --run`：9 passed。
- `npm.cmd run build`：成功。

### 下一步
- 可再加入「錯題重刷 / spaced repetition」，讓常見弱點自動決定下一題類型。
- 若之後 OpenAI API quota 正常，可新增可選的 LLM AI snapshot，並保留 deterministic fallback。
- README 中文段落仍建議後續完整重寫，避免目前舊段落亂碼影響評審閱讀。
## 2026-07-21 Practice failed to fetch 修復與比賽影片準備

### 做了什麼
- 追查 `http://127.0.0.1:5184/` 的 Practice failed to fetch，確認問題是兩層疊加：前端目前以 `VITE_API_BASE_URL=http://127.0.0.1:8020` 直連後端，而 `/api/practice` 在 `8020` 因舊 SQLite 資料回 500；同時 Vite proxy 自身的 `/api/practice` 仍回 404。
- 修正前端 Practice API 呼叫：即使已設定 `VITE_API_BASE_URL`，Practice dashboard 與 attempt submit 遇到 404/500/502/503/504 或非 JSON dev proxy 回應時，會依序嘗試本機 fallback backend URL，避免 demo 時被殘留 port 卡住。
- 修正後端 Practice dashboard：隨機題生成若因 yfinance/live data 失敗，會退回本地 deterministic DEMO 題；cache 寫入失敗不會讓整頁 500。
- 修正 legacy SQLite 相容：舊 `practice_attempts` 內的 `nvda-ai-guidance` 等已不存在題號不再讓 `_recent_attempts()` 爆掉，會降級顯示為 legacy ticker 紀錄並保留回饋。
- 修正舊 cached question 的技術指標欄位缺值問題：MA/RSI/KD/MACD 為 `None` 時摘要顯示 `N/A`，不再因格式化 `None` 導致 500。

### 關鍵決定
- 不刪除使用者既有 `data/app.db` 內容，改用 backward-compatible reader 保留 demo 操作紀錄。
- Practice 訓練模式以「可用性優先」處理：live random 題可以失敗，但刷題頁不能白屏，必須回 demo-safe 題。
- 前端 fallback 只針對 Practice API，避免大範圍改動所有 API 呼叫造成額外回歸風險。

### 驗收測試
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`：29 passed，1 warning。
- `.\.venv\Scripts\python.exe -m pytest backend\tests\test_practice.py -q`：8 passed，1 warning。
- `npm.cmd test -- --run`：10 passed。
- `npm.cmd run build`：通過。
- 實機驗證：in-app browser 進入 `http://127.0.0.1:5184/` 的 Practice 頁，未再出現 failed to fetch，畫面顯示 Historical Backtest Drills、K-line / Price-Volume / KD / MACD、統計與 AI 面向。

### 遇到的問題
- PowerShell 直接執行 `npm` 會被 execution policy 擋住，改用 `npm.cmd`。
- Windows sandbox 讓 `Get-NetTCPConnection`/`tasklist` 部分查詢權限受限，改用 `netstat` 與 API 實測。
- 背景啟動額外 uvicorn port 時 Windows `Path/PATH` 環境變數衝突，最後確認現有 `8020` reload 後已可用，不再強行切換 port。

### 下一步
- 製作上完字幕的比賽展示影片，主軸改成「歷史資料實測刷題 + AI 面向訓練 + 多空辯論 + 戰績回測」。

## 2026-07-21 Practice 修復驗收與上字幕比賽影片完成

### 做了什麼
- 產出已上字幕、含中文語音旁白的比賽影片：`submission_assets/generated/competition_video/bull_vs_bear_arena_competition_captioned.mp4`。
- 新增影片產生腳本 `scripts/render_competition_video.ps1`，可用本機 FFmpeg 與 Windows SAPI 重新生成投稿影片。
- 新增 `submission_assets/competition_video_script_zh_tw.md` 作為中文配音逐字稿，並新增 `submission_assets/competition_video_subtitles_zh_tw.srt` 作為字幕檔。
- 補上 `.gitignore` 規則，排除 `backend/data/*.db` 與 `backend/data/*.sqlite`，避免測試或本機 demo SQLite 檔被誤 commit。

### 關鍵決定
- 影片主軸聚焦在歷史資料實測刷題，而不是只展示 AI 辯論，符合目前產品定位：訓練使用者基於過去可見資訊、技術面、基本面、籌碼 proxy 與 AI 面向做判斷。
- 最終 MP4 放在 `submission_assets/generated/`，維持不進 Git；Git 只保存可重製影片的腳本、逐字稿與字幕檔。

### 驗收測試
- `.\.venv\Scripts\python.exe -m pytest -q`（backend）：31 passed，1 warning。
- `npm.cmd test -- --run`（frontend）：10 passed。
- `npm.cmd run build`（frontend）：通過。
- 實機驗證：`http://127.0.0.1:5184/` 的 Practice 頁不再顯示 failed to fetch。
- 使用 FFmpeg 驗證影片：長度約 00:02:10、1920x1080、30 fps、H.264/AAC MP4；並抽查 25 秒預覽圖確認字幕已燒錄。

### 遇到的問題
- HyperFrames CLI 在本機不可用，因此改用可重現的 PowerShell/GDI+、Windows SAPI TTS 與 FFmpeg 流程產出比賽影片。
- Windows PowerShell 5 解析中文腳本需要 UTF-8 BOM，因此影片腳本已保存為 UTF-8 with BOM。

### 下一步
- 上傳 MP4 到 YouTube 或 Devpost 可接受的影片平台後，將影片 URL 填入投稿表單。

## 2026-07-21 Practice 刷題版面重設計與布林通道

### 做了什麼
- 將 Practice 頁改成「先讀題與看圖，最後再作答」的直向刷題流程；`你的判斷` 區塊移到題目、圖表、三面向判讀、多空線索之後。
- 後端 `MarketIndicatorPoint` 新增 `bb_middle`、`bb_upper`、`bb_lower`，以 20 日均線與 2 倍標準差計算布林通道，並在技術面摘要加入 Bollinger 訊號。
- 前端技術圖表加大為 660px 高，價格區獨立顯示 K 線、MA5、MA20、布林通道帶狀區；下方分層顯示成交量與量均線、KD、MACD。
- 三面向判讀改為技術面、基本面、AI 面；籌碼面暫時降級為 `價量 proxy` 輔助觀察，不再列入正式作答權重。
- 作答權重改為技術面 45%、基本面 25%、AI 面 30%，提交時仍帶 `chip: 0` 以保持後端 schema 與歷史資料相容。

### 關鍵決定
- 不移除後端與資料庫中的 `chip` 欄位，避免破壞既有紀錄與統計；只在 UI 上弱化籌碼面。
- 布林通道同時由後端產生、前端可 fallback 計算，讓舊 cached practice question 缺欄位時仍能正常顯示。
- 作答區不做 sticky，避免使用者未讀完歷史截面就被表單錨定。

### 驗收測試
- `.\.venv\Scripts\python.exe -m pytest backend\tests\test_practice.py -q`：8 passed，1 warning。
- `.\.venv\Scripts\python.exe -m pytest -q`（backend）：31 passed，1 warning。
- `npm.cmd test -- --run`（frontend）：10 passed。
- `npm.cmd run build`（frontend）：通過。
- `git diff --check`：無 whitespace error，僅 Windows LF/CRLF 提示。
- 實機驗證：in-app browser 的 Practice 頁顯示布林通道、MA5/MA20、價量 proxy、三面向判讀；圖表高度為 660px；作答區位於頁面底部。

### 遇到的問題
- Vite reload 後 SPA 會回首頁，需要重新點擊 `練習` 驗證；非本次改版阻塞。
- Browser console 保留了一條 HMR 中間狀態的舊錯誤，重新整理後頁面可正常渲染。

### 下一步
- 若時間允許，可再把 Practice 頁面的隨機題切換做成題目佇列與難度標籤，強化刷題節奏。
## 2026-07-21 Practice 圖表互動、新聞題材與個人化教練回饋

### 做了什麼
- 將截圖中那排獨立技術摘要卡移除，改成把開高低收、成交量、MA5、MA10、MA20、布林通道、RSI、KD、MACD 全部整合到 K 線圖 hover tooltip。
- 在技術圖表上加入指標 checkbox，可個別顯示/隱藏 MA5、MA10、MA20、布林通道、量均線、KD、MACD。
- 擴大隨機題庫標的池，加入更多中小型/高波動美股、加密貨幣與台股，不再只抽大型知名股。
- 練習題新增新聞/題材面，包含公司切入領域、業務描述與 as-of 前可用新聞；抓不到歷史新聞時明確顯示不可得，避免把未來新聞塞進歷史題。
- 歷史基本面改成優先抓 as-of 前季度財務資料；若 yfinance 沒有可靠歷史財報 backfill，隱藏最新估值/營收數字並顯示 fallback 說明，避免未來資料穿越。
- 教練回饋改成解析使用者的作答理由與權重，會引用使用者原文片段並辨識 MA/布林/MACD/成交量/新聞題材/AI 等訊號，降低罐頭回答感。

### 關鍵決定
- 保留資料模型中的 `chip` 欄位以相容舊紀錄，但練習 UI 不再把籌碼 proxy 當作正式面向；價量訊號統一放在 K 線圖與技術面內。
- 新聞面若沒有題目日期前的 yfinance headline，寧可顯示「Historical news unavailable」，也不顯示題目日期之後的新聞。
- 基本面若沒有歷史季度財務欄位，寧可退回背景 proxy，也不在歷史題中展示最新 PE/市值造成訓練污染。

### 遇到的問題
- yfinance 的 current news 與 current profile 容易讓歷史題偷看到未來資訊；已針對 headline 與財務數字做 cutoff/fallback 防護。
- in-app browser 會出現 Statsig 網路錯誤訊息，但不影響本機 app 驗證；Practice 頁載入與互動正常。
- Windows sandbox 會擋 Vitest/Vite 讀取設定檔，因此前端測試與 build 需使用提升權限執行。

### 驗收測試
- `..\.venv\Scripts\python.exe -m pytest tests\test_practice.py -q`：10 passed，1 warning。
- `..\.venv\Scripts\python.exe -m pytest -q`：33 passed，1 warning。
- `npm.cmd test -- --run`：10 passed。
- `npm.cmd run build`：成功。
- `git diff --check`：無 whitespace error，只有 Windows LF/CRLF 提示。
- in-app browser：確認 Practice 不再顯示舊的籌碼/價量摘要卡；圖表 hover 日期會跟著游標移動；MA10 與指標 checkbox 正常；未來 Yahoo 新聞不會出現在歷史題；送出含 MACD/新聞/AI 的理由後，教練回饋有引用並解析該理由。

### 下一步
- 可進一步補歷史新聞資料源或匯入靜態新聞事件資料集，讓新聞/題材面更接近真正 point-in-time。
- 若要做比賽影片，建議重錄 Practice 片段，強調「歷史防穿越、圖表 tooltip、個人化教練」三個亮點。
## 2026-07-21 新定位與 Decision Workbench 版面重排

### 做了什麼
- 將前端品牌與首頁定位從 `Bull vs Bear Arena` 收斂為「AI 投資決策健身房」，把產品主軸改成歷史判斷訓練、AI 分析審核與真實回測。
- 導覽列改成練習優先，首頁原本的標的查詢改為「即時分析」入口，並新增「開始歷史練習」與「分析現在標的」兩個 CTA。
- 將 Practice 頁重排為 `Decision Workbench`：題目摘要後先呈現全寬大圖表，再把基本面、新聞/題材、AI 面、反方檢查放到圖表下方 tabs。
- 將 K 線圖原本跟著游標移動的 SVG tooltip 改成圖表上方固定 inspector 資料列；圖上只保留 vertical crosshair 與收盤點，避免遮住其他日期 K 線。
- 新增證據面板 tabs 的互動測試，確保 News/Theme、AI 面內容需切換 tab 後呈現，符合新的工作台閱讀節奏。

### 關鍵決定
- 暫不新增獨立即時分析頁路由，而是先把首頁標的查詢定位成「即時分析」入口；後續可將同一套 Decision Workbench 抽成共用元件後再擴充。
- Practice 工作台採「圖表在上、證據面板在下」而非左右分欄，優先保留圖表寬度與掃讀清晰度。
- 固定 inspector 放在圖表 SVG 外部，避免 hover 資料遮擋 K 線與技術指標。

### 遇到的問題
- `練習` 與 `開始歷史練習` 兩個按鈕會讓瀏覽器 role name 模糊匹配；驗證時改用 exact match 點擊導覽列。
- Windows sandbox 仍會阻擋 Vitest/Vite 讀取設定檔，因此前端測試與 build 使用提升權限執行。

### 驗收測試
- `npm.cmd test -- --run`：10 passed。
- `npm.cmd run build`：成功。
- `git diff --check`：無 whitespace error，只有 Windows LF/CRLF 提示。
- in-app browser：首頁新品牌、新標題與 CTA 正常；Practice 顯示 Decision Workbench、固定 inspector、證據 tabs；AI tab 切換正常；圖表 hover 日期會更新且 SVG 內不再有浮動 tooltip。

### 下一步
- 將首頁即時分析真正升級為「決策備忘錄」模式，重用 Decision Workbench 的全寬圖表、固定 inspector 與證據 tabs。
- 將戰績頁改成「能力地圖」，讓使用者直接看到 AI 依賴、反方思考、信心校準等弱點診斷。
