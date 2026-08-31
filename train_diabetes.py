"""
Train and save Diabetes Prediction model (standalone script).
Uses faster SVM config to avoid timeout.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import warnings, json, os, time
warnings.filterwarnings('ignore')

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import LinearSVC  # LinearSVC much faster than SVC on large data
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, roc_auc_score, confusion_matrix)
import joblib

print("=== Diabetes Prediction Model Training ===")

# ── Load ──────────────────────────────────────────────────────────────────────
DATA_PATH = r'diabetes/archive/diabetes_binary_5050split_health_indicators_BRFSS2015.csv'
df = pd.read_csv(DATA_PATH)
print(f"Loaded: {df.shape}")

TARGET = 'Diabetes_binary'
feature_cols = [c for c in df.columns if c != TARGET]

# ── Clean ─────────────────────────────────────────────────────────────────────
df_clean = df.drop_duplicates()
print(f"After dedup: {df_clean.shape}")
# BMI validation
df_clean = df_clean[(df_clean['BMI'] >= 10) & (df_clean['BMI'] <= 100)]
print(f"After BMI validation: {df_clean.shape}")

# ── Represent ─────────────────────────────────────────────────────────────────
X = df_clean[feature_cols].values
y = df_clean[TARGET].values

print(f"\nFeature matrix X: R^(N×d) = R^({X.shape[0]}×{X.shape[1]})")
print(f"  N = {X.shape[0]:,}  → total patient records")
print(f"  d = {X.shape[1]}     → health indicator features")

# ── Split ─────────────────────────────────────────────────────────────────────
X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.30, random_state=42, stratify=y)
X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp)

scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_val_s   = scaler.transform(X_val)
X_test_s  = scaler.transform(X_test)

print(f"\nSplit: Train={X_train_s.shape[0]:,} | Val={X_val_s.shape[0]:,} | Test={X_test_s.shape[0]:,}")
print(f"X_train: R^(N_train×d) = R^({X_train_s.shape[0]}×{X_train_s.shape[1]})")
print(f"  N_train = {X_train_s.shape[0]:,}  → patients in training set")
print(f"  d = {X_train_s.shape[1]}            → number of features")

# ── Models (using LinearSVC instead of SVC for speed) ────────────────────────
models = {
    'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42),
    'KNN':                 KNeighborsClassifier(n_neighbors=7, n_jobs=-1),
    'Decision Tree':       DecisionTreeClassifier(max_depth=8, random_state=42),
    'Random Forest':       RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1),
    'Linear SVM':          LinearSVC(max_iter=2000, random_state=42)  # faster than SVC(kernel='rbf')
}

results = {}
trained = {}
print("\nTraining 5 models...")
for name, model in models.items():
    t0 = time.time()
    model.fit(X_train_s, y_train)
    y_pred = model.predict(X_val_s)
    # ROC-AUC: LinearSVC has decision_function
    if hasattr(model, 'predict_proba'):
        y_score = model.predict_proba(X_val_s)[:, 1]
    else:
        y_score = model.decision_function(X_val_s)
    auc = roc_auc_score(y_val, y_score)
    elapsed = time.time() - t0
    results[name] = {
        'Accuracy':  accuracy_score(y_val, y_pred),
        'Precision': precision_score(y_val, y_pred, zero_division=0),
        'Recall':    recall_score(y_val, y_pred, zero_division=0),
        'F1':        f1_score(y_val, y_pred, zero_division=0),
        'ROC-AUC':   auc,
        'Time(s)':   round(elapsed, 2)
    }
    trained[name] = model
    print(f"  [{name}] Acc={results[name]['Accuracy']:.4f} | F1={results[name]['F1']:.4f} | ROC-AUC={auc:.4f} | {elapsed:.1f}s")

# ── Best model ────────────────────────────────────────────────────────────────
best_name = max(results, key=lambda k: results[k]['F1'])
best_model = trained[best_name]
print(f"\nBest model (highest F1): {best_name}")

y_pred_test = best_model.predict(X_test_s)
if hasattr(best_model, 'predict_proba'):
    y_score_test = best_model.predict_proba(X_test_s)[:, 1]
else:
    y_score_test = best_model.decision_function(X_test_s)

print(f"Test → Acc={accuracy_score(y_test,y_pred_test):.4f} | F1={f1_score(y_test,y_pred_test):.4f} | ROC-AUC={roc_auc_score(y_test,y_score_test):.4f}")

# ── Persist ───────────────────────────────────────────────────────────────────
os.makedirs('diabetes/models', exist_ok=True)
final_pipeline = Pipeline([('scaler', StandardScaler()), ('model', best_model)])
final_pipeline.fit(X_train, y_train)

MODEL_PATH = 'diabetes/models/diabetes_pipeline.joblib'
joblib.dump(final_pipeline, MODEL_PATH)
print(f"\nModel saved: {MODEL_PATH}")

metadata = {
    'feature_names': feature_cols,
    'target': TARGET,
    'classes': [0, 1],
    'class_names': ['No Diabetes', 'Diabetes'],
    'best_model': best_name,
    'n_features': len(feature_cols),
    'training_shape': f'R^({X_train.shape[0]}×{X_train.shape[1]})',
    'N': X.shape[0],
    'd': X.shape[1],
    'results': {k: {m: round(v, 4) for m, v in res.items() if m != 'Time(s)'} for k, res in results.items()}
}
with open('diabetes/models/diabetes_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)
print("Metadata saved.")

# Verify
loaded = joblib.load(MODEL_PATH)
test_preds = loaded.predict(X_test[:3])
print(f"\nVerification: preds={test_preds} | true={y_test[:3]}")
print("✓ Diabetes model saved and verified.")

# ── EDA plots ─────────────────────────────────────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
vc = df_clean[TARGET].value_counts()
axes[0].bar(['No Diabetes', 'Diabetes'], vc.values, color=['#4ECDC4', '#FF6B6B'])
axes[0].set_title('Target Distribution – Diabetes', fontweight='bold')
for i, v in enumerate(vc.values):
    axes[0].text(i, v + 200, f'{v:,}\n({v/len(df_clean)*100:.1f}%)', ha='center')

# BMI by class
for cls, color, label in [(0,'#4ECDC4','No Diabetes'), (1,'#FF6B6B','Diabetes')]:
    data = df_clean[df_clean[TARGET] == cls]['BMI']
    axes[1].hist(data, bins=40, alpha=0.6, color=color, label=f'{label} (mean={data.mean():.1f})')
axes[1].set_title('BMI Distribution by Class', fontweight='bold')
axes[1].legend()
plt.tight_layout()
plt.savefig('diabetes/diabetes_eda.png', dpi=120, bbox_inches='tight')
print("Plot saved: diabetes_eda.png")

print("\n=== COMPLETE ===")
