/**
 * AI Real Estate Price Predictor & Investment Consultant Dashboard
 * Frontend Controller with Vis.js Graph & Groq LLM GraphRAG
 */

const API_BASE_URL = window.location.origin.includes('8002') 
    ? window.location.origin 
    : 'http://localhost:8002';

let lastPredictionData = null;
let currentPropertyData = null;
let chatHistory = [];
let networkInstance = null;
let kgNodesDataset = null;
let kgEdgesDataset = null;

// ── Quick Samples ───────────────────────────────────────────────────────────
const SAMPLE_PROPERTIES = {
    mat_pho: {
        Quan: "Quận Hoàn Kiếm",
        Huyen: "Phường Hàng Bạc",
        LoaiHinhNhaO: "Nhà mặt phố, mặt tiền",
        GiayToPhaply: "Đã có sổ",
        DienTich: 100,
        Rong: 5.0,
        Dai: 20.0,
        SoTang: 5,
        SoPhongNgu: 4
    },
    biet_thu: {
        Quan: "Quận Tây Hồ",
        Huyen: "Phường Quảng An",
        LoaiHinhNhaO: "Nhà biệt thự",
        GiayToPhaply: "Đã có sổ",
        DienTich: 250,
        Rong: 10.0,
        Dai: 25.0,
        SoTang: 3,
        SoPhongNgu: 5
    },
    nha_ngo: {
        Quan: "Quận Hà Đông",
        Huyen: "Phường Mộ Lao",
        LoaiHinhNhaO: "Nhà ngõ, hẻm",
        GiayToPhaply: "Đã có sổ",
        DienTich: 45,
        Rong: 4.0,
        Dai: 11.2,
        SoTang: 4,
        SoPhongNgu: 3
    },
    lien_ke: {
        Quan: "Huyện Gia Lâm",
        Huyen: "Xã Đa Tốn",
        LoaiHinhNhaO: "Nhà phố liền kề",
        GiayToPhaply: "Đang chờ sổ",
        DienTich: 90,
        Rong: 5.0,
        Dai: 18.0,
        SoTang: 4,
        SoPhongNgu: 4
    }
};

// ── Initialize App ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initSliders();
    initForm();
    initChat();
    loadKnowledgeGraph();
    
    // Load sample đầu tiên và dự đoán tự động
    loadSample('mat_pho');
});

// ── Sliders Sync ────────────────────────────────────────────────────────────
function initSliders() {
    const sliders = [
        { id: "dientich-slider", valId: "dientich-val", suffix: " m²" },
        { id: "rong-slider",     valId: "rong-val",     suffix: " m" },
        { id: "dai-slider",      valId: "dai-val",      suffix: " m" },
        { id: "sotang-slider",   valId: "sotang-val",   suffix: " tầng" },
        { id: "sophong-slider",  valId: "sophong-val",  suffix: " phòng" }
    ];

    sliders.forEach(s => {
        const el = document.getElementById(s.id);
        const valEl = document.getElementById(s.valId);
        if (el && valEl) {
            el.addEventListener("input", (e) => {
                valEl.textContent = e.target.value + s.suffix;
            });
        }
    });
}

