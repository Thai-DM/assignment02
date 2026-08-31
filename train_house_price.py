"""
Fix and run House Price notebook logic directly (bypassing notebook execution issues).
This trains the model and saves it to the models/ folder.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
import warnings, json, os, time
warnings.filterwarnings('ignore')

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib

print("=== House Price Model Training ===")

# ── Load ──────────────────────────────────────────────────────────────────────
DATA_PATH = r'house_price/archive (1)/VN_housing_dataset.csv'
df = pd.read_csv(DATA_PATH)
print(f"Loaded: {df.shape}")
print(f"Columns: {list(df.columns)}")
print(f"dtypes:\n{df.dtypes}")

# ── Inspect ───────────────────────────────────────────────────────────────────
TARGET = 'Giá/m2'
DROP_COLS = ['Unnamed: 0', 'Ngày', 'Địa chỉ']

# Columns are all read as str – explicitly define types
KNOWN_CAT_COLS = ['Quận', 'Huyện', 'Loại hình nhà ở', 'Giấy tờ pháp lý']
KNOWN_NUM_COLS = ['Số tầng', 'Số phòng ngủ', 'Diện tích', 'Dài', 'Rộng']

# Drop irrelevant
df_work = df.drop(columns=[c for c in DROP_COLS if c in df.columns])
print(f"\nAfter dropping irrelevant cols: {df_work.shape}")

# Convert price string "86,96 triệu/m²" → float 86.96 using regex
import re

def parse_price(s):
    if not isinstance(s, str): return None
    m = re.search(r'[\d,\.]+', s)
    if m:
        num_str = m.group().replace(',', '.')
        try: return float(num_str)
        except: return None
    return None

df_work[TARGET] = df_work[TARGET].apply(parse_price)

# Convert numeric feature cols to float
for col in KNOWN_NUM_COLS:
    if col in df_work.columns:
        df_work[col] = pd.to_numeric(
            df_work[col].astype(str).str.replace(',', '.'), errors='coerce'
        )

cat_cols = [c for c in KNOWN_CAT_COLS if c in df_work.columns]
num_cols = [c for c in KNOWN_NUM_COLS if c in df_work.columns]

print(f"\nNumerical cols ({len(num_cols)}): {num_cols}")
print(f"Categorical cols ({len(cat_cols)}): {cat_cols}")

# ── Clean ─────────────────────────────────────────────────────────────────────
df_clean = df_work.copy()

# Step 1: Drop rows with missing target FIRST
df_clean = df_clean.dropna(subset=[TARGET])
print(f"\nAfter dropna target: {len(df_clean):,}")

# Step 2: Remove duplicates AFTER parsing
before = len(df_clean)
df_clean = df_clean.drop_duplicates()
print(f"Removed {before - len(df_clean):,} duplicates → {len(df_clean):,} remain")

# Step 3: Convert numeric feature cols
for col in num_cols:
    if col in df_clean.columns:
        df_clean[col] = pd.to_numeric(
            df_clean[col].astype(str).str.replace(',', '.'), errors='coerce'
        )

# Step 4: Remove invalid price
before = len(df_clean)
df_clean = df_clean[df_clean[TARGET] > 0]
print(f"Removed {before - len(df_clean)} rows with price <= 0")

# Step 5: Outlier removal (1st-99th percentile)
q01 = df_clean[TARGET].quantile(0.01)
q99 = df_clean[TARGET].quantile(0.99)
before = len(df_clean)
df_clean = df_clean[(df_clean[TARGET] >= q01) & (df_clean[TARGET] <= q99)]
print(f"Removed {before - len(df_clean)} extreme price outliers")
print(f"Final clean shape: {df_clean.shape}")
print(f"Price range: [{df_clean[TARGET].min():.2f}, {df_clean[TARGET].max():.2f}] M VND/m²")

# ── Represent ────────────────────────────────────────────────────────────────
# Only keep available columns that exist
available_cat = [c for c in cat_cols if c in df_clean.columns]
available_num = [c for c in num_cols if c in df_clean.columns]

num_transformer = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler())
])
cat_transformer = Pipeline([
    ('imputer', SimpleImputer(strategy='most_frequent')),
    ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
])

preprocessor = ColumnTransformer([
    ('num', num_transformer, available_num),
    ('cat', cat_transformer, available_cat)
])

feature_cols_raw = available_num + available_cat
X_raw = df_clean[feature_cols_raw]
y = df_clean[TARGET].values

print(f"\nFeature cols: {feature_cols_raw}")
print(f"X_raw shape: {X_raw.shape}")

# ── Split ────────────────────────────────────────────────────────────────────
X_train_r, X_temp_r, y_train, y_temp = train_test_split(X_raw, y, test_size=0.30, random_state=42)
X_val_r,   X_test_r, y_val,   y_test = train_test_split(X_temp_r, y_temp, test_size=0.50, random_state=42)

X_train = preprocessor.fit_transform(X_train_r)
X_val   = preprocessor.transform(X_val_r)
X_test  = preprocessor.transform(X_test_r)

print(f"\nX_train: R^(N×d) = R^({X_train.shape[0]}×{X_train.shape[1]})")
print(f"  N_train = {X_train.shape[0]:,} → house listings in training set")
print(f"  d = {X_train.shape[1]}      → features after OHE encoding")

# ── Models ───────────────────────────────────────────────────────────────────
models = {
    'Linear Regression':  LinearRegression(),
    'Ridge':              Ridge(alpha=1.0),
    'Decision Tree':      DecisionTreeRegressor(max_depth=10, random_state=42),
    'Random Forest':      RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1),
    'Gradient Boosting':  GradientBoostingRegressor(n_estimators=100, random_state=42)
}

results = {}
trained = {}
print("\nTraining models...")
for name, model in models.items():
    t0 = time.time()
    model.fit(X_train, y_train)
    y_pred = model.predict(X_val)
    mae  = mean_absolute_error(y_val, y_pred)
    rmse = np.sqrt(mean_squared_error(y_val, y_pred))
    r2   = r2_score(y_val, y_pred)
    elapsed = time.time() - t0
    results[name] = {'MAE': mae, 'RMSE': rmse, 'R2': r2, 'Time': elapsed}
    trained[name] = model
    print(f"  [{name}] MAE={mae:.2f} | RMSE={rmse:.2f} | R²={r2:.4f} | {elapsed:.1f}s")

# ── Best model ────────────────────────────────────────────────────────────────
best_name = max(results, key=lambda k: results[k]['R2'])
best_model = trained[best_name]
print(f"\nBest model: {best_name}")

y_pred_test = best_model.predict(X_test)
mae  = mean_absolute_error(y_test, y_pred_test)
rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
r2   = r2_score(y_test, y_pred_test)
print(f"Test → MAE={mae:.2f} | RMSE={rmse:.2f} | R²={r2:.4f}")

# ── Persist ───────────────────────────────────────────────────────────────────
os.makedirs('house_price/models', exist_ok=True)
full_pipeline = Pipeline([
    ('preprocessor', preprocessor),
    ('model', best_model)
])
full_pipeline.fit(X_raw, y)
MODEL_PATH = 'house_price/models/house_price_pipeline.joblib'
joblib.dump(full_pipeline, MODEL_PATH)
print(f"\nModel saved: {MODEL_PATH}")

metadata = {
    'feature_cols_raw': feature_cols_raw,
    'numerical_cols': available_num,
    'categorical_cols': available_cat,
    'target': TARGET,
    'best_model': best_name,
    'training_N': len(y),
    'training_d': X_train.shape[1],
    'representation': f'R^(N×d) = R^({len(y)}×{X_train.shape[1]})',
    'results': {k: {m: round(v, 4) for m, v in res.items() if m != 'Time'} for k, res in results.items()}
}
with open('house_price/models/house_price_metadata.json', 'w', encoding='utf-8') as f:
    json.dump(metadata, f, indent=2, ensure_ascii=False)
print("Metadata saved.")

# ── Verify ────────────────────────────────────────────────────────────────────
loaded = joblib.load(MODEL_PATH)
test_pred = loaded.predict(X_raw.iloc[:3])
print(f"\nVerification – predictions: {test_pred.round(2)}")
print(f"Ground truth:               {y[:3].round(2)}")
print("✓ House Price model saved and verified.")

# ── EDA plots ─────────────────────────────────────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(14, 5))
axes[0].hist(df_clean[TARGET], bins=60, color='#4ECDC4', edgecolor='white')
axes[0].axvline(df_clean[TARGET].median(), color='red', linestyle='--', 
                label=f'Median: {df_clean[TARGET].median():.1f}')
axes[0].set_title('House Price Distribution (Giá/m²)', fontweight='bold')
axes[0].set_xlabel('Price per m² (million VND)')
axes[0].legend()

axes[1].hist(np.log1p(df_clean[TARGET]), bins=60, color='#FF6B6B', edgecolor='white')
axes[1].set_title('Log-transformed Price Distribution', fontweight='bold')
axes[1].set_xlabel('log(1 + Price)')

plt.tight_layout()
plt.savefig('house_price/house_price_distribution.png', dpi=120, bbox_inches='tight')
print("Plot saved: house_price_distribution.png")

print("\n=== COMPLETE ===")
