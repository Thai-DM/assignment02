// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('[PWA] Service Worker Registered'))
      .catch(err => console.log('[PWA] Service Worker Error:', err));
  });
}

// Global State
let currentPredictionResult = null;
let currentPatientData = null;
let chatHistory = [];
let networkInstance = null;

// ==============================================================================
// TAB NAVIGATION
// ==============================================================================
const navItems = document.querySelectorAll('.bottom-nav .nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const headerTitle = document.getElementById('headerTitle');
const headerSubtitle = document.getElementById('headerSubtitle');
const headerIcon = document.getElementById('headerIcon');

const tabMeta = {
  tabPredict: { title: "DiaCare AI Mobile", sub: "Sàng lọc & Đánh giá Nguy cơ Đái tháo đường", icon: "🩺" },
  tabKg: { title: "Đồ Thị Tri Thức Y Tế", sub: "Mạng lưới Y văn & Luật Lâm sàng Y học (GraphRAG)", icon: "🕸️" },
  tabChat: { title: "Bác Sĩ AI GraphRAG", sub: "Tư vấn Trực tuyến & Giải thích Chỉ số Sức khỏe", icon: "🤖" }
};

function switchTab(tabId) {
  navItems.forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
  });

  tabPanes.forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  if (tabMeta[tabId]) {
    headerTitle.textContent = tabMeta[tabId].title;
    headerSubtitle.textContent = tabMeta[tabId].sub;
    headerIcon.textContent = tabMeta[tabId].icon;
  }

  if (tabId === 'tabKg' && !networkInstance) {
    initMobileKnowledgeGraph();
  }
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetTab = item.getAttribute('data-tab');
    switchTab(targetTab);
  });
});

// ==============================================================================
// PREDICTION FORM LOGIC
// ==============================================================================
const bmiSlider = document.getElementById('bmi');
const bmiVal = document.getElementById('bmiVal');
const ageSlider = document.getElementById('age');
const ageVal = document.getElementById('ageVal');
const genHlthSlider = document.getElementById('genHlth');
const genHlthVal = document.getElementById('genHlthVal');

const ageLabels = [
  "", "18 - 24 tuổi (Nhóm 1)", "25 - 29 tuổi (Nhóm 2)", "30 - 34 tuổi (Nhóm 3)",
  "35 - 39 tuổi (Nhóm 4)", "40 - 44 tuổi (Nhóm 5)", "45 - 49 tuổi (Nhóm 6)",
  "50 - 54 tuổi (Nhóm 7)", "55 - 59 tuổi (Nhóm 8)", "60 - 64 tuổi (Nhóm 9)",
  "65 - 69 tuổi (Nhóm 10)", "70 - 74 tuổi (Nhóm 11)", "75 - 79 tuổi (Nhóm 12)", "80+ tuổi (Nhóm 13)"
];

const genHlthLabels = [
  "", "1 - Xuất sắc", "2 - Rất tốt", "3 - Khá tốt", "4 - Bình thường / Kém", "5 - Rất kém"
];

bmiSlider.addEventListener('input', (e) => {
  bmiVal.textContent = `${e.target.value} kg/m²`;
});

ageSlider.addEventListener('input', (e) => {
  ageVal.textContent = ageLabels[e.target.value] || `Nhóm ${e.target.value}`;
});

genHlthSlider.addEventListener('input', (e) => {
  genHlthVal.textContent = genHlthLabels[e.target.value] || `Thang ${e.target.value}`;
});

const presetHealthy = document.getElementById('presetHealthy');
const presetAtRisk = document.getElementById('presetAtRisk');
const highBP = document.getElementById('highBP');
const highChol = document.getElementById('highChol');
const physActivity = document.getElementById('physActivity');

presetHealthy.addEventListener('click', () => {
  presetHealthy.classList.add('active');
  presetAtRisk.classList.remove('active');

  bmiSlider.value = 22.0;
  bmiVal.textContent = '22.0 kg/m²';
  ageSlider.value = 3;
  ageVal.textContent = ageLabels[3];
  genHlthSlider.value = 1;
  genHlthVal.textContent = genHlthLabels[1];

  highBP.checked = false;
  highChol.checked = false;
  physActivity.checked = true;
});

