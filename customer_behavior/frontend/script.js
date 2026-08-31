/**
 * AI Shopee Customer Experience & Sentiment Dashboard
 * Frontend Controller with Vis.js Graph & Groq LLM GraphRAG
 */

const API_BASE_URL = window.location.origin.includes('8003') 
    ? window.location.origin 
    : 'http://localhost:8003';

let lastPredictionData = null;
let currentReviewData = null;
let chatHistory = [];
let networkInstance = null;
let kgNodesDataset = null;
let kgEdgesDataset = null;

// ── Quick Samples ───────────────────────────────────────────────────────────
const SAMPLE_REVIEWS = {
    pos_perfect: {
        rating: 5,
        review: "Hàng siêu xịn, đóng gói 3 lớp bóng khí cẩn thận, giao siêu nhanh, thơm ngon 10/10!"
    },
    neg_broken: {
        rating: 1,
        review: "Giao hàng vỡ nát hộp, chất lượng quá tệ, không giống mô tả của shop, thái độ phục vụ cọc cằn, hoàn tiền gấp!"
    },
    mid_neutral: {
        rating: 3,
        review: "Chất lượng sản phẩm tạm ổn so với giá tiền, nhưng đơn vị vận chuyển giao hàng hơi chậm mất 5 ngày mới tới."
    },
    pos_loyal: {
        rating: 5,
        review: "Mua lần thứ 3 của shop rồi, hàng luôn chuẩn chính hãng, shop tư vấn nhiệt tình lại còn tặng kèm quà xinh xắn, sẽ ủng hộ dài dài!"
    }
};

// ── Initialize App ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initStarPicker();
    initTextareaCounter();
    initForm();
    initChat();
    loadKnowledgeGraph();
    
    // Load sample đầu tiên và dự đoán tự động
    loadSample('pos_perfect');
});

// ── Star Picker Controller ──────────────────────────────────────────────────
function initStarPicker() {
    const stars = document.querySelectorAll("#star-picker .star");
    const inputRating = document.getElementById("input-rating");
    const ratingText = document.getElementById("rating-text");

    const RATING_LABELS = {
        1: "1 Sao (Rất Tệ / Thất Vọng)",
        2: "2 Sao (Chưa Hài Lòng)",
        3: "3 Sao (Bình Thường / Tạm Ổn)",
        4: "4 Sao (Hài Lòng)",
        5: "5 Sao (Rất Hài Lòng & Tuyệt Vời)"
    };

    stars.forEach(star => {
        star.addEventListener("click", () => {
            const val = parseInt(star.getAttribute("data-value"));
            inputRating.value = val;
            ratingText.textContent = RATING_LABELS[val];
            updateStarsUI(val);
        });
    });
}

function updateStarsUI(val) {
    const stars = document.querySelectorAll("#star-picker .star");
    stars.forEach(star => {
        const starVal = parseInt(star.getAttribute("data-value"));
        if (starVal <= val) {
            star.classList.add("active");
        } else {
            star.classList.remove("active");
        }
    });
}

// ── Live Textarea Counter ───────────────────────────────────────────────────
function initTextareaCounter() {
    const textarea = document.getElementById("review-input");
    const countEl = document.getElementById("char-count");

    if (textarea && countEl) {
        textarea.addEventListener("input", () => {
            countEl.textContent = `${textarea.value.length} ký tự`;
        });
    }
}

// ── Load Sample ─────────────────────────────────────────────────────────────
function loadSample(key) {
    const sample = SAMPLE_REVIEWS[key];
    if (!sample) return;

    const textarea = document.getElementById("review-input");
    const inputRating = document.getElementById("input-rating");
    const ratingText = document.getElementById("rating-text");
    const countEl = document.getElementById("char-count");

    const RATING_LABELS = {
        1: "1 Sao (Rất Tệ / Thất Vọng)",
        2: "2 Sao (Chưa Hài Lòng)",
        3: "3 Sao (Bình Thường / Tạm Ổn)",
        4: "4 Sao (Hài Lòng)",
        5: "5 Sao (Rất Hài Lòng & Tuyệt Vời)"
    };

    if (textarea) {
        textarea.value = sample.review;
        if (countEl) countEl.textContent = `${sample.review.length} ký tự`;
    }
    if (inputRating) inputRating.value = sample.rating;
    if (ratingText) ratingText.textContent = RATING_LABELS[sample.rating];
    updateStarsUI(sample.rating);

    // Tự động submit
    handleFormSubmit();
}

// ── Form Submission & Prediction ────────────────────────────────────────────
function initForm() {
    const form = document.getElementById("predict-form");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            handleFormSubmit();
        });
    }
}

