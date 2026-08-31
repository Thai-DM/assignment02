const API_URL = 'http://localhost:8001';
let network = null;
let nodesDataset = null;
let edgesDataset = null;
let currentPrediction = null;

// Initialize vis-network
function initKnowledgeGraph(fullGraphData) {
    const container = document.getElementById('network-view');
    
    nodesDataset = new vis.DataSet(fullGraphData.nodes.map(n => ({
        id: n.id,
        label: n.id,
        color: n.color,
        shape: 'dot',
        size: 15,
        font: { color: '#ffffff' }
    })));

    edgesDataset = new vis.DataSet(fullGraphData.edges.map(e => ({
        from: e.source,
        to: e.target,
        label: e.relation,
        font: { align: 'middle', color: '#94a3b8', size: 10 },
        arrows: 'to',
        color: { color: 'rgba(255,255,255,0.15)' }
    })));

    const data = { nodes: nodesDataset, edges: edgesDataset };
    const options = {
        physics: { stabilization: false, barnesHut: { springLength: 100 } },
        interaction: { hover: true }
    };
    network = new vis.Network(container, data, options);

    // Event: Click on node to inspect clinical details
    network.on('click', function(params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const nodeInfo = fullGraphData.nodes.find(n => n.id === nodeId);
            if (nodeInfo) {
                document.getElementById('node-name').innerHTML = `📌 <strong>${nodeInfo.label_vn || nodeInfo.id}</strong> (<code>${nodeInfo.id}</code>)`;
                const badge = document.getElementById('node-category');
                badge.innerText = nodeInfo.category_vn || nodeInfo.type;
                badge.style.background = nodeInfo.color;
                badge.style.color = '#000';
                badge.style.fontWeight = '700';
                
                // Find connected edges
                const outgoing = fullGraphData.edges.filter(e => e.source === nodeId);
                const incoming = fullGraphData.edges.filter(e => e.target === nodeId);
                
                let relText = "";
                if (outgoing.length > 0) {
                    relText += "<br><br><strong>🔗 Tác động tới:</strong><br>" + outgoing.map(e => `• <code>--[${e.relation} (Trọng số: ${e.weight})]--></code> <strong>${e.target}</strong>`).join('<br>');
                }
                if (incoming.length > 0) {
                    relText += "<br><br><strong>⬅️ Nhận liên kết từ:</strong><br>" + incoming.map(e => `• <strong>${e.source}</strong> <code>--[${e.relation}]--></code>`).join('<br>');
                }

                document.getElementById('node-desc').innerHTML = `${nodeInfo.description || "Thực thể tri thức trong đồ thị y tế."}${relText}`;
            }
        }
    });
}

async function loadFullGraph() {
    try {
        const res = await fetch(`${API_URL}/knowledge-graph`);
        const data = await res.json();
        initKnowledgeGraph(data);
    } catch (err) {
        console.error("Failed to load KG:", err);
    }
}

document.getElementById('load-full-kg-btn').addEventListener('click', () => {
    loadFullGraph();
});

window.addEventListener('load', loadFullGraph);

// Update Slider values
const sliders = ['bmi', 'age', 'gen', 'phys', 'ment', 'edu', 'inc'];
sliders.forEach(id => {
    const el = document.getElementById(`${id}-slider`);
    if(el) {
        el.addEventListener('input', (e) => {
            const val = e.target.value;
            let display = val;
            if(id === 'bmi') display = val + ' kg/m²';
            else if(id === 'age') display = 'Nhóm ' + val;
            else if(id === 'gen' || id === 'edu' || id === 'inc') display = 'Mức ' + val;
            else if(id === 'phys' || id === 'ment') display = val + ' ngày';
            
            document.getElementById(`${id}-val`).innerText = display;
        });
    }
});

