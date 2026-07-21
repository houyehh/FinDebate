param(
    [string]$FfmpegPath = "C:\tmp\findebate-video-tools\node_modules\ffmpeg-static\ffmpeg.exe"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $repoRoot "submission_assets\generated\competition_video"
$framesDir = Join-Path $outputRoot "frames"
$audioDir = Join-Path $outputRoot "audio"
$capturePath = Join-Path $repoRoot "submission_assets\generated\captures\practice_fixed.png"
$scriptPath = Join-Path $repoRoot "submission_assets\competition_video_script_zh_tw.md"
$srtPath = Join-Path $repoRoot "submission_assets\competition_video_subtitles_zh_tw.srt"
$videoNoAudioPath = Join-Path $outputRoot "competition_video_no_audio.mp4"
$audioAllPath = Join-Path $outputRoot "competition_video_voiceover.wav"
$finalVideoPath = Join-Path $outputRoot "bull_vs_bear_arena_competition_captioned.mp4"

New-Item -ItemType Directory -Force -Path $framesDir | Out-Null
New-Item -ItemType Directory -Force -Path $audioDir | Out-Null

if (-not (Test-Path $FfmpegPath)) {
    throw "FFmpeg not found at $FfmpegPath"
}

Add-Type -AssemblyName System.Drawing

$width = 1920
$height = 1080
$fontUi = "Microsoft JhengHei UI"
$fontMono = "Consolas"
$bg = "#101416"
$panel = "#171d20"
$line = "#2d383d"
$fg = "#edf4ef"
$muted = "#9cacaa"
$emerald = "#35d07f"
$red = "#ff5d64"
$amber = "#f4c76a"
$sky = "#79b7ff"

$slides = @(
    [pscustomobject]@{
        Kind = "title"
        Title = "AI 投資多空辯論擂台"
        Subtitle = "Bull vs Bear Arena"
        Caption = "這不是叫你跟單，而是把投資判斷變成可以練習、可以回測的題庫。"
        Narration = "Bull vs Bear Arena 不是叫使用者跟單，而是把投資判斷變成可以練習、可以回測的題庫。使用者先看資料、自己站邊，再看 AI 裁判與真實價格結果。"
        Duration = 9.0
        Bullets = @("Historical drills", "AI debate", "Blind verdict", "Backtested record")
    }
    [pscustomobject]@{
        Kind = "problem"
        Title = "投資訓練最大的缺口"
        Subtitle = "多數工具只給答案，沒有訓練判斷"
        Caption = "核心目標：回到過去某個時刻，只用當時可見資訊做判斷。"
        Narration = "投資工具常常直接給結論，但真正需要訓練的是判斷力。這個產品把使用者放回過去某個時間點，只顯示當時以前可見的資訊，讓判斷有紀錄、有理由、有後續驗證。"
        Duration = 11.0
        Bullets = @("避免事後諸葛", "先寫理由再揭曉", "把信心度拿來校準", "用七日結果當主結算")
    }
    [pscustomobject]@{
        Kind = "practice"
        Title = "歷史實測刷題"
        Subtitle = "Practice mode fixed and demo-ready"
        Caption = "每題都有 as-of 日期、價格、K 線價量、KD、MACD，以及 AI 面向提示。"
        Narration = "Practice 頁現在已修復，可以穩定載入題目。每題都有 as-of 日期、當時價格、K 線價量、成交量、KD、MACD，並且加上 AI 面向提示，讓使用者練習如何把 AI 分析納入自己的決策。"
        Duration = 13.0
        Bullets = @("As-of market snapshot", "K-line / VOL / KD / MACD", "Technical + fundamental + chip proxy", "AI reasoning checklist")
    }
    [pscustomobject]@{
        Kind = "dimensions"
        Title = "四個面向，不再只看單一訊號"
        Subtitle = "Technical · Fundamental · Chip proxy · AI"
        Caption = "使用者提交時要分配權重，系統能反推你可能過度相信哪一類訊號。"
        Narration = "使用者不只選看多、看空或觀望，還要分配技術面、基本面、籌碼 proxy 與 AI 面的權重。答題後，系統會根據答案與理由，診斷是不是過度依賴單一訊號。"
        Duration = 12.0
        Bullets = @("Technical: trend and momentum", "Fundamental: quality and valuation proxy", "Chip proxy: volume and position pressure", "AI: narrative, uncertainty, falsifier")
    }
    [pscustomobject]@{
        Kind = "ai"
        Title = "AI 面是新的訓練項目"
        Subtitle = "不是神諭，是可檢查的假說"
        Caption = "AI 的價值在於整理敘事、人為因素與反方論點，再交給使用者驗證。"
        Narration = "在 AI 時代，投資分析多了一個新面向。AI 可以整理市場敘事、管理層語氣、投資人心理與反方論點，但它不能被當成神諭。產品會教使用者把 AI 輸出轉成假說、檢查清單與反證條件。"
        Duration = 13.0
        Bullets = @("Narrative", "Human factors", "Counter-thesis", "Falsifier")
    }
    [pscustomobject]@{
        Kind = "debate"
        Title = "多空辯論仍是核心場景"
        Subtitle = "Bull vs Bear, then Judge"
        Caption = "正式模式用 GPT-5.6 多空與裁判；Demo 模式讓 quota 用完也能完整展示。"
        Narration = "多空辯論仍然是核心場景。正式模式用 GPT-5.6 生成多頭、空頭與裁判，並要求 JSON schema 驗證。當 API quota 不足時，Demo 模式仍可完整展示流程，適合黑客松評審測試。"
        Duration = 12.0
        Bullets = @("Bull: 3 evidence-backed claims", "Bear: 3 evidence-backed claims", "Rebuttal: target claim id", "Judge: evidence, source, logic")
    }
    [pscustomobject]@{
        Kind = "blind"
        Title = "盲判流程保留使用者獨立判斷"
        Subtitle = "Judge score is hidden until you choose"
        Caption = "先站邊、寫理由與信心度，再揭曉裁判分數。"
        Narration = "產品最重要的互動，是先站邊再揭曉裁判。使用者先選看多、看空或中立，寫下信心度與理由。提交後才看到裁判分數，避免被 AI 分數錨定。"
        Duration = 11.0
        Bullets = @("Read both sides", "Choose side", "Write confidence and rationale", "Reveal judge")
    }
    [pscustomobject]@{
        Kind = "scoreboard"
        Title = "戰績與回測才是產品靈魂"
        Subtitle = "Your judgment becomes a measurable record"
        Caption = "系統追蹤 1D、7D、30D；勝率、校準度、與 AI 同邊/不同邊表現都會被記錄。"
        Narration = "每次判斷都會存入 SQLite，後續用 yfinance 追蹤一日、七日、三十日價格。戰績頁會統計勝率、信心校準度，以及跟 AI 或裁判同邊時和不同邊時的表現。"
        Duration = 13.0
        Bullets = @("1D / 7D / 30D settlement", "7D win rate", "High vs low confidence calibration", "AI-aligned vs AI-different accuracy")
    }
    [pscustomobject]@{
        Kind = "stack"
        Title = "本機優先，投稿可測"
        Subtitle = "FastAPI · React · SQLite · yfinance · OpenAI"
        Caption = "BYOK 與 Demo Mode 讓評審不用消耗開發者 credit，也能測完整流程。"
        Narration = "技術上，這是一個本機優先的 FastAPI、React、SQLite 應用。市場資料來自 yfinance，LLM 路徑使用 OpenAI。BYOK 讓使用者填自己的 API key，Demo Mode 讓評審不用消耗開發者 credit 也能完整測試。"
        Duration = 12.0
        Bullets = @("No login", "No brokerage integration", "SQLite local record", "BYOK + Demo Mode")
    }
    [pscustomobject]@{
        Kind = "close"
        Title = "Bull vs Bear Arena"
        Subtitle = "Train judgment before trusting predictions"
        Caption = "Repo: github.com/houyehh/FinDebate"
        Narration = "Bull vs Bear Arena 的目標，是在 AI 時代訓練人如何判斷，而不是只把答案交給模型。專案原始碼在 GitHub：houyehh slash FinDebate。"
        Duration = 9.0
        Bullets = @("Practice", "Debate", "Blind verdict", "Backtest")
    }
)

function New-Color {
    param([string]$Hex, [int]$Alpha = 255)
    $clean = $Hex.TrimStart("#")
    return [System.Drawing.Color]::FromArgb(
        $Alpha,
        [Convert]::ToInt32($clean.Substring(0, 2), 16),
        [Convert]::ToInt32($clean.Substring(2, 2), 16),
        [Convert]::ToInt32($clean.Substring(4, 2), 16)
    )
}

function New-Brush {
    param([string]$Hex, [int]$Alpha = 255)
    return [System.Drawing.SolidBrush]::new((New-Color $Hex $Alpha))
}

function New-Pen {
    param([string]$Hex, [float]$Width = 1, [int]$Alpha = 255)
    return [System.Drawing.Pen]::new((New-Color $Hex $Alpha), $Width)
}

function Draw-Text {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Text,
        [float]$X,
        [float]$Y,
        [float]$W,
        [float]$H,
        [float]$Size,
        [string]$Color = "#edf4ef",
        [string]$Weight = "Regular",
        [string]$Align = "Near",
        [string]$Family = $fontUi,
        [int]$Alpha = 255
    )
    $style = [System.Drawing.FontStyle]::Regular
    if ($Weight -eq "Bold") { $style = [System.Drawing.FontStyle]::Bold }
    $font = [System.Drawing.Font]::new($Family, $Size, $style, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Brush $Color $Alpha
    $format = [System.Drawing.StringFormat]::new()
    $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
    $format.FormatFlags = 0
    if ($Align -eq "Center") { $format.Alignment = [System.Drawing.StringAlignment]::Center }
    elseif ($Align -eq "Far") { $format.Alignment = [System.Drawing.StringAlignment]::Far }
    else { $format.Alignment = [System.Drawing.StringAlignment]::Near }
    $rect = [System.Drawing.RectangleF]::new($X, $Y, $W, $H)
    $Graphics.DrawString($Text, $font, $brush, $rect, $format)
    $font.Dispose()
    $brush.Dispose()
    $format.Dispose()
}

function Draw-Panel {
    param(
        [System.Drawing.Graphics]$Graphics,
        [float]$X,
        [float]$Y,
        [float]$W,
        [float]$H,
        [string]$Stroke = "#2d383d",
        [string]$Fill = "#171d20",
        [int]$FillAlpha = 235
    )
    $brush = New-Brush $Fill $FillAlpha
    $pen = New-Pen $Stroke 2 220
    $Graphics.FillRectangle($brush, $X, $Y, $W, $H)
    $Graphics.DrawRectangle($pen, $X, $Y, $W, $H)
    $brush.Dispose()
    $pen.Dispose()
}

function Draw-Base {
    param([System.Drawing.Graphics]$Graphics, [int]$Index)
    $Graphics.Clear((New-Color $bg 255))
    $gridPen = New-Pen $line 1 65
    for ($x = 0; $x -le $width; $x += 96) {
        $Graphics.DrawLine($gridPen, $x, 0, $x, $height)
    }
    for ($y = 0; $y -le $height; $y += 72) {
        $Graphics.DrawLine($gridPen, 0, $y, $width, $y)
    }
    $gridPen.Dispose()

    $sparkPen = New-Pen $emerald 4 130
    $points = New-Object "System.Drawing.PointF[]" 18
    for ($i = 0; $i -lt 18; $i += 1) {
        $px = 80 + ($i * 105)
        $py = 835 - ([Math]::Sin($i * 0.75 + $Index) * 36) - ($i * 5)
        $points[$i] = [System.Drawing.PointF]::new($px, $py)
    }
    $Graphics.DrawLines($sparkPen, $points)
    $sparkPen.Dispose()

    Draw-Text $Graphics "Bull vs Bear Arena" 72 42 520 42 28 $fg "Bold"
    Draw-Text $Graphics "OpenAI Build Week demo" 1320 44 520 40 24 $muted "Regular" "Far"
    $headerPen = New-Pen $amber 2 180
    $Graphics.DrawLine($headerPen, 72, 96, 1848, 96)
    $headerPen.Dispose()
}

function Draw-Caption {
    param([System.Drawing.Graphics]$Graphics, [string]$Caption)
    $captionBrush = New-Brush "#0a0d0e" 230
    $Graphics.FillRectangle($captionBrush, 120, 905, 1680, 120)
    $captionBrush.Dispose()
    Draw-Text $Graphics $Caption 170 928 1580 82 35 $fg "Bold" "Center"
}

function Draw-Bullets {
    param([System.Drawing.Graphics]$Graphics, [string[]]$Bullets, [float]$X, [float]$Y, [float]$W, [string]$Accent = $amber)
    for ($i = 0; $i -lt $Bullets.Count; $i += 1) {
        $cy = $Y + ($i * 78)
        $dot = New-Brush $Accent 255
        $Graphics.FillEllipse($dot, $X, $cy + 10, 18, 18)
        $dot.Dispose()
        Draw-Text $Graphics $Bullets[$i] ($X + 34) $cy ($W - 34) 56 30 $fg "Regular"
    }
}

function Draw-KLine {
    param([System.Drawing.Graphics]$Graphics, [float]$X, [float]$Y)
    Draw-Panel $Graphics $X $Y 820 440 $line "#111719" 240
    Draw-Text $Graphics "K-line / VOL / KD / MACD" ($X + 34) ($Y + 24) 560 42 28 $amber "Bold"
    $prices = @(104, 107, 105, 111, 116, 113, 118, 121, 119, 126, 131, 128, 135, 138)
    $vols = @(42, 51, 48, 76, 82, 60, 92, 88, 65, 96, 104, 80, 110, 118)
    $maxPrice = ($prices | Measure-Object -Maximum).Maximum
    $minPrice = ($prices | Measure-Object -Minimum).Minimum
    $plotX = $X + 52
    $plotY = $Y + 88
    $plotW = 705
    $plotH = 250
    $axisPen = New-Pen $line 1.5 180
    $Graphics.DrawRectangle($axisPen, $plotX, $plotY, $plotW, $plotH)
    $axisPen.Dispose()
    for ($i = 0; $i -lt $prices.Count; $i += 1) {
        $xPos = $plotX + ($i * ($plotW / ($prices.Count - 1)))
        $price = $prices[$i]
        $prev = if ($i -eq 0) { $price - 2 } else { $prices[$i - 1] }
        $yClose = $plotY + $plotH - (($price - $minPrice) / ($maxPrice - $minPrice) * $plotH)
        $yOpen = $plotY + $plotH - (($prev - $minPrice) / ($maxPrice - $minPrice) * $plotH)
        $up = $price -ge $prev
        $candleColor = if ($up) { $emerald } else { $red }
        $pen = New-Pen $candleColor 3 240
        $brush = New-Brush $candleColor 205
        $Graphics.DrawLine($pen, $xPos, [Math]::Min($yOpen, $yClose) - 16, $xPos, [Math]::Max($yOpen, $yClose) + 16)
        $Graphics.FillRectangle($brush, $xPos - 12, [Math]::Min($yOpen, $yClose), 24, [Math]::Max([Math]::Abs($yOpen - $yClose), 8))
        $pen.Dispose()
        $brush.Dispose()
        $volH = $vols[$i] * 0.55
        $volBrush = New-Brush $sky 95
        $Graphics.FillRectangle($volBrush, $xPos - 10, $Y + 390 - $volH, 20, $volH)
        $volBrush.Dispose()
    }
    Draw-Text $Graphics "KD 70.7 / 64.6" ($X + 50) ($Y + 348) 250 38 24 $amber "Bold"
    Draw-Text $Graphics "MACD Hist +1.612" ($X + 315) ($Y + 348) 300 38 24 $emerald "Bold"
    Draw-Text $Graphics "VOL 0.83x 20D avg" ($X + 530) ($Y + 348) 240 38 24 $sky "Bold"
}

function Draw-Slide {
    param([pscustomobject]$Slide, [int]$Index)
    $bitmap = [System.Drawing.Bitmap]::new($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    Draw-Base $graphics $Index

    switch ($Slide.Kind) {
        "title" {
            Draw-Text $graphics $Slide.Subtitle 120 174 1680 70 48 $amber "Bold" "Center"
            Draw-Text $graphics $Slide.Title 120 250 1680 140 92 $fg "Bold" "Center"
            Draw-Panel $graphics 330 455 1260 230 $line "#13191b" 235
            Draw-Bullets $graphics $Slide.Bullets 470 505 960 $emerald
        }
        "problem" {
            Draw-Text $graphics $Slide.Title 120 150 1180 82 70 $fg "Bold"
            Draw-Text $graphics $Slide.Subtitle 125 235 1100 52 34 $muted
            $labels = @("事後諸葛", "單點訊號", "沒有回測")
            $descs = @("看完結果才說自己早知道", "只看新聞、K 線或 AI 一句話", "沒有紀錄就沒有進步")
            for ($i = 0; $i -lt 3; $i += 1) {
                $x = 170 + $i * 545
                Draw-Panel $graphics $x 380 430 270 $line "#161c1f" 240
                Draw-Text $graphics $labels[$i] ($x + 30) 420 370 54 42 $amber "Bold" "Center"
                Draw-Text $graphics $descs[$i] ($x + 44) 500 342 90 29 $fg "Regular" "Center"
            }
            Draw-Bullets $graphics $Slide.Bullets 320 700 1180 $emerald
        }
        "practice" {
            Draw-Text $graphics $Slide.Title 92 136 720 78 66 $fg "Bold"
            Draw-Text $graphics $Slide.Subtitle 96 214 720 42 31 $amber "Bold"
            if (Test-Path $capturePath) {
                $img = [System.Drawing.Image]::FromFile($capturePath)
                Draw-Panel $graphics 830 150 940 600 $amber "#101416" 255
                $graphics.DrawImage($img, 850, 170, 900, 560)
                $img.Dispose()
            } else {
                Draw-KLine $graphics 850 190
            }
            Draw-Bullets $graphics $Slide.Bullets 120 360 620 $sky
        }
        "dimensions" {
            Draw-Text $graphics $Slide.Title 110 135 1500 80 62 $fg "Bold"
            Draw-Text $graphics $Slide.Subtitle 114 212 1200 45 32 $muted
            $names = @("技術面", "基本面", "籌碼 proxy", "AI 面")
            $colors = @($emerald, $amber, $sky, $red)
            for ($i = 0; $i -lt 4; $i += 1) {
                $x = 120 + $i * 435
                Draw-Panel $graphics $x 360 370 360 $colors[$i] "#151b1e" 238
                Draw-Text $graphics $names[$i] ($x + 28) 398 314 54 42 $colors[$i] "Bold" "Center"
                Draw-Text $graphics $Slide.Bullets[$i] ($x + 42) 490 286 120 28 $fg "Regular" "Center"
                $barBrush = New-Brush $colors[$i] 210
                $graphics.FillRectangle($barBrush, $x + 62, 650, 246 - ($i * 22), 18)
                $barBrush.Dispose()
            }
        }
        "ai" {
            Draw-Text $graphics $Slide.Title 110 138 1180 76 64 $fg "Bold"
            Draw-Text $graphics $Slide.Subtitle 114 216 900 44 34 $amber "Bold"
            $steps = @("市場敘事", "人為因素", "反方論點", "反證條件")
            for ($i = 0; $i -lt 4; $i += 1) {
                $x = 155 + $i * 410
                Draw-Panel $graphics $x 390 320 190 $line "#151b1e" 240
                Draw-Text $graphics $steps[$i] ($x + 24) 432 272 48 38 $(if ($i -eq 3) { $red } else { $sky }) "Bold" "Center"
                if ($i -lt 3) {
                    $arrowPen = New-Pen $amber 5 220
                    $graphics.DrawLine($arrowPen, $x + 330, 485, $x + 395, 485)
                    $graphics.DrawLine($arrowPen, $x + 380, 470, $x + 395, 485)
                    $graphics.DrawLine($arrowPen, $x + 380, 500, $x + 395, 485)
                    $arrowPen.Dispose()
                }
            }
            Draw-Text $graphics "AI is useful when it becomes a checklist, not a command." 240 660 1440 52 36 $fg "Bold" "Center" $fontMono
            Draw-Bullets $graphics $Slide.Bullets 420 745 980 $emerald
        }
        "debate" {
            Draw-Text $graphics $Slide.Title 110 138 1250 76 62 $fg "Bold"
            Draw-Text $graphics $Slide.Subtitle 114 216 900 44 34 $muted
            Draw-Panel $graphics 130 340 520 350 $emerald "#111a16" 240
            Draw-Panel $graphics 700 340 520 350 $red "#1b1315" 240
            Draw-Panel $graphics 1270 340 520 350 $amber "#1a1710" 240
            Draw-Text $graphics "BULL" 165 380 450 54 46 $emerald "Bold" "Center" $fontMono
            Draw-Text $graphics "BEAR" 735 380 450 54 46 $red "Bold" "Center" $fontMono
            Draw-Text $graphics "JUDGE" 1305 380 450 54 46 $amber "Bold" "Center" $fontMono
            Draw-Bullets $graphics @($Slide.Bullets[0], $Slide.Bullets[1]) 185 475 390 $emerald
            Draw-Bullets $graphics @($Slide.Bullets[2]) 755 500 390 $red
            Draw-Bullets $graphics @($Slide.Bullets[3]) 1325 500 390 $amber
        }
        "blind" {
            Draw-Text $graphics $Slide.Title 110 138 1340 76 62 $fg "Bold"
            Draw-Text $graphics $Slide.Subtitle 114 216 970 44 34 $amber
            $nodes = @("Read", "Choose", "Reason", "Reveal")
            for ($i = 0; $i -lt 4; $i += 1) {
                $x = 190 + $i * 410
                Draw-Panel $graphics $x 420 270 170 $line "#151b1e" 240
                Draw-Text $graphics $nodes[$i] ($x + 20) 460 230 52 42 $fg "Bold" "Center" $fontMono
                Draw-Text $graphics $Slide.Bullets[$i] ($x + 25) 525 220 44 24 $muted "Regular" "Center"
                if ($i -lt 3) {
                    $pen = New-Pen $emerald 5 220
                    $graphics.DrawLine($pen, $x + 285, 505, $x + 385, 505)
                    $graphics.DrawLine($pen, $x + 368, 488, $x + 385, 505)
                    $graphics.DrawLine($pen, $x + 368, 522, $x + 385, 505)
                    $pen.Dispose()
                }
            }
            Draw-Text $graphics "Judge score hidden until submit" 360 660 1200 52 38 $red "Bold" "Center"
        }
        "scoreboard" {
            Draw-Text $graphics $Slide.Title 110 138 1300 76 62 $fg "Bold"
            Draw-Text $graphics $Slide.Subtitle 114 216 1100 44 33 $muted
            $stats = @(
                @("7D win rate", "75%"),
                @("Calibration", "High vs Low"),
                @("AI alignment", "Compare"),
                @("Settled rows", "1D / 7D / 30D")
            )
            for ($i = 0; $i -lt 4; $i += 1) {
                $x = 135 + $i * 430
                Draw-Panel $graphics $x 340 350 170 $line "#151b1e" 240
                Draw-Text $graphics $stats[$i][0] ($x + 26) 370 300 40 27 $muted
                Draw-Text $graphics $stats[$i][1] ($x + 26) 420 300 58 44 $(if ($i -eq 0) { $emerald } else { $amber }) "Bold"
            }
            Draw-Panel $graphics 210 560 1500 185 $line "#111719" 240
            Draw-Text $graphics "Ticker      Side      Confidence      7D result      Coach focus" 255 598 1370 40 29 $sky "Bold" $fontMono
            Draw-Text $graphics "NVDA        Bull      5/5             WIN +8.4%     Evidence quality" 255 655 1370 40 30 $fg "Regular" $fontMono
            Draw-Text $graphics "AAPL        Bear      2/5             LOSS          Counterargument" 255 704 1370 40 30 $muted "Regular" $fontMono
        }
        "stack" {
            Draw-Text $graphics $Slide.Title 110 138 1100 76 62 $fg "Bold"
            Draw-Text $graphics $Slide.Subtitle 114 216 1200 44 34 $amber "Bold"
            $layers = @("React + Tailwind", "FastAPI", "SQLite", "yfinance", "OpenAI / Demo Mode")
            for ($i = 0; $i -lt $layers.Count; $i += 1) {
                $y = 340 + $i * 78
                Draw-Panel $graphics 350 $y 1220 52 $line "#151b1e" 238
                Draw-Text $graphics $layers[$i] 380 ($y + 8) 1160 36 28 $(if ($i -eq 4) { $emerald } else { $fg }) "Bold" "Center" $fontMono
            }
            Draw-Bullets $graphics $Slide.Bullets 460 760 1000 $sky
        }
        "close" {
            Draw-Text $graphics $Slide.Title 120 210 1680 90 76 $fg "Bold" "Center"
            Draw-Text $graphics $Slide.Subtitle 220 325 1480 62 42 $amber "Bold" "Center"
            Draw-Panel $graphics 420 470 1080 170 $amber "#151b1e" 245
            Draw-Text $graphics "github.com/houyehh/FinDebate" 460 525 1000 64 42 $emerald "Bold" "Center" $fontMono
            Draw-Bullets $graphics $Slide.Bullets 560 710 820 $sky
        }
    }

    Draw-Caption $graphics $Slide.Caption
    $framePath = Join-Path $framesDir ("{0:D2}_{1}.png" -f ($Index + 1), $Slide.Kind)
    $bitmap.Save($framePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
    return $framePath
}

function Write-TtsWav {
    param([string]$Text, [string]$Path)
    $voice = New-Object -ComObject SAPI.SpVoice
    foreach ($candidate in $voice.GetVoices()) {
        if ($candidate.GetDescription() -like "*Hanhan*") {
            $voice.Voice = $candidate
            break
        }
    }
    $voice.Rate = 3
    $voice.Volume = 100
    $stream = New-Object -ComObject SAPI.SpFileStream
    $stream.Open($Path, 3)
    $voice.AudioOutputStream = $stream
    [void]$voice.Speak($Text)
    $stream.Close()
}

function Get-AudioDuration {
    param([string]$Path)
    if (Test-Path $Path) {
        $bytes = (Get-Item $Path).Length
        if ($bytes -gt 44) {
            return [Math]::Round(($bytes - 44) / 44100, 2)
        }
    }
    return 0
}

function Format-SrtTime {
    param([double]$Seconds)
    $span = [TimeSpan]::FromSeconds($Seconds)
    return "{0:00}:{1:00}:{2:00},{3:000}" -f [Math]::Floor($span.TotalHours), $span.Minutes, $span.Seconds, $span.Milliseconds
}

$framePaths = @()
$durations = @()
$ttsAvailable = $true

for ($i = 0; $i -lt $slides.Count; $i += 1) {
    $framePaths += Draw-Slide $slides[$i] $i
    $durations += [double]$slides[$i].Duration
}

$scriptLines = @("# Bull vs Bear Arena Competition Video Script", "")
for ($i = 0; $i -lt $slides.Count; $i += 1) {
    $scriptLines += ("## Scene {0}: {1}" -f ($i + 1), $slides[$i].Title)
    $scriptLines += $slides[$i].Narration
    $scriptLines += ""
}
Set-Content -Path $scriptPath -Value $scriptLines -Encoding UTF8

$narrationText = ($slides | ForEach-Object { $_.Narration }) -join "`r`n`r`n"
try {
    Write-TtsWav $narrationText $audioAllPath
} catch {
    if (-not (Test-Path $audioAllPath)) {
        $ttsAvailable = $false
    }
}
if ($ttsAvailable) {
    $audioDuration = Get-AudioDuration $audioAllPath
    $baseDuration = ($durations | Measure-Object -Sum).Sum
    if ($audioDuration -gt 0 -and $baseDuration -gt 0) {
        $scale = [Math]::Max(1.0, ($audioDuration + 0.8) / $baseDuration)
        $durations = $durations | ForEach-Object { [double]$_ * $scale }
    }
}

$srtLines = @()
$cursor = 0.0
for ($i = 0; $i -lt $slides.Count; $i += 1) {
    $start = $cursor
    $end = $cursor + [double]$durations[$i]
    $srtLines += [string]($i + 1)
    $srtLines += ("{0} --> {1}" -f (Format-SrtTime $start), (Format-SrtTime $end))
    $srtLines += $slides[$i].Caption
    $srtLines += ""
    $cursor = $end
}
Set-Content -Path $srtPath -Value $srtLines -Encoding UTF8

$imageConcatPath = Join-Path $outputRoot "frames_concat.txt"
$imageConcat = @()
for ($i = 0; $i -lt $framePaths.Count; $i += 1) {
    $safePath = $framePaths[$i].Replace("\", "/")
    $imageConcat += "file '$safePath'"
    $imageConcat += ("duration {0:N3}" -f [double]$durations[$i])
}
$imageConcat += "file '$($framePaths[-1].Replace("\", "/"))'"
Set-Content -Path $imageConcatPath -Value $imageConcat -Encoding ASCII

& $FfmpegPath -y -hide_banner -f concat -safe 0 -i $imageConcatPath -vf "fps=30,format=yuv420p" -c:v libx264 -r 30 $videoNoAudioPath
if ($LASTEXITCODE -ne 0) {
    throw "Video render failed"
}

if ($ttsAvailable -and (Test-Path $audioAllPath)) {
    & $FfmpegPath -y -hide_banner -i $videoNoAudioPath -i $audioAllPath -c:v copy -c:a aac -b:a 128k -shortest $finalVideoPath
    if ($LASTEXITCODE -ne 0) {
        throw "Final mux failed"
    }
} else {
    Copy-Item -Path $videoNoAudioPath -Destination $finalVideoPath -Force
}

Write-Output "video=$finalVideoPath"
Write-Output "script=$scriptPath"
Write-Output "srt=$srtPath"