// ── Load Sample ─────────────────────────────────────────────────────────────
function loadSample(key) {
    const sample = SAMPLE_PROPERTIES[key];
    if (!sample) return;

    const form = document.getElementById("predict-form");
    if (!form) return;

    if (form.elements["Quan"]) form.elements["Quan"].value = sample.Quan;
    if (form.elements["Huyen"]) form.elements["Huyen"].value = sample.Huyen;
    if (form.elements["LoaiHinhNhaO"]) form.elements["LoaiHinhNhaO"].value = sample.LoaiHinhNhaO;
    if (form.elements["GiayToPhaply"]) form.elements["GiayToPhaply"].value = sample.GiayToPhaply;
    
    if (form.elements["DienTich"]) {
        form.elements["DienTich"].value = sample.DienTich;
        document.getElementById("dientich-val").textContent = sample.DienTich + " m²";
    }
    if (form.elements["Rong"]) {
        form.elements["Rong"].value = sample.Rong;
        document.getElementById("rong-val").textContent = sample.Rong + " m";
    }
    if (form.elements["Dai"]) {
        form.elements["Dai"].value = sample.Dai;
        document.getElementById("dai-val").textContent = sample.Dai + " m";
    }
    if (form.elements["SoTang"]) {
        form.elements["SoTang"].value = sample.SoTang;
        document.getElementById("sotang-val").textContent = sample.SoTang + " tầng";
    }
    if (form.elements["SoPhongNgu"]) {
        form.elements["SoPhongNgu"].value = sample.SoPhongNgu;
        document.getElementById("sophong-val").textContent = sample.SoPhongNgu + " phòng";
    }

    // Tự động submit form
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
    const form = document.getElementById("predict-form");
    const formData = new FormData(form);
    
    const payload = {
        Quan:         formData.get("Quan"),
        Huyen:        formData.get("Huyen") || "Phường Dịch Vọng",
        LoaiHinhNhaO: formData.get("LoaiHinhNhaO"),
        GiayToPhaply: formData.get("GiayToPhaply"),
        SoTang:       parseFloat(formData.get("SoTang")),
        SoPhongNgu:   parseFloat(formData.get("SoPhongNgu")),
        DienTich:     parseFloat(formData.get("DienTich")),
        Dai:          parseFloat(formData.get("Dai")),
        Rong:         parseFloat(formData.get("Rong"))
    };

    currentPropertyData = payload;
    const btnSubmit = document.getElementById("btn-submit");
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG THẨM ĐỊNH GIÁ...';
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
        renderPredictionResult(data, payload);

    } catch (err) {
        console.error("Predict failed:", err);
        alert("Không thể kết nối đến Backend API. Vui lòng đảm bảo server đang chạy tại port 8002.");
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-chart-line"></i> <span>THẨM ĐỊNH GIÁ & PHÂN TÍCH THỊ TRƯỜNG</span>';
        }
    }
}

function renderPredictionResult(data, payload) {
    // 1. Cập nhật hero values
    const priceM2El = document.getElementById("price-per-m2");
    const totalBillionEl = document.getElementById("price-total-billion");
    const totalMillionEl = document.getElementById("price-total-million");
    const catPillEl = document.getElementById("price-cat-pill");
    const tierBadgeEl = document.getElementById("price-tier-badge");

    if (priceM2El) {
        priceM2El.innerHTML = `${data.predicted_price_per_m2} <small>triệu/m²</small>`;
    }
    if (totalBillionEl) {
        totalBillionEl.innerHTML = `≈ ${data.total_estimated_billion} <small>Tỷ VND</small>`;
    }
    if (totalMillionEl) {
        totalMillionEl.textContent = `(khoảng ${data.total_estimated_million.toLocaleString('vi-VN')} triệu VNĐ)`;
    }
    if (catPillEl) {
        catPillEl.textContent = data.price_category;
        catPillEl.style.color = data.price_color;
        catPillEl.style.borderColor = data.price_color;
    }
    if (tierBadgeEl) {
        tierBadgeEl.textContent = data.price_tier || "Đã thẩm định";
        tierBadgeEl.style.color = data.price_color;
    }

    // 2. Cập nhật drivers list
    const drvLoc = document.getElementById("drv-location");
    const drvType = document.getElementById("drv-type");
    const drvLegal = document.getElementById("drv-legal");
    const drvSize = document.getElementById("drv-size");

    if (drvLoc) drvLoc.textContent = `${payload.Quan} (${payload.Huyen})`;
    if (drvType) drvType.textContent = payload.LoaiHinhNhaO;
    if (drvLegal) drvLegal.textContent = payload.GiayToPhaply;
    if (drvSize) drvSize.textContent = `${payload.DienTich} m² (Mặt tiền ${payload.Rong}m, ${payload.SoTang} tầng)`;
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
            highlight: { background: "#f59e0b", border: "#ffffff" }
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
        color: { color: "rgba(148, 163, 184, 0.4)", highlight: "#f59e0b" },
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
        badgeEl.style.borderColor = node.color || "#38bdf8";
        badgeEl.style.color = node.color || "#38bdf8";
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

    // Typing indicator
    const typingId = appendTypingIndicator();

    try {
        const res = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: msg,
                property_data: currentPropertyData,
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
        
        // Lưu lịch sử hội thoại
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

    const icon = role === "assistant" ? "fa-user-tie" : "fa-user";
    
    // Render Markdown nếu là tin nhắn của assistant
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
        <div class="msg-avatar"><i class="fa-solid fa-user-tie"></i></div>
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
