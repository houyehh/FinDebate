# OpenAI Build Week Devpost Form Guide

Hackathon: OpenAI Build Week  
Project: Bull vs Bear Arena  
Recommended category: Apps for Your Life

Submission deadline: 2026-07-22 00:00 UTC, which is 2026-07-22 08:00 in Taiwan.

## Project Page Fields

Use these values on the Devpost project page.

### Project name

Bull vs Bear Arena

### Tagline

Practice investment judgment through blind AI bull-bear debates and real-price backtesting.

### Built with

Python, FastAPI, React, Vite, Tailwind CSS, SQLite, yfinance, OpenAI API, Codex, GPT-5.6

### Links

Repository:

```text
https://github.com/houyehh/FinDebate
```

Demo video:

```text
Paste your public or unlisted YouTube URL here after upload.
```

### Description

```markdown
Bull vs Bear Arena is a local investment judgment training app. A user enters a ticker, reviews a structured two-round bull-vs-bear AI debate, makes a blind verdict before seeing judge scores, and later checks whether that judgment was right using real market prices.

The product is built around one idea: good investing requires recording your own reasoning before seeing someone else's score. The judge AI evaluates evidence specificity, source quality, and logic, but the user must choose bull, bear, or neutral first. This avoids anchoring and turns the app into a practice environment for decision-making.

Core features:

- Ticker lookup with yfinance for stocks, Taiwan equities, and crypto tickers.
- Two-round debate: three opening claims per side, then two evidence-backed rebuttals per side.
- Judge scoring for evidence, source quality, logic, and unverifiable claims.
- Blind verdict flow: users choose a side and confidence before judge scores are revealed.
- SQLite persistence for debates, verdicts, settlements, and backtesting.
- Scoreboard with 1-day, 7-day, and 30-day settlement data, win rate, confidence calibration, and judge-agreement analytics.
- BYOK settings page so users can provide their own OpenAI API key and model.
- Demo Mode so judges can test the full workflow without spending API credits.

How Codex and GPT-5.6 were used:

Codex was the primary engineering partner for scaffolding the FastAPI and React/Vite app, implementing yfinance ticker validation, designing the SQLite persistence layer, creating the two-round debate and judge schemas, writing tests, debugging OpenAI provider errors, adding BYOK settings, and tightening local development CORS behavior.

GPT-5.6 is used in the intended product path as the bull, bear, and judge model. Each agent returns structured JSON that is validated by the backend with Pydantic schemas. The project also includes Demo Mode so the entire user experience can be evaluated when API quota is unavailable.

This is not a trading or brokerage app. It does not place orders or give personalized financial advice. It is a local-first judgment training tool.
```

## Hackathon Submission Fields

Use these values on the OpenAI Build Week submission form.

### Submitter Type

Choose the one that matches you:

```text
Individual
```

Use `Team of Individuals` only if teammates are added and accepted before the deadline.

### Please indicate your Country of Residence

Choose your real current country of residence. Examples:

```text
Taiwan
```

or

```text
United States
```

Do not guess this field. It affects eligibility.

### Which category are you submitting to?

```text
Apps for Your Life
```

Reason: the product is a consumer personal-finance judgment trainer.

### URL to your public or private code repo

```text
https://github.com/houyehh/FinDebate
```

The repo now includes an MIT License and an English judge quickstart in README.

### If applicable, link to your project for judges to check and test & any necessary instructions

```text
This is a local-first app. Please use the GitHub README quickstart to run it locally.

Recommended judging path:
1. Start the FastAPI backend.
2. Start the Vite frontend.
3. Open the Settings page and switch Debate Mode to Demo Mode if OpenAI API quota is unavailable.
4. Search NVDA, start a debate, make a blind verdict, then reveal judge scores.
5. Run `.\.venv\Scripts\python.exe scripts\demo_seed.py --demo-seed` to populate settled scoreboard records.

No login or test credentials are required.
```

### /feedback Session ID where the majority of your project was worked on

Required. You need to paste the Codex `/feedback` Session ID from the main build thread.

How to get it:

```text
In the main Codex thread where most of the project was built, type /feedback and copy the returned Session ID.
```

### If your project is a plugin or dev tool, provide installation instructions

```text
N/A. This submission is a local consumer app, not a plugin or developer tool. Setup and testing instructions are in the README.
```

## Final Checklist Before Submit

- YouTube demo video is public and shorter than 3 minutes.
- Video has audio narration covering what was built, Codex usage, and GPT-5.6 usage.
- Repo URL is public and has a LICENSE file.
- README includes setup, Demo Mode, and Codex/GPT-5.6 usage notes.
- `/feedback` Session ID is filled in.
- Submission status is Submitted, not Draft.
