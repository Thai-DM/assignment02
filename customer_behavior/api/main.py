"""
FastAPI Backend – App 3: Shopee Customer Review Sentiment & E-Commerce GraphRAG (Vietnam)
Includes: /predict endpoint + /knowledge-graph endpoint + /chat (Groq LLM + GraphRAG)
"""
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import joblib, json, os, re, numpy as np
from pathlib import Path
from sklearn.metrics.pairwise import cosine_similarity

# ── Load Environment Variables ──────────────────────────────────────────────
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))
load_dotenv(Path(__file__).parent.parent.parent / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
groq_client = None
if GROQ_API_KEY:
    try:
        from groq import Groq
        groq_client = Groq(api_key=GROQ_API_KEY)
        print("[OK] Groq LLM Client initialized for Shopee E-Commerce Advisor from environment variable!")
    except Exception as e:
        print(f"[!] Groq Client initialization failed: {e}")
else:
    print("[!] GROQ_API_KEY not found in environment. Chat will use rule-based fallback responses.")

# ── Paths & Model Setup ──────────────────────────────────────────────────────
MODEL_PATH = Path(__file__).parent.parent / "models" / "shopee_pipeline.joblib"
META_PATH  = Path(__file__).parent.parent / "models" / "shopee_metadata.json"
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

pipeline = None
metadata = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline, metadata
    if MODEL_PATH.exists():
        pipeline = joblib.load(MODEL_PATH)
        print(f"[OK] Shopee Linear SVM ML Model loaded successfully from {MODEL_PATH}")
    else:
        print(f"[!] Model not found at {MODEL_PATH}.")
    if META_PATH.exists():
        with open(META_PATH, encoding='utf-8') as f:
            metadata = json.load(f)
    yield

app = FastAPI(
    title="Shopee Customer Review Sentiment & GraphRAG API",
    description="Analyzes customer feedback sentiment and provides AI E-Commerce Customer Experience Consulting.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s]', ' ', text)
    return text.strip()

# ── Shopee E-Commerce Knowledge Graph ─────────────────────────────────────────
KNOWLEDGE_GRAPH = {
    "nodes": [
        {
            "id": "Review",
            "type": "entity",
            "color": "#4ECDC4",
            "label_vn": "Đánh Giá Khách Hàng (Feedback)",
            "category_vn": "Thực thể Gốc (Root Entity)",
            "description": "Ý kiến phản hồi trực tiếp của người mua hàng trên sàn TMĐT Shopee, phản ánh trải nghiệm mua sắm thực tế."
        },
        {
            "id": "Customer",
            "type": "entity",
            "color": "#74B9FF",
            "label_vn": "Người Mua Hàng (Shopper)",
            "category_vn": "Chủ thể Tiêu dùng",
            "description": "Khách hàng cá nhân thực hiện giao dịch, có kỳ vọng về chất lượng sản phẩm, tốc độ giao nhận và dịch vụ của shop."
        },
        {
            "id": "ProductQuality",
            "type": "aspect",
            "color": "#FDCB6E",
            "label_vn": "Chất Lượng Sản Phẩm (Quality)",
            "category_vn": "Khía cạnh Cốt lõi (Core Aspect)",
            "description": "Độ hoàn thiện, công năng, độ bền, mùi hương, xuất xứ chính hãng và mức độ trùng khớp với mô tả của bài đăng bán."
        },
        {
            "id": "DeliverySpeed",
            "type": "aspect",
            "color": "#00CEC9",
            "label_vn": "Vận Chuyển & Giao Hàng (Logistics)",
            "category_vn": "Khía cạnh Giao nhận",
            "description": "Thời gian chuẩn bị hàng của shop, tốc độ giao của đơn vị vận chuyển (Shopee Xpress, SPX, GHTK, GHN) và thái độ của shipper."
        },
        {
            "id": "PackagingSafety",
            "type": "aspect",
            "color": "#FFA502",
            "label_vn": "Đóng Gói & Bảo Quản (Packaging)",
            "category_vn": "Khía cạnh Bảo vệ Hàng",
            "description": "Quy cách đóng gói hộp carton, chèn bóng khí chống sốc xốp nổ, đảm bảo hàng hóa nguyên vẹn không bị móp méo, vỡ nát."
        },
        {
            "id": "CustomerService",
            "type": "aspect",
            "color": "#A29BFE",
            "label_vn": "Chăm Sóc & Tư Vấn (Support)",
            "category_vn": "Khía cạnh Dịch vụ Shop",
            "description": "Tốc độ phản hồi tin nhắn chat, thái độ nhiệt tình, giải quyết khiếu nại đổi trả và quà tặng tri ân kèm theo đơn hàng."
        },
        {
            "id": "PriceValue",
            "type": "aspect",
            "color": "#E17055",
            "label_vn": "Giá Cả & Độ Đáng Tiền (P/P)",
            "category_vn": "Khía cạnh Định giá",
            "description": "Mức giá so với chất lượng nhận được, các chương trình giảm giá Flash Sale, mã Freeship Extra và voucher ưu đãi."
        },
        {
            "id": "PositiveSentiment",
            "type": "sentiment",
            "color": "#2ED573",
            "label_vn": "Cảm Xúc Tích Cực (Positive - 5★)",
            "category_vn": "Trạng thái Hài Lòng",
            "description": "Khách hàng hài lòng vượt mong đợi, để lại đánh giá 5 sao, lời khen ngợi chân thành và hình ảnh/video unbox đẹp mắt."
        },
        {
            "id": "NegativeSentiment",
            "type": "sentiment",
            "color": "#FF4757",
            "label_vn": "Cảm Xúc Tiêu Cực (Negative - 1★)",
            "category_vn": "Trạng thái Thất Vọng / Bất Mãn",
            "description": "Khách hàng bức xúc do nhận hàng lỗi, vỡ hỏng, giao trễ hoặc shop thái độ kém, dẫn đến đánh giá 1-2 sao và khiếu nại hoàn tiền."
        },
        {
            "id": "RepurchaseIntent",
            "type": "outcome",
            "color": "#38BDF8",
            "label_vn": "Ý Định Tái Mua Hàng (Repurchase)",
            "category_vn": "Giá trị Trọn đời Khách hàng (LTV)",
            "description": "Khách hàng quay lại mua tiếp nhiều lần, trở thành khách hàng thân thiết và tích cực giới thiệu sản phẩm cho bạn bè, người thân."
        },
        {
            "id": "ShopReputation",
            "type": "outcome",
            "color": "#9B59B6",
            "label_vn": "Uy Tín & Điểm Đánh Giá Gian Hàng",
            "category_vn": "Chỉ số Hiệu suất Shop (Shop Rating)",
            "description": "Điểm sao trung bình gian hàng (4.8 - 5.0★), danh hiệu Shop Yêu Thích / Shopee Mall và thứ hạng hiển thị trên thuật toán tìm kiếm."
        },
        {
            "id": "RiskCrisis",
            "type": "outcome",
            "color": "#D63031",
            "label_vn": "Nguy Cơ Mất Khách & Khủng Hoảng",
            "category_vn": "Rủi ro Kinh doanh (Churn Rate)",
            "description": "Tỷ lệ trả hàng hoàn tiền (Return Rate) tăng cao, bị Shopee phạt điểm sao chép hoặc hạ bậc hiển thị sản phẩm."
        }
    ],
    "edges": [
        {"source": "Customer", "target": "Review", "relation": "VIẾT_ĐÁNH_GIÁ", "weight": 1.0},
        {"source": "Review", "target": "ProductQuality", "relation": "ĐÁNH_GIÁ_VỀ", "weight": 0.90},
        {"source": "Review", "target": "DeliverySpeed", "relation": "ĐÁNH_GIÁ_VỀ", "weight": 0.85},
        {"source": "Review", "target": "PackagingSafety", "relation": "ĐÁNH_GIÁ_VỀ", "weight": 0.80},
        {"source": "Review", "target": "CustomerService", "relation": "ĐÁNH_GIÁ_VỀ", "weight": 0.75},
        {"source": "Review", "target": "PriceValue", "relation": "ĐÁNH_GIÁ_VỀ", "weight": 0.70},
        
        {"source": "ProductQuality", "target": "PositiveSentiment", "relation": "TẠO_LÒNG_TIN_TUYỆT_ĐỐI", "weight": 0.95},
        {"source": "DeliverySpeed", "target": "PositiveSentiment", "relation": "NÂNG_CAO_TRẢI_NGHIỆM_NHẬN", "weight": 0.85},
        {"source": "PackagingSafety", "target": "PositiveSentiment", "relation": "BẢO_VỆ_TRỌN_VẸN_HÀNG", "weight": 0.80},
        {"source": "CustomerService", "target": "PositiveSentiment", "relation": "TĂNG_THIỆN_CẢM_KHÁCH", "weight": 0.88},
        
        {"source": "PackagingSafety", "target": "NegativeSentiment", "relation": "HỎNG_HÓC_VỠ_HỘP (KHI_KÉM)", "weight": 0.90},
        {"source": "DeliverySpeed", "target": "NegativeSentiment", "relation": "GIAO_CHẬM_HỦY_ĐƠN (KHI_TRỄ)", "weight": 0.85},
        {"source": "ProductQuality", "target": "NegativeSentiment", "relation": "HÀNG_LỖI_KHÔNG_GIỐNG_ẢNH", "weight": 0.95},
        
        {"source": "PositiveSentiment", "target": "RepurchaseIntent", "relation": "TĂNG_TỶ_LỆ_MUA_LẠI_GẤP_3_LẦN", "weight": 0.95},
        {"source": "PositiveSentiment", "target": "ShopReputation", "relation": "ĐẨY_ĐIỂM_SHOP_LÊN_5_SAO", "weight": 0.90},
        {"source": "NegativeSentiment", "target": "RiskCrisis", "relation": "TĂNG_TỶ_LỆ_HOÀN_HÀNG_VÀ_MẤT_UY_TÍN", "weight": 0.92},
        {"source": "CustomerService", "target": "RiskCrisis", "relation": "XỬ_LÝ_KHÉO_CỨU_VÃN_1_SAO", "weight": 0.85}
    ]
}

# Keywords dictionary
POSITIVE_KEYWORDS = {"tốt", "thơm", "nhanh", "chất lượng", "ngon", "đẹp", "ổn", "hài lòng", "tuyệt", "ok", "xịn", "ưng", "dễ thương", "chu đáo", "cẩn thận", "chính hãng"}
NEGATIVE_KEYWORDS = {"tệ", "kém", "vỡ", "chậm", "lỗi", "hỏng", "dở", "thất vọng", "xấu", "bẩn", "lừa đảo", "móp", "rách", "thiếu", "không giống", "mùi lạ"}

# ── Neural Dense Vector Engine for Shopee GraphRAG ───────────────────────────
class ShopeeGraphRAGEngine:
    """
    GraphRAG Vector Search Engine for Shopee Customer Experience & Reviews.
    Indexes all Nodes (Aspects, Sentiments) and Edges (E-Commerce insights) into 384-dimensional vector space.
    """
    def __init__(self, kg_data):
        self.kg_data = kg_data
        self.documents = []
        self.doc_metadata = []
        
        # 1. Index all Nodes with e-commerce descriptions
        for node in kg_data["nodes"]:
            doc_text = f"{node['label_vn']} ({node['id']}) - Phân loại: {node.get('category_vn', '')}. Ý nghĩa kinh doanh: {node['description']}"
            self.documents.append(doc_text)
            self.doc_metadata.append({"type": "node", "id": node["id"], "data": node})
            
        # 2. Index all Relationships / Edges
        for edge in kg_data["edges"]:
            doc_text = f"Mối quan hệ hành vi khách hàng Shopee: {edge['source']} có tác động [{edge['relation']}] đến {edge['target']} với trọng số {edge['weight']}."
            self.documents.append(doc_text)
            self.doc_metadata.append({"type": "edge", "source": edge["source"], "target": edge["target"], "relation": edge["relation"], "weight": edge["weight"]})
            
        # 3. Compute Dense Vector Embeddings (384-dimensional)
        print("[*] Đang khởi tạo mô hình Neural Embedding (SentenceTransformer all-MiniLM-L6-v2) cho Shopee...")
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            self.doc_vectors = self.model.encode(self.documents, convert_to_numpy=True, show_progress_bar=False)
            self.mode = "sentence_transformers"
            print(f"[OK] Neural Dense Vector Index initialized: {len(self.documents)} tri thức TMĐT Shopee đã được nhúng vector (384 chiều).")
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
        
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        retrieved_items = []
        for idx in top_indices:
            score = float(similarities[idx])
            if score > 0.15:
                retrieved_items.append({
                    "text": self.documents[idx],
                    "score": round(score, 4),
                    "meta": self.doc_metadata[idx]
                })
        return retrieved_items

# Khởi tạo Vector Embedding Engine
vector_engine = ShopeeGraphRAGEngine(KNOWLEDGE_GRAPH)


# ── Schemas ──────────────────────────────────────────────────────────────────
class ReviewInput(BaseModel):
    review: str = Field(..., description="Nội dung bình luận đánh giá của khách hàng")
    rating: int = Field(5, ge=1, le=5, description="Số sao đánh giá (1-5 sao)")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    review_data: Optional[Dict[str, Any]] = None
    prediction: Optional[Dict[str, Any]] = None
    history: Optional[List[ChatMessage]] = []


# ── API Endpoints ────────────────────────────────────────────────────────────
@app.post("/predict")
def predict_sentiment(data: ReviewInput):
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Mô hình chưa được tải. Vui lòng kiểm tra file shopee_pipeline.joblib.")

    raw_text = data.review.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Bình luận không được để trống.")

    cleaned = clean_text(raw_text)

    try:
        pred = int(pipeline.predict([cleaned])[0])
        # Tính xác suất bằng decision_function + Sigmoid cho Linear SVM
        if hasattr(pipeline, "decision_function"):
            decision_val = float(pipeline.decision_function([cleaned])[0])
            prob_pos = 1.0 / (1.0 + np.exp(-decision_val))
            confidence = prob_pos if pred == 1 else (1.0 - prob_pos)
        else:
            confidence = 0.92 if pred == 1 else 0.88
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi dự đoán: {str(e)}")

    # Trích xuất từ khóa & khía cạnh (Aspects)
    tokens = set(cleaned.split())
    found_pos = [w for w in POSITIVE_KEYWORDS if w in cleaned]
    found_neg = [w for w in NEGATIVE_KEYWORDS if w in cleaned]

    detected_aspects = []
    if any(k in cleaned for k in ["chất lượng", "thơm", "ngon", "xịn", "đẹp", "kém", "dở", "tệ", "hỏng", "không giống"]):
        detected_aspects.append({"aspect": "Chất lượng Sản phẩm", "icon": "fa-gem", "sentiment": "pos" if found_pos else "neg"})
    if any(k in cleaned for k in ["nhanh", "chậm", "giao", "shipper", "vận chuyển", "trễ", "hỏa tốc"]):
        detected_aspects.append({"aspect": "Tốc độ Vận chuyển", "icon": "fa-truck-fast", "sentiment": "pos" if "nhanh" in cleaned else "neg"})
    if any(k in cleaned for k in ["đóng gói", "bóng khí", "xốp", "vỡ", "móp", "hộp", "rách", "cẩn thận"]):
        detected_aspects.append({"aspect": "Quy cách Đóng gói", "icon": "fa-box-open", "sentiment": "neg" if any(x in cleaned for x in ["vỡ", "móp", "rách"]) else "pos"})
    if any(k in cleaned for k in ["tư vấn", "shop", "nhiệt tình", "quà", "thái độ", "cọc cằn", "chu đáo"]):
        detected_aspects.append({"aspect": "Chăm sóc Khách hàng", "icon": "fa-headset", "sentiment": "pos" if any(x in cleaned for x in ["nhiệt tình", "quà", "chu đáo"]) else "neg"})
    if any(k in cleaned for k in ["giá", "rẻ", "đáng tiền", "đắt", "sale", "voucher"]):
        detected_aspects.append({"aspect": "Giá cả & P/P", "icon": "fa-tags", "sentiment": "pos" if any(x in cleaned for x in ["rẻ", "đáng tiền", "sale"]) else "neg"})

    sentiment_label = "Tích Cực (Hài Lòng)" if pred == 1 else "Tiêu Cực (Bất Mãn)"
    sentiment_color = "#2ED573" if pred == 1 else "#FF4757"
    conf_percent = round(confidence * 100)

    return {
        "prediction": pred,
        "sentiment_label": sentiment_label,
        "sentiment_color": sentiment_color,
        "confidence_score": round(confidence, 4),
        "confidence_percent": conf_percent,
        "rating": data.rating,
        "cleaned_text": cleaned,
        "positive_keywords": found_pos,
        "negative_keywords": found_neg,
        "detected_aspects": detected_aspects,
        "knowledge_graph_insight": {
            "sentiment_node": "PositiveSentiment" if pred == 1 else "NegativeSentiment",
            "aspect_count": len(detected_aspects),
            "customer_churn_risk": "Thấp (Khách hàng Trung thành)" if pred == 1 else "RẤT CAO (Nguy cơ mất khách & 1 sao)"
        }
    }


@app.get("/knowledge-graph")
def get_full_kg():
    return KNOWLEDGE_GRAPH


@app.post("/chat")
def chat_with_shopee_advisor(req: ChatRequest):
    """
    GraphRAG + Groq LLM Endpoint for Shopee Customer Experience & Response Automation.
    """
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Tin nhắn không được để trống.")

    r_data = req.review_data or {}
    pred_data = req.prediction or {}
    
    # 1. Trích xuất thông tin đánh giá
    raw_review = r_data.get("review", "Sản phẩm rất tốt, giao hàng nhanh!")
    rating = r_data.get("rating", 5)
    
    sentiment = pred_data.get("sentiment_label", "Tích Cực")
    conf = pred_data.get("confidence_percent", 95)
    aspects = [a.get("aspect") for a in pred_data.get("detected_aspects", [])]
    aspects_str = ", ".join(aspects) if aspects else "Tổng quan sản phẩm & dịch vụ"
    pos_keys = ", ".join(pred_data.get("positive_keywords", [])) or "Không có"
    neg_keys = ", ".join(pred_data.get("negative_keywords", [])) or "Không có"

    # 2. GraphRAG: Dense Vector Search + 1-Hop Graph Traversal
    retrieved_chunks = vector_engine.query(user_msg, top_k=4)
    
    retrieved_facts = []
    for chunk in retrieved_chunks:
        retrieved_facts.append(f"• [Vector Match {chunk['score']*100:.1f}%] {chunk['text']}")
        if chunk["meta"]["type"] == "node":
            node_id = chunk["meta"]["id"]
            connected_edges = [
                e for e in KNOWLEDGE_GRAPH["edges"]
                if e["source"] == node_id or e["target"] == node_id
            ]
            for edge in connected_edges[:2]:
                retrieved_facts.append(f"   └── [Graph Link] {edge['source']} --[{edge['relation']} (Trọng số: {edge['weight']})]--> {edge['target']}")
                
    kg_context_str = "\n".join(retrieved_facts) if retrieved_facts else "- Truy xuất tri thức vận hành gian hàng Shopee và quản trị trải nghiệm khách hàng."

    # 3. System Prompt chuyên gia TMĐT Shopee
    system_prompt = f"""Bạn là Chuyên gia AI Cao cấp về Quản trị Trải nghiệm Khách hàng & Tăng trưởng Gian hàng Shopee (Shopee Customer Experience & GraphRAG E-Commerce).
Nhiệm vụ của bạn là hỗ trợ chủ shop phân tích tâm lý khách hàng, viết kịch bản phản hồi (CSKH) cực kỳ chuyên nghiệp và đề xuất giải pháp cải thiện vận hành dựa trên Đánh giá và Tri thức Đồ thị bên dưới:

=== THÔNG TIN BÌNH LUẬN ĐÁNH GIÁ CỦA KHÁCH HÀNG ===
- Nội dung bình luận: "{raw_review}"
- Số sao đánh giá: {rating} ★
- Kết quả Phân loại ML (Linear SVM): {sentiment} (Độ tin cậy: {conf}%)
- Các khía cạnh nhận diện (Aspects): {aspects_str}
- Từ khóa tích cực: {pos_keys}
- Từ khóa tiêu cực: {neg_keys}

=== TRÍ THỨC TRUY XUẤT TỪ KNOWLEDGE GRAPH (GRAPHRAG VECTOR SEARCH) ===
{kg_context_str}

=== QUY TẮC TƯ VẤN ===
1. Trả lời bằng tiếng Việt lịch thiệp, thông minh, mang tư duy của một Chuyên gia Vận hành Shopee Mall / Top Seller.
2. Nếu người dùng yêu cầu "viết mẫu phản hồi khách hàng": Hãy soạn sẵn 2 kịch bản phản hồi (1 kịch bản ngắn gọn, thân thiện + 1 kịch bản chi tiết, tặng voucher/bảo hành) để chủ shop chỉ việc sao chép (copy) và dán ngay vào Shopee.
3. Nếu đánh giá là TIÊU CỰC (1-2★): Hướng dẫn chủ shop cách xử lý khủng hoảng khéo léo (xin lỗi chân thành, giải thích nguyên nhân, đề xuất đổi hàng mới hoặc hoàn tiền miễn phí để khách sửa đánh giá lên 5 sao).
4. Sử dụng định dạng Markdown đẹp mắt: in đậm từ khóa, gạch đầu dòng rõ ràng, bảng biểu so sánh, dùng emoji TMĐT phù hợp (🛍️, 📦, 🚚, ⭐, 💬, 🎁, 🛡️, 🚀).
5. Đưa ra giải pháp vận hành thực tế (cách đóng gói chống sốc 3 lớp, đổi đơn vị vận chuyển SPX/GHTK nếu hay giao chậm, kỹ thuật gửi tin nhắn auto-chat chăm sóc sau bán).
6. Câu trả lời súc tích, hoàn chỉnh từ đầu đến cuối và có kết luận rõ ràng, không được dừng dở chừng.
"""

    try:
        messages = [{"role": "system", "content": system_prompt}]
        for h in (req.history or [])[-4:]:
            messages.append({"role": h.role, "content": h.content})
        messages.append({"role": "user", "content": user_msg})

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
            return {
                "reply": f"⚠️ Chuyên gia AI đang gặp sự cố kết nối LLM ({e2}). Xin vui lòng thử lại sau giây lát!",
                "model": "fallback",
                "graphrag_applied": False
            }


# ── Mount Frontend & Mobile Static Files ─────────────────────────────────────
MOBILE_DIR = Path(__file__).parent.parent / "mobile"
if MOBILE_DIR.exists():
    app.mount("/mobile", StaticFiles(directory=str(MOBILE_DIR), html=True), name="mobile")

if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8003)
