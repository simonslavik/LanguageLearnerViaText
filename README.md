# PDF Translator

> Upload a PDF, pick a language, and read the original and translated text side-by-side — with sentence-level sync scrolling, word-click lookup, vocabulary building, Anki export, and an immersive book-reading mode.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb)
![License](https://img.shields.io/badge/License-MIT-green)

<!-- TODO: replace <your-username> with your GitHub username so these render -->
[![CI](https://github.com/<your-username>/Translation-WebApp/actions/workflows/ci.yml/badge.svg)](https://github.com/<your-username>/Translation-WebApp/actions/workflows/ci.yml)

**Live demo:** _<!-- TODO: paste your deployed URL here, e.g. https://translation-webapp.vercel.app -->_

---

## Table of Contents

1. [Overview](#overview)
2. [Feature Highlights](#feature-highlights)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Project Structure](#project-structure)
6. [Getting Started](#getting-started)
7. [Environment Variables](#environment-variables)
8. [API Reference](#api-reference)
9. [Running Tests](#running-tests)
10. [Decisions & Tradeoffs](#decisions--tradeoffs)
11. [Known Limitations](#known-limitations)
12. [Roadmap](#roadmap)
13. [License](#license)

---

## Overview

**PDF Translator** is a full-stack language-learning tool that bridges document reading and vocabulary acquisition. A user uploads any text-based PDF, selects a target language, and immediately sees both the original and translated texts aligned sentence-by-sentence. From there, every word in the document becomes interactive — click it for a real-time definition, pin sentences you want to revisit, build a personal vocabulary notebook, quiz yourself with flashcards, and export your word list to Anki.

The project demonstrates end-to-end ownership of a production-grade web application: async Python backend, React SPA with a rich interactive interface, MongoDB for persistence, JWT + Google OAuth for authentication, and a full unit-test suite.

---

## Feature Highlights

### Translation & Reading

| Feature | Details |
|---|---|
| **PDF upload** | Drag-and-drop or browse; PDFs up to 16 MB; files are deleted server-side after processing |
| **20+ languages** | English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Arabic, Hindi, Dutch, Polish, Turkish, Swedish, Czech, Romanian, Vietnamese, Thai |
| **Sentence alignment** | Every original sentence is paired with its translation; the two panels stay in sync |
| **Synchronised scrolling** | Scrolling one panel mirrors the other, keeping you oriented across both texts |
| **Language auto-detection** | `langdetect` infers the source language from the first 500 characters |
| **CEFR word-frequency badges** | Words are colour-coded by frequency tier (A1 → C2 / rare) using `wordfreq` |

### Interactive Word Features

| Feature | Details |
|---|---|
| **Click-to-translate** | Click any word in either panel for an instant reverse translation via the API |
| **Hover highlight** | Hovering a word highlights the same token in both panels simultaneously |
| **Sentence pinning** | Right-click any sentence to pin it; pinned sentences are highlighted and collected in a side drawer |
| **Pin mode** | Lock both panels so only pinned sentences are visible for focused study |

### Vocabulary & Study Tools

| Feature | Details |
|---|---|
| **Vocabulary Notebook** | Saved words accumulate in a notebook (persisted in `localStorage`) with original word, translation, context sentence, and source language |
| **Flashcard Quiz** | In-app flip-card mode cycles through saved words; tracks correct/incorrect per session |
| **Anki Export** | Download the vocabulary notebook as an `.apkg` Anki deck ready to import |

### View Modes

| Feature | Details |
|---|---|
| **Fullscreen mode** | Expands the translation into a distraction-free full-page view; all interactive features remain available |
| **Book reading mode** | Inside fullscreen, flip through the document like an open book — original on the left page, translation on the right; supports keyboard navigation (← → ↑ ↓) and page-turn animations |
| **Dark / light theme** | Theme toggle in the navbar; all components including book pages adapt |

### Authentication

| Feature | Details |
|---|---|
| **Email + password** | Register / login with bcrypt-hashed passwords; JWT issued on success |
| **Google OAuth** | One-click sign-in via `@react-oauth/google`; backend verifies the ID token with Google's tokeninfo endpoint |
| **Translation history** | Authenticated users have every translation stored in MongoDB; accessible from the History tab |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend runtime | **Python 3.10+** | |
| Web framework | **FastAPI 0.115** | Async REST API, automatic OpenAPI docs |
| ASGI server | **Uvicorn** | Production-grade ASGI server |
| PDF parsing | **PyPDF2 3** | Text extraction from PDFs |
| Translation engine | **deep-translator** | Wraps Google Translate |
| Language detection | **langdetect** | Identifies source language |
| Word frequency | **wordfreq** | CEFR-style frequency tiers |
| Anki export | **genanki** | Generates `.apkg` flashcard decks |
| Database | **MongoDB** (async via **Motor 3**) | Users, history |
| Authentication | **python-jose** + **passlib[bcrypt]** | JWT tokens, password hashing |
| Google OAuth | **httpx** | Verifies Google ID tokens server-side |
| Frontend framework | **React 19** | Component-based SPA |
| Language | **TypeScript (strict)** | Type-safe domain model end-to-end; `tsc` gates the build |
| Build tool | **Vite 8** | Dev server with HMR, production build |
| Routing | **React Router 7** | URL-driven navigation, deep links, browser history |
| Server state | **TanStack Query 5** | History fetching with caching + mutation invalidation |
| Google login UI | **@react-oauth/google** | Pre-built Google button + credential flow |
| Styling | **CSS3 custom properties** | Theme tokens, responsive layout |
| Icons | **Font Awesome 6** | Toolbar and button icons |
| Testing | **pytest** (backend) · **Vitest + Testing Library** (frontend) | Unit + component tests |
| CI | **GitHub Actions** | Typecheck, lint, test, build on every push/PR |

---

## Architecture

```
Browser (React SPA)
       │
       │  HTTP  (dev: :5173 → proxy → :5000)
       ▼
FastAPI  (Uvicorn :5000)
  ├── POST /api/translate       ← PDF upload + language selection
  ├── POST /api/auth/register   ← email/password registration
  ├── POST /api/auth/login      ← email/password login
  ├── POST /api/auth/google     ← Google ID-token verification
  ├── GET  /api/history         ← user translation history (JWT-gated)
  ├── POST /api/translate-word  ← single-word reverse translation
  └── POST /api/export-anki     ← Anki deck download
       │
       ├── services/pdf_parser.py   → PyPDF2 text extraction
       ├── services/translator.py   → sentence alignment, word map, deep-translator
       └── database.py              → Motor (async MongoDB)
```

In production the React build is served as static files by FastAPI; in development Vite proxies `/api/*` calls to the backend.

---

## Project Structure

```
Translation-WebApp/
│
├── app/                             # FastAPI backend
│   ├── main.py                      # App factory, middleware, router registration
│   ├── config.py                    # Settings loaded from environment variables
│   ├── database.py                  # MongoDB connect/disconnect, get_db helper
│   ├── routes/
│   │   ├── api.py                   # /api/translate, /api/word, /api/export-anki
│   │   ├── auth.py                  # /api/auth/* (register, login, google, /me)
│   │   └── history.py               # /api/history (list, retrieve, delete)
│   ├── services/
│   │   ├── auth.py                  # JWT helpers, password hashing, get_current_user
│   │   ├── pdf_parser.py            # PDF → plain text extraction
│   │   └── translator.py            # Translation, sentence alignment, word map
│   └── utils/
│       └── helpers.py               # File extension validation, misc utilities
│
├── frontend/                        # React + Vite SPA (TypeScript)
│   ├── src/
│   │   ├── main.tsx                 # Entry: Router, QueryClient, GoogleOAuth, ErrorBoundary
│   │   ├── App.tsx                  # Route table, auth state, theme toggle
│   │   ├── App.css                  # Global styles and CSS custom properties
│   │   ├── api.ts                   # Typed request() wrapper + endpoint functions
│   │   ├── types.ts                 # Shared domain types (TranslationResult, VocabEntry…)
│   │   ├── components/
│   │   │   ├── Navbar.tsx           # Top navigation, auth status, theme switch
│   │   │   ├── UploadForm.tsx       # File drop-zone, language picker, translate button
│   │   │   ├── ResultView.tsx       # Side-by-side view, fullscreen, book mode (orchestration)
│   │   │   ├── AuthForm.tsx         # Login / register form + Google button
│   │   │   ├── History.tsx          # Translation history (TanStack Query)
│   │   │   ├── VocabularyNotebook.tsx   # Saved words manager
│   │   │   ├── FlashcardQuiz.tsx    # Spaced-repetition study modes
│   │   │   └── ErrorBoundary.tsx    # Top-level render-error fallback
│   │   ├── hooks/                   # Reusable logic extracted from ResultView
│   │   │   ├── useSyncScroll.ts     # Sentence-aligned panel scroll sync
│   │   │   ├── useCrossHighlight.ts # Cross-panel word/sentence highlighting
│   │   │   ├── usePinnedSentences.ts# Pinned-sentence state (sessionStorage)
│   │   │   └── useVocabulary.ts     # Vocabulary notebook state (localStorage)
│   │   ├── lib/
│   │   │   └── srs.ts               # Pure Leitner spaced-repetition logic (unit-tested)
│   │   └── __tests__/ · *.test.ts(x)# Vitest unit + component tests
│   ├── tsconfig*.json               # Strict TypeScript config
│   └── vite.config.ts               # Dev proxy /api → :5000, Vitest config
│
├── tests/                           # Backend pytest suite (DB mocked via conftest.py)
│   ├── test_api.py · test_translator.py · test_pdf_parser.py
│   ├── test_auth_service.py · test_auth_routes.py · test_history_routes.py
│   └── test_freq_cefr.py · test_helpers.py · test_word_anki.py
│
├── .github/workflows/ci.yml         # CI: frontend (tsc·lint·test·build) + backend (pytest)
│
├── uploads/                         # Temp PDF storage (auto-created, auto-cleaned)
├── requirements.txt
├── docker-compose.yml
└── .env.example
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB (local instance or MongoDB Atlas)
- A Google Cloud project with an OAuth 2.0 client ID (optional, for Google login)

---

### 1 — Clone the repository

```bash
git clone https://github.com/<your-username>/Translation-WebApp.git
cd Translation-WebApp
```

### 2 — Backend setup

```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# Install Python dependencies
pip install -r requirements.txt

# Copy the example environment file and fill in your values
cp .env.example .env
```

Start the backend:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

The API is now running at **http://localhost:5000**. Interactive Swagger docs are at **http://localhost:5000/docs**.

### 3 — Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Start the dev server:

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

### 4 — Production build (optional)

```bash
cd frontend && npm run build && cd ..
uvicorn app.main:app --host 0.0.0.0 --port 5000
```

FastAPI serves the built frontend at `/` — no separate Node process needed.

---

### Docker (optional)

```bash
docker compose up --build
```

Starts MongoDB, the FastAPI backend, and the Vite dev server together.

---

## Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```env
# Application
SECRET_KEY=change-me-to-a-long-random-string

# MongoDB
MONGO_URL=mongodb://localhost:27017
MONGO_DB=translation_app

# JWT
JWT_SECRET=change-me-too
JWT_EXPIRE_MINUTES=1440

# Google OAuth (leave blank to disable Google login)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

**Google login setup:**
In [Google Cloud Console](https://console.cloud.google.com/) → _APIs & Services_ → _Credentials_ → your OAuth 2.0 client → add `http://localhost:5173` to **Authorised JavaScript origins**.

---

## API Reference

All endpoints are prefixed with `/api`. Full interactive docs are available at `/docs` when the backend is running.

### Translation

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/languages` | None | Returns all supported target languages |
| `POST` | `/api/translate` | Optional | Upload a PDF + target language; returns sentence pairs, word map, frequency data |
| `POST` | `/api/translate-word` | None | Translate a single word (used for click-to-translate) |
| `POST` | `/api/export-anki` | None | Download vocabulary as an Anki `.apkg` deck |

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | None | Create account with email + password |
| `POST` | `/api/auth/login` | None | Login; returns JWT access token |
| `POST` | `/api/auth/google` | None | Verify Google ID token; returns JWT |
| `GET` | `/api/auth/me` | JWT | Returns the current user object |

### History

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/history` | JWT | List all past translations (metadata only) |
| `GET` | `/api/history/{id}` | JWT | Retrieve full text of a past translation |
| `DELETE` | `/api/history/{id}` | JWT | Delete a history entry |

**Translate response shape (abbreviated):**

```json
{
  "original_text": "...",
  "translated_text": "...",
  "source_lang": "en",
  "target_lang": "es",
  "sentence_pairs": [
    { "original": "Hello world.", "translated": "Hola mundo." }
  ],
  "word_map": { "hello": "hola" },
  "word_frequencies": { "hello": 0.85, "world": 0.76 }
}
```

---

## Running Tests

**Backend** (pytest — the database is mocked in `conftest.py`, so no MongoDB is required):

```bash
source venv/bin/activate
pytest
```

Covers PDF extraction, the translation service, auth/JWT, history routes, frequency/CEFR scoring, and the API endpoints (via FastAPI's `TestClient`).

**Frontend** (from `frontend/`):

```bash
npm run typecheck   # tsc --build, no emit
npm run lint        # ESLint (typescript-eslint)
npm test            # Vitest: SRS logic, hooks, components, api wrapper
npm run build       # tsc + vite build (the production gate)
```

Frontend tests deliberately target the riskiest logic: the Leitner spaced-repetition scheduler (`lib/srs.ts`), the persistence hooks, and the API error-handling wrapper.

All four frontend checks plus the backend suite run in CI on every push and pull request — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Decisions & Tradeoffs

Each choice below lists *what* was chosen, *why*, and *what was given up* — the constraints matter as much as the picks.

**Sentence alignment as the core data model**
The backend splits text on sentence boundaries and pairs each original sentence with its translation, and the entire frontend (sync-scroll, pinning, book pages, cross-highlight) keys off the `data-sentence` index.
- *Why:* one stable primitive powers every interactive feature, instead of bolting on per-feature data.
- *Tradeoff:* alignment quality depends on the sentence splitter. Mismatched sentence counts between languages can drift; a sentence-embedding aligner would be more robust but adds latency and a model dependency that isn't justified at this scale.

**DOM-driven highlighting instead of React state**
Hover/cross-panel highlighting mutates `classList` directly (tracked in a ref) rather than re-rendering thousands of word `<span>`s.
- *Why:* a document can contain thousands of tokens; setting state per hover caused visible lag. Direct class toggling keeps highlighting at one paint, and a tracked list clears it without re-scanning the DOM.
- *Tradeoff:* this steps outside React's declarative model, so it's covered by intent (the `useCrossHighlight` hook isolates it) rather than being "pure." A virtualized renderer would be the React-idiomatic fix but is overkill for typical document sizes.

**`useSyncScroll` as one hook used twice**
The normal and fullscreen views share a single scroll-sync hook, parameterized by refs and an `enabled` flag.
- *Why:* the two effects were ~95% identical; one hook removes the drift risk of duplicated logic.
- *Tradeoff:* the hook reaches into the DOM (`getBoundingClientRect`, `scrollTop`) and assumes the `.sentence-block[data-sentence]` contract — coupling that's documented in the hook rather than abstracted away.

**TanStack Query for history, local state for everything else**
Only the translation history (genuine server state) uses TanStack Query; transient UI and study tools stay in component state / `localStorage`.
- *Why:* history benefits from caching and automatic invalidation after delete/clear; a global store (Redux/Zustand) would be ceremony for a single resource.
- *Tradeoff:* mixed state strategies in one app. The boundary is deliberate — "is this data owned by the server?" — but a reviewer will rightly ask where the line is, and that's the answer.

**`localStorage`/`sessionStorage` for study data, not the database**
Vocabulary, SRS boxes, and pins live client-side.
- *Why:* keeps study tools fully usable for anonymous users with zero backend surface.
- *Tradeoff:* no cross-device sync and data is lost if storage is cleared. Promoting these to the authenticated user record is the obvious next step (see roadmap), deferred because guest-first access was the priority.

**Word translation via the same Google engine, not a paid API**
Click-to-translate and word lookups reuse `deep-translator`.
- *Why:* zero cost and no key management for a portfolio app.
- *Tradeoff:* unofficial, rate-limit-prone, and not production-SLA. The code isolates translation behind a service boundary so swapping in DeepL/OpenAI is a one-file change.

**JWT in `localStorage` + `get_optional_user` for guest access**
Auth is optional; the FastAPI dependency returns `None` instead of raising 401, so history is stored only when authenticated.
- *Why:* lets the core feature work without an account while still supporting persistence for signed-in users.
- *Tradeoff:* a token in `localStorage` is reachable by XSS. For production I'd move to an httpOnly, SameSite cookie with CSRF protection; the current approach is a conscious portfolio simplification, not an oversight.

**Strict TypeScript with `tsc` gating the build**
`npm run build` runs `tsc -b && vite build`, so type errors fail CI.
- *Why:* types that don't block the build rot. Gating makes the type system load-bearing.
- *Tradeoff:* slightly slower builds and stricter friction on quick changes — accepted in exchange for the API/domain contract being enforced rather than aspirational.

---

## Known Limitations

Being explicit about what this *doesn't* do is part of the design:

- **Text-based PDFs only** — no OCR, so scanned/image PDFs won't extract.
- **No cross-device study sync** — vocabulary, SRS, and pins are per-browser (see localStorage tradeoff above).
- **Translation engine is best-effort** — `deep-translator` is unofficial and rate-limited; not suitable for high volume.
- **No request-level observability** — no structured logging, tracing, or error reporting wired up yet.
- **Auth token storage** — `localStorage` rather than httpOnly cookies (XSS tradeoff documented above).
- **Long PDFs block the request** — translation is synchronous; very large files can approach proxy timeouts. A job queue + polling/SSE is the production fix.

---

## Roadmap

- [x] Spaced-repetition scheduling for the flashcard quiz (Leitner box system)
- [ ] Sync vocabulary / SRS / pins to the authenticated user record (cross-device)
- [ ] OCR support for scanned (image-based) PDFs via Tesseract
- [ ] Async translation job queue + polling/SSE for large documents
- [ ] Highlight and annotate sentences directly in the document
- [ ] Export to PDF with both languages side-by-side
- [ ] Mobile-optimised book reading mode
- [ ] DeepL / OpenAI translation backend as an alternative engine

---

## License

MIT — free to use, modify, and distribute.
