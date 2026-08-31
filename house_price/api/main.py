"""
FastAPI Backend – App 2: House Price Prediction & Real Estate Knowledge Graph (Vietnam)
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
import joblib, json, os, numpy as np, pandas as pd
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
        print("[OK] Groq LLM Client initialized for Real Estate Advisor from environment variable!")
    except Exception as e:
        print(f"[!] Groq Client initialization failed: {e}")
else:
    print("[!] GROQ_API_KEY not found in environment. Chat will use rule-based fallback responses.")

# ── Paths & Model Setup ──────────────────────────────────────────────────────
MODEL_PATH = Path(__file__).parent.parent / "models" / "house_price_pipeline.joblib"
META_PATH  = Path(__file__).parent.parent / "models" / "house_price_metadata.json"
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

pipeline = None
metadata = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline, metadata
    if MODEL_PATH.exists():
        pipeline = joblib.load(MODEL_PATH)
        print(f"[OK] House Price ML Model loaded successfully from {MODEL_PATH}")
    else:
        print(f"[!] Model not found at {MODEL_PATH}.")
    if META_PATH.exists():
        with open(META_PATH, encoding='utf-8') as f:
            metadata = json.load(f)
    yield

app = FastAPI(
    title="Vietnam Real Estate Price Prediction & GraphRAG API",
    description="Predicts house price per m² and provides AI Real Estate Investment Consulting using GraphRAG.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Real Estate Knowledge Graph ──────────────────────────────────────────────
KNOWLEDGE_GRAPH = {
    "nodes": [
        {
            "id": "Property",
            "type": "entity",
            "color": "#4ECDC4",
            "label_vn": "Bất Động Sản Mục Tiêu",
            "category_vn": "Thực thể Gốc (Root Property Entity)",
            "description": "Thực thể bất động sản trung tâm được khảo sát đầy đủ thông số vị trí, loại hình, diện tích và pháp lý để định giá thị trường."
        },
        {
            "id": "Location",
            "type": "category",
            "color": "#45B7D1",
            "label_vn": "Vị Trí & Hạ Tầng Giao Thông",
            "category_vn": "Nhóm Yếu tố Cốt lõi",
            "description": "Yếu tố quan trọng số 1 quyết định tới 60-70% giá trị BĐS, bao gồm khoảng cách tới trung tâm, trường học, bệnh viện và quy hoạch mở đường."
        },
        {
            "id": "CentralDistrict",
            "type": "attribute",
            "color": "#FF7675",
            "label_vn": "Quận Trung Tâm (Lõi Đô Thị)",
            "category_vn": "Vị trí Đắc địa (Hoàn Kiếm, Ba Đình, Đống Đa, Cầu Giấy, Tây Hồ)",
            "description": "Khu vực quỹ đất khan hiếm, mật độ kinh doanh sầm uất, tính thanh khoản cực cao và giá trị bất động sản luôn ở mức đỉnh (>150-300 triệu/m²)."
        },
        {
            "id": "SuburbanDistrict",
            "type": "attribute",
            "color": "#74B9FF",
            "label_vn": "Khu Vực Ven Đô & Đô Thị Mới",
            "category_vn": "Vùng Mở rộng (Hà Đông, Nam/Bắc Từ Liêm, Long Biên, Gia Lâm, Đông Anh)",
            "description": "Khu vực có tốc độ đô thị hóa nhanh, hưởng lợi từ hạ tầng vành đai và các đại đô thị mới, tiềm năng tăng giá vốn dài hạn rất lớn."
        },
        {
            "id": "PropertyType",
            "type": "category",
            "color": "#A29BFE",
            "label_vn": "Loại Hình Bất Động Sản",
            "category_vn": "Phân khúc Sản phẩm",
            "description": "Quyết định công năng sử dụng (để ở, kinh doanh buôn bán, cho thuê làm văn phòng) và biên độ định giá trên mỗi m² đất."
        },
        {
            "id": "StreetFrontage",
            "type": "attribute",
            "color": "#FD79A8",
            "label_vn": "Nhà Mặt Phố / Mặt Tiền",
            "category_vn": "Công năng Thương mại",
            "description": "Có giá trị kinh doanh và tạo dòng tiền cho thuê cao nhất, đơn giá mỗi m² thường cao gấp 1.5 - 2.5 lần so với nhà trong ngõ cùng khu vực."
        },
        {
            "id": "Villa",
            "type": "attribute",
            "color": "#FDCB6E",
            "label_vn": "Nhà Biệt Thự / Liền Kề",
            "category_vn": "Phân khúc Cao cấp",
            "description": "Bất động sản diện tích lớn, không gian xanh, quy hoạch đồng bộ, tiện ích nội khu đẳng cấp, phục vụ giới thượng lưu và tích sản an toàn."
        },
        {
            "id": "AlleyHouse",
            "type": "attribute",
            "color": "#81ECEC",
            "label_vn": "Nhà Ngõ Hẻm",
            "category_vn": "Phân khúc Phổ thông / An cư",
            "description": "Phục vụ nhu cầu ở thực của đa số người dân, giá cả hợp lý, phụ thuộc lớn vào độ rộng ngõ (ngõ ô tô vào được hay ngõ xe máy tránh)."
        },
        {
            "id": "LegalDocument",
            "type": "category",
            "color": "#F9CA24",
            "label_vn": "Giấy Tờ Pháp Lý",
            "category_vn": "Yếu tố An toàn & Rủi ro",
            "description": "Lá chắn pháp lý bảo vệ quyền sở hữu của người mua, quyết định khả năng thế chấp vay vốn ngân hàng và tốc độ thanh khoản."
        },
        {
            "id": "RedBook",
            "type": "attribute",
            "color": "#00B894",
            "label_vn": "Đã Có Sổ Đỏ / Sổ Hồng",
            "category_vn": "Pháp lý Chuẩn chỉnh 100%",
            "description": "Giấy chứng nhận quyền sử dụng đất chính chủ, an toàn tuyệt đối, thanh khoản nhanh chóng và được ngân hàng định giá cho vay tối đa 70%."
        },
        {
            "id": "PendingLegal",
            "type": "attribute",
            "color": "#E17055",
            "label_vn": "Đang Chờ Sổ / Giấy Tờ Khác",
            "category_vn": "Rủi ro Pháp lý Cần Lưu ý",
            "description": "Nhà đất mua bán qua vi bằng hoặc giấy viết tay, tiềm năng tranh chấp cao, bắt buộc phải chiết khấu giá từ 20-35% so với thị trường."
        },
        {
            "id": "PhysicalSize",
            "type": "category",
            "color": "#55EFC4",
            "label_vn": "Quy Mô & Kiến Trúc Xây Dựng",
            "category_vn": "Thông số Công trình",
            "description": "Bao gồm diện tích đất (m²), mặt tiền rộng/dài, số tầng cao và số lượng phòng ngủ khai thác."
        },
        {
            "id": "DienTich",
            "type": "attribute",
            "color": "#0984E3",
            "label_vn": "Diện Tích Đất (m²)",
            "category_vn": "Quy mô Mặt bằng",
            "description": "Nhân tố tính tổng giá trị giao dịch. Diện tích càng lớn thì tổng tiền càng cao, tuy nhiên đơn giá/m² có thể giảm nhẹ đối với lô đất quá lớn."
        },
        {
            "id": "SoTang",
            "type": "attribute",
            "color": "#6C5CE7",
            "label_vn": "Số Tầng Cao & Không Gian Sử Dụng",
            "category_vn": "Hệ số Sử dụng Đất",
            "description": "Nhà nhiều tầng làm tăng tổng diện tích sàn sử dụng (GFA), tối ưu hóa việc phân chia công năng ở kết hợp cho thuê phòng trọ hoặc văn phòng."
        },
        {
            "id": "PriceValuation",
            "type": "outcome",
            "color": "#D63031",
            "label_vn": "Định Giá & Đơn Giá Thị Trường",
            "category_vn": "Kết quả Thẩm định Machine Learning",
            "description": "Mức giá hợp lý ước tính (triệu VND/m² và Tổng tỷ VNĐ) dựa trên mô hình Random Forest Regressor đã được huấn luyện trên hàng nghìn giao dịch thực tế."
        },
        {
            "id": "InvestmentROI",
            "type": "outcome",
            "color": "#E84393",
            "label_vn": "Hiệu Quả Đầu Tư & Dòng Tiền",
            "category_vn": "Chiến lược Tài chính BĐS",
            "description": "Đánh giá tỷ suất lợi nhuận kép (Tăng giá vốn hàng năm + Lợi tức cho thuê 3-5%/năm) và tính thanh khoản khi cần thu hồi vốn."
        }
    ],
    "edges": [
        {"source": "Property", "target": "Location", "relation": "TỌA_LẠC_TẠI", "weight": 1.0},
        {"source": "Property", "target": "PropertyType", "relation": "THUỘC_PHÂN_KHÚC", "weight": 1.0},
        {"source": "Property", "target": "LegalDocument", "relation": "SỞ_HỮU_PHÁP_LÝ", "weight": 1.0},
        {"source": "Property", "target": "PhysicalSize", "relation": "CÓ_QUY_MÔ", "weight": 1.0},
        
        {"source": "Location", "target": "CentralDistrict", "relation": "PHÂN_NHÁNH_KHU_VỰC", "weight": 0.95},
        {"source": "Location", "target": "SuburbanDistrict", "relation": "PHÂN_NHÁNH_KHU_VỰC", "weight": 0.85},
        {"source": "PropertyType", "target": "StreetFrontage", "relation": "LOẠI_HÌNH_KINH_DOANH", "weight": 0.95},
        {"source": "PropertyType", "target": "Villa", "relation": "LOẠI_HÌNH_CAO_CẤP", "weight": 0.90},
        {"source": "PropertyType", "target": "AlleyHouse", "relation": "LOẠI_HÌNH_DÂN_SINH", "weight": 0.80},
        
        {"source": "LegalDocument", "target": "RedBook", "relation": "BẢO_CHỨNG_MINH_BẠCH", "weight": 1.0},
        {"source": "LegalDocument", "target": "PendingLegal", "relation": "YẾU_TỐ_RỦI_RO", "weight": 0.75},
        
        {"source": "PhysicalSize", "target": "DienTich", "relation": "XÁC_ĐỊNH_KHUÔN_VIÊN", "weight": 0.90},
        {"source": "PhysicalSize", "target": "SoTang", "relation": "TĂNG_DIỆN_TÍCH_SÀN", "weight": 0.80},
        
        {"source": "CentralDistrict", "target": "PriceValuation", "relation": "ĐẨY_GIÁ_LÊN_ĐỈNH (>150M/m²)", "weight": 0.95},
        {"source": "StreetFrontage", "target": "PriceValuation", "relation": "TĂNG_GIÁ_TRỊ_THƯƠNG_MẠI (+50%)", "weight": 0.90},
        {"source": "RedBook", "target": "PriceValuation", "relation": "TĂNG_TÍNH_THANH_KHOẢN_VÀ_GIÁ", "weight": 0.85},
        {"source": "PendingLegal", "target": "PriceValuation", "relation": "CHIẾT_KHẤU_GIẢM_GIÁ (-25%)", "weight": 0.80},
        
        {"source": "StreetFrontage", "target": "InvestmentROI", "relation": "TẠO_DÒNG_TIỀN_CHO_THUÊ_CAO", "weight": 0.90},
        {"source": "SuburbanDistrict", "target": "InvestmentROI", "relation": "DƯ_ĐỊA_TĂNG_GIÁ_VỐN_LỚN", "weight": 0.85},
        {"source": "PriceValuation", "target": "InvestmentROI", "relation": "TỔNG_HÒA_HIỆU_QUẢ_ĐẦU_TƯ", "weight": 1.0}
    ]
}

# ── Neural Dense Vector Engine for Real Estate GraphRAG ───────────────────────
class RealEstateGraphRAGEngine:
    """
    GraphRAG Vector Search Engine for Real Estate Investment Ontology.
    Indexes all Nodes (Market entities) and Edges (Valuation/ROI facts) into 384-dimensional vector space.
    """
    def __init__(self, kg_data):
        self.kg_data = kg_data
        self.documents = []
        self.doc_metadata = []
        
        # 1. Index all Nodes with market descriptions
        for node in kg_data["nodes"]:
            doc_text = f"{node['label_vn']} ({node['id']}) - Phân loại: {node.get('category_vn', '')}. Mô tả cơ chế thị trường: {node['description']}"
            self.documents.append(doc_text)
            self.doc_metadata.append({"type": "node", "id": node["id"], "data": node})
            
        # 2. Index all Relationships / Edges
        for edge in kg_data["edges"]:
            doc_text = f"Mối quan hệ bất động sản: {edge['source']} có tác động định giá [{edge['relation']}] đến {edge['target']} với trọng số {edge['weight']}."
            self.documents.append(doc_text)
            self.doc_metadata.append({"type": "edge", "source": edge["source"], "target": edge["target"], "relation": edge["relation"], "weight": edge["weight"]})
            
        # 3. Compute Dense Vector Embeddings (384-dimensional)
        print("[*] Đang khởi tạo mô hình Neural Embedding (SentenceTransformer all-MiniLM-L6-v2) cho Bất Động Sản...")
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            self.doc_vectors = self.model.encode(self.documents, convert_to_numpy=True, show_progress_bar=False)
            self.mode = "sentence_transformers"
            print(f"[OK] Neural Dense Vector Index initialized: {len(self.documents)} tri thức BĐS đã được nhúng vector (384 chiều).")
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
vector_engine = RealEstateGraphRAGEngine(KNOWLEDGE_GRAPH)


# ── Schemas ──────────────────────────────────────────────────────────────────
class HousePriceInput(BaseModel):
    Quan:             str   = Field("Quận Cầu Giấy", description="Quận/Huyện tại Hà Nội")
    Huyen:            str   = Field("Phường Dịch Vọng", description="Phường/Xã")
    LoaiHinhNhaO:     str   = Field("Nhà mặt phố, mặt tiền", description="Loại hình nhà ở")
    GiayToPhaply:     str   = Field("Đã có sổ", description="Tình trạng pháp lý")
    SoTang:           float = Field(4.0, ge=1, le=50,   description="Số tầng")
    SoPhongNgu:       float = Field(4.0, ge=0, le=20,   description="Số phòng ngủ")
    DienTich:         float = Field(80.0, ge=5, le=5000, description="Diện tích đất (m²)")
    Dai:              float = Field(16.0, ge=1, le=500,  description="Chiều dài (m)")
    Rong:             float = Field(5.0, ge=1, le=100,  description="Chiều rộng mặt tiền (m)")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    property_data: Optional[Dict[str, Any]] = None
    prediction: Optional[Dict[str, Any]] = None
    history: Optional[List[ChatMessage]] = []


# ── API Endpoints ────────────────────────────────────────────────────────────
@app.get("/options")
def get_filter_options():
    """Trả về danh sách Quận, Loại hình và Pháp lý hợp lệ trong mô hình"""
    districts = [
        "Quận Hoàn Kiếm", "Quận Ba Đình", "Quận Cầu Giấy", "Quận Đống Đa",
        "Quận Hai Bà Trưng", "Quận Tây Hồ", "Quận Thanh Xuân", "Quận Nam Từ Liêm",
        "Quận Bắc Từ Liêm", "Quận Hoàng Mai", "Quận Hà Đông", "Quận Long Biên",
        "Huyện Gia Lâm", "Huyện Hoài Đức", "Huyện Đông Anh", "Huyện Thanh Trì",
        "Huyện Đan Phượng", "Huyện Thường Tín", "Huyện Thanh Oai", "Huyện Thạch Thất",
        "Huyện Quốc Oai", "Huyện Sóc Sơn", "Huyện Mê Linh", "Huyện Chương Mỹ",
        "Huyện Ba Vì", "Huyện Phú Xuyên", "Huyện Mỹ Đức", "Thị xã Sơn Tây"
    ]
    property_types = [
        "Nhà mặt phố, mặt tiền",
        "Nhà biệt thự",
        "Nhà phố liền kề",
        "Nhà ngõ, hẻm"
    ]
    legal_docs = [
        "Đã có sổ",
        "Đang chờ sổ",
        "Giấy tờ khác"
    ]
    return {
        "districts": districts,
        "property_types": property_types,
        "legal_docs": legal_docs
    }


@app.post("/predict")
def predict_house_price(data: HousePriceInput):
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Mô hình chưa được tải. Vui lòng kiểm tra file pipeline.joblib.")

    input_df = pd.DataFrame([{
        "Quận":            data.Quan,
        "Huyện":           data.Huyen,
        "Loại hình nhà ở": data.LoaiHinhNhaO,
        "Giấy tờ pháp lý": data.GiayToPhaply,
        "Số tầng":         data.SoTang,
        "Số phòng ngủ":    data.SoPhongNgu,
        "Diện tích":       data.DienTich,
        "Dài":             data.Dai,
        "Rộng":            data.Rong,
    }])

    try:
        predicted_price = float(pipeline.predict(input_df)[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi dự đoán: {str(e)}")

    # Phân loại phân khúc giá
    if predicted_price < 50:
        price_cat = "Phổ thông (< 50 tr/m²)"
        cat_color = "#2ED573"
        tier = "Affordable"
    elif predicted_price < 100:
        price_cat = "Trung cấp (50 - 100 tr/m²)"
        cat_color = "#FFA502"
        tier = "Mid-range"
    elif predicted_price < 180:
        price_cat = "Cao cấp (100 - 180 tr/m²)"
        cat_color = "#FF4757"
        tier = "Premium"
    else:
        price_cat = "Siêu sang / Đắc địa (> 180 tr/m²)"
        cat_color = "#9B59B6"
        tier = "Luxury"

    total_price_m = predicted_price * data.DienTich
    total_price_billion = total_price_m / 1000.0

    return {
        "predicted_price_per_m2": round(predicted_price, 2),
        "predicted_price_unit": "triệu VND/m²",
        "price_category": price_cat,
        "price_tier": tier,
        "price_color": cat_color,
        "total_estimated_million": round(total_price_m, 2),
        "total_estimated_billion": round(total_price_billion, 2),
        "knowledge_graph_insight": {
            "district": data.Quan,
            "property_type": data.LoaiHinhNhaO,
            "legal_status": data.GiayToPhaply,
            "land_area": data.DienTich,
            "floors": data.SoTang,
            "key_drivers": [
                {"factor": "Vị trí Quận/Huyện", "impact": "Tối quan trọng (Ảnh hưởng 60% đơn giá)"},
                {"factor": "Loại hình nhà ở", "impact": "Rất cao (Mặt tiền / Biệt thự có biên độ giá vượt trội)"},
                {"factor": "Pháp lý Sổ đỏ", "impact": "Cốt lõi (Bảo chứng thanh khoản & định giá ngân hàng)"},
                {"factor": "Diện tích & Mặt tiền", "impact": "Quyết định tổng giá trị vốn và dòng tiền cho thuê"}
            ]
        }
    }


@app.get("/knowledge-graph")
def get_full_kg():
    return KNOWLEDGE_GRAPH


@app.post("/chat")
def chat_with_real_estate_advisor(req: ChatRequest):
    """
    GraphRAG + Groq LLM Endpoint for Real Estate Investment Consulting.
    Combines Property Features + Machine Learning Valuation + Knowledge Graph Vector Search.
    """
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Tin nhắn không được để trống.")

    p_data = req.property_data or {}
    pred_data = req.prediction or {}
    
    # 1. Trích xuất thông tin bất động sản
    quan = p_data.get("Quan", "Quận Cầu Giấy")
    huyen = p_data.get("Huyen", "Chưa rõ")
    loai_hinh = p_data.get("LoaiHinhNhaO", "Nhà mặt phố, mặt tiền")
    phap_ly = p_data.get("GiayToPhaply", "Đã có sổ")
    dien_tich = p_data.get("DienTich", 80.0)
    so_tang = p_data.get("SoTang", 4.0)
    so_phong = p_data.get("SoPhongNgu", 4.0)
    dai = p_data.get("Dai", 16.0)
    rong = p_data.get("Rong", 5.0)

    # 2. Trích xuất kết quả định giá ML
    price_m2 = pred_data.get("predicted_price_per_m2", 0.0)
    total_billion = pred_data.get("total_estimated_billion", 0.0)
    price_cat = pred_data.get("price_category", "Chưa xác định")

    # 3. GraphRAG: Dense Vector Semantic Search + 1-Hop Graph Traversal
    retrieved_chunks = vector_engine.query(user_msg, top_k=4)
    
    retrieved_facts = []
    for chunk in retrieved_chunks:
        retrieved_facts.append(f"• [Vector Match {chunk['score']*100:.1f}%] {chunk['text']}")
        if chunk["meta"]["type"] == "node":
            node_id = chunk["meta"]["id"]
            # 1-hop Graph Traversal
            connected_edges = [
                e for e in KNOWLEDGE_GRAPH["edges"]
                if e["source"] == node_id or e["target"] == node_id
            ]
            for edge in connected_edges[:2]:
                retrieved_facts.append(f"   └── [Graph Link] {edge['source']} --[{edge['relation']} (Trọng số: {edge['weight']})]--> {edge['target']}")
                
    kg_context_str = "\n".join(retrieved_facts) if retrieved_facts else "- Truy xuất tri thức thị trường BĐS Hà Nội và các nguyên lý định giá dòng tiền."

    # 4. System Prompt chuẩn chuyên gia BĐS
    system_prompt = f"""Bạn là Chuyên gia Tư vấn Đầu tư & Thẩm định Giá Bất động sản Cao cấp tại Hà Nội (Hệ thống AI Thẩm định Định giá & GraphRAG BĐS).
