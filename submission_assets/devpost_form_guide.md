# OpenAI Build Week Devpost Form Guide

Hackathon: OpenAI Build Week

Project: Alpha Gym

Recommended category: Apps for Your Life

Submission deadline noted during project prep: 2026-07-22 00:00 UTC, which is 2026-07-22 08:00 in Taiwan.

## Project Page Fields

### Project name

```text
Alpha Gym
```

### Tagline

```text
Train market judgment with AI debate, historical replay, and real outcome review.
```

### Built with

```text
Python, FastAPI, React, Vite, Tailwind CSS, SQLite, yfinance, OpenAI API, Codex, GPT-5.6
```

### Links

Repository:

```text
https://github.com/houyehh/FinDebate
```

Demo video:

```text
Paste the public or unlisted YouTube URL after uploading:
submission_assets/generated/competition_video/alpha_gym_competition_captioned_en.mp4
```

## Description

```markdown
Alpha Gym is an AI-era investment decision training app. It does not place trades or tell users what to buy. Instead, it turns market judgment into a repeatable practice loop: replay a past market moment, inspect only the information visible at that time, make a blind bull/bear/neutral call, then reveal the real price outcome and AI coach feedback.

The core idea is that AI should not replace human judgment. It should become a training partner. Alpha Gym uses GPT-powered AI Debate and coaching to surface bull cases, bear cases, uncertainty, and counterarguments, while the user still has to make the decision first. Later, the app records whether that judgment worked through real yfinance price checks.

Core features:

- Market Replay: historical drills that hide future prices until after submission.
- Decision Workbench: K-line chart with MA5, MA10, MA20, Bollinger Bands, volume average, KD, and MACD toggles.
- Evidence panels: technical, fundamental, news/theme, and AI usage context.
- GPT-first AI Debate: bull opening, bear opening, cross-examination, and judge scoring.
- Personalized coach feedback: uses the user's side, confidence, rationale, weights, correct side, and actual outcome.
- Live Decision Desk: run the same workbench against current market data.
- Portfolio Lab: save live or manual decisions with entry price, time, rationale, status, and review notes.
- Review Center: separate practice answer records from live judgment records so learning stays organized.
- BYOK settings: judges or users can provide their own OpenAI API key and model.
- Transparent fallback: if quota, billing, model access, or provider errors occur, the UI labels deterministic fallback content instead of pretending it came from GPT.

How OpenAI and Codex were used:

Codex was the primary engineering collaborator for the full-stack build: FastAPI routes, React/Vite UI, SQLite schema, yfinance integration, OpenAI structured-output prompts, Pydantic validation, error handling, BYOK settings, tests, and the competition video pipeline.

GPT-5.6 is used in the intended product path for AI dimension summaries, bull/bear debate generation, judge evidence scoring, and personalized practice coaching. All GPT outputs requested by the backend use JSON schemas and are validated before they reach the frontend.

Alpha Gym is local-first and educational. It is not financial advice, a brokerage integration, or an automated trading system.
```

## Hackathon Submission Fields

### Submitter Type

Choose the option that matches the real submission:

```text
Individual
```

Use `Team of Individuals` only if teammates are added and accepted before the deadline.

### Country of Residence

Choose the submitter's real country of residence. Do not guess this field.

### Category

```text
Apps for Your Life
```

Reason: Alpha Gym is a personal decision-training and learning app.

### URL to public or private code repo

```text
https://github.com/houyehh/FinDebate
```

### Project URL or instructions for judges

```text
This is a local-first app. Please use the GitHub README quickstart to run it locally.

Recommended judging path:
1. Start the FastAPI backend.
2. Start the Vite frontend.
3. Open the API status button in the top-right corner.
4. Use OpenAI API mode with your own key/model if available, or switch to Demo Mode if quota is unavailable.
5. Open Market Replay, inspect a historical drill, submit a judgment, and review the coach feedback.
6. Open Live Desk, search a ticker or company name, save a decision, then review it in Portfolio Lab.
7. Open Review Center to inspect practice answers and live judgment records.

No login, hosted service, brokerage account, or test credentials are required.
```

### `/feedback` Session ID

Required. Paste the Codex `/feedback` Session ID from the main build thread.

How to get it:

```text
In the main Codex thread where most of the project was built, type /feedback and copy the returned Session ID.
```

### If your project is a plugin or dev tool

```text
N/A. Alpha Gym is a local consumer/education app, not a plugin or developer tool.
```

## Final Checklist Before Submit

- Upload `submission_assets/generated/competition_video/alpha_gym_competition_captioned_en.mp4` to YouTube as public or unlisted.
- Confirm the video is shorter than 3 minutes and includes English audio narration.
- Confirm English captions are visible in the video.
- Confirm the GitHub repo is public and includes `LICENSE`.
- Confirm README includes setup, Demo Mode, OpenAI/Codex usage, and limitations.
- Paste the YouTube video URL into Devpost.
- Paste the `/feedback` Session ID.
- Submit the project, not just save it as a draft.
