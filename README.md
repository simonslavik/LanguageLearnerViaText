# PDF Translator

> Upload a PDF, pick a language, and read the original and translated text side-by-side — with sentence-level sync scrolling, word-click lookup, vocabulary building, Anki export, and an immersive book-reading mode.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb)
![License](https://img.shields.io/badge/License-MIT-green)

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
10. [Design Decisions](#design-decisions)
11. [Roadmap](#roadmap)
12. [License](#license)

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
| Build tool | **Vite 8** | Dev server with HMR, production build |
| Google login UI | **@react-oauth/google** | Pre-built Google button + credential flow |
| Styling | **CSS3 custom properties** | Theme tokens, responsive layout |
| Icons | **Font Awesome 6** | Toolbar and button icons |
| Testing | **pytest** | Backend unit tests |

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
  ├── POST /api/word            ← single-word reverse translation
  └── GET  /api/export-anki     ← Anki deck download
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
├── frontend/                        # React + Vite SPA
│   ├── src/
│   │   ├── main.jsx                 # Entry point, GoogleOAuthProvider wrapper
│   │   ├── App.jsx                  # Routing, auth state, theme toggle
│   │   ├── App.css                  # Global styles and CSS custom properties
│   │   ├── api.js                   # Fetch wrappers for all backend endpoints
│   │   └── components/
│   │       ├── Navbar.jsx           # Top navigation, auth status, theme switch
│   │       ├── UploadForm.jsx       # File drop-zone, language picker, translate button
│   │       ├── ResultView.jsx       # Side-by-side view, fullscreen, book mode, all tools
│   │       ├── AuthForm.jsx         # Login / register form + Google button
│   │       ├── History.jsx          # User translation history list
│   │       ├── VocabularyNotebook.jsx   # Saved words manager
│   │       └── FlashcardQuiz.jsx    # Flip-card study mode
│   └── vite.config.js               # Dev proxy /api → localhost:5000
│
├── tests/
│   ├── test_api.py                  # Translation endpoint tests
│   ├── test_pdf_parser.py           # PDF parsing unit tests
│   └── test_translator.py           # Translation service tests
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
| `POST` | `/api/word` | None | Translate a single word (used for click-to-translate) |
| `GET` | `/api/export-anki` | None | Download vocabulary as an Anki `.apkg` deck |

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

```bash
# Activate the virtual environment first
source venv/bin/activate

pytest tests/ -v
```

Tests cover PDF extraction, the translation service, and the API endpoints (using FastAPI's `TestClient`).

---

## Design Decisions

**Sentence alignment over paragraph blocks**
The translator splits text at sentence boundaries and aligns each original sentence with its translation. This makes sync-scrolling precise and enables per-sentence features like pinning and book-page rendering.

**Word frequency via `wordfreq`**
Rather than a static word list, `wordfreq` provides real-world Zipf frequency scores that are bucketed into four tiers and surfaced as colour-coded CEFR-style badges, giving readers an immediate sense of vocabulary difficulty.

**`localStorage` for vocabulary**
The vocabulary notebook is stored client-side so it persists across sessions without requiring authentication, keeping study tools accessible to anonymous users.

**Fullscreen as a separate render tree**
The fullscreen and book views use dedicated React refs (`fsOrigPanelRef`, `fsTranPanelRef`) rather than CSS transforms. This avoids `position: fixed` stacking-context issues and lets the sync-scroll logic reuse the same handler with a ref-switch pattern controlled by `isFullscreenRef`.

**JWT on every request, `get_optional_user` for guest access**
Translation is available without an account. The `get_optional_user` FastAPI dependency returns `None` instead of raising a 401, so translation history is only stored when a user is authenticated.

---

## Roadmap

- [ ] OCR support for scanned (image-based) PDFs via Tesseract
- [ ] Highlight and annotate sentences directly in the document
- [ ] Spaced repetition scheduling for the flashcard quiz
- [ ] Export to PDF with both languages side-by-side
- [ ] Mobile-optimised book reading mode
- [ ] DeepL / OpenAI translation backend as an alternative engine

---

## License

MIT — free to use, modify, and distribute.
