param(
    [string]$FfmpegPath = "C:\tmp\findebate-video-tools\node_modules\ffmpeg-static\ffmpeg.exe"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $repoRoot "submission_assets\generated\competition_video"
$framesDir = Join-Path $outputRoot "frames"
$captureDir = Join-Path $repoRoot "submission_assets\generated\captures"
$scriptPath = Join-Path $repoRoot "submission_assets\competition_video_script_en.md"
$srtPath = Join-Path $repoRoot "submission_assets\competition_video_subtitles_en.srt"
$videoNoAudioPath = Join-Path $outputRoot "competition_video_no_audio.mp4"
$voiceoverPath = Join-Path $outputRoot "competition_video_voiceover_en.wav"
$sfxPath = Join-Path $outputRoot "competition_video_sfx.wav"
$finalVideoPath = Join-Path $outputRoot "alpha_gym_competition_captioned_en.mp4"

New-Item -ItemType Directory -Force -Path $framesDir | Out-Null
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

if (-not (Test-Path $FfmpegPath)) {
    throw "FFmpeg not found at $FfmpegPath"
}

Add-Type -AssemblyName System.Drawing

$width = 1920
$height = 1080
$fontDisplay = "Georgia"
$fontUi = "Segoe UI"
$fontMono = "Consolas"
$bg = "#050505"
$panel = "#0c0d0c"
$line = "#3b3321"
$fg = "#f8f1dc"
$muted = "#b7ad97"
$gold = "#f1c35b"
$emerald = "#42d99a"
$red = "#f26a6a"
$cyan = "#6ed7f2"
$violet = "#a792ff"

$slides = @(
    [pscustomobject]@{
        Kind = "title"
        Title = "Alpha Gym"
        Subtitle = "AI Investment Decision Training"
        Caption = "AI gives answers. Alpha Gym trains judgment."
        Narration = "AI gives answers. Alpha Gym trains judgment. It is a local-first investment decision gym for practicing market calls before accepting a model's conclusion."
        Duration = 8.0
        Bullets = @("Replay the past", "Debate with AI", "Decide before reveal", "Review real outcomes")
        Image = ""
    },
    [pscustomobject]@{
        Kind = "loop"
        Title = "The product is a training loop"
        Subtitle = "Not a trading bot. Not financial advice."
        Caption = "Replay, decide, reveal, and review: the user stays responsible for the judgment."
        Narration = "Most finance tools jump straight to recommendations. Alpha Gym reverses that pattern: replay the market, make your own call, reveal evidence and outcomes, then review how your reasoning performed."
        Duration = 12.0
        Bullets = @("1. Market snapshot", "2. Blind judgment", "3. AI opposition", "4. Outcome review")
        Image = ""
    },
    [pscustomobject]@{
        Kind = "screenshot"
        Title = "Memorable product shell"
        Subtitle = "A palace outside, a professional desk inside"
        Caption = "The home page frames the app as a decision hall, not another generic dashboard."
        Narration = "The outer experience uses a luxurious decision-hall visual identity, while the workbench keeps conventional chart colors, dense market data, and practical controls for repeated use."
        Duration = 11.0
        Bullets = @("Luxury brand signal", "Desktop-first workflow", "Clear mode entry points")
        Image = (Join-Path $captureDir "alpha_home.png")
    },
    [pscustomobject]@{
        Kind = "screenshot"
        Title = "Market Replay hides the future"
        Subtitle = "Historical drills use only information visible as of that date"
        Caption = "Users practice on past snapshots without future leakage, then reveal the true outcome."
        Narration = "Market Replay places the user at a past date and hides future prices until submission. Each drill shows price structure, technical indicators, fundamentals, news and theme context, and AI usage prompts."
        Duration = 13.0
        Bullets = @("As-of date", "Hidden future prices", "Technical, fundamental, news, and AI evidence")
        Image = (Join-Path $captureDir "alpha_market_replay.png")
    },
    [pscustomobject]@{
        Kind = "screenshot"
        Title = "The workbench starts with the chart"
        Subtitle = "MA5, MA10, MA20, Bollinger Bands, volume, KD, and MACD"
        Caption = "A fixed hover inspector keeps daily OHLC and indicators above the chart."
        Narration = "The decision workbench starts with a large chart. Users can toggle moving averages, Bollinger Bands, volume, KD, and MACD, while a fixed inspector keeps daily values visible without blocking the chart."
        Duration = 13.0
        Bullets = @("Large K-line panel", "Indicator checkboxes", "Fixed hover inspector")
        Image = (Join-Path $captureDir "alpha_market_workbench.png")
    },
    [pscustomobject]@{
        Kind = "evidence"
        Title = "Evidence is split into readable grids"
        Subtitle = "Technical | Fundamental | News/Theme | AI"
        Caption = "Fundamentals include valuation and quality signals instead of one long paragraph."
        Narration = "Below the chart, evidence is organized into compact grids. Fundamentals include valuation and quality signals such as P E, market cap, margins, profitability, debt, growth, and dividend context when data is available."
        Duration = 12.0
        Bullets = @("P/E and valuation", "Margins and profitability", "News titles and source URLs", "AI hypotheses and falsifiers")
        Image = ""
    },
    [pscustomobject]@{
        Kind = "ai"
        Title = "AI becomes a new dimension"
        Subtitle = "GPT-first, schema-validated, and source-labeled"
        Caption = "GPT is used for AI summaries, debate, judge scoring, and personalized coaching."
        Narration = "In OpenAI API mode, GPT powers AI summaries, bull and bear debate, judge scoring, and personalized coach feedback. If quota or model access fails, Alpha Gym clearly labels deterministic fallback content instead of pretending it came from GPT."
        Duration = 14.0
        Bullets = @("AI summary", "Bull versus bear debate", "Judge evidence scores", "Personalized coach feedback")
        Image = ""
    },
    [pscustomobject]@{
        Kind = "feedback"
        Title = "Coaching is based on the user's answer"
        Subtitle = "Side, confidence, rationale, weights, and outcome"
        Caption = "The coach critiques the submitted reasoning, not a canned template."
        Narration = "After each practice answer, the coach receives the user's side, confidence, rationale, evidence weights, correct side, visible evidence, and real result. The feedback names the likely blind spot and the next training focus."
        Duration = 13.0
        Bullets = @("What you noticed", "What you ignored", "Why the outcome disagreed", "What to practice next")
        Image = ""
    },
    [pscustomobject]@{
        Kind = "screenshot"
        Title = "Live Desk turns today's ticker into a record"
        Subtitle = "Current analysis can be saved to Portfolio Lab"
        Caption = "Live analysis uses the same workbench, then records entry price, time, side, and rationale."
        Narration = "Live Desk uses the same workbench for today's market data. A saved decision moves into Portfolio Lab with ticker, entry price, timestamp, side, confidence, rationale, and AI agreement."
        Duration = 12.0
        Bullets = @("Ticker or company-name search", "Latest yfinance snapshot", "Save to Portfolio Lab")
        Image = (Join-Path $captureDir "alpha_live_desk.png")
    },
    [pscustomobject]@{
        Kind = "screenshot"
        Title = "Portfolio and Review close the loop"
        Subtitle = "Track decisions, edit records, and inspect recurring mistakes"
        Caption = "The app separates live portfolio decisions from historical practice answers."
        Narration = "Portfolio Lab tracks current decisions and manual entries. Review Center separates practice answer records from live judgment records, so users can edit, delete, and revisit the right context."
        Duration = 12.0
        Bullets = @("Edit and delete records", "Practice accuracy", "AI-aligned versus AI-different results")
        Image = (Join-Path $captureDir "alpha_review_center.png")
    },
    [pscustomobject]@{
        Kind = "build"
        Title = "Built with Codex and GPT-5.6"
        Subtitle = "FastAPI · React · SQLite · yfinance · OpenAI"
        Caption = "Codex built the full stack; GPT-5.6 powers the AI path through structured JSON."
        Narration = "Codex was the engineering partner for the FastAPI backend, React interface, SQLite schema, yfinance data layer, tests, and video pipeline. GPT five point six powers the intended AI path through structured JSON validated by the backend."
        Duration = 12.0
        Bullets = @("FastAPI routes", "React workbench", "SQLite persistence", "Pydantic schema validation")
        Image = ""
    },
    [pscustomobject]@{
        Kind = "close"
        Title = "Alpha Gym"
        Subtitle = "Learn to think with AI before trusting AI."
        Caption = "GitHub: github.com/houyehh/FinDebate"
        Narration = "Alpha Gym is for people learning to think with AI before trusting AI. The project is on GitHub at houyehh slash FinDebate."
        Duration = 8.0
        Bullets = @("Market Replay", "AI Debate", "Portfolio Lab", "Review Center")
        Image = ""
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
        [string]$Color = "#f8f1dc",
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
        [string]$Stroke = "#3b3321",
        [string]$Fill = "#0c0d0c",
        [int]$FillAlpha = 238
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
    $gridPen = New-Pen "#2d2418" 1 75
    for ($x = 0; $x -le $width; $x += 90) {
        $Graphics.DrawLine($gridPen, $x, 0, $x, $height)
    }
    for ($y = 0; $y -le $height; $y += 72) {
        $Graphics.DrawLine($gridPen, 0, $y, $width, $y)
    }
    $gridPen.Dispose()

    $glowBrush = New-Brush "#3a140f" 90
    $Graphics.FillEllipse($glowBrush, -260, 80, 720, 620)
    $glowBrush.Dispose()
    $greenGlow = New-Brush "#063528" 75
    $Graphics.FillEllipse($greenGlow, 1260, 60, 760, 660)
    $greenGlow.Dispose()

    $borderPen = New-Pen $gold 2 180
    $Graphics.DrawRectangle($borderPen, 66, 74, 1788, 920)
    $Graphics.DrawLine($borderPen, 96, 142, 1824, 142)
    $borderPen.Dispose()
    Draw-Text $Graphics "ALPHA GYM" 96 94 520 40 28 $gold "Bold" "Near" $fontDisplay
    Draw-Text $Graphics "OpenAI Build Week" 1240 94 410 40 26 $muted "Regular" "Far" $fontMono
    Draw-Text $Graphics ("{0:00}" -f ($Index + 1)) 1730 94 96 38 28 $gold "Bold" "Far" $fontMono
}

function Draw-Caption {
    param([System.Drawing.Graphics]$Graphics, [string]$Caption)
    $captionBrush = New-Brush "#030303" 232
    $Graphics.FillRectangle($captionBrush, 130, 892, 1660, 126)
    $captionBrush.Dispose()
    $pen = New-Pen $gold 1.5 180
    $Graphics.DrawRectangle($pen, 130, 892, 1660, 126)
    $pen.Dispose()
    Draw-Text $Graphics $Caption 182 916 1556 84 34 $fg "Bold" "Center" $fontUi
}

function Draw-Bullets {
    param([System.Drawing.Graphics]$Graphics, [string[]]$Bullets, [float]$X, [float]$Y, [float]$W, [string]$Accent = $gold)
    for ($i = 0; $i -lt $Bullets.Count; $i += 1) {
        $cy = $Y + ($i * 56)
        $dot = New-Brush $Accent 255
        $Graphics.FillEllipse($dot, $X, $cy + 12, 18, 18)
        $dot.Dispose()
        Draw-Text $Graphics $Bullets[$i] ($X + 38) $cy ($W - 38) 46 28 $fg "Regular" "Near" $fontUi
    }
}

function Draw-ImageFit {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Path,
        [float]$X,
        [float]$Y,
        [float]$W,
        [float]$H
    )
    if (-not (Test-Path $Path)) {
        Draw-Panel $Graphics $X $Y $W $H $line $panel 245
        Draw-Text $Graphics "Screenshot unavailable" $X ($Y + ($H / 2) - 24) $W 48 30 $muted "Bold" "Center" $fontMono
        return
    }
    Draw-Panel $Graphics $X $Y $W $H $gold "#050505" 255
    $img = [System.Drawing.Image]::FromFile($Path)
    $scale = [Math]::Min(($W - 28) / $img.Width, ($H - 28) / $img.Height)
    $drawW = $img.Width * $scale
    $drawH = $img.Height * $scale
    $dx = $X + (($W - $drawW) / 2)
    $dy = $Y + (($H - $drawH) / 2)
    $Graphics.DrawImage($img, $dx, $dy, $drawW, $drawH)
    $img.Dispose()
}

function Draw-KLineMock {
    param([System.Drawing.Graphics]$Graphics, [float]$X, [float]$Y, [float]$W, [float]$H)
    Draw-Panel $Graphics $X $Y $W $H "#2f2d2c" "#070808" 245
    Draw-Text $Graphics "Price Structure" ($X + 28) ($Y + 24) 360 42 28 $fg "Bold" "Near" $fontMono
    $legend = @(
        @("Candles", $emerald),
        @("MA10", $cyan),
        @("Bollinger", $violet),
        @("MACD", $gold)
    )
    for ($i = 0; $i -lt $legend.Count; $i += 1) {
        $lx = $X + $W - 520 + ($i * 130)
        $brush = New-Brush $legend[$i][1] 230
        $Graphics.FillRectangle($brush, $lx, $Y + 34, 28, 10)
        $brush.Dispose()
        Draw-Text $Graphics $legend[$i][0] ($lx + 36) ($Y + 20) 110 38 20 $muted "Regular" "Near" $fontMono
    }

    $plotX = $X + 58
    $plotY = $Y + 110
    $plotW = $W - 116
    $plotH = $H - 196
    $axisPen = New-Pen "#383838" 1.5 180
    $Graphics.DrawRectangle($axisPen, $plotX, $plotY, $plotW, $plotH)
    for ($i = 1; $i -lt 5; $i += 1) {
        $gy = $plotY + ($plotH / 5 * $i)
        $Graphics.DrawLine($axisPen, $plotX, $gy, $plotX + $plotW, $gy)
    }
    $axisPen.Dispose()

    $prices = @(118, 121, 119, 124, 128, 126, 132, 136, 131, 139, 142, 138, 146, 151, 148, 156)
    $maxPrice = 160
    $minPrice = 112
    $maPen = New-Pen $cyan 3 210
    $maPoints = New-Object "System.Drawing.PointF[]" $prices.Count
    for ($i = 0; $i -lt $prices.Count; $i += 1) {
        $xPos = $plotX + ($i * ($plotW / ($prices.Count - 1)))
        $price = $prices[$i]
        $prev = if ($i -eq 0) { $price - 1 } else { $prices[$i - 1] }
        $yClose = $plotY + $plotH - (($price - $minPrice) / ($maxPrice - $minPrice) * $plotH)
        $yOpen = $plotY + $plotH - (($prev - $minPrice) / ($maxPrice - $minPrice) * $plotH)
        $up = $price -ge $prev
        $candleColor = if ($up) { $emerald } else { $red }
        $pen = New-Pen $candleColor 3 240
        $brush = New-Brush $candleColor 205
        $Graphics.DrawLine($pen, $xPos, [Math]::Min($yOpen, $yClose) - 20, $xPos, [Math]::Max($yOpen, $yClose) + 20)
        $Graphics.FillRectangle($brush, $xPos - 12, [Math]::Min($yOpen, $yClose), 24, [Math]::Max([Math]::Abs($yOpen - $yClose), 8))
        $pen.Dispose()
        $brush.Dispose()
        $maPoints[$i] = [System.Drawing.PointF]::new($xPos, $yClose - 14)
    }
    $Graphics.DrawLines($maPen, $maPoints)
    $maPen.Dispose()
    Draw-Text $Graphics "Inspector: Close 151.20  MA10 145.80  RSI 61.3  MACD +0.42" ($X + 42) ($Y + $H - 64) ($W - 84) 36 24 $gold "Bold" "Center" $fontMono
}

function Draw-MiniDashboard {
    param([System.Drawing.Graphics]$Graphics, [float]$X, [float]$Y)
    $cards = @(
        @("P/E", "32.5", $gold),
        @("Gross margin", "54.1%", $emerald),
        @("Debt/equity", "0.28", $cyan),
        @("News theme", "AI demand", $violet),
        @("AI thesis", "Bull lean", $emerald),
        @("Falsifier", "Volume fail", $red)
    )
    for ($i = 0; $i -lt $cards.Count; $i += 1) {
        $col = $i % 3
        $row = [Math]::Floor($i / 3)
        $cx = $X + ($col * 292)
        $cy = $Y + ($row * 150)
        Draw-Panel $Graphics $cx $cy 260 112 "#37322a" "#080909" 245
        Draw-Text $Graphics $cards[$i][0] ($cx + 22) ($cy + 18) 216 30 22 $muted "Regular" "Near" $fontUi
        Draw-Text $Graphics $cards[$i][1] ($cx + 22) ($cy + 52) 216 42 32 $cards[$i][2] "Bold" "Near" $fontMono
    }
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
            Draw-Text $graphics $Slide.Title 130 210 1660 110 98 $fg "Bold" "Center" $fontDisplay
            Draw-Text $graphics $Slide.Subtitle 210 330 1500 60 42 $gold "Bold" "Center" $fontMono
            Draw-Panel $graphics 360 470 1200 250 $gold "#090909" 238
            Draw-Bullets $graphics $Slide.Bullets 510 530 940 $emerald
        }
        "loop" {
            Draw-Text $graphics $Slide.Title 120 176 1120 78 64 $fg "Bold" "Near" $fontDisplay
            Draw-Text $graphics $Slide.Subtitle 124 254 980 44 32 $gold "Bold"
            $nodes = @("Replay", "Decide", "Debate", "Review")
            $colors = @($cyan, $gold, $violet, $emerald)
            for ($i = 0; $i -lt 4; $i += 1) {
                $x = 190 + ($i * 405)
                Draw-Panel $graphics $x 438 270 160 $colors[$i] "#080909" 245
                Draw-Text $graphics $nodes[$i] ($x + 18) 478 234 52 40 $colors[$i] "Bold" "Center" $fontMono
                Draw-Text $graphics $Slide.Bullets[$i] ($x + 22) 535 226 38 22 $muted "Regular" "Center" $fontUi
                if ($i -lt 3) {
                    $pen = New-Pen $gold 5 220
                    $Graphics.DrawLine($pen, $x + 286, 518, $x + 386, 518)
                    $Graphics.DrawLine($pen, $x + 370, 502, $x + 386, 518)
                    $Graphics.DrawLine($pen, $x + 370, 534, $x + 386, 518)
                    $pen.Dispose()
                }
            }
            Draw-Text $graphics "Decide before reveal is the product's learning spine." 340 690 1240 56 36 $fg "Bold" "Center" $fontUi
        }
        "screenshot" {
            Draw-Text $graphics $Slide.Title 110 168 690 116 52 $fg "Bold" "Near" $fontDisplay
            Draw-Text $graphics $Slide.Subtitle 114 290 660 84 28 $gold "Bold"
            Draw-Bullets $graphics $Slide.Bullets 130 432 620 $emerald
            Draw-ImageFit $graphics $Slide.Image 820 190 930 590
        }
        "evidence" {
            Draw-Text $graphics $Slide.Title 110 172 1260 76 62 $fg "Bold" "Near" $fontDisplay
            Draw-Text $graphics $Slide.Subtitle 114 250 980 44 32 $gold "Bold" "Near" $fontMono
            Draw-MiniDashboard $graphics 190 392
            Draw-KLineMock $graphics 1080 370 620 350
            Draw-Bullets $graphics $Slide.Bullets 240 632 760 $cyan
        }
        "ai" {
            Draw-Text $graphics $Slide.Title 110 174 1120 76 64 $fg "Bold" "Near" $fontDisplay
            Draw-Text $graphics $Slide.Subtitle 114 252 980 44 32 $gold "Bold" "Near" $fontMono
            Draw-Panel $graphics 180 390 690 330 $emerald "#07100d" 245
            Draw-Text $graphics "openai:gpt-5.6" 230 432 600 42 30 $emerald "Bold" "Near" $fontMono
            Draw-Text $graphics "Structured JSON is validated by FastAPI before it reaches the workbench." 230 492 580 92 30 $fg "Regular"
            Draw-Text $graphics "AI is a hypothesis engine, not the final authority." 230 620 580 58 32 $gold "Bold"
            Draw-Panel $graphics 1010 390 690 330 $red "#120707" 245
            Draw-Text $graphics "fallback_reason" 1060 432 600 42 30 $red "Bold" "Near" $fontMono
            Draw-Text $graphics "Quota, billing, model access, schema, or provider errors become labeled fallback output." 1060 492 580 92 30 $fg "Regular"
            Draw-Text $graphics "No hidden fake AI." 1060 620 580 58 32 $gold "Bold"
            Draw-Bullets $graphics $Slide.Bullets 470 760 900 $violet
        }
        "feedback" {
            Draw-Text $graphics $Slide.Title 110 170 1260 76 62 $fg "Bold" "Near" $fontDisplay
            Draw-Text $graphics $Slide.Subtitle 114 248 1100 44 32 $gold "Bold"
            Draw-Panel $graphics 170 360 720 360 $gold "#080909" 245
            Draw-Text $graphics "User answer" 220 400 620 38 28 $muted "Bold" "Near" $fontMono
            Draw-Text $graphics "Bearish, confidence 4/5. Rationale: valuation looks stretched, but MACD and news themes are improving." 220 452 620 112 30 $fg "Regular"
            Draw-Text $graphics "Weights: Technical 40% · Fundamental 35% · AI 25%" 220 610 620 40 26 $gold "Bold" "Near" $fontMono
            Draw-Panel $graphics 1030 360 720 360 $emerald "#07100d" 245
            Draw-Text $graphics "Coach feedback" 1080 400 620 38 28 $emerald "Bold" "Near" $fontMono
            Draw-Text $graphics "You identified valuation risk, but your rationale did not explain why momentum and improving themes were not enough to invalidate the bear case." 1080 452 620 138 30 $fg "Regular"
            Draw-Text $graphics "Next drill: add one explicit falsifier before choosing a side." 1080 620 620 50 28 $gold "Bold"
            Draw-Bullets $graphics $Slide.Bullets 430 760 980 $cyan
        }
        "build" {
            Draw-Text $graphics $Slide.Title 110 174 1180 76 64 $fg "Bold" "Near" $fontDisplay
            Draw-Text $graphics $Slide.Subtitle 114 252 1240 44 32 $gold "Bold" "Near" $fontMono
            $layers = @("React + Tailwind UI", "FastAPI + Pydantic", "SQLite local records", "yfinance market data", "OpenAI Responses API")
            for ($i = 0; $i -lt $layers.Count; $i += 1) {
                $y = 372 + ($i * 72)
                Draw-Panel $graphics 380 $y 1160 46 "#35312a" "#080909" 245
                Draw-Text $graphics $layers[$i] 410 ($y + 7) 1100 32 26 $(if ($i -eq 4) { $emerald } else { $fg }) "Bold" "Center" $fontMono
            }
            Draw-Bullets $graphics $Slide.Bullets 460 770 980 $violet
        }
        "close" {
            Draw-Text $graphics $Slide.Title 120 220 1680 100 86 $fg "Bold" "Center" $fontDisplay
            Draw-Text $graphics $Slide.Subtitle 220 340 1480 62 42 $gold "Bold" "Center"
            Draw-Panel $graphics 410 486 1100 158 $gold "#080909" 245
            Draw-Text $graphics "github.com/houyehh/FinDebate" 450 538 1020 54 38 $emerald "Bold" "Center" $fontMono
            Draw-Bullets $graphics $Slide.Bullets 560 724 820 $cyan
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
    $selected = $false
    foreach ($candidate in $voice.GetVoices()) {
        if ($candidate.GetDescription() -like "*Zira*") {
            $voice.Voice = $candidate
            $selected = $true
            break
        }
    }
    if (-not $selected) {
        foreach ($candidate in $voice.GetVoices()) {
            if ($candidate.GetDescription() -like "*David*") {
                $voice.Voice = $candidate
                break
            }
        }
    }
    $voice.Rate = 0
    $voice.Volume = 100
    $stream = New-Object -ComObject SAPI.SpFileStream
    $stream.Open($Path, 3)
    $voice.AudioOutputStream = $stream
    [void]$voice.Speak($Text)
    $stream.Close()
}

function Find-Bytes {
    param([byte[]]$Bytes, [byte[]]$Needle, [int]$Start = 0)
    for ($i = $Start; $i -le $Bytes.Length - $Needle.Length; $i += 1) {
        $matched = $true
        for ($j = 0; $j -lt $Needle.Length; $j += 1) {
            if ($Bytes[$i + $j] -ne $Needle[$j]) {
                $matched = $false
                break
            }
        }
        if ($matched) { return $i }
    }
    return -1
}

function Get-WavDuration {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $fmtIndex = Find-Bytes $bytes ([System.Text.Encoding]::ASCII.GetBytes("fmt "))
    $dataIndex = Find-Bytes $bytes ([System.Text.Encoding]::ASCII.GetBytes("data"))
    if ($fmtIndex -lt 0 -or $dataIndex -lt 0) { return 0.0 }
    $byteRate = [BitConverter]::ToInt32($bytes, $fmtIndex + 16)
    $dataSize = [BitConverter]::ToInt32($bytes, $dataIndex + 4)
    if ($byteRate -le 0) { return 0.0 }
    return [Math]::Round($dataSize / $byteRate, 3)
}

function Write-SfxWav {
    param([string]$Path, [double]$Duration, [double[]]$Markers)
    $sampleRate = 44100
    $channels = 1
    $bitsPerSample = 16
    $byteRate = $sampleRate * $channels * ($bitsPerSample / 8)
    $blockAlign = $channels * ($bitsPerSample / 8)
    $sampleCount = [int]($Duration * $sampleRate)
    $dataSize = $sampleCount * $blockAlign
    $writer = [System.IO.BinaryWriter]::new([System.IO.File]::Open($Path, [System.IO.FileMode]::Create))
    try {
        $writer.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
        $writer.Write([int](36 + $dataSize))
        $writer.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))
        $writer.Write([System.Text.Encoding]::ASCII.GetBytes("fmt "))
        $writer.Write([int]16)
        $writer.Write([int16]1)
        $writer.Write([int16]$channels)
        $writer.Write([int]$sampleRate)
        $writer.Write([int]$byteRate)
        $writer.Write([int16]$blockAlign)
        $writer.Write([int16]$bitsPerSample)
        $writer.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
        $writer.Write([int]$dataSize)
        for ($n = 0; $n -lt $sampleCount; $n += 1) {
            $time = $n / $sampleRate
            $value = 0.0
            foreach ($marker in $Markers) {
                $dt = $time - $marker
                if ($dt -ge 0 -and $dt -lt 0.42) {
                    $env = [Math]::Exp(-8.5 * $dt)
                    $tone = ([Math]::Sin(2 * [Math]::PI * 660 * $dt) * 0.55) + ([Math]::Sin(2 * [Math]::PI * 990 * $dt) * 0.30)
                    $value += $tone * $env * 0.18
                }
            }
            $value = [Math]::Max(-0.8, [Math]::Min(0.8, $value))
            $writer.Write([int16]($value * [int16]::MaxValue))
        }
    } finally {
        $writer.Close()
    }
}

