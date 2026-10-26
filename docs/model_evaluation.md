# IntelliAPI AI — Model Evaluation

All metrics below were computed on a **held-out test set (20% of the combined dataset)**. No test data was used during training. Metrics are loaded from `backend/artifacts/metrics.json` at service startup and are available at `GET /model-info`.

## Dataset composition

| Source | Type | Rows |
|---|---|---|
| CSIC 2010 HTTP dataset | Real binary-labelled (Normal / Anomalous) | 60,851 |
| Synthetic HTTP requests | Clearly-labelled SQLi / XSS / path-traversal / cmd-injection | 9,000 |
| **Combined (after dedup)** | — | **33,379** |

Deduplication: exact-duplicate request signatures (method + lowercased URL-decoded text) are collapsed to one row, keeping the first row's real label. This prevents the same request appearing in both train and test sets.

Split: 80% train / 20% test, stratified by label.

## Random Forest (primary model)

| Metric | Value |
|---|---|
| Accuracy (combined test set) | **96.39%** |
| Accuracy (CSIC-only subset) | 96.24% |
| Accuracy (synthetic-only subset) | 96.82% |
| Precision | 0.9878 |
| Recall | 0.9549 |
| F1 | 0.9710 |
| False Positive Rate | 0.0204 |
| False Negative Rate | 0.0451 |
| Avg inference latency | ~130 ms/request (local, single-threaded) |

### Confusion matrix

|  | Predicted NORMAL | Predicted ATTACK |
|---|---|---|
| **Actual NORMAL** | TN = 2395 | FP = 50 |
| **Actual ATTACK** | FN = 191 | TP = 4040 |

### Interpretation

- **False positives (50/2445 normal):** ~2% of normal requests are incorrectly flagged. In a real production system this would need tuning; for a demo the MONITOR threshold (0.35) keeps most false positives in MONITOR rather than BLOCK.
- **False negatives (191/4231 attacks):** ~4.5% of attacks are missed by the model. The heuristic layer catches many of these (particularly textbook payloads) and can escalate the agent's decision.

## Decision Tree (interpretable baseline)

| Metric | Value |
|---|---|
| Accuracy | 84.05% |
| Precision | 0.9925 |
| F1 | 0.8570 |
| False Positive Rate | 0.010 |
| False Negative Rate | 0.246 |

The DT is lower accuracy than the RF (expected — simpler model, regularised with `max_depth=12`). Its value is interpretability: the decision path for any request can be traced step-by-step and shown in the dashboard's Threat Analysis panel.

## Feature pipeline

| Feature group | Method | Description |
|---|---|---|
| `text` | TF-IDF (char n-grams 3-5, max 4000) | URL-decoded, lower-cased concatenation of method + path + query + body |
| `method` | OneHotEncoder | HTTP method: GET / POST / PUT |
| 12 numeric | StandardScaler | path_len, query_len, body_len, special_char_count, digit_count, non_alnum_count, equals_count, semicolon_count, slash_count, quote_count, angle_bracket_count, paren_count |

Top global RF feature importances are saved to `artifacts/feature_importance.json` and displayed in the dashboard's feature importance chart.

## Reproducibility

To reproduce these metrics:
```powershell
cd intelliapi-ai\backend
python -m training.train      # trains from scratch, saves artifacts
python -m training.evaluate   # loads saved artifacts, re-runs evaluation
```
Both produce the same numbers because they use the same random_state=42 and identical preprocessing.
