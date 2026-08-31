# Ứng Dụng 3: Phân Tích Cảm Xúc Khách Hàng TMĐT Shopee & Chuyên Gia AI GraphRAG

## 📌 1. Tổng Quan Ứng Dụng
Hệ thống phân loại tự động **Cảm xúc & Khám phá Sở thích người mua (Aspect-Based Sentiment & Interest Discovery)** từ các bài đánh giá sản phẩm trên sàn thương mại điện tử Shopee Việt Nam. Ứng dụng tích hợp mô hình Xử lý Ngôn ngữ Tự nhiên (Linear SVM TF-IDF) kết hợp với **Đồ thị Tri thức Đa khía cạnh TMĐT (E-commerce Aspect KG)** và chuyên gia AI **GraphRAG Groq LLM** để tự động bóc tách khuyết tật vận hành và đề xuất chiến lược CSKH giữ chân khách hàng (Retention).

---

## 📊 2. Bộ Dữ Liệu & Biểu Diễn Văn Bản (Lecture 02)
- **Nguồn dữ liệu:** [Kaggle - Shopee Vietnamese Product Reviews Sentiment](https://www.kaggle.com/datasets/duongnguyen/shopee-vietnamese-product-reviews-sentiment)
- **Kích thước ban đầu:** $10.947$ đánh giá ($9.599$ bản ghi nạp thành công từ JSONL).
- **Kích thước sau làm sạch:** $6.719$ bản ghi sau khi lọc nhiễu và loại bỏ đánh giá rỗng.
- **Biến mục tiêu:** `label` $\in \{0: \text{Tiêu cực (Negative)}, 1: \text{Tích cực (Positive)}\}$.
- **Quy trình biểu diễn văn bản (Text Representation Pipeline):**
  $$\text{Văn bản thô} \xrightarrow{\text{Regex/Tiền xử lý}} \text{Văn bản sạch} \xrightarrow{\text{Tokens}} \text{TF-IDF (1-gram, 2-gram)} \xrightarrow{\text{Ma trận thưa}} X \in \mathbb{R}^{6719 \times 10000}$$
  $$\text{Mỗi nhận xét } x_i = [\text{tfidf}_1, \text{tfidf}_2, \dots, \text{tfidf}_{10000}]^T \in \mathbb{R}^{10000}$$

---

## 🤖 3. Kết Quả Huấn Luyện & Lựa Chọn Mô Hình

Chiến lược phân chia: **70% Train / 15% Validation / 15% Test** (Stratified Split theo nhãn cảm xúc).

| Mô hình | Accuracy | Precision | Recall | F1-Score | ROC-AUC |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Baseline (DummyClassifier)** | 0.5367 | 0.5367 | 1.0000 | 0.6985 | 0.5000 |
| **Naïve Bayes Đa thức (Multinomial NB)** | 0.9049 | 0.8820 | 0.9575 | 0.9182 | 0.9680 |
| **Hồi quy Logistic (Logistic Regression)** | 0.9208 | 0.8828 | 0.9852 | 0.9312 | 0.9790 |
| **Rừng Ngẫu Nhiên (Random Forest)** | 0.9266 | 0.9096 | 0.9612 | 0.9347 | 0.9720 |
| **Gradient Boosting (GBM)** | 0.9119 | 0.8730 | 0.9815 | 0.9241 | 0.9705 |
| ⭐ **Linear SVM (LinearSVC - Selected)** | **0.9410** | **0.9137** | **0.9834** | **0.9472** | **0.9856** |

> **Lý do lựa chọn Linear SVM:**
> 1. **Hiệu năng vượt trội trong không gian chiều cao:** Đạt Accuracy $= 94.10\%$ và F1-Score $= 0.9472$ trên tập Test với ma trận 10.000 đặc trưng thưa.
> 2. **Tối đa hóa khoảng cách phân cách (Maximum Margin):** Giúp mô hình phân tách cực kỳ vững chắc giữa từ vựng tích cực và tiêu cực.
> 3. **Tốc độ huấn luyện & suy luận siêu tốc (< 0.1s):** Tối ưu hóa tuyệt đối cho các hệ thống tiếp nhận hàng triệu bình luận mỗi ngày.

---

## 🕸️ 4. Đồ Thị Tri Thức Đa Khía Cạnh (Aspect-Based Knowledge Graph)
- **Quy mô:** **19 Nodes & 21 Edges** mô hình hóa 5 khía cạnh cốt lõi (`Chất lượng SP`, `Đóng gói`, `Tốc độ giao hàng`, `CSKH & Tư vấn`, `Giá cả & Voucher`), 3 nhóm lỗi vận hành (`Hàng vỡ nát`, `Hàng không giống ảnh`, `Giao trễ`), 2 phân khúc khách hàng (`VIP` vs `At-Risk`) và các kịch bản phản hồi CSKH tức thì.
- **Tương tác trực quan:** Vis.js Network tương tác thời gian thực với màu sắc Shopee Flame Orange & Dark Slate.
- **GraphRAG Vector Retrieval:** Tự động tìm kiếm các luật cứu vãn 1 sao thành 5 sao và kích cầu mua lại (LTV).

---

## 🚀 5. Hướng Dẫn Cài Đặt & Khởi Chạy

### Cách 1: Khởi chạy 1-Click bằng file Batch
Nhấp đúp chuột vào file:
```cmd
run_customer_behavior.bat
```

### Cách 2: Khởi chạy thủ công từ dòng lệnh
```bash
# 1. Kích hoạt môi trường ảo
.\.venv\Scripts\activate

# 2. Huấn luyện lại mô hình (nếu cần)
python train_shopee.py

# 3. Khởi động Backend API
cd customer_behavior
uvicorn api.main:app --host 0.0.0.0 --port 8003 --reload
```
Truy cập giao diện: [http://localhost:8003](http://localhost:8003)  
Tài liệu Swagger API: [http://localhost:8003/docs](http://localhost:8003/docs)

---

## 📡 6. Danh Sách API Endpoints Chính
- `POST /predict`: Phân tích cảm xúc nhận xét văn bản (trả về xác suất, nhãn cảm xúc, phân tích các khía cạnh Aspect Chips và đề xuất hành động).
- `GET /sample-reviews`: Danh sách các bài đánh giá mẫu đa dạng (5 sao, 1 sao đóng gói ẩu, giao trễ, hàng vỡ).
- `GET /knowledge-graph`: Lấy cấu trúc Nodes & Edges đồ thị tri thức Shopee.
- `POST /chat`: Chuyên gia AI tư vấn tối ưu vận hành shop và kịch bản CSKH.

---

## 📁 7. Cấu Trúc Thư Mục
```
customer_behavior/
├── api/
│   └── main.py                     # FastAPI Backend (REST API + GraphRAG + Groq LLM)
├── archive/
│   ├── shopee_reviews_dataset.jsonl
│   └── aug_unaccented_reviews.jsonl
├── frontend/
│   ├── index.html                  # Giao diện Web Dashboard Shopee Theme
│   ├── style.css                   # Định kiểu Dark Slate & Shopee Orange
│   └── script.js                   # Xử lý tương tác, Circular Gauge, Aspect Chips & Vis.js
├── models/
│   ├── shopee_pipeline.joblib      # Pipeline hoàn chỉnh (TF-IDF Vectorizer + Linear SVM)
│   └── shopee_metadata.json        # Metadata và tham số mô hình
├── customer_behavior_notebook.ipynb# Jupyter Notebook thực nghiệm 13 phần chuẩn mực
└── README.md
```
