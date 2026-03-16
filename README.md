# PDF Translator — Portfolio Project

A clean, modern web application that lets users **upload a PDF document**, choose a target language, and instantly see the **original and translated text side-by-side**.

Built with a **Python / FastAPI** backend and a **React** (Vite) frontend, powered by Google Translate (via `deep-translator`).

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **PDF text extraction** — parses text-based PDFs using PyPDF2
- **20 languages** — translate into English, Spanish, French, German, Chinese, Japanese, and more
- **Side-by-side view** — original text on the left, translation on the right
- **Drag & drop upload** — modern file upload UX with drag-and-drop support
- **Copy to clipboard** — one-click copy for both panels
- **Responsive design** — works on desktop & mobile
- **Auto-generated API docs** — interactive Swagger UI at `/docs`
- **Auto-cleanup** — uploaded files are removed after processing

---

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/Translation-WebApp.git
cd Translation-WebApp
```

### 2. Create a virtual environment

```bash
python -m venv venv
source venv/bin/activate   # macOS / Linux
# venv\Scripts\activate    # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Build the React frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 5. Run the app

```bash
python app/main.py
```

Open **http://localhost:5000** in your browser.

> **Dev mode:** To run the React dev server with hot-reload, open a second terminal:
> ```bash
> cd frontend && npm run dev
> ```
> This starts Vite on **http://localhost:5173** with API proxy to the backend on `:5000`.

---

## Project Structure

```
Translation-WebApp/
├── app/                         # FastAPI backend
│   ├── __init__.py
│   ├── main.py                  # Entry point (uvicorn + serves React build)
│   ├── config.py                # Configuration
│   ├── routes/
│   │   └── api.py               # REST API endpoints
│   ├── services/
│   │   ├── pdf_parser.py        # PDF text extraction
│   │   └── translator.py        # Google Translate wrapper
│   └── utils/
│       └── helpers.py           # Utility functions
├── frontend/                    # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx              # Root component
│   │   ├── api.js               # API client
│   │   └── components/          # Navbar, UploadForm, ResultView, Footer
│   ├── index.html
│   ├── vite.config.js           # Dev proxy → backend :5000
│   └── package.json
├── uploads/                     # Temp upload directory (auto-created)
├── tests/                       # Unit tests
├── requirements.txt
├── .env.example
└── README.md
```

---

## Running Tests

```bash
pytest tests/ -v
```

---

## Configuration

Copy `.env.example` to `.env` and customise:

```bash
cp .env.example .env
```

| Variable       | Default                        | Description            |
| -------------- | ------------------------------ | ---------------------- |
| `SECRET_KEY`   | `dev-secret-key-change-in-…`   | App secret key         |

---

## Tech Stack

| Layer       | Technology                  |
| ----------- | --------------------------- |
| Backend     | Python 3.10+, FastAPI 0.115  |
| Frontend    | React 19, Vite 8             |
| PDF Parsing | PyPDF2                       |
| Translation | deep-translator (Google)     |
| Styling     | CSS3 custom properties       |
| Icons       | Font Awesome 6               |

---

## License

MIT — feel free to use this in your own portfolio.
# LanguageLearnerViaText
