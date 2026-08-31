"""
FastAPI Backend – App 1: Diabetes Prediction
Includes: /predict endpoint + /knowledge-graph endpoint
"""
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import joblib, json, os, numpy as np
from pathlib import Path

from contextlib import asynccontextmanager

# ── Load model ──────────────────────────────────────────────────────────────
MODEL_PATH = Path(__file__).parent.parent / "models" / "diabetes_pipeline.joblib"
META_PATH  = Path(__file__).parent.parent / "models" / "diabetes_metadata.json"

pipeline = None
metadata = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline, metadata
    if MODEL_PATH.exists():
        pipeline = joblib.load(MODEL_PATH)
        print(f"[OK] Model loaded from {MODEL_PATH}")
    else:
        print(f"[!] Model not found at {MODEL_PATH}. Run the notebook first.")
    if META_PATH.exists():
        with open(META_PATH) as f:
            metadata = json.load(f)
    yield

app = FastAPI(
    title="Diabetes Prediction API",
    description="Predicts diabetes risk from health indicators. Includes Knowledge Graph endpoint.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Knowledge Graph definition ───────────────────────────────────────────────
# Nodes and relationships for the Diabetes domain
KNOWLEDGE_GRAPH = {
    "nodes": [
        {
            "id": "Patient",
            "type": "entity",
            "color": "#4ECDC4",
            "label_vn": "Hồ sơ Bệnh nhân",
            "category_vn": "Thực thể Gốc (Root Entity)",
            "description": "Nút trung tâm đại diện cho cá thể bệnh nhân đang được khảo sát 21 chỉ số lâm sàng."
        },
        {
            "id": "HighBP",
            "type": "risk_factor",
            "color": "#FF6B6B",
            "label_vn": "Tăng Huyết Áp",
            "category_vn": "Yếu tố Nguy cơ (Risk Factor)",
            "description": "Áp lực dòng máu cao làm xơ cứng vi mạch, tổn thương tế bào nội mô và thúc đẩy đề kháng insulin (Trọng số rủi ro: 0.72)."
        },
        {
            "id": "HighChol",
            "type": "risk_factor",
            "color": "#FF6B6B",
            "label_vn": "Mỡ Máu Cao (Hyperlipidemia)",
            "category_vn": "Yếu tố Nguy cơ (Risk Factor)",
            "description": "Nồng độ cholesterol xấu (LDL-C) và triglyceride cao gây lắng đọng mảng xơ vữa và rối loạn chuyển hóa lipid (Trọng số rủi ro: 0.65)."
        },
        {
            "id": "BMI",
            "type": "risk_factor",
            "color": "#FF6B6B",
            "label_vn": "Chỉ số Khối cơ thể (BMI)",
            "category_vn": "Yếu tố Nguy cơ Cốt lõi",
            "description": "Mô mỡ tích tụ (đặc biệt mỡ nội tạng) tiết cytokine gây viêm và ức chế trực tiếp thụ thể Insulin tại mô cơ và gan (Trọng số rủi ro: 0.78)."
        },
        {
            "id": "Smoker",
            "type": "risk_factor",
            "color": "#FF9F43",
            "label_vn": "Hút Thuốc Lá",
            "category_vn": "Yếu tố Hành vi Nguy cơ",
            "description": "Chất độc nicotin kích thích thần kinh giao cảm, làm tăng tiết cortisol và catecholamine gây tăng đề kháng insulin (Trọng số rủi ro: 0.48)."
        },
        {
            "id": "Stroke",
            "type": "complication",
            "color": "#EE5A24",
            "label_vn": "Đột Quỵ Não",
            "category_vn": "Bệnh Đồng Mắc & Biến chứng",
            "description": "Biến chứng mạch máu lớn do tổn thương tuần hoàn não, có mối tương quan bệnh học 2 chiều với Đái tháo đường."
        },
        {
            "id": "HeartDiseaseorAttack",
            "type": "complication",
            "color": "#EE5A24",
            "label_vn": "Bệnh Tim Mạch & Nhồi Máu Cơ Tim",
            "category_vn": "Bệnh Đồng Mắc & Biến chứng",
            "description": "Đường huyết cao làm xơ cứng mạch vành tim. Hơn 70% bệnh nhân tiểu đường tử vong do biến chứng tim mạch."
        },
        {
            "id": "DiffWalk",
            "type": "complication",
            "color": "#EE5A24",
            "label_vn": "Khó Khăn Vận Động / Đi Lại",
            "category_vn": "Biến chứng Thần kinh & Cơ xương",
            "description": "Hậu quả của biến chứng bàn chân đái tháo đường, viêm đa dây thần kinh ngoại biên hoặc thoái hóa khớp do béo phì."
        },
        {
            "id": "PhysActivity",
            "type": "protective",
            "color": "#A3CB38",
            "label_vn": "Hoạt Động Thể Lực (≥150p/tuần)",
            "category_vn": "Yếu tố Bảo vệ (Protective Factor)",
            "description": "Co cơ kích hoạt con đường bắt giữ glucose không phụ thuộc insulin thông qua AMPK, tăng nhạy cảm insulin lên 40%."
        },
        {
            "id": "Fruits",
            "type": "protective",
            "color": "#A3CB38",
            "label_vn": "Ăn Hoa Quả Thường Xuyên",
            "category_vn": "Yếu tố Bảo vệ (Protective Factor)",
            "description": "Cung cấp chất chống oxy hóa (Polyphenols, Vitamin C) làm giảm stress oxy hóa tại tế bào beta đảo tụy."
        },
        {
            "id": "Veggies",
            "type": "protective",
            "color": "#A3CB38",
            "label_vn": "Ăn Rau Xanh Đầy Đủ",
            "category_vn": "Yếu tố Bảo vệ (Protective Factor)",
            "description": "Chất xơ hòa tan làm chậm quá trình hấp thu carbohydrate tại ruột non, ngăn ngừa đỉnh tăng đường huyết đột ngột sau ăn."
        },
        {
            "id": "GenHlth",
            "type": "indicator",
            "color": "#45B7D1",
            "label_vn": "Sức Khỏe Tổng Quát (Thang 1-5)",
            "category_vn": "Chỉ số Đánh giá Cá nhân",
            "description": "Chỉ báo phản ánh gánh nặng bệnh tật tổng thể, tương quan mạnh mẽ với tỷ lệ mắc bệnh mạn tính."
        },
        {
            "id": "Age",
            "type": "indicator",
            "color": "#45B7D1",
            "label_vn": "Nhóm Tuổi (Thang 1-13)",
            "category_vn": "Chỉ số Nhân khẩu học",
            "description": "Quá trình lão hóa làm suy giảm tự nhiên chức năng tiết insulin của tế bào beta và tăng tỷ lệ mỡ nội tạng."
        },
        {
            "id": "Diabetes",
            "type": "outcome",
            "color": "#6C5CE7",
            "label_vn": "Bệnh Đái Tháo Đường (Diabetes)",
            "category_vn": "Kết luận Lâm sàng (Outcome)",
            "description": "Bệnh lý rối loạn chuyển hóa carbohydrate đặc trưng bởi đường huyết mạn tính cao do thiếu hoặc kháng insulin."
        },
        {
            "id": "NoDiabetes",
            "type": "outcome",
            "color": "#00B894",
            "label_vn": "Không Mắc Bệnh (Khỏe mạnh)",
            "category_vn": "Kết luận Lâm sàng (Outcome)",
            "description": "Trạng thái chuyển hóa glucose bình thường, các cơ chế điều hòa nội môi được duy trì ổn định."
        }
    ],
    "edges": [
        {"source": "Patient",              "target": "HighBP",               "relation": "HAS_CONDITION",         "weight": 1.0},
        {"source": "Patient",              "target": "HighChol",             "relation": "HAS_CONDITION",         "weight": 1.0},
        {"source": "Patient",              "target": "BMI",                  "relation": "HAS_ATTRIBUTE",         "weight": 1.0},
        {"source": "Patient",              "target": "Smoker",               "relation": "HAS_BEHAVIOR",          "weight": 1.0},
        {"source": "Patient",              "target": "PhysActivity",         "relation": "HAS_BEHAVIOR",          "weight": 1.0},
        {"source": "Patient",              "target": "Age",                  "relation": "HAS_ATTRIBUTE",         "weight": 1.0},
        {"source": "HighBP",              "target": "Diabetes",             "relation": "INCREASES_RISK",        "weight": 0.72},
        {"source": "HighChol",            "target": "Diabetes",             "relation": "INCREASES_RISK",        "weight": 0.65},
        {"source": "BMI",                 "target": "Diabetes",             "relation": "INCREASES_RISK",        "weight": 0.78},
        {"source": "Smoker",              "target": "Diabetes",             "relation": "INCREASES_RISK",        "weight": 0.48},
        {"source": "Stroke",              "target": "Diabetes",             "relation": "COMORBIDITY",           "weight": 0.55},
        {"source": "HeartDiseaseorAttack","target": "Diabetes",             "relation": "COMORBIDITY",           "weight": 0.60},
        {"source": "Age",                 "target": "Diabetes",             "relation": "INCREASES_RISK",        "weight": 0.55},
        {"source": "GenHlth",             "target": "Diabetes",             "relation": "INDICATES",             "weight": 0.68},
        {"source": "PhysActivity",        "target": "Diabetes",             "relation": "REDUCES_RISK",          "weight": 0.45},
        {"source": "Fruits",              "target": "Diabetes",             "relation": "REDUCES_RISK",          "weight": 0.30},
        {"source": "Veggies",             "target": "Diabetes",             "relation": "REDUCES_RISK",          "weight": 0.28},
        {"source": "Diabetes",            "target": "Stroke",               "relation": "LEADS_TO",              "weight": 0.40},
        {"source": "Diabetes",            "target": "HeartDiseaseorAttack", "relation": "LEADS_TO",              "weight": 0.45},
        {"source": "Diabetes",            "target": "DiffWalk",             "relation": "LEADS_TO",              "weight": 0.35},
    ]
}


# ── Input schema ─────────────────────────────────────────────────────────────
class DiabetesInput(BaseModel):
    HighBP:               int   = Field(0, ge=0, le=1, description="High Blood Pressure (0=No, 1=Yes)")
    HighChol:             int   = Field(0, ge=0, le=1, description="High Cholesterol (0=No, 1=Yes)")
    CholCheck:            int   = Field(1, ge=0, le=1, description="Cholesterol check in 5 years")
    BMI:                  float = Field(25.0, ge=10.0, le=100.0, description="Body Mass Index")
    Smoker:               int   = Field(0, ge=0, le=1, description="Smoked 100+ cigarettes (0=No, 1=Yes)")
    Stroke:               int   = Field(0, ge=0, le=1, description="Ever had stroke")
    HeartDiseaseorAttack: int   = Field(0, ge=0, le=1, description="Heart disease or attack")
    PhysActivity:         int   = Field(1, ge=0, le=1, description="Physical activity past 30 days")
    Fruits:               int   = Field(1, ge=0, le=1, description="Consume fruit 1+/day")
    Veggies:              int   = Field(1, ge=0, le=1, description="Consume vegetables 1+/day")
    HvyAlcoholConsump:    int   = Field(0, ge=0, le=1, description="Heavy alcohol consumption")
    AnyHealthcare:        int   = Field(1, ge=0, le=1, description="Any healthcare coverage")
    NoDocbcCost:          int   = Field(0, ge=0, le=1, description="No doctor due to cost")
    GenHlth:              int   = Field(2, ge=1, le=5, description="General health (1=Excellent, 5=Poor)")
    MentHlth:             int   = Field(0, ge=0, le=30, description="Days of poor mental health (0-30)")
    PhysHlth:             int   = Field(0, ge=0, le=30, description="Days of poor physical health (0-30)")
    DiffWalk:             int   = Field(0, ge=0, le=1, description="Difficulty walking/stairs")
    Sex:                  int   = Field(0, ge=0, le=1, description="Sex (0=Female, 1=Male)")
    Age:                  int   = Field(5, ge=1, le=13, description="Age category (1=18-24, 13=80+)")
    Education:            int   = Field(4, ge=1, le=6, description="Education level (1-6)")
    Income:               int   = Field(5, ge=1, le=8, description="Income level (1-8)")


# ── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Diabetes Prediction API", "docs": "/docs", "endpoints": ["/predict", "/knowledge-graph"]}


@app.post("/predict")
def predict(data: DiabetesInput):
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Run the notebook first.")

    feature_order = [
        "HighBP","HighChol","CholCheck","BMI","Smoker","Stroke",
        "HeartDiseaseorAttack","PhysActivity","Fruits","Veggies",
        "HvyAlcoholConsump","AnyHealthcare","NoDocbcCost","GenHlth",
        "MentHlth","PhysHlth","DiffWalk","Sex","Age","Education","Income"
    ]
    X = np.array([[getattr(data, f) for f in feature_order]])

    pred = int(pipeline.predict(X)[0])
    try:
        # Always return the probability of having diabetes (class 1)
        proba = float(pipeline.predict_proba(X)[0][1])
    except Exception:
        proba = 1.0 if pred == 1 else 0.0

    # --- CLINICAL SAFETY GUARDRAILS (Luật An toàn Lâm sàng) ---
    # Fix điểm yếu của Decision Tree khi gặp Edge Case (Ví dụ: BMI=98 nhưng GenHlth=2)
    risk_boost = 0.0
    if data.BMI >= 40:
        risk_boost += 0.45  # Béo phì độ III (Cực đoan) -> Cú hích +45% rủi ro
    elif data.BMI >= 30:
        risk_boost += 0.15  # Béo phì độ I, II -> +15% rủi ro

    if data.HighBP == 1 and data.HighChol == 1:
        risk_boost += 0.20  # Combo Huyết áp + Mỡ máu -> +20% rủi ro
        
    if data.GenHlth >= 4:
        risk_boost += 0.15  # Sức khỏe kém -> +15% rủi ro

    # Hiệu chỉnh lại xác suất cuối cùng
    proba = min(0.98, proba + risk_boost)
    pred = 1 if proba >= 0.50 else 0
    # ---------------------------------------------------------

    # Identify top risk factors from input
    risk_factors_present = []
    if data.HighBP == 1:   risk_factors_present.append({"factor": "HighBP",    "relation": "INCREASES_RISK", "weight": 0.72})
    if data.HighChol == 1: risk_factors_present.append({"factor": "HighChol",  "relation": "INCREASES_RISK", "weight": 0.65})
    if data.BMI > 30:      risk_factors_present.append({"factor": "BMI",       "relation": "INCREASES_RISK", "weight": 0.78})
    if data.Stroke == 1:   risk_factors_present.append({"factor": "Stroke",    "relation": "COMORBIDITY",    "weight": 0.55})
    risk_factors_present.sort(key=lambda x: -x["weight"])

    protective_present = []
    if data.PhysActivity == 1: protective_present.append({"factor": "PhysActivity", "relation": "REDUCES_RISK", "weight": 0.45})
    if data.Fruits == 1:       protective_present.append({"factor": "Fruits",       "relation": "REDUCES_RISK", "weight": 0.30})
    if data.Veggies == 1:      protective_present.append({"factor": "Veggies",      "relation": "REDUCES_RISK", "weight": 0.28})

    return {
        "prediction": pred,
        "prediction_label": "Diabetes" if pred == 1 else "No Diabetes",
        "confidence": round(proba, 4),
        "explanation": (
            f"Hệ thống chẩn đoán bệnh nhân có {proba:.0%} nguy cơ mắc bệnh Tiểu đường."
        ),
        "knowledge_graph_insight": {
            "top_risk_factors": risk_factors_present[:3],
            "protective_factors": protective_present,
            "recommendation": (
                "Consider lifestyle changes: increase physical activity, eat more fruits/vegetables."
                if pred == 1 else
                "Maintain current healthy lifestyle."
            )
        },
        "input_feature_vector": {
            "shape": f"R^(1×{len(feature_order)})",
            "description": f"1 patient × {len(feature_order)} health features"
        }
    }


@app.get("/knowledge-graph")
def get_full_knowledge_graph():
    """Return the full domain Knowledge Graph for visualization."""
    return KNOWLEDGE_GRAPH


from typing import Optional, Dict, Any, List
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))
load_dotenv(Path(__file__).parent.parent.parent / ".env")