async function handleFormSubmit() {
    const textarea = document.getElementById("review-input");
    const inputRating = document.getElementById("input-rating");
    const reviewText = textarea.value.trim();
    const ratingVal = parseInt(inputRating.value) || 5;

    if (!reviewText) {
        alert("Vui lòng nhập nội dung đánh giá của khách hàng!");
        return;
    }

    const payload = {
        review: reviewText,
        rating: ratingVal
    };

    currentReviewData = payload;
    const btnSubmit = document.getElementById("btn-submit");
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG PHÂN TÍCH...';
    }

    try {
        const res = await fetch(`${API_BASE_URL}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`API Error: ${res.statusText}`);
        }

        const data = await res.json();
        lastPredictionData = data;
        renderPredictionResult(data);

    } catch (err) {
        console.error("Predict failed:", err);
        alert("Không thể kết nối đến Backend API. Vui lòng đảm bảo server đang chạy tại port 8003.");
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> <span>PHÂN TÍCH CẢM XÚC & TRÍCH XUẤT KHÍA CẠNH</span>';
        }
    }
}

function renderPredictionResult(data) {
    const isPos = data.prediction === 1;

    // 1. Cập nhật Badge & Title
    const badgeEl = document.getElementById("sentiment-badge");
    const titleEl = document.getElementById("sentiment-title");
    const churnEl = document.getElementById("sentiment-churn");

    if (badgeEl) {
        badgeEl.textContent = `${data.sentiment_label} (${data.rating}★)`;
        badgeEl.className = isPos ? "badge badge-pos" : "badge badge-neg";
    }

    if (titleEl) {
        titleEl.textContent = data.sentiment_label;
        titleEl.className = isPos ? "sentiment-title text-success" : "sentiment-title text-danger";
    }

    if (churnEl) {
        churnEl.innerHTML = isPos
            ? `<i class="fa-solid fa-shield-halved text-success"></i> Nguy cơ mất khách: <strong>Thấp (Khách hàng Trung thành)</strong>`
            : `<i class="fa-solid fa-triangle-exclamation text-danger"></i> Nguy cơ mất khách: <strong>RẤT CAO (Nguy cơ 1 sao & Hoàn tiền)</strong>`;
    }

    // 2. Cập nhật Gauge
    const circle = document.getElementById("conf-circle");
    const confText = document.getElementById("conf-text");
    const percent = data.confidence_percent || 90;

    if (circle) {
        circle.setAttribute("stroke-dasharray", `${percent}, 100`);
        circle.style.stroke = data.sentiment_color;
    }
    if (confText) {
        confText.textContent = `${percent}%`;
    }

    // 3. Cập nhật Keywords Tags
    const posBox = document.getElementById("pos-keywords-tags");
    const negBox = document.getElementById("neg-keywords-tags");

    if (posBox) {
        if (data.positive_keywords && data.positive_keywords.length > 0) {
            posBox.innerHTML = data.positive_keywords.map(k => `<span class="tag tag-pos">${escapeHtml(k)}</span>`).join('');
        } else {
            posBox.innerHTML = `<span class="tag-empty">Không phát hiện</span>`;
        }
    }

    if (negBox) {
        if (data.negative_keywords && data.negative_keywords.length > 0) {
            negBox.innerHTML = data.negative_keywords.map(k => `<span class="tag tag-neg">${escapeHtml(k)}</span>`).join('');
        } else {
            negBox.innerHTML = `<span class="tag-empty">Không phát hiện</span>`;
        }
    }

    // 4. Cập nhật Detected Aspects
    const aspectsGrid = document.getElementById("aspects-grid");
    if (aspectsGrid) {
        if (data.detected_aspects && data.detected_aspects.length > 0) {
            aspectsGrid.innerHTML = data.detected_aspects.map(a => `
                <div class="aspect-chip ${a.sentiment}">
                    <i class="fa-solid ${a.icon || 'fa-tag'}"></i>
                    <span>${a.aspect}</span>
                </div>
            `).join('');
        } else {
            aspectsGrid.innerHTML = `
                <div class="aspect-chip pos">
                    <i class="fa-solid fa-comment"></i>
                    <span>Bình luận Tổng quan</span>
                </div>
            `;
        }
    }
}

// ── Knowledge Graph (Vis.js) ────────────────────────────────────────────────
async function loadKnowledgeGraph() {
    try {
        const res = await fetch(`${API_BASE_URL}/knowledge-graph`);
        if (!res.ok) throw new Error("KG fetch failed");
        const kgData = await res.json();
        renderVisNetwork(kgData);
    } catch (err) {
        console.warn("Could not load KG from server, using local fallback:", err);
    }
}

function renderVisNetwork(kgData) {
    const container = document.getElementById("kg-network");
    if (!container) return;

    const nodes = kgData.nodes.map(n => ({
        id: n.id,
        label: n.label_vn || n.id,
        color: {
            background: n.color || "#45B7D1",
            border: "#ffffff",
            highlight: { background: "#ee4d2d", border: "#ffffff" }
        },
        shape: "box",
        margin: 10,
        font: { color: "#ffffff", size: 12, face: "Plus Jakarta Sans", bold: true },
        borderWidth: 2,
        shadow: { enabled: true, color: "rgba(0,0,0,0.5)", size: 8 },
        raw: n
    }));

    const edges = kgData.edges.map(e => ({
        from: e.source,
        to: e.target,
        label: e.relation,
        arrows: "to",
        color: { color: "rgba(148, 163, 184, 0.4)", highlight: "#ee4d2d" },
        font: { color: "#94a3b8", size: 9, align: "middle", strokeWidth: 0 },
        smooth: { type: "continuous" }
    }));

    kgNodesDataset = new vis.DataSet(nodes);
    kgEdgesDataset = new vis.DataSet(edges);

    const data = { nodes: kgNodesDataset, edges: kgEdgesDataset };
    const options = {
        physics: {
            solver: "forceAtlas2Based",
            forceAtlas2Based: {
                gravitationalConstant: -40,
                centralGravity: 0.01,
                springLength: 100,
                springConstant: 0.08
            },
            maxVelocity: 50,
            minVelocity: 0.1
        },
        interaction: {
            hover: true,
            zoomView: true,
            dragView: true
        }
    };

    networkInstance = new vis.Network(container, data, options);

    // Bắt sự kiện click Node trên đồ thị
    networkInstance.on("click", (params) => {
        if (params.nodes && params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const nodeData = kgNodesDataset.get(nodeId);
            if (nodeData && nodeData.raw) {
                showNodeInspector(nodeData.raw, kgData);
            }
        }
    });
}

function showNodeInspector(node, fullKg) {
    const titleEl = document.getElementById("inspector-title");
    const badgeEl = document.getElementById("inspector-type");
    const descEl = document.getElementById("inspector-desc");
    const relsEl = document.getElementById("inspector-relations");

    if (titleEl) titleEl.textContent = `${node.label_vn} (${node.id})`;
    if (badgeEl) {
        badgeEl.textContent = node.category_vn || node.type;
        badgeEl.style.borderColor = node.color || "#ee4d2d";
        badgeEl.style.color = node.color || "#ee4d2d";
    }
    if (descEl) descEl.textContent = node.description || "Không có mô tả chi tiết.";

    // Tìm các edges liên kết
    if (relsEl && fullKg && fullKg.edges) {
        const related = fullKg.edges.filter(e => e.source === node.id || e.target === node.id);
        if (related.length > 0) {
            relsEl.innerHTML = related.map(e => `
                <div class="link-pill">
                    <i class="fa-solid fa-arrow-right-long"></i> 
                    <strong>${e.source}</strong> --[${e.relation}]--> <strong>${e.target}</strong>
                </div>
            `).join('');
        } else {
            relsEl.innerHTML = '';
        }
    }
}

// ── AI Chatbot Controller (Groq LLM + GraphRAG) ─────────────────────────────
function initChat() {
    const btnSend = document.getElementById("btn-send-chat");
    const input = document.getElementById("chat-input");

    if (btnSend && input) {
        btnSend.addEventListener("click", () => sendChatMessage());
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }
}

function sendQuickPrompt(promptText) {
    const input = document.getElementById("chat-input");
    if (input) {
        input.value = promptText;
        sendChatMessage();
    }
}

async function sendChatMessage() {
    const input = document.getElementById("chat-input");
    const msg = input.value.trim();
    if (!msg) return;

    input.value = "";
    appendMessage("user", msg);

    const typingId = appendTypingIndicator();

    try {
        const res = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: msg,
                review_data: currentReviewData,
                prediction: lastPredictionData,
                history: chatHistory
            })
        });

        removeTypingIndicator(typingId);

        if (!res.ok) {
            throw new Error(`Chat API Error: ${res.statusText}`);
        }

        const data = await res.json();
        appendMessage("assistant", data.reply);
        
        chatHistory.push({ role: "user", content: msg });
        chatHistory.push({ role: "assistant", content: data.reply });

    } catch (err) {
        removeTypingIndicator(typingId);
        console.error("Chat error:", err);
        appendMessage("assistant", `⚠️ Xin lỗi, có lỗi kết nối tới chuyên gia AI (${err.message}). Vui lòng thử lại!`);
    }
}

function appendMessage(role, content) {
    const container = document.getElementById("chat-messages");
    if (!container) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${role}`;

    const icon = role === "assistant" ? "fa-headset" : "fa-user";
    
    const renderedHtml = (role === "assistant" && typeof marked !== "undefined")
        ? marked.parse(content)
        : `<p>${escapeHtml(content)}</p>`;

    msgDiv.innerHTML = `
        <div class="msg-avatar">
            <i class="fa-solid ${icon}"></i>
        </div>
        <div class="msg-content">
            ${renderedHtml}
        </div>
    `;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function appendTypingIndicator() {
    const container = document.getElementById("chat-messages");
    if (!container) return null;

    const id = "typing-" + Date.now();
    const div = document.createElement("div");
    div.id = id;
    div.className = "message assistant";
    div.innerHTML = `
        <div class="msg-avatar"><i class="fa-solid fa-headset"></i></div>
        <div class="msg-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.remove();
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}
