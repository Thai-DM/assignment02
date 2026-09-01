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
let currentPropertyData = null;
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
  tabValuation: { title: "HanoiHome Mobile", sub: "Thẩm định & Dự toán Giá Nhà đất Hà Nội", icon: "🏡" },
  tabKg: { title: "Đồ Thị Tri Thức BĐS", sub: "Mạng lưới Hạ tầng, Metro & Đầu tư (GraphRAG)", icon: "🏙️" },
  tabChat: { title: "Chuyên Gia BĐS AI", sub: "Tư vấn Đầu tư, Dòng tiền & Pháp lý Quy hoạch", icon: "🤖" }
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
// VALUATION FORM LOGIC
// ==============================================================================
const areaSlider = document.getElementById('area');
const areaVal = document.getElementById('areaVal');

areaSlider.addEventListener('input', (e) => {
  areaVal.textContent = `${e.target.value} m²`;
});

const presetTownhouse = document.getElementById('presetTownhouse');
const presetAlley = document.getElementById('presetAlley');
const districtSelect = document.getElementById('districtSelect');
const propTypeSelect = document.getElementById('propTypeSelect');
const legalSelect = document.getElementById('legalSelect');
const floorsInput = document.getElementById('floors');
const bedroomsInput = document.getElementById('bedrooms');
const widthInput = document.getElementById('width');
const lengthInput = document.getElementById('length');

presetTownhouse.addEventListener('click', () => {
  presetTownhouse.classList.add('active');
  presetAlley.classList.remove('active');

  districtSelect.value = "Quận Cầu Giấy";
  propTypeSelect.value = "Nhà mặt phố, mặt tiền";
  legalSelect.value = "Đã có sổ";
  areaSlider.value = 80;
  areaVal.textContent = "80 m²";
  floorsInput.value = 4;
  bedroomsInput.value = 4;
  widthInput.value = 5.0;
  lengthInput.value = 16.0;
});

presetAlley.addEventListener('click', () => {
  presetAlley.classList.add('active');
  presetTownhouse.classList.remove('active');

  districtSelect.value = "Quận Hà Đông";
  propTypeSelect.value = "Nhà ngõ, hẻm";
  legalSelect.value = "Đã có sổ";
  areaSlider.value = 45;
  areaVal.textContent = "45 m²";
  floorsInput.value = 3;
  bedroomsInput.value = 3;
  widthInput.value = 3.8;
  lengthInput.value = 12.0;
});

// Bottom Sheet Handlers
const resultSheet = document.getElementById('resultSheet');
const sheetScrim = document.getElementById('sheetScrim');
const sheetClose = document.getElementById('sheetClose');
const retestBtn = document.getElementById('retestBtn');
const askAdvisorBtn = document.getElementById('askAdvisorBtn');

function openSheet() {
  resultSheet.classList.add('show');
}

function closeSheet() {
  resultSheet.classList.remove('show');
}

sheetScrim.addEventListener('click', closeSheet);
sheetClose.addEventListener('click', closeSheet);
retestBtn.addEventListener('click', closeSheet);

askAdvisorBtn.addEventListener('click', () => {
  closeSheet();
  switchTab('tabChat');
  sendChatMessage("Chuyên gia ơi, với căn nhà định giá như trên, tôi nên đầu tư cho thuê hay lướt sóng? Tiềm năng tăng giá ra sao?");
});

// Form Submission & API Call
const houseForm = document.getElementById('houseForm');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoader = submitBtn.querySelector('.btn-loader');

houseForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';
  submitBtn.disabled = true;

  const payload = {
    Quan: districtSelect.value,
    Huyen: "Phường Dịch Vọng",
    LoaiHinhNhaO: propTypeSelect.value,
    GiayToPhaply: legalSelect.value,
    SoTang: parseFloat(floorsInput.value),
    SoPhongNgu: parseFloat(bedroomsInput.value),
    DienTich: parseFloat(areaSlider.value),
    Dai: parseFloat(lengthInput.value),
    Rong: parseFloat(widthInput.value)
  };

  currentPropertyData = payload;

  const apiUrl = window.location.origin.includes(':8002')
    ? `${window.location.origin}/predict`
    : 'http://localhost:8002/predict';

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Không thể kết nối API định giá BĐS.');

    const result = await response.json();
    currentPredictionResult = result;
    renderResult(result, payload);
  } catch (err) {
    console.warn('API fallback for house price demo:', err);
    const isCentral = ["Quận Cầu Giấy", "Quận Ba Đình", "Quận Hoàn Kiếm", "Quận Tây Hồ"].includes(payload.Quan);
    const isStreet = payload.LoaiHinhNhaO === "Nhà mặt phố, mặt tiền";
    const basePrice = isCentral ? (isStreet ? 142.8 : 95.0) : (isStreet ? 88.5 : 55.0);
    const totalM = basePrice * payload.DienTich;

    const fakeResult = {
      predicted_price_per_m2: basePrice,
      total_estimated_billion: (totalM / 1000).toFixed(2),
      price_category: isStreet ? "Cao cấp (100 - 180 tr/m²)" : "Trung cấp (50 - 100 tr/m²)"
    };
    currentPredictionResult = fakeResult;
    renderResult(fakeResult, payload);
  } finally {
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
    submitBtn.disabled = false;
  }
});