# Setup Groq Client from Environment Variable
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
groq_client = None
if GROQ_API_KEY:
    try:
        from groq import Groq
        groq_client = Groq(api_key=GROQ_API_KEY)
        print("[OK] Groq LLM Client initialized successfully from environment variable!")
    except Exception as e:
        print(f"[!] Groq Client initialization failed: {e}")
else:
    print("[!] GROQ_API_KEY not found in environment. Chat will use rule-based fallback responses.")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    patient_data: Optional[Dict[str, Any]] = None
    prediction: Optional[Dict[str, Any]] = None
    history: Optional[List[ChatMessage]] = []


from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class GraphRAGVectorEngine:
    """
    State-of-the-Art GraphRAG Vector Search Engine.
    Combines Neural Dense Embeddings (SentenceTransformer all-MiniLM-L6-v2) + 1-Hop Graph Traversal.
    """
    def __init__(self, kg_data):
        self.kg_data = kg_data
        self.documents = []
        self.doc_metadata = []
        
        # 1. Index all Nodes with clinical descriptions
        for node in kg_data["nodes"]:
            doc_text = f"{node['label_vn']} ({node['id']}) - Phân loại: {node.get('category_vn', '')}. Mô tả cơ chế y học: {node['description']}"
            self.documents.append(doc_text)
            self.doc_metadata.append({"type": "node", "id": node["id"], "data": node})
            
        # 2. Index all Relationships / Edges
        for edge in kg_data["edges"]:
            doc_text = f"Mối quan hệ y khoa: {edge['source']} có tác động [{edge['relation']}] đến {edge['target']} với trọng số nguy cơ {edge['weight']}."
            self.documents.append(doc_text)
            self.doc_metadata.append({"type": "edge", "source": edge["source"], "target": edge["target"], "relation": edge["relation"], "weight": edge["weight"]})
            
        # 3. Compute Dense Vector Embeddings (384-dimensional)
        print("[*] Đang khởi tạo mô hình Neural Embedding (SentenceTransformer all-MiniLM-L6-v2)...")
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            self.doc_vectors = self.model.encode(self.documents, convert_to_numpy=True, show_progress_bar=False)
            self.mode = "sentence_transformers"
            print(f"[OK] Neural Dense Vector Index initialized: {len(self.documents)} tri thức y khoa đã được nhúng vector (384 chiều).")
        except Exception as e:
            print(f"[!] Fallback to TF-IDF Vectorizer: {e}")
            from sklearn.feature_extraction.text import TfidfVectorizer
            self.vectorizer = TfidfVectorizer(ngram_range=(1, 3), sublinear_tf=True)
            self.doc_vectors = self.vectorizer.fit_transform(self.documents)
            self.mode = "tfidf"

    def query(self, user_query: str, top_k: int = 4) -> List[Dict[str, Any]]:
        """Dense Vector Cosine Similarity Search + Graph Traversal"""
        if self.mode == "sentence_transformers":
            q_vec = self.model.encode([user_query], convert_to_numpy=True)
            similarities = cosine_similarity(q_vec, self.doc_vectors)[0]
        else:
            q_vec = self.vectorizer.transform([user_query])
            similarities = cosine_similarity(q_vec, self.doc_vectors)[0]
        
        # Get top-k indices
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        retrieved_items = []
        for idx in top_indices:
            score = float(similarities[idx])
            if score > 0.15:  # Relevance threshold
                retrieved_items.append({
                    "text": self.documents[idx],
                    "score": round(score, 4),
                    "meta": self.doc_metadata[idx]
                })
        return retrieved_items


