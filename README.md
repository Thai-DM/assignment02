# Assignment 02 – Intelligent System Development
## From Data Representation to a Deployable Intelligent System

**PTIT – Dinh Que Tran, Ph.D., Assoc. Prof.**

---

## Three Applications

| # | Application | Task | Dataset | Port |
|---|-------------|------|---------|------|
| 1 | **Diabetes Prediction** | Binary Classification | BRFSS2015 (70,692 × 22) | 8001 |
| 2 | **House Price Prediction** | Regression | VN Housing (82,497 × 13) | 8002 |
| 3 | **Shopee Sentiment Analysis** | Text Classification | Shopee Reviews (JSONL) | 8003 |

---

## Project Structure

```
asign2/
├── diabetes/
│   ├── archive/                 ← Dataset CSV
│   ├── diabetes_notebook.ipynb  ← Main notebook (Parts I–X)
│   ├── models/                  ← Saved pipeline (.joblib)
│   └── api/main.py              ← FastAPI + Knowledge Graph
│
├── house_price/
│   ├── archive (1)/             ← Dataset CSV
│   ├── house_price_notebook.ipynb
│   ├── models/
│   └── api/main.py
│
├── customer_behavior/
│   ├── archive/                 ← Dataset JSONL
│   ├── customer_behavior_notebook.ipynb
│   ├── models/
│   └── api/main.py
│
└── README.md
```

---

## How to Reproduce

### Step 1 – Install dependencies

```bash
pip install pandas numpy scikit-learn matplotlib seaborn joblib fastapi uvicorn networkx jupyter
```

### Step 2 – Run notebooks (train models)

Open each notebook in Jupyter and run all cells:

```bash
cd diabetes
jupyter notebook diabetes_notebook.ipynb

cd ../house_price
jupyter notebook house_price_notebook.ipynb

cd ../customer_behavior
jupyter notebook customer_behavior_notebook.ipynb
```

Each notebook will:
1. Load the dataset from `archive/`
2. Clean and preprocess data
3. Build feature representations (X ∈ R^(N×d))
4. Train 5-6 ML models
5. Evaluate and compare models
6. Save best model to `models/` folder

### Step 3 – Start Web APIs

```bash
# App 1 – Diabetes
cd diabetes/api
uvicorn main:app --reload --port 8001

# App 2 – House Price
cd house_price/api
uvicorn main:app --reload --port 8002

# App 3 – Shopee Sentiment
cd customer_behavior/api
uvicorn main:app --reload --port 8003
```

### Step 4 – Test APIs

**Swagger UI (browser):**
- http://localhost:8001/docs
- http://localhost:8002/docs
- http://localhost:8003/docs

**Test endpoints:**

```bash
# App 1 – Diabetes predict
curl -X POST http://localhost:8001/predict \
  -H "Content-Type: application/json" \
  -d '{"HighBP":1,"HighChol":1,"BMI":35.0,"Age":9,"GenHlth":4,"PhysActivity":0}'

# App 2 – House Price predict
curl -X POST http://localhost:8002/predict \
  -H "Content-Type: application/json" \
  -d '{"Quan":"Quận 1","DienTich":60,"SoPhongNgu":3,"SoTang":4,"LoaiHinhNhaO":"Nhà phố","GiayToPhaply":"Sổ đỏ/ Sổ hồng","Dai":5,"Rong":4,"Huyen":"Quận 1"}'

# App 3 – Shopee Sentiment
curl -X POST http://localhost:8003/predict \
  -H "Content-Type: application/json" \
  -d '{"review":"Sản phẩm tốt, giao hàng nhanh, đóng gói cẩn thận","rating":5}'

# Knowledge Graph endpoints
curl http://localhost:8001/knowledge-graph
curl http://localhost:8001/knowledge-graph/BMI
curl http://localhost:8002/knowledge-graph/Location
curl http://localhost:8003/knowledge-graph/Quality
```

---

## Data Representation Summary

| Application | Raw form | Numerical representation | Model input shape | Key parameters |
|------------|----------|--------------------------|-------------------|----------------|
| Diabetes | CSV/table | Feature matrix | `R^(N×d)` = `R^(70692×21)` | N=patients, d=features |
| House Price | CSV/table | Encoded feature matrix | `R^(N×d)` | N=listings, d=num+OHE |
| Shopee | JSONL + text | TF-IDF matrix | `R^(N×V)` = `R^(N×10000)` | N=reviews, V=vocab size |
| Shopee (adv.) | text | Token embeddings | `R^(B×T×e)` | B=batch, T=128, e=768 |

**Parameter glossary:**
- **N** = total number of samples (observations)
- **d** = number of input features (after encoding)
- **B** = mini-batch size during training
- **V** = vocabulary size (TF-IDF)
- **T** = sequence length (tokens per review)
- **e** = embedding dimension

---

## Knowledge Graph Integration

All 3 APIs expose two KG endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /knowledge-graph` | Full domain KG (all nodes + edges) |
| `GET /knowledge-graph/{entity}` | Subgraph for a specific entity |

### KG Components per App

**App 1 – Diabetes:**
- Nodes: Patient, RiskFactor, Complication, LifestyleCategory, DiabetesClass
- Key relations: `INCREASES_RISK`, `REDUCES_RISK`, `LEADS_TO`, `COMORBIDITY`

**App 2 – House Price:**
- Nodes: House, Location, Quận, PropertyType, LegalDocument, PriceRange
- Key relations: `LOCATED_IN`, `AFFECTS_STRONGLY`, `DETERMINES`, `PREMIUM_LOCATION`

**App 3 – Shopee Sentiment:**
- Nodes: Review, Customer, Product, Aspect, Keyword, Sentiment, Rating
- Key relations: `INDICATES`, `RELATES_TO`, `DISCUSSES`, `CORRELATES_WITH`

---

## Mobile Application

Architecture:
```
Mobile UI (Flutter) → POST /predict → FastAPI → ML Model → Response → Mobile UI
Mobile UI (Flutter) → GET /knowledge-graph → FastAPI → KG JSON → Display cards
```

Each app screen:
1. **Input Screen** – user enters features
2. **Result Screen** – shows prediction + confidence
3. **KG Screen** – shows Knowledge Graph relationships as cards

---

## Assessment Rubric Alignment

| Component | Evidence |
|-----------|---------|
| Problem understanding | Each notebook: Part I with clear X, y definition |
| Data quality | Part II–III: full cleaning with WHY explanations |
| **Data representation (15%)** | Part IV: all parameters explained (N, d, B, T, e, V) |
| EDA | Part V: ≥3 plots each with Observation/Interpretation/ML Implication |
| Preprocessing | Reproducible sklearn Pipeline (scaler + model) |
| ML models | 5-6 models per app, comparison table in Part IX |
| Evaluation | Correct metrics: F1/AUC for classification, MAE/R² for regression |
| **Web deployment** | FastAPI with /predict + /knowledge-graph endpoints |
| **Mobile deployment** | Flutter app calling REST APIs + KG display |
| Discussion | Discussion questions answered in notebook summary cells |
# assignment02