function renderResult(data, payload) {
  const priceM2 = data.predicted_price_per_m2 || 120.0;
  const totalBillion = data.total_estimated_billion || ((priceM2 * payload.DienTich) / 1000).toFixed(2);

  document.getElementById('resPriceM2').textContent = Number(priceM2).toFixed(1);
  document.getElementById('resTotalBillion').textContent = `≈ ${Number(totalBillion).toFixed(2)} Tỷ VND`;
  document.getElementById('priceTierBadge').textContent = data.price_category || "PHÂN KHÚC CAO CẤP";

  openSheet();
}

// ==============================================================================
// VIS.JS KNOWLEDGE GRAPH MOBILE
// ==============================================================================
async function initMobileKnowledgeGraph() {
  const container = document.getElementById('kgCanvasMobile');
  if (!container) return;

  const kgApiUrl = window.location.origin.includes(':8002')
    ? `${window.location.origin}/knowledge-graph`
    : 'http://localhost:8002/knowledge-graph';

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
        { id: "Property", label: "BĐS Mục Tiêu", color: "#4ECDC4" },
        { id: "Location", label: "Vị Trí Vùng", color: "#45B7D1" },
        { id: "CentralDistrict", label: "Quận Lõi Đô Thị", color: "#FF7675" },
        { id: "SuburbanDistrict", label: "Khu Vực Ven Đô", color: "#74B9FF" },
        { id: "StreetFrontage", label: "Nhà Mặt Phố", color: "#FD79A8" },
        { id: "Villa", label: "Biệt Thự Liền Kề", color: "#FDCB6E" },
        { id: "MetroLine", label: "Tuyến Metro", color: "#A29BFE" },
        { id: "CapitalGain", label: "Tăng Giá Vốn", color: "#2ED573" }
      ],
      edges: [
        { from: "Property", to: "Location" },
        { from: "Location", to: "CentralDistrict" },
        { from: "Location", to: "SuburbanDistrict" },
        { from: "Property", to: "StreetFrontage" },
        { from: "SuburbanDistrict", to: "MetroLine" },
        { from: "MetroLine", to: "CapitalGain" }
      ]
    };
  }

  const nodes = new vis.DataSet(
    (kgData.nodes || []).map(n => ({
      id: n.id,
      label: n.label_vn || n.label || n.id,
      color: {
        background: n.color || "#d97706",
        border: "#ffffff",
        highlight: { background: "#b45309", border: "#78350f" }
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
      font: { size: 9, color: "#78716c", align: "horizontal" },
      arrows: "to",
      color: { color: "#a8a29e", highlight: "#d97706" },
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
// AI CHATBOT ADVISOR LOGIC
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
  appendBubble('user', msgText);

  const aiBubbleId = `aiMsg_${Date.now()}`;
  appendLoadingBubble(aiBubbleId);

  const chatApiUrl = window.location.origin.includes(':8002')
    ? `${window.location.origin}/chat`
    : 'http://localhost:8002/chat';

  const payload = {
    message: msgText,
    property_data: currentPropertyData || { Quan: "Quận Cầu Giấy", LoaiHinhNhaO: "Nhà mặt phố, mặt tiền", DienTich: 80, SoTang: 4 },
    prediction: currentPredictionResult || { predicted_price_per_m2: 142.8, total_estimated_billion: 11.42, price_category: "Cao cấp" },
    history: chatHistory.slice(-4)
  };

  try {
    const res = await fetch(chatApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Không thể kết nối Chuyên gia BĐS.');

    const data = await res.json();
    updateAiBubble(aiBubbleId, data.reply);
    chatHistory.push({ role: "user", content: msgText });
    chatHistory.push({ role: "assistant", content: data.reply });
  } catch (err) {
    console.warn('Chat API fallback:', err);
    const fallbackReply = `Chào Nhà đầu tư! Với BĐS ${payload.property_data.Quan}, diện tích ${payload.property_data.DienTich}m² và đơn giá ước tính ${payload.prediction.predicted_price_per_m2} tr/m²:

1. **Dòng tiền cho thuê:** Khu vực mặt phố có thể khai thác kinh doanh với tỷ suất lợi nhuận đạt từ 35-50 triệu/tháng.
2. **Tiềm năng tăng giá:** Hưởng lợi từ quy hoạch lõi đô thị mở rộng, thanh khoản luôn ở mức cao.
3. **Lưu ý thực địa:** Cần kiểm tra kỹ quy hoạch chỉ giới đường đỏ và mật độ xây dựng tại Sở TN&MT trước khi cọc.`;
    updateAiBubble(aiBubbleId, fallbackReply);
  }
}

function appendBubble(sender, text) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;

  const avatar = sender === 'ai' ? '🏢' : '👤';
  const name = sender === 'ai' ? 'Chuyên Gia BĐS AI (GraphRAG)' : 'Bạn';

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
    <div class="bubble-avatar">🏢</div>
    <div class="bubble-content">
      <strong>Chuyên Gia BĐS AI (GraphRAG):</strong>
      <p><em>Đang tra cứu thị trường và phân tích dòng tiền...</em></p>
    </div>
  `;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateAiBubble(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.querySelector('.bubble-content').innerHTML = `
      <strong>Chuyên Gia BĐS AI (GraphRAG):</strong>
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
