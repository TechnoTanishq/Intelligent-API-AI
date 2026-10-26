# Data

This folder documents the dataset used by IntelliAPI AI.

## Dataset: CSIC 2010 HTTP Dataset

IntelliAPI AI is trained on the **CSIC 2010 HTTP dataset**, a labelled set of
normal and anomalous (attack) HTTP requests targeting an e-commerce web
application (`tienda1`).

The provided file is:

```
../csic_database.csv~1/csic_database.csv
```

(That is the original `csic_database.csv` folder shipped with this workspace.)

### Schema (as inspected)

| Column            | Description                                           |
|-------------------|-------------------------------------------------------|
| `Unnamed: 0`      | Label: `Normal` or `Anomalous`                        |
| `Method`          | HTTP method: GET / POST / PUT                         |
| `User-Agent`      | Request User-Agent header                             |
| `Pragma`, `Cache-Control`, `Accept`, `Accept-encoding`, `Accept-charset`, `language`, `host`, `cookie`, `content-type`, `connection`, `lenght` | HTTP headers |
| `content`         | Request body (empty for GET)                          |
| `classification`  | 0 = Normal, 1 = Anomalous                             |
| `URL`             | Full request line, e.g. `http://host/path?query HTTP/1.1` |

### Label distribution (inspected)

- Normal: 36,000
- Anomalous: 25,065
- Methods: GET (43,088), POST (17,580), PUT (397)

### Attack types present (inferred, NOT a model label)

The dataset is **binary** (Normal / Anomalous) and does NOT ship per-attack
category labels. Anomalous requests contain payloads resembling:

- SQL injection: `'; DROP TABLE usuarios; SELECT ...`, `waitfor delay '0:0:15'`
- XSS: `<SCRipt>alert(Paros)</scrIPT>`
- Path traversal: `2%2F`, `asf-logo-wide.gif~`
- Parameter tampering: `rememberA`, `errorMsgA`, `idA=2`

Because there are no category labels, IntelliAPI AI performs **binary**
classification (NORMAL / ATTACK). Attack-type information shown in the UI is
produced by a **separate transparent heuristic layer** and is clearly labelled
as heuristic, not as a model prediction.

### How the data is loaded

The training pipeline reads the CSV, normalizes the first column to a `label`
column (`Normal`/`Anomalous`), parses the `URL` field into `path` and `query`,
and combines it with `content` (the body). See `backend/training/preprocess.py`.

The large CSV is intentionally **gitignored** and is not copied into this
folder. Training reads it directly from the path above (configurable via
`CSIC_CSV_PATH` in `.env`).
