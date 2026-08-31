# Ứng Dụng 1: Hệ Thống Chuyên Gia Dự Đoán Nguy Cơ Tiểu Đường & GraphRAG Y Tế

## 📌 1. Tổng Quan Ứng Dụng
Hệ thống hỗ trợ chẩn đoán và sàng lọc sớm nguy cơ mắc **Bệnh Đái tháo đường Type 2** dựa trên các chỉ số sinh học lâm sàng và thói quen sinh hoạt. Hệ thống kết hợp mô hình Học máy có giám sát (Machine Learning Classification) với mạng lưới **Đồ thị Tri thức Y tế (Clinical Knowledge Graph)** và mô hình ngôn ngữ lớn **GraphRAG Groq LLM** để đưa ra phác đồ tư vấn y khoa cá nhân hóa.

---

## 📊 2. Bộ Dữ Liệu & Biểu Diễn Dữ Liệu (Lecture 02)
- **Nguồn dữ liệu:** [Kaggle - Diabetes Health Indicators Dataset (BRFSS 2015)](https://www.kaggle.com/datasets/alexteboul/diabetes-health-indicators-dataset)
- **Đơn vị thu thập gốc:** CDC (Centers for Disease Control and Prevention - USA).
- **Kích thước ban đầu:** $70.692$ quan sát $\times$ $22$ cột (bản 50-50 cân bằng nhãn).
- **Kích thước sau làm sạch:** $69.057$ quan sát (đã loại bỏ 1.635 dòng trùng lặp).
- **Biến mục tiêu:** `Diabetes_binary` $\in \{0: \text{Không bệnh}, 1: \text{Mắc bệnh/Nguy cơ cao}\}$.
- **Biểu diễn toán học:**
  $$x_i = [x_{\text{HighBP}}, x_{\text{HighChol}}, x_{\text{BMI}}, \dots, x_{\text{Income}}]^T \in \mathbb{R}^{21}$$
  $$X \in \mathbb{R}^{69057 \times 21}, \quad y \in \{0, 1\}^{69057}$$
- **Phép tiền xử lý:** Chuẩn hóa $Z$-score bằng `StandardScaler()`.

---

## 🤖 3. Kết Quả Huấn Luyện & Lựa Chọn Mô Hình

Chiến lược phân chia: **70% Train / 15% Validation / 15% Test** (Stratified Split theo nhãn).

| Mô hình | Accuracy | Precision | Recall | F1-Score | ROC-AUC |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Baseline (DummyClassifier)** | 0.5083 | 0.5083 | 1.0000 | 0.6740 | 0.5000 |
| **Hồi quy Logistic (Logistic Regression)** | 0.7424 | 0.7301 | 0.7765 | 0.7526 | 0.8182 |
| **Linear SVM** | 0.7427 | 0.7310 | 0.7791 | 0.7543 | 0.8179 |
| **K-Nearest Neighbors (k=7)** | 0.7173 | 0.7082 | 0.7521 | 0.7295 | 0.7764 |
| **Rừng Ngẫu Nhiên (Random Forest)** | 0.7291 | 0.7205 | 0.7684 | 0.7437 | 0.7990 |
| ⭐ **Cây Quyết Định (Decision Tree - Selected)** | **0.7375** | **0.7154** | **0.8030** | **0.7567** | **0.8072** |

> **Lý do lựa chọn Decision Tree:**
> 1. **Độ nhạy lâm sàng (Recall = 80.30%):** Giảm thiểu tối đa bỏ sót ca bệnh (False Negative) trong sàng lọc y tế.
> 2. **Khả năng giải thích (Interpretability):** Cho phép truy vết các nhánh quyết định y khoa rõ ràng.
> 3. **Tốc độ suy luận (Inference Time < 1ms):** Phù hợp phản hồi thời gian thực qua REST API.

---

## 🕸️ 4. Đồ Thị Tri Thức Y Tế (Clinical Knowledge Graph)
- **Quy mô:** **22 Nodes & 26 Edges** đa tầng (Patient, Biomarkers, Lifestyle, Disease, 5 Complications, 4 Treatments).
- **Tương tác trực quan:** Mạng lưới lực đàn hồi (Physics-based Spring Layout) vẽ bằng Vis.js trên Web UI và NetworkX trong Notebook.
- **GraphRAG Vector Engine:** Vector hóa các node tri thức bằng TF-IDF và tính tương đồng Cosine Similarity để cung cấp ngữ cảnh y khoa cho Groq LLM (`openai/gpt-oss-120b`).

---

## 🚀 5. Hướng Dẫn Cài Đặt & Khởi Chạy

### Cách 1: Khởi chạy 1-Click bằng file Batch (Khuyên dùng trên Windows)
Nhấp đúp chuột vào file:
```cmd
run_diabetes.bat
```
*(File bat sẽ tự động kích hoạt môi trường ảo `.venv`, khởi động FastAPI server tại cổng 8001 và tự động mở trình duyệt web).*

### Cách 2: Khởi chạy thủ công từ dòng lệnh
```bash
# 1. Kích hoạt môi trường ảo
.\.venv\Scripts\activate

# 2. Huấn luyện lại mô hình (nếu cần)
python train_diabetes.py

# 3. Khởi động Backend API
cd diabetes
uvicorn api.main:app --host 0.0.0.0 --port 8001 --reload
```
Truy cập giao diện: [http://localhost:8001](http://localhost:8001)  
Tài liệu Swagger API: [http://localhost:8001/docs](http://localhost:8001/docs)

---

## 📡 6. Danh Sách API Endpoints Chính
- `POST /predict`: Dự đoán nguy cơ từ 21 chỉ số lâm sàng (trả về xác suất, nhãn và giải thích).
- `GET /knowledge-graph`: Lấy cấu trúc Nodes & Edges để hiển thị đồ thị tương tác Vis.js.
- `POST /graph-rag-query`: Truy vấn thông tin y khoa từ Đồ thị Tri thức bằng Không gian Vector.
- `POST /chat`: Trò chuyện chuyên gia y tế AI (tích hợp Groq LLM + GraphRAG).

---

## 📁 7. Cấu Trúc Thư Mục
```
diabetes/
├── api/
│   └── main.py                     # FastAPI Backend (REST API + GraphRAG + Groq LLM)
├── archive/
│   └── diabetes_binary_5050split_health_indicators_BRFSS2015.csv
├── frontend/
│   ├── index.html                  # Giao diện Web Dashboard Glassmorphism
│   ├── style.css                   # Định kiểu Cyber Medical Emerald Theme
│   └── script.js                   # Xử lý gọi API, vẽ Vis.js graph & Chatbot
├── models/
│   ├── diabetes_pipeline.joblib    # Mô hình Pipeline đóng gói (Scaler + Decision Tree)
│   └── diabetes_metadata.json      # Metadata và tham số đánh giá mô hình
├── diabetes_notebook.ipynb         # Jupyter Notebook thực nghiệm 15 phần chuẩn mực
└── README.md
```
