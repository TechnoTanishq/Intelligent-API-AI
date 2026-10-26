# IntelliAPI AI — Setup & Run Guide

> **For team members cloning this repo.** Follow every step in order. Takes about 5–10 minutes on a fresh machine.

---

## Prerequisites

Install these before anything else:

| Tool | Version needed | Download |
|---|---|---|
| Python | 3.11 or higher | https://www.python.org/downloads/ |
| Node.js | 18 or higher | https://nodejs.org/ |
| Git | Any recent | https://git-scm.com/ |

After installing, verify:

```bash
python --version    # should show 3.11+
node --version      # should show 18+
npm --version       # should show 9+
git --version
```

---

## Step 1 — Clone the repository

```bash
git clone https://github.com/TechnoTanishq/Intelligent-API-AI.git
cd Intelligent-API-AI
```

---

## Step 2 — Dataset setup

The CSIC 2010 dataset CSV is **not committed** (too large for git). You need to place it at exactly this path:

```
Intelligent-API-AI/
└── csic_database.csv~1/
    └── csic_database.csv      ← place the file here
```

**How to get the file:**  
Ask your group member (Tanishq) to share `csic_database.csv` via WhatsApp / Google Drive, or copy it from the original project folder.

> If you do NOT have the dataset, you can still run the backend using the **pre-trained model artifacts** already committed in `backend/artifacts/`. Skip directly to Step 5 in that case.

---

## Step 3 — Backend Python dependencies

Open a terminal in the project root:

```bash
cd backend
pip install -r requirements.txt
```

Also install testing and WebSocket tools:

```bash
pip install pytest httpx websockets pymongo
```

> On Windows, use `python -m pip install ...` if `pip` alone doesn't work.

---

## Step 4 — Train the model (only needed if artifacts are missing)

Check if `backend/artifacts/` already contains these files:

```
backend/artifacts/
├── pipeline_rf.joblib       ← Random Forest model
├── pipeline_dt.joblib       ← Decision Tree model
├── metrics.json
├── feature_importance.json
└── training_config.json
```

**If they are already there → skip this step.**

If they are missing (fresh clone without artifacts), run training from inside `backend/`:

```bash
cd backend

# Step 4a: inspect the dataset (optional, sanity check)
python -m training.inspect_dataset

# Step 4b: train both models (~4-5 minutes)
python -m training.train

# Step 4c: verify artifacts reproduce training metrics
python -m training.evaluate
```

Expected output from `train.py`:
```
RandomForest accuracy (combined test set) = 96.39%
```

---

## Step 5 — Create the backend .env file

```bash
# still inside backend/
copy ..\\.env.example .env        # Windows
# OR on Mac/Linux:
cp ../.env.example .env
```

The default values work out of the box. You only need to edit `.env` if you want to change ports or enable MongoDB Atlas.

---

## Step 6 — Install frontend dependencies

Open a **new terminal**, go to the `frontend/` folder:

```bash
cd frontend
npm install
```

---

## Step 7 — Install simulator dependencies

Open a **third terminal**, go to the `simulator/` folder:

```bash
cd simulator
npm install
```

---

## Step 8 — Run all three components

You need **three separate terminals** open simultaneously.

### Terminal 1 — FastAPI Backend (port 8000)