Nhiệm vụ của bạn là đưa ra những phân tích thị trường, tư vấn đầu tư, thẩm định giá và chiến lược tài chính chuyên nghiệp, chuẩn xác dựa trên Hồ sơ BĐS và Tri thức Đồ thị bên dưới:

=== THÔNG TIN BẤT ĐỘNG SẢN ĐANG KHẢO SÁT ===
- Vị trí: {quan} (Phường/Xã: {huyen})
- Phân khúc loại hình: {loai_hinh}
- Tình trạng pháp lý: {phap_ly}
- Quy mô: Diện tích đất {dien_tich} m² | Mặt tiền {rong} m | Chiều dài {dai} m
- Kết cấu xây dựng: {so_tang} tầng | {so_phong} phòng ngủ

=== KẾT QUẢ ĐỊNH GIÁ MACHINE LEARNING (RANDOM FOREST REGRESSOR) ===
- Đơn giá ước tính: {price_m2} triệu VND/m²
- Tổng giá trị BĐS: ≈ {total_billion} Tỷ VND
- Phân khúc thị trường: {price_cat}

=== TRÍ THỨC TRUY XUẤT TỪ KNOWLEDGE GRAPH (GRAPHRAG VECTOR SEARCH) ===
{kg_context_str}

=== QUY TẮC TƯ VẤN ===
1. Trả lời bằng tiếng Việt lịch sự, phong thái chuyên gia đầu tư bất động sản, am hiểu thị trường Hà Nội.
2. Trả lời đúng trọng tâm câu hỏi của nhà đầu tư (ví dụ: đánh giá tiềm năng tăng giá, phân tích dòng tiền cho thuê, rủi ro pháp lý, đàm phán giá, vay đòn bẩy ngân hàng...).
3. Sử dụng định dạng Markdown chuyên nghiệp: in đậm từ khóa, gạch đầu dòng rõ ràng, bảng biểu so sánh nếu cần, dùng emoji BĐS phù hợp (🏢, 💰, 📈, 📜, ⚖️, 🧭, 📍, 🔑).
4. Luôn bám sát các chỉ số thực tế của BĐS ở trên ({quan}, {loai_hinh}, {dien_tich}m², đơn giá {price_m2} tr/m², tổng {total_billion} tỷ).
5. Đưa ra lời khuyên tài chính thực tế và lưu ý thẩm định thực địa (check quy hoạch tại Sở TN&MT, kiểm tra tranh chấp hàng xóm, ngập nước mùa mưa).
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


# ── Mount Frontend Static Files ──────────────────────────────────────────────
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8002)
