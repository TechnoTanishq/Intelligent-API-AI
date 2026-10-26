# IntelliAPI AI — Architecture

## System components

| Component | Technology | Port |
|---|---|---|
| Inference API (FastAPI) | Python 3.13, FastAPI, Uvicorn | 8000 |
| Real-time Dashboard | React 18, Vite, TypeScript, Tailwind, Recharts | 5173 |
| Traffic Simulator | React 18, Vite, TypeScript, Tailwind | 5174 |
| Event store | In-memory (deque ring buffer) + optional MongoDB Atlas | — |
| Model training | Python, scikit-learn, pandas, joblib | offline |

## Request flow

```
Simulator / Postman
    ↓ HTTP POST /analyze
FastAPI (Pydantic validation)
    ↓
Feature Extraction (app/features/extract.py)
  • URL-decode path + query + body
  • Build text = "method path query body" (lower-cased)
  • Count: special chars, digits, quotes, angle brackets, slashes, parens, semicolons
    ↓
ColumnTransformer pipeline
  • text   → TfidfVectorizer (char n-grams 3-5, max_features=4000)
  • method → OneHotEncoder
  • 12 numeric features → StandardScaler
    ↓
RandomForest (150 trees, class_weight='balanced', n_jobs=1 at inference)
  → predict_class: NORMAL / ATTACK
  → attack_probability: P(ATTACK)
    ↓
Heuristic layer (separate, never replaces ML)
  → SQLi / XSS / path-traversal / cmd-injection regex matching
  → heuristic_strength: none / low / medium / high
    ↓
Intelligent Agent decision policy
  → ALLOW  if prob < 0.35
  → MONITOR if 0.35 ≤ prob < 0.70
  → BLOCK  if prob ≥ 0.70
  → heuristic escalation: ALLOW→MONITOR (medium/high), MONITOR→BLOCK (high)
    ↓
Explainability
  → RF top feature importances vs this request (model evidence)
  → DT decision path (interpretable baseline)
  → Heuristic findings (displayed separately)
    ↓
In-memory event store (thread-safe deque)
    ↓
WebSocket broadcast → Dashboard
```

## AI module separation

```
app/
├── agent/policy.py         decision logic only (configurable thresholds)
├── features/extract.py     single source of truth (training + inference)
├── services/
│   ├── inference.py        model prediction wrapper
│   ├── heuristics.py       regex rules (separate from ML)
│   ├── explainability.py   model evidence + DT path
│   └── agent.py            orchestrates all services (the agent loop)
└── storage/event_store.py  event persistence
```

## WebSocket protocol

The server broadcasts every analyzed event as a JSON frame:
```json
{ "type": "event", "data": <EventRecord> }
```

The dashboard connects to `ws://127.0.0.1:8000/ws` and reconnects automatically on disconnect (2s backoff). Pausing the dashboard display does not stop the backend from accepting and analyzing requests — events continue to buffer.

## Data separation

- **Model training metrics** — computed on a fixed held-out test set (20% of deduplicated combined dataset). Never updated at runtime.
- **Live dashboard statistics** — computed from the in-memory event buffer of analyzed traffic. Clearly labeled as "from analyzed traffic."
- **Simulator ground-truth label** — stored alongside the analyzed event for evaluation display but is explicitly excluded from model input features.
