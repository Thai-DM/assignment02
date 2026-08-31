"""
Train and save Shopee Sentiment model directly (standalone script).
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import json, re, os, time, warnings
warnings.filterwarnings('ignore')

from collections import Counter
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import LinearSVC
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import joblib

print("=== Shopee Sentiment Model Training ===")

# ── Load ──────────────────────────────────────────────────────────────────────
records = []
for path in [
    r'customer_behavior/archive/shopee_reviews_dataset.jsonl',
    r'customer_behavior/archive/aug_unaccented_reviews.jsonl'
]:
    with open(path, encoding='utf-8') as f:
        for line in f:
            try:
                records.append(json.loads(line.strip()))
            except:
                pass

df = pd.DataFrame(records)
print(f"Loaded: {df.shape} | columns: {list(df.columns)}")
print(df['label'].value_counts())

# ── Clean ─────────────────────────────────────────────────────────────────────
df_clean = df.dropna(subset=['review', 'label'])
df_clean = df_clean.drop_duplicates(subset=['review'])
df_clean = df_clean[df_clean['review'].str.strip().str.len() >= 3].copy()

def clean_text(text):
    if not isinstance(text, str): return ''
    text = text.lower()
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s]', ' ', text)
    return text.strip()

df_clean['review_clean'] = df_clean['review'].apply(clean_text)
df_clean['label_int'] = (df_clean['label'] == 'positive').astype(int)
print(f"Clean: {df_clean.shape} | positive: {df_clean['label_int'].sum()} | negative: {(df_clean['label_int']==0).sum()}")

# ── Split ─────────────────────────────────────────────────────────────────────
X_text = df_clean['review_clean'].values
y = df_clean['label_int'].values

X_train_r, X_temp_r, y_train, y_temp = train_test_split(X_text, y, test_size=0.30, random_state=42, stratify=y)
X_val_r, X_test_r, y_val, y_test = train_test_split(X_temp_r, y_temp, test_size=0.50, random_state=42, stratify=y_temp)

# ── TF-IDF ────────────────────────────────────────────────────────────────────
MAX_FEATURES = 10000
tfidf = TfidfVectorizer(max_features=MAX_FEATURES, ngram_range=(1, 2), min_df=2)
X_train = tfidf.fit_transform(X_train_r)
X_val   = tfidf.transform(X_val_r)
X_test  = tfidf.transform(X_test_r)

print(f"\nX_train (TF-IDF): R^(N×V) = R^({X_train.shape[0]}×{X_train.shape[1]})")
print(f"  N = {X_train.shape[0]:,} -> reviews in training set")
print(f"  V = {X_train.shape[1]:,} -> vocabulary size (TF-IDF features)")

# ── Models ────────────────────────────────────────────────────────────────────
models = {
    'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42, class_weight='balanced'),
    'Naive Bayes':         MultinomialNB(),
    'Decision Tree':       DecisionTreeClassifier(max_depth=12, random_state=42),
    'Random Forest':       RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1),
    'Linear SVM':          LinearSVC(max_iter=2000, random_state=42, class_weight='balanced'),
    'Gradient Boosting':   GradientBoostingClassifier(n_estimators=50, random_state=42)
}

results = {}
trained = {}
print("\nTraining models...")
for name, model in models.items():
    t0 = time.time()
    model.fit(X_train, y_train)
    y_pred = model.predict(X_val)
    f1  = f1_score(y_val, y_pred, zero_division=0)
    acc = accuracy_score(y_val, y_pred)
    elapsed = time.time() - t0
    results[name] = {'F1': f1, 'Accuracy': acc, 'Time': elapsed}
    trained[name] = model
    print(f"  [{name}] F1={f1:.4f} | Acc={acc:.4f} | {elapsed:.1f}s")

best_name = max(results, key=lambda k: results[k]['F1'])
best_model = trained[best_name]
print(f"\nBest model: {best_name}")

y_pred_test = best_model.predict(X_test)
print(f"Test → F1={f1_score(y_test, y_pred_test):.4f} | Acc={accuracy_score(y_test, y_pred_test):.4f}")

# ── Persist ───────────────────────────────────────────────────────────────────
os.makedirs('customer_behavior/models', exist_ok=True)
text_pipeline = Pipeline([('tfidf', tfidf), ('model', best_model)])
text_pipeline.fit(X_train_r, y_train)
MODEL_PATH = 'customer_behavior/models/shopee_pipeline.joblib'
joblib.dump(text_pipeline, MODEL_PATH)
print(f"\nModel saved: {MODEL_PATH}")

metadata = {
    'model_name': best_name,
    'tfidf_max_features': MAX_FEATURES,
    'ngram_range': [1, 2],
    'classes': ['negative', 'positive'],
    'class_int': {'negative': 0, 'positive': 1},
    'text_col': 'review',
    'representation': f'TF-IDF: R^(N×V) = R^(N×{MAX_FEATURES})',
    'results': {k: {m: round(v, 4) for m, v in res.items() if m != 'Time'} for k, res in results.items()}
}
with open('customer_behavior/models/shopee_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

# Verify
loaded = joblib.load(MODEL_PATH)
samples = ["Sản phẩm tốt, giao hàng nhanh", "Hàng kém chất lượng, thất vọng"]
preds = loaded.predict(samples)
print("\nVerification:")
for txt, p in zip(samples, preds):
    print(f"  \"{txt}\" → {'Positive' if p==1 else 'Negative'}")
print("✓ Shopee model saved and verified.")

# ── EDA plots ─────────────────────────────────────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
vc = df_clean['label'].value_counts()
axes[0].bar(vc.index, vc.values, color=['#4ECDC4', '#FF6B6B'])
axes[0].set_title('Sentiment Distribution')

# Top keywords
pos_texts = ' '.join(df_clean[df_clean['label']=='positive']['review_clean'].tolist())
neg_texts = ' '.join(df_clean[df_clean['label']=='negative']['review_clean'].tolist())
top_pos = Counter(pos_texts.split()).most_common(10)
top_neg = Counter(neg_texts.split()).most_common(10)
words_p, counts_p = zip(*top_pos)
axes[1].barh(words_p[::-1], counts_p[::-1], color='#4ECDC4')
axes[1].set_title('Top Keywords – Positive')
plt.tight_layout()
plt.savefig('customer_behavior/shopee_eda.png', dpi=120, bbox_inches='tight')
print("Plot saved.")
print("\n=== COMPLETE ===")
