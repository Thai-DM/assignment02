# Ứng Dụng 2: Hệ Thống Định Giá Bất Động Sản Hà Nội & GraphRAG Đầu Tư

## 📌 1. Tổng Quan Ứng Dụng
Hệ thống tự động **Định giá Bất động sản (Triệu VND/m²)** tại thị trường Hà Nội dựa trên các thuộc tính vị trí địa lý, loại hình nhà ở, giấy tờ pháp lý và quy mô kiến trúc. Ứng dụng tích hợp mô hình Hồi quy Machine Learning (Random Forest Regression) cùng hệ sinh thái **Đồ thị Tri thức BĐS (Real Estate Knowledge Graph)** và trợ lý tư vấn tài chính **GraphRAG Groq LLM**.

---

## 📊 2. Bộ Dữ Liệu & Biểu Diễn Dữ Liệu (Lecture 02)
- **Nguồn dữ liệu:** [Kaggle - Vietnam Housing Dataset Hanoi](https://www.kaggle.com/datasets/ladcva/vietnam-housing-dataset-hanoi)
- **Kích thước ban đầu:** $82.497$ tin đăng $\times$ $13$ cột.
- **Kích thước sau làm sạch:** $75.413$ tin đăng (đã làm sạch đơn vị giá, diện tích, loại bỏ ngoại lai phi lý).
- **Biến mục tiêu:** `Giá/m2` (Liên tục, đơn vị: Triệu VND/m²).
- **Biểu diễn toán học:**
  - Biến danh mục: Mã hóa One-Hot Encoding (`Quận`, `Huyện`, `Loại hình nhà ở`, `Giấy tờ pháp lý`).
  - Biến số học: Chuẩn hóa Z-score (`Số tầng`, `Số phòng ngủ`, `Diện tích`, `Dài`, `Rộng`).
  $$x_i = [x_{\text{num\_1}}, \dots, x_{\text{num\_5}}, x_{\text{cat\_ohe\_1}}, \dots, x_{\text{cat\_ohe\_302}}]^T \in \mathbb{R}^{307}$$
  $$X \in \mathbb{R}^{75413 \times 307}, \quad y \in \mathbb{R}^{75413}$$

---

## 🤖 3. Kết Quả Huấn Luyện & Lựa Chọn Mô Hình

Chiến lược phân chia: **70% Train / 15% Validation / 15% Test**.

| Mô hình | MAE (Tr/m²) | RMSE (Tr/m²) | $R^2$ Score | Thời gian huấn luyện |
| :--- | :---: | :---: | :---: | :---: |
| **Baseline (DummyRegressor - Mean)** | 35.80 | 49.20 | 0.0000 | 0.01s |
| **Hồi quy Tuyến tính (Linear Regression)** | 25.40 | 37.24 | 0.3551 | 0.20s |
| **Hồi quy Ridge ($\alpha=1.0$)** | 25.41 | 37.26 | 0.3545 | 0.80s |
| **Cây Quyết Định (Decision Tree Regressor)** | 24.87 | 38.00 | 0.3285 | 1.40s |
| **Gradient Boosting Regressor** | 24.58 | 36.71 | 0.3735 | 62.3s |
| ⭐ **Rừng Ngẫu Nhiên (Random Forest - Selected)** | **22.65** | **35.78** | **0.4113** | **32.0s** |

> **Lý do lựa chọn Random Forest Regressor:**
> 1. **Hiệu năng vượt trội:** Đạt sai số tuyệt đối trung bình $MAE = 22.65\text{ tr/m}^2$ và hệ số xác định $R^2 = 0.4113$ cao nhất trên tập Test.
> 2. **Khả năng học quan hệ phi tuyến:** Bắt được các tương tác phức tạp giữa vị trí trung tâm và loại hình nhà mặt phố.
> 3. **Khả năng kháng ngoại lai:** Cơ chế lấy mẫu ngẫu nhiên (Bootstrap Aggregating) giúp giảm thiểu biến động định giá.

---

## 🕸️ 4. Đồ Thị Tri Thức BĐS (Real Estate Knowledge Graph)
- **Quy mô:** **19 Nodes & 19 Edges** biểu diễn 3 phân vùng quận/huyện, 4 loại hình BĐS, chuẩn pháp lý Sổ đỏ/Chưa sổ, hạ tầng Metro và các phân khúc giá / tỷ suất ROI dòng tiền.
- **Tương tác trực quan:** Vis.js Network tương tác thời gian thực với màu sắc phân nhóm rõ rệt.
- **GraphRAG Vector Retrieval:** Khám phá nhanh các đòn bẩy tăng giá và chiến lược đầu tư dòng tiền cho Groq LLM.

---

## 🚀 5. Hướng Dẫn Cài Đặt & Khởi Chạy

### Cách 1: Khởi chạy 1-Click bằng file Batch
Nhấp đúp chuột vào file:
```cmd
run_house_price.bat
```

### Cách 2: Khởi chạy thủ công từ dòng lệnh
```bash
# 1. Kích hoạt môi trường ảo
.\.venv\Scripts\activate

# 2. Huấn luyện lại mô hình (nếu cần)
python train_house_price.py

# 3. Khởi động Backend API
cd house_price
uvicorn api.main:app --host 0.0.0.0 --port 8002 --reload
```
Truy cập giao diện: [http://localhost:8002](http://localhost:8002)  
Tài liệu Swagger API: [http://localhost:8002/docs](http://localhost:8002/docs)

---

## 📡 6. Danh Sách API Endpoints Chính
- `POST /predict`: Định giá BĐS từ thông số nhà đất (trả về đơn giá/m², tổng giá trị ước tính và phân tích biên độ giá).
- `GET /districts`: Danh sách các Quận/Huyện có trong tập dữ liệu.
- `GET /knowledge-graph`: Lấy cấu trúc Nodes & Edges đồ thị BĐS.
- `POST /chat`: Trợ lý AI thẩm định & tư vấn chiến lược đầu tư BĐS.

---

## 📁 7. Cấu Trúc Thư Mục
```
house_price/
├── api/
│   └── main.py                     # FastAPI Backend (REST API + GraphRAG + Groq LLM)
├── archive (1)/
│   └── VN_housing_dataset.csv      # Tập dữ liệu tin đăng BĐS Hà Nội
├── frontend/
│   ├── index.html                  # Giao diện Web Dashboard Luxury Amber Gold
│   ├── style.css                   # Định kiểu Real Estate Luxury Theme
│   └── script.js                   # Xử lý tính toán định giá & Vis.js graph
├── models/
│   ├── house_price_pipeline.joblib # Pipeline hoàn chỉnh (Preprocessor + Random Forest)
│   └── house_price_metadata.json   # Tham số metadata
├── house_price_notebook.ipynb      # Jupyter Notebook thực nghiệm 15 phần chuẩn mực
└── README.md
```