function Format-SrtTime {
    param([double]$Seconds)
    $span = [TimeSpan]::FromSeconds($Seconds)
    return "{0:00}:{1:00}:{2:00},{3:000}" -f [Math]::Floor($span.TotalHours), $span.Minutes, $span.Seconds, $span.Milliseconds
}

$framePaths = @()
$durations = @()
for ($i = 0; $i -lt $slides.Count; $i += 1) {
    $framePaths += Draw-Slide $slides[$i] $i
    $durations += [double]$slides[$i].Duration
}

$scriptLines = @("# Alpha Gym Competition Video Script", "")
for ($i = 0; $i -lt $slides.Count; $i += 1) {
    $scriptLines += ("## Scene {0}: {1}" -f ($i + 1), $slides[$i].Title)
    $scriptLines += $slides[$i].Narration
    $scriptLines += ""
}
Set-Content -Path $scriptPath -Value $scriptLines -Encoding UTF8

$narrationText = ($slides | ForEach-Object { $_.Narration }) -join "`r`n`r`n"
Write-TtsWav $narrationText $voiceoverPath

$audioDuration = Get-WavDuration $voiceoverPath
$baseDuration = ($durations | Measure-Object -Sum).Sum
if ($audioDuration -gt 0 -and $baseDuration -gt 0) {
    $scale = [Math]::Max(1.0, ($audioDuration + 0.6) / $baseDuration)
    $durations = $durations | ForEach-Object { [double]$_ * $scale }
}

$srtLines = @()
$cursor = 0.0
$markers = New-Object System.Collections.Generic.List[double]
$markers.Add(0.35)
for ($i = 0; $i -lt $slides.Count; $i += 1) {
    $start = $cursor
    $end = $cursor + [double]$durations[$i]
    if ($i -gt 0) { $markers.Add($start + 0.18) }
    $srtLines += [string]($i + 1)
    $srtLines += ("{0} --> {1}" -f (Format-SrtTime $start), (Format-SrtTime $end))
    $srtLines += $slides[$i].Caption
    $srtLines += ""
    $cursor = $end
}
Set-Content -Path $srtPath -Value $srtLines -Encoding UTF8
Write-SfxWav $sfxPath ($cursor + 1.0) $markers.ToArray()

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

& $FfmpegPath -y -hide_banner -i $videoNoAudioPath -i $voiceoverPath -i $sfxPath -filter_complex "[1:a]volume=1.0[a1];[2:a]volume=0.12[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=0[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest $finalVideoPath
if ($LASTEXITCODE -ne 0) {
    throw "Final mux failed"
}

Write-Output "video=$finalVideoPath"
Write-Output "script=$scriptPath"
Write-Output "srt=$srtPath"