# Khởi tạo Vector Embedding Engine cho Knowledge Graph
vector_engine = GraphRAGVectorEngine(KNOWLEDGE_GRAPH)


@app.post("/chat")
def chat_with_medical_ai(req: ChatRequest):
    """
    GraphRAG + LLM Endpoint:
    Combines Patient Clinical Data + Machine Learning Prediction + Knowledge Graph Vector Search
    into Groq LLM to generate professional, limitless medical advice.
    """
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Tin nhắn không được để trống.")

    p_data = req.patient_data or {}
    pred_data = req.prediction or {}
    
    # 1. Trích xuất thông tin bệnh nhân
    bmi = p_data.get("BMI", 25.0)
    age = p_data.get("Age", 5)
    high_bp = "Có" if p_data.get("HighBP") == 1 else "Không"
    high_chol = "Có" if p_data.get("HighChol") == 1 else "Không"
    smoker = "Có" if p_data.get("Smoker") == 1 else "Không"
    stroke = "Có" if p_data.get("Stroke") == 1 else "Không"
    heart = "Có" if p_data.get("HeartDiseaseorAttack") == 1 else "Không"
    phys_act = "Có" if p_data.get("PhysActivity") == 1 else "Không"
    fruits = "Có" if p_data.get("Fruits") == 1 else "Không"
    veggies = "Có" if p_data.get("Veggies") == 1 else "Không"
    alcohol = "Có (Nghiện rượu)" if p_data.get("HvyAlcoholConsump") == 1 else "Không"
    gen_hlth = p_data.get("GenHlth", 2)
    diff_walk = "Có" if p_data.get("DiffWalk") == 1 else "Không"

    # 2. Trích xuất kết quả dự đoán Machine Learning
    pred_label = pred_data.get("prediction_label", "Chưa xác định")
    confidence = pred_data.get("confidence", 0.0)
    conf_percent = round(confidence * 100)

    # 3. GraphRAG: Vector Semantic Search + 1-Hop Graph Traversal
    retrieved_chunks = vector_engine.query(user_msg, top_k=4)
    
    retrieved_facts = []
    for chunk in retrieved_chunks:
        retrieved_facts.append(f"• [Vector Similarity {chunk['score']*100:.1f}%] {chunk['text']}")
        if chunk["meta"]["type"] == "node":
            node_id = chunk["meta"]["id"]
            # Graph Traversal: Lấy thêm các quan hệ liên kết lân cận (1-hop)
            connected_edges = [
                e for e in KNOWLEDGE_GRAPH["edges"]
                if e["source"] == node_id or e["target"] == node_id
            ]
            for edge in connected_edges[:2]:
                retrieved_facts.append(f"   └── [Graph Link] {edge['source']} --[{edge['relation']} (Trọng số: {edge['weight']})]--> {edge['target']}")
                
    kg_context_str = "\n".join(retrieved_facts) if retrieved_facts else "- Truy xuất tri thức nền tảng: Bệnh Đái tháo đường và các cơ chế chuyển hóa insulin."

    # 4. Tạo System Prompt chuẩn y khoa
    system_prompt = f"""Bạn là Bác sĩ AI Chuyên khoa Nội tiết & Đái tháo đường (Hệ thống Y tế Thông minh BRFSS GraphRAG).
Nhiệm vụ của bạn là tư vấn cho bệnh nhân một cách ân cần, chuẩn xác, dựa trên đúng Hồ sơ bệnh án và Trí thức Đồ thị Y khoa bên dưới:

=== HỒ SƠ LÂM SÀNG BỆNH NHÂN ===
- Chỉ số BMI: {bmi} kg/m²
- Nhóm tuổi: Nhóm {age} (theo thang BRFSS 1-13)
- Tăng huyết áp: {high_bp} | Mỡ máu cao: {high_chol}
- Tiền sử tim mạch: {heart} | Tiền sử đột quỵ: {stroke} | Khó khăn đi lại: {diff_walk}
- Lối sống: Hút thuốc: {smoker} | Nghiện rượu: {alcohol} | Tập thể thao: {phys_act} | Ăn rau: {veggies} | Ăn hoa quả: {fruits}
- Tự đánh giá sức khỏe: Mức {gen_hlth}/5

=== DỰ ĐOÁN TỪ MÔ HÌNH MACHINE LEARNING (DECISION TREE + GUARDRAILS) ===
- Kết luận: {pred_label} (Xác suất nguy cơ mắc bệnh: {conf_percent}%)

=== TRÍ THỨC TRUY XUẤT TỪ KNOWLEDGE GRAPH (GRAPHRAG) ===
{kg_context_str}

=== QUY TẮC TƯ VẤN ===
1. Trả lời bằng tiếng Việt tự nhiên, chuyên môn cao nhưng dễ hiểu, có thái độ đồng cảm, ân cần.
2. Trả lời đúng trọng tâm câu hỏi của người dùng (ví dụ hỏi về thuốc, ăn uống, tập luyện, xét nghiệm, triệu chứng, giải thích nguyên nhân...).
3. Sử dụng định dạng Markdown đẹp mắt: in đậm từ khóa quan trọng, gạch đầu dòng rõ ràng, dùng emoji y tế phù hợp (💊, 🥗, 🏃, ⚠️, 📋, ✅).
4. KHÔNG kê đơn thuốc liều lượng cụ thể một cách tùy tiện; luôn nhắc bệnh nhân làm xét nghiệm máu (HbA1c, Đường huyết lúc đói) tại bệnh viện trước khi dùng thuốc.
5. Luôn liên kết câu trả lời với đúng các chỉ số thực tế của bệnh nhân ở trên (ví dụ nếu BMI cao thì nhắc nhở giảm cân, nếu thiếu rau thì nhắc ăn rau, nếu huyết áp cao thì nhắc bảo vệ tim thận).
6. Câu trả lời phải có độ dài vừa phải, súc tích, hoàn chỉnh từ đầu đến cuối và có lời kết rõ ràng, không được ngắt quãng dở chừng.
"""

    # 5. Gọi Groq LLM
    try:
        messages = [{"role": "system", "content": system_prompt}]
        
        # Thêm lịch sử hội thoại gần nhất (tối đa 4 tin nhắn)
        for h in (req.history or [])[-4:]:
            messages.append({"role": h.role, "content": h.content})
            
        messages.append({"role": "user", "content": user_msg})

        # Gọi mô hình LLM mạnh nhất của Groq với max_tokens mở rộng
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.6,
            max_tokens=2500
        )
        reply = response.choices[0].message.content
        return {
            "reply": reply,
            "model": "openai/gpt-oss-120b (Groq LLM)",
            "graphrag_applied": len(retrieved_facts) > 0
        }

    except Exception as e:
        print(f"[!] Groq primary model failed: {e}. Trying fallback Qwen...")
        try:
            response = groq_client.chat.completions.create(
                model="qwen/qwen3.8-27b",
                messages=messages,
                temperature=0.6,
                max_tokens=2500
            )
            reply = response.choices[0].message.content
            return {
                "reply": reply,
                "model": "qwen/qwen3.8-27b (Groq LLM)",
                "graphrag_applied": len(retrieved_facts) > 0
            }
        except Exception as e2:
            print(f"[X] Groq LLM completely failed: {e2}")
            # Fallback nếu mất mạng
            return {
                "reply": f"⚠️ Bác sĩ AI đang gặp sự cố kết nối LLM ({e2}). Xin vui lòng thử lại sau giây lát!",
                "model": "fallback",
                "graphrag_applied": False
            }


from fastapi.staticfiles import StaticFiles

# ── Mount Frontend Static Files ──────────────────────────────────────────────
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)