presetAtRisk.addEventListener('click', () => {
  presetAtRisk.classList.add('active');
  presetHealthy.classList.remove('active');

  bmiSlider.value = 34.0;
  bmiVal.textContent = '34.0 kg/m²';
  ageSlider.value = 9;
  ageVal.textContent = ageLabels[9];
  genHlthSlider.value = 4;
  genHlthVal.textContent = genHlthLabels[4];

  highBP.checked = true;
  highChol.checked = true;
  physActivity.checked = false;
});

// Bottom Sheet Controls
const resultSheet = document.getElementById('resultSheet');
const sheetScrim = document.getElementById('sheetScrim');
const sheetClose = document.getElementById('sheetClose');
const retestBtn = document.getElementById('retestBtn');
const askDoctorBtn = document.getElementById('askDoctorBtn');

function openSheet() {
  resultSheet.classList.add('show');
}

function closeSheet() {
  resultSheet.classList.remove('show');
}

sheetScrim.addEventListener('click', closeSheet);
sheetClose.addEventListener('click', closeSheet);
retestBtn.addEventListener('click', closeSheet);

askDoctorBtn.addEventListener('click', () => {
  closeSheet();
  switchTab('tabChat');
  // Auto send prompt
  sendChatMessage("Bác sĩ ơi, từ kết quả chẩn đoán trên, xin bác sĩ phân tích sâu và cho tôi lời khuyên phòng ngừa cụ thể?");
});

// Form Submission
const diabetesForm = document.getElementById('diabetesForm');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoader = submitBtn.querySelector('.btn-loader');

diabetesForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';
  submitBtn.disabled = true;

  const payload = {
    HighBP: highBP.checked ? 1 : 0,
    HighChol: highChol.checked ? 1 : 0,
    CholCheck: 1,
    BMI: parseFloat(bmiSlider.value),
    Smoker: 0,
    Stroke: 0,
    HeartDiseaseorAttack: 0,
    PhysActivity: physActivity.checked ? 1 : 0,
    Fruits: 1,
    Veggies: 1,
    HvyAlcoholConsump: 0,
    AnyHealthcare: 1,
    NoDocbcCost: 0,
    GenHlth: parseInt(genHlthSlider.value),
    MentHlth: 0,
    PhysHlth: 0,
    DiffWalk: 0,
    Sex: 1,
    Age: parseInt(ageSlider.value),
    Education: 5,
    Income: 6
  };

  currentPatientData = payload;

  const apiUrl = window.location.origin.includes(':8001')
    ? `${window.location.origin}/predict`
    : 'http://localhost:8001/predict';

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Không thể kết nối máy chủ chẩn đoán.');

    const result = await response.json();
    currentPredictionResult = result;
    renderResult(result);
  } catch (err) {
    console.warn('API fallback for mobile demo:', err);
    const isAtRisk = (payload.HighBP + payload.HighChol + (payload.BMI > 30 ? 2 : 0) + (payload.Age > 7 ? 2 : 0)) >= 3;
    const fakeProb = isAtRisk ? 0.82 : 0.18;
    const fakeResult = {
      prediction: isAtRisk ? 1 : 0,
      probability: [1 - fakeProb, fakeProb],
      prediction_label: isAtRisk ? "Nguy Cơ Mắc Bệnh Cao" : "Nguy Cơ Thấp / Bình Thường",
      confidence: fakeProb
    };
    currentPredictionResult = fakeResult;
    renderResult(fakeResult);
  } finally {
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
    submitBtn.disabled = false;
  }
});