// Quick Samples
function loadSample(type) {
    if (type === 'healthy') {
        document.getElementById('bmi-slider').value = 22.5; document.getElementById('bmi-val').innerText = '22.5 kg/m²';
        document.getElementById('age-slider').value = 3; document.getElementById('age-val').innerText = 'Nhóm 3';
        document.getElementById('gen-slider').value = 1; document.getElementById('gen-val').innerText = 'Mức 1';
        
        ['chk-HighBP', 'chk-HighChol', 'chk-Stroke', 'chk-Heart', 'chk-DiffWalk', 'chk-Smoker', 'chk-Alcohol', 'chk-NoDoc'].forEach(id => document.getElementById(id).checked = false);
        ['chk-CholCheck', 'chk-Phys', 'chk-Fruits', 'chk-Veggies', 'chk-HealthCare'].forEach(id => document.getElementById(id).checked = true);
    } 
    else if (type === 'high_risk') {
        document.getElementById('bmi-slider').value = 35.0; document.getElementById('bmi-val').innerText = '35.0 kg/m²';
        document.getElementById('age-slider').value = 9; document.getElementById('age-val').innerText = 'Nhóm 9';
        document.getElementById('gen-slider').value = 4; document.getElementById('gen-val').innerText = 'Mức 4';
        
        ['chk-HighBP', 'chk-HighChol', 'chk-CholCheck'].forEach(id => document.getElementById(id).checked = true);
        ['chk-Phys', 'chk-Fruits', 'chk-Veggies'].forEach(id => document.getElementById(id).checked = false);
    }
    else if (type === 'elderly') {
        document.getElementById('bmi-slider').value = 28.0; document.getElementById('bmi-val').innerText = '28.0 kg/m²';
        document.getElementById('age-slider').value = 13; document.getElementById('age-val').innerText = 'Nhóm 13';
        document.getElementById('gen-slider').value = 5; document.getElementById('gen-val').innerText = 'Mức 5';
        
        ['chk-HighBP', 'chk-Stroke', 'chk-Heart', 'chk-DiffWalk'].forEach(id => document.getElementById(id).checked = true);
    }
}

let currentInputData = null;