```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

You should see:
```
INFO: Model loaded. Primary=RandomForest accuracy=0.9639
INFO: Application startup complete.
INFO: Uvicorn running on http://127.0.0.1:8000
```

### Terminal 2 — Dashboard (port 5173)

```bash
cd frontend
npm run dev
```

Open in browser: **http://localhost:5173**

### Terminal 3 — Traffic Simulator (port 5174)

```bash
cd simulator
npm run dev
```

Open in browser: **http://localhost:5174**

---

## Step 9 — Verify everything works

1. Open http://127.0.0.1:8000/health in your browser → should return:
   ```json
   {"status": "ok", "model_loaded": true, "model_name": "RandomForest"}
   ```

2. Open http://127.0.0.1:8000/docs → Swagger UI for interactive API testing

3. Open the **Simulator** tab (http://localhost:5174) → click **Start** → you should see requests being sent every 4 seconds

4. Open the **Dashboard** tab (http://localhost:5173) → you should see the stat cards and traffic feed updating live

---

## Quick demo flow (for college evaluation)

1. Start all three components (Steps 8 above).
2. Open **Postman** → import `postman/IntelliAPI_AI.postman_collection.json`.
3. Run request #1 (Health) and #2 (Model Info) — shows 96.4% accuracy.
4. Run requests #3–#7 — shows normal vs attack predictions with explanations.
5. Open the **Dashboard** in one browser tab.
6. Open the **Simulator** in another tab → click Start.
7. Watch the dashboard update live every 4 seconds.
8. Click any flagged row in the live feed → see the full threat explanation panel.

---

## Testing (optional)

Run the backend test suite from `backend/`:

```bash
cd backend
python -m pytest tests/ -v
```

Expected: **37 passed**.

Run the WebSocket integration test (requires backend running):

```bash
python tests/ws_integration_test.py
```

Expected: **ALL TESTS PASSED**.

---

## Project structure overview

```
Intelligent-API-AI/
├── backend/                    Python FastAPI backend
│   ├── app/                    Application code
│   │   ├── agent/policy.py     Intelligent agent decision policy
│   │   ├── features/extract.py Feature extraction (shared by train + inference)
│   │   ├── services/           Inference, heuristics, explainability, agent
│   │   ├── api/routes.py       All API endpoints + WebSocket
│   │   └── storage/            In-memory event store
│   ├── training/               Offline model training pipeline
│   │   ├── train.py            Train Decision Tree + Random Forest
│   │   ├── preprocess.py       Dataset loading, cleaning, splitting
│   │   └── synthetic.py        Synthetic attack request generator
│   ├── artifacts/              Saved model files (pipeline_rf.joblib etc.)
│   ├── tests/                  37 automated tests
│   └── requirements.txt        Python dependencies
├── frontend/                   React dashboard (port 5173)
│   └── src/
│       ├── components/         StatCards, Charts, TrafficFeed, ThreatPanel
│       ├── hooks/              useEventStream (WebSocket)
│       └── utils/stats.ts      Stats computation from live events
├── simulator/                  React traffic simulator (port 5174)
│   └── src/
│       └── scenarios/          Request generator with attack payloads
├── postman/                    Postman collection (10 requests)
├── docs/                       Architecture and model evaluation docs
├── data/README.md              Dataset documentation
├── .env.example                All environment variables documented
└── README.md                   Full project documentation
```

---

## Common issues and fixes

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: No module named 'fastapi'` | Run `pip install -r backend/requirements.txt` |
| `Primary model artifact not found` | Run `python -m training.train` from inside `backend/` |
| `CSIC CSV not found` | Place `csic_database.csv` in `csic_database.csv~1/` folder at project root |
| Port 8000 already in use | Change `PORT=8001` in `backend/.env`, then use `--port 8001` |
| Port 5173 already in use | Edit `frontend/vite.config.ts`, change port to 5175 |
| Dashboard shows "WS: disconnected" | Make sure the backend is running on port 8000 |
| `npm install` fails on Node 16 | Upgrade to Node 18+ |
| `python -m uvicorn` not found | Run `pip install uvicorn` |

---

## Ports used

| Service | Port | URL |
|---|---|---|
| FastAPI backend | 8000 | http://127.0.0.1:8000 |
| Dashboard | 5173 | http://localhost:5173 |
| Simulator | 5174 | http://localhost:5174 |
| API docs (Swagger) | 8000 | http://127.0.0.1:8000/docs |

---

## Environment variables (backend/.env)

| Variable | Default | Description |
|---|---|---|
| `PORT` | 8000 | Backend server port |
| `RISK_LOW_MAX` | 0.35 | Attack probability below this → ALLOW |
| `RISK_HIGH_MIN` | 0.70 | Attack probability above this → BLOCK |
| `ENABLE_HEURISTICS` | 1 | Enable regex heuristic layer (1/0) |
| `MAX_EVENTS_STORED` | 2000 | In-memory event ring buffer size |
| `STORAGE_BACKEND` | memory | Use `mongo` for MongoDB Atlas persistence |
| `MONGO_URI` | placeholder | MongoDB Atlas connection string |
| `CSIC_CSV_PATH` | ../../csic_database.csv~1/csic_database.csv | Path to CSIC dataset |

---

*IntelliAPI AI — AIL-L4 Mini Project | educational prototype*