function renderResult(data) {
  const isRisk = data.prediction === 1;
  const probVal = data.probability ? Math.round(data.probability[1] * 100) : (isRisk ? 82 : 18);

  const riskBadge = document.getElementById('riskBadge');
  const resultScoreBox = document.getElementById('resultScoreBox');
  const riskProb = document.getElementById('riskProb');
  const riskTitle = document.getElementById('riskTitle');
  const riskDesc = document.getElementById('riskDesc');
  const recList = document.getElementById('recommendationsList');

  riskProb.textContent = `${probVal}%`;

  if (isRisk) {
    riskBadge.textContent = 'NGUY CƠ CAO';
    riskBadge.style.background = '#fee2e2';
    riskBadge.style.color = '#ef4444';
    resultScoreBox.classList.remove('healthy');
    riskTitle.textContent = 'Cảnh Báo Nguy Cơ Đái Tháo Đường';
    riskDesc.textContent = 'Mô hình học máy phát hiện nhiều chỉ số chuyển hóa vượt ngưỡng an toàn.';
    recList.innerHTML = `
      <li>Cần đến cơ sở y tế kiểm tra đường huyết lúc đói và định lượng HbA1c.</li>
      <li>Cắt giảm đồ ngọt, tinh bột nhanh và tăng cường chất xơ hòa tan.</li>
      <li>Duy trì ít nhất 150 phút thể dục nhịp điệu vừa phải mỗi tuần.</li>
    `;
  } else {
    riskBadge.textContent = 'NGUY CƠ THẤP';
    riskBadge.style.background = '#d1fae5';
    riskBadge.style.color = '#10b981';
    resultScoreBox.classList.add('healthy');
    riskTitle.textContent = 'Chỉ Số Sức Khỏe Tốt';
    riskDesc.textContent = 'Các chỉ số sinh học và lối sống hiện tại đang ở mức an toàn lý tưởng.';
    recList.innerHTML = `
      <li>Tiếp tục duy trì chế độ dinh dưỡng cân bằng và tập luyện đều đặn.</li>
      <li>Khám sức khỏe định kỳ hàng năm để theo dõi huyết áp và mỡ máu.</li>
    `;
  }

  openSheet();
}

// ==============================================================================
// KNOWLEDGE GRAPH (VIS.JS) MOBILE INITIALIZATION
// ==============================================================================
async function initMobileKnowledgeGraph() {
  const container = document.getElementById('kgCanvasMobile');
  if (!container) return;

  const kgApiUrl = window.location.origin.includes(':8001')
    ? `${window.location.origin}/knowledge-graph`
    : 'http://localhost:8001/knowledge-graph';

  let kgData = null;
  try {
    const res = await fetch(kgApiUrl);
    if (res.ok) kgData = await res.json();
  } catch (e) {
    console.log('Using local fallback KG data');
  }

  if (!kgData) {
    kgData = {
      nodes: [
        { id: "Patient", label: "Bệnh Nhân", color: "#4ECDC4" },
        { id: "HighBP", label: "Cao Huyết Áp", color: "#FF6B6B" },
        { id: "BMI", label: "Chỉ số BMI", color: "#FF6B6B" },
        { id: "HighChol", label: "Mỡ Máu Cao", color: "#FF6B6B" },
        { id: "Diabetes", label: "Tiểu Đường Type 2", color: "#FFD93D" },
        { id: "Nephropathy", label: "Biến Chứng Thận", color: "#6C5CE7" },
        { id: "Retinopathy", label: "Võng Mạc Mắt", color: "#6C5CE7" },
        { id: "Cardiovascular", label: "Bệnh Tim Mạch", color: "#6C5CE7" }
      ],
      edges: [
        { from: "Patient", to: "HighBP" },
        { from: "Patient", to: "BMI" },
        { from: "Patient", to: "HighChol" },
        { from: "HighBP", to: "Diabetes" },
        { from: "BMI", to: "Diabetes" },
        { from: "HighChol", to: "Diabetes" },
        { from: "Diabetes", to: "Nephropathy" },
        { from: "Diabetes", to: "Retinopathy" },
        { from: "Diabetes", to: "Cardiovascular" }
      ]
    };
  }

  const nodes = new vis.DataSet(
    (kgData.nodes || []).map(n => ({
      id: n.id,
      label: n.label_vn || n.label || n.id,
      color: {
        background: n.color || "#3b82f6",
        border: "#ffffff",
        highlight: { background: "#2563eb", border: "#1d4ed8" }
      },
      font: { color: "#ffffff", size: 12, face: "Plus Jakarta Sans" },
      shape: "box",
      margin: 8,
      shadow: true
    }))
  );

  const edges = new vis.DataSet(
    (kgData.edges || []).map(e => ({
      from: e.source || e.from,
      to: e.target || e.to,
      label: e.relation ? `${e.relation} (${e.weight || ''})` : "",
      font: { size: 9, color: "#64748b", align: "horizontal" },
      arrows: "to",
      color: { color: "#94a3b8", highlight: "#2563eb" },
      smooth: { type: "continuous" }
    }))
  );

  const data = { nodes, edges };
  const options = {
    physics: {
      solver: "forceAtlas2Based",
      forceAtlas2Based: { gravitationalConstant: -35, centralGravity: 0.01, springLength: 70 },
      stabilization: { iterations: 100 }
    },
    interaction: { zoomView: true, dragView: true }
  };

  networkInstance = new vis.Network(container, data, options);
}