// Form Submit
document.getElementById('predict-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('submit-btn');
    btn.querySelector('.btn-text').classList.add('hidden');
    btn.querySelector('.loader').classList.remove('hidden');
    btn.disabled = true;

    const formData = new FormData(e.target);
    const data = {};
    const fields = [
        "HighBP","HighChol","CholCheck","BMI","Smoker","Stroke",
        "HeartDiseaseorAttack","PhysActivity","Fruits","Veggies",
        "HvyAlcoholConsump","AnyHealthcare","NoDocbcCost","GenHlth",
        "MentHlth","PhysHlth","DiffWalk","Sex","Age","Education","Income"
    ];
    
    fields.forEach(f => {
        if (["HighBP","HighChol","CholCheck","Stroke","HeartDiseaseorAttack","PhysActivity",
             "Fruits","Veggies","HvyAlcoholConsump","AnyHealthcare","NoDocbcCost","DiffWalk","Smoker"].includes(f)) {
            data[f] = formData.get(f) ? 1 : 0;
        } else {
            data[f] = parseFloat(formData.get(f) || 0);
        }
    });

    try {
        const res = await fetch(`${API_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        currentPrediction = result;
        currentInputData = data;
        
        displayResult(result);
        highlightGraph(result.knowledge_graph_insight);
        startChatbot(result, data);

    } catch (err) {
        alert("Lỗi kết nối Backend API! Đảm bảo server đang chạy ở port 8001.");
    } finally {
        btn.querySelector('.btn-text').classList.remove('hidden');
        btn.querySelector('.loader').classList.add('hidden');
        btn.disabled = false;
    }
});

function displayResult(res) {
    document.getElementById('result-card').classList.remove('hidden');
    
    const riskPercent = Math.round(res.confidence * 100);
    const isHighRisk = res.prediction === 1;
    
    document.getElementById('risk-text').textContent = `${riskPercent}%`;
    const circle = document.getElementById('risk-circle');
    circle.style.strokeDasharray = `${riskPercent}, 100`;
    
    let color = 'var(--success)';
    if(riskPercent >= 50) color = 'var(--danger)';
    else if(riskPercent >= 30) color = 'var(--warning)';
    circle.style.stroke = color;
    
    const title = document.getElementById('result-title');
    title.innerText = isHighRisk ? 'Nguy cơ Cao!' : 'Khỏe mạnh';
    title.style.color = color;
    
    document.getElementById('result-desc').innerText = res.explanation;
}

function highlightGraph(insight) {
    if (!network || !nodesDataset) return;
    nodesDataset.forEach(n => {
        nodesDataset.update({ id: n.id, size: 10, shadow: false, opacity: 0.3 });
    });
    
    const activeNodes = ['Patient', 'Diabetes'];
    insight.top_risk_factors.forEach(f => activeNodes.push(f.factor));
    insight.protective_factors.forEach(f => activeNodes.push(f.factor));

    activeNodes.forEach(id => {
        if (nodesDataset.get(id)) {
            nodesDataset.update({
                id: id, 
                size: 25, 
                opacity: 1,
                shadow: { enabled: true, color: '#38bdf8', size: 15 }
            });
        }
    });
    network.fit({ nodes: activeNodes, animation: true });
}

/* ==========================================================================
   DYNAMIC CLINICAL CHATBOT REASONING ENGINE
   ========================================================================== */

let chatHistoryLog = [];

function startChatbot(res, data) {
    document.getElementById('chatbot-card').classList.remove('hidden');
    const chatHistory = document.getElementById('chat-history');
    chatHistory.innerHTML = ''; 
    chatHistoryLog = [];

    const riskPercent = Math.round(res.confidence * 100);
    const isHighRisk = res.prediction === 1;
    const insight = res.knowledge_graph_insight || {};
    
    let riskLevelText = "Nguy cơ Rất Thấp (An Toàn)";
    if (riskPercent >= 70) riskLevelText = "Nguy cơ CỰC CAO (Báo Động)";
    else if (riskPercent >= 50) riskLevelText = "Nguy cơ CAO (Cần Can Thiệp)";
    else if (riskPercent >= 30) riskLevelText = "Tiền Nguy Cơ / Trung Bình";

    let riskFactors = (insight.top_risk_factors || []).map(f => {
        const map = { HighBP: 'Tăng huyết áp', HighChol: 'Mỡ máu cao', BMI: `Béo phì (BMI ${data.BMI})`, Stroke: 'Tiền sử đột quỵ' };
        return map[f.factor] || f.factor;
    });

    let welcomeText = `👋 **Chào bạn, tôi là Bác sĩ AI Tư Vấn Lâm Sàng (Groq LLM + GraphRAG).**<br><br>`;
    welcomeText += `📊 **Đánh giá sơ bộ:** Bệnh nhân thuộc nhóm **${riskLevelText}** với xác suất rủi ro **${riskPercent}%**.<br>`;
    
    if (riskFactors.length > 0) {
        welcomeText += `⚠️ **Yếu tố cảnh báo chính:** ${riskFactors.join(', ')}.<br>`;
    }
    
    if (data.PhysActivity === 1 && data.Veggies === 1) {
        welcomeText += `✅ **Điểm tích cực:** Bạn đang duy trì tập thể dục và ăn nhiều rau xanh.<br>`;
    }
    
    welcomeText += `<br>👉 Bạn có thể bấm các nút gợi ý phía dưới hoặc gõ trực tiếp bất kỳ câu hỏi nào để tôi tư vấn chuyên sâu nhé!`;
    
    addMessage(welcomeText, 'bot');
}

function addMessage(html, sender, isRawText = false) {
    const chatHistory = document.getElementById('chat-history');
    const div = document.createElement('div');
    div.className = `msg ${sender}`;
    
    let content = html;
    if (typeof marked !== 'undefined' && (isRawText || sender === 'bot')) {
        // Full Markdown parsing with marked.js
        content = marked.parse(content);
    } else {
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }
    
    div.innerHTML = content;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    
    // Save to conversation memory
    chatHistoryLog.push({
        role: sender === 'user' ? 'user' : 'assistant',
        content: div.innerText
    });
}

function showTypingIndicator() {
    const chatHistory = document.getElementById('chat-history');
    const div = document.createElement('div');
    div.className = 'msg bot typing-indicator';
    div.id = 'typing-indicator';
    div.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <em>Bác sĩ AI đang suy nghĩ và truy xuất đồ thị tri thức...</em>';
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

async function callChatAPI(userMessage) {
    showTypingIndicator();
    
    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userMessage,
                patient_data: currentInputData,
                prediction: currentPrediction,
                history: chatHistoryLog.slice(-6)
            })
        });
        
        const data = await response.json();
        removeTypingIndicator();
        
        if (data.reply) {
            addMessage(data.reply, 'bot', true);
        } else {
            fallbackLocalReply(userMessage);
        }
    } catch (err) {
        console.warn("Backend chat failed, switching to local reasoning fallback:", err);
        removeTypingIndicator();
        fallbackLocalReply(userMessage);
    }
}

document.querySelectorAll('.sugg-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const queryText = e.currentTarget.innerText;
        addMessage(queryText, 'user');
        
        if (!currentPrediction || !currentInputData) {
            setTimeout(() => addMessage("⚠️ Vui lòng điền hồ sơ bên trái và bấm **PHÂN TÍCH HỒ SƠ** trước khi hỏi bệnh nhé!", 'bot'), 300);
            return;
        }
        
        callChatAPI(queryText);
    });
});

function fallbackLocalReply(text) {
    const lower = text.toLowerCase();
    const data = currentInputData;
    const res = currentPrediction;
    const isHigh = res.prediction === 1;
    const riskPercent = Math.round(res.confidence * 100);
    
    if (lower.includes('thuốc') || lower.includes('uống gì') || lower.includes('điều trị')) {
        let reply = riskPercent >= 50
            ? `💊 **Tư vấn Phác đồ:** Bác sĩ thường chỉ định **Metformin**. Nếu có Huyết áp cao (${data.HighBP ? 'Có' : 'Không'}) hoặc Mỡ máu (${data.HighChol ? 'Có' : 'Không'}), cần phối hợp thêm ACEi/ARB và Statin. Hãy xét nghiệm HbA1c tại bệnh viện trước khi dùng thuốc.`
            : `💊 **Tư vấn Dược lý:** Nguy cơ của bạn hiện tại thấp (**${riskPercent}%**), **chưa cần dùng thuốc**. Tập trung vào dinh dưỡng và vận động.`;
        addMessage(reply, 'bot');
    } else if (lower.includes('ăn') || lower.includes('uống') || lower.includes('kiêng') || lower.includes('thực đơn')) {
        let reply = `🥗 **Dinh dưỡng:** Ưu tiên tinh bột chậm (gạo lứt, yến mạch), ăn tối thiểu 400g rau xanh mỗi ngày. Hạn chế đường tinh luyện, nước ngọt có ga và trái cây quá ngọt.`;
        addMessage(reply, 'bot');
    } else if (lower.includes('tập') || lower.includes('vận động') || lower.includes('thể dục')) {
        let reply = (data.DiffWalk === 1 || data.BMI >= 35)
            ? `🏃 **Luyện tập:** Do có khó khăn đi lại hoặc BMI lớn (${data.BMI}), nên ưu tiên bơi lội, đạp xe tại chỗ để giảm tải khớp gối.`
            : `🏃 **Luyện tập:** Duy trì tối thiểu 150 phút/tuần với các bài tập vừa sức (đi bộ nhanh, chạy nhẹ) kết hợp bài tập kháng lực.`;
        addMessage(reply, 'bot');
    } else {
        addMessage(`Bác sĩ AI đã ghi nhận câu hỏi của bạn. Dựa trên rủi ro **${riskPercent}%**, bạn có thể hỏi thêm về: **Thuốc điều trị, Thực đơn dinh dưỡng, Bài tập thể dục, Chỉ số xét nghiệm, hoặc Nguyên nhân rủi ro** nhé!`, 'bot');
    }
}

function handleChatInput() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    if (!currentPrediction || !currentInputData) {
        addMessage(text, 'user');
        input.value = '';
        setTimeout(() => addMessage("⚠️ Vui lòng điền hồ sơ bên trái và bấm **PHÂN TÍCH HỒ SƠ** trước khi hỏi bệnh nhé!", 'bot'), 300);
        return;
    }

    addMessage(text, 'user');
    input.value = '';

    callChatAPI(text);
}

document.getElementById('chat-send-btn').addEventListener('click', handleChatInput);
document.getElementById('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleChatInput(); });