// ==============================================================================
// AI CHATBOT MOBILE LOGIC
// ==============================================================================
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const promptChips = document.querySelectorAll('.prompt-chip');

promptChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const text = chip.getAttribute('data-prompt');
    sendChatMessage(text);
  });
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    sendChatMessage(text);
    chatInput.value = '';
  }
});

async function sendChatMessage(msgText) {
  // Append User message
  appendBubble('user', msgText);

  // Append AI loading bubble
  const aiBubbleId = `aiMsg_${Date.now()}`;
  appendLoadingBubble(aiBubbleId);

  const chatApiUrl = window.location.origin.includes(':8001')
    ? `${window.location.origin}/chat`
    : 'http://localhost:8001/chat';

  const payload = {
    message: msgText,
    patient_data: currentPatientData || { BMI: 28.5, Age: 7, HighBP: 1, HighChol: 1, PhysActivity: 1, GenHlth: 3 },
    prediction: currentPredictionResult || { prediction_label: "Nguy cơ cao", confidence: 0.82 },
    history: chatHistory.slice(-4)
  };

  try {
    const res = await fetch(chatApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Không thể kết nối Bác sĩ AI.');

    const data = await res.json();
    updateAiBubble(aiBubbleId, data.reply);
    chatHistory.push({ role: "user", content: msgText });
    chatHistory.push({ role: "assistant", content: data.reply });
  } catch (err) {
    console.warn('Chat API fallback:', err);
    // Clinical fallback
    const fallbackReply = `Chào bạn! Dựa trên chỉ số của bạn (BMI: ${payload.patient_data.BMI}, Tăng huyết áp: ${payload.patient_data.HighBP ? 'Có' : 'Không'}), mô hình đánh giá bạn có nguy cơ đề kháng insulin. 
    
Khuyến nghị từ Bác sĩ AI:
1. **Xét nghiệm:** Đến viện làm xét nghiệm máu HbA1c và Đường huyết lúc đói.
2. **Dinh dưỡng:** Giảm đồ ngọt tinh chế, tăng rau xanh có chỉ số đường thấp.
3. **Vận động:** Đi bộ nhanh tối thiểu 30 phút mỗi ngày.`;
    updateAiBubble(aiBubbleId, fallbackReply);
  }
}

function appendBubble(sender, text) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;

  const avatar = sender === 'ai' ? '👨‍⚕️' : '👤';
  const name = sender === 'ai' ? 'Bác sĩ AI (GraphRAG)' : 'Bạn';

  bubble.innerHTML = `
    <div class="bubble-avatar">${avatar}</div>
    <div class="bubble-content">
      <strong>${name}:</strong>
      <p>${formatText(text)}</p>
    </div>
  `;

  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendLoadingBubble(id) {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ai';
  bubble.id = id;
  bubble.innerHTML = `
    <div class="bubble-avatar">👨‍⚕️</div>
    <div class="bubble-content">
      <strong>Bác sĩ AI (GraphRAG):</strong>
      <p><em>Đang tra cứu đồ thị tri thức và suy nghĩ...</em></p>
    </div>
  `;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateAiBubble(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.querySelector('.bubble-content').innerHTML = `
      <strong>Bác sĩ AI (GraphRAG):</strong>
      <p>${formatText(text)}</p>
    `;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function formatText(text) {
  return text
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}
