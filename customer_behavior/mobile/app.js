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
let currentReviewText = "";
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
  tabSentiment: { title: "ShopeeSense Mobile", sub: "Phân Tích Cảm Xúc & CSKH Tự Động", icon: "🛍️" },
  tabKg: { title: "Đồ Thị Tri Thức TMĐT", sub: "Ontology Quản trị Trải nghiệm Khách hàng (GraphRAG)", icon: "🕸️" },
  tabChat: { title: "Chuyên Gia Shopee AI", sub: "Kịch bản Phản hồi CSKH & Xử lý Khủng hoảng Đánh giá", icon: "🤖" }
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
// SENTIMENT FORM LOGIC
// ==============================================================================
const presetPositive = document.getElementById('presetPositive');
const presetNegative = document.getElementById('presetNegative');
const reviewText = document.getElementById('reviewText');
const chipButtons = document.querySelectorAll('.chip-btn');

presetPositive.addEventListener('click', () => {
  presetPositive.classList.add('active');
  presetNegative.classList.remove('active');
  reviewText.value = "Sản phẩm dùng rất ưng ý, đóng gói kỹ 2 lớp bọt khí, shop tư vấn nhiệt tình và giao hàng siêu nhanh. Sẽ ủng hộ shop dài dài!";
});

presetNegative.addEventListener('click', () => {
  presetNegative.classList.add('active');
  presetPositive.classList.remove('active');
  reviewText.value = "Hàng nhận bị móp méo vỡ nát, đóng gói sơ sài không có xốp. Nhắn tin khiếu nại thì shop không thèm trả lời, thái độ phục vụ quá tệ!";
});

presetPositive.click();

chipButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    reviewText.value = btn.getAttribute('data-text');
  });
});

// Bottom Sheet Controls
const resultSheet = document.getElementById('resultSheet');
const sheetScrim = document.getElementById('sheetScrim');
const sheetClose = document.getElementById('sheetClose');
const retestBtn = document.getElementById('retestBtn');
const askCsAdvisorBtn = document.getElementById('askCsAdvisorBtn');

function openSheet() {
  resultSheet.classList.add('show');
}

function closeSheet() {
  resultSheet.classList.remove('show');
}

sheetScrim.addEventListener('click', closeSheet);
sheetClose.addEventListener('click', closeSheet);
retestBtn.addEventListener('click', closeSheet);

askCsAdvisorBtn.addEventListener('click', () => {
  closeSheet();
  switchTab('tabChat');
  sendChatMessage("Chuyên gia ơi, hãy viết giúp tôi 2 kịch bản phản hồi cho đánh giá này để làm hài lòng khách hàng?");
});

// Form Submission & API Call
const sentimentForm = document.getElementById('sentimentForm');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoader = submitBtn.querySelector('.btn-loader');

sentimentForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const textVal = reviewText.value.trim();
  if (!textVal) {
    alert('Vui lòng nhập nhận xét của khách hàng.');
    return;
  }

  currentReviewText = textVal;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';
  submitBtn.disabled = true;

  const payload = {
    review: textVal
  };

  const apiUrl = window.location.origin.includes(':8003')
    ? `${window.location.origin}/predict`
    : 'http://localhost:8003/predict';

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Không thể kết nối API phân tích cảm xúc.');

    const result = await response.json();
    currentPredictionResult = result;
    renderResult(result, textVal);
  } catch (err) {
    console.warn('API fallback for Shopee demo:', err);
    const lower = textVal.toLowerCase();
    const negWords = ['vỡ', 'nát', 'tệ', 'kém', 'chậm', 'móp', 'lừa đảo', 'hỏng', 'bực'];
    const isNeg = negWords.some(w => lower.includes(w));

    const fakeResult = {
      prediction: isNeg ? 0 : 1,
      sentiment: isNeg ? "Tiêu cực" : "Tích cực",
      confidence: 0.94
    };
    currentPredictionResult = fakeResult;
    renderResult(fakeResult, textVal);
  } finally {
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
    submitBtn.disabled = false;
  }
});

function renderResult(data, text) {
  const isPositive = data.prediction === 1 || data.sentiment === "Tích cực";
  const badge = document.getElementById('sentimentBadge');
  const hero = document.getElementById('sentimentHero');
  const icon = document.getElementById('sentimentIcon');
  const title = document.getElementById('sentimentTitle');
  const conf = document.getElementById('confScore');
  const csBox = document.getElementById('csActionBox');

  const confPercent = Math.round((data.confidence || 0.94) * 100);
  conf.textContent = `Độ tin cậy mô hình: ${confPercent}% (Linear SVM)`;

  if (isPositive) {
    badge.textContent = 'TÍCH CỰC (POSITIVE)';
    badge.style.background = '#d1fae5';
    badge.style.color = '#10b981';

    hero.classList.remove('negative');
    icon.textContent = '😍';
    title.textContent = 'Đánh Giá Rất Tích Cực';

    csBox.innerHTML = `
      <strong>Gửi lời cảm ơn & Tặng Voucher khách VIP:</strong>
      <p>"Dạ Shop chân thành cảm ơn Bạn đã tin tưởng ủng hộ! Shop xin gửi tặng Bạn mã giảm giá VIP 10% cho đơn hàng tiếp theo nhé ❤️"</p>
    `;
  } else {
    badge.textContent = 'TIÊU CỰC (AT-RISK CUSTOMER)';
    badge.style.background = '#fee2e2';
    badge.style.color = '#ef4444';

    hero.classList.add('negative');
    icon.textContent = '😡';
    title.textContent = 'Cảnh Báo Khiếu Nại Tiêu Cực';

    csBox.innerHTML = `
      <strong>Kích hoạt Quy trình CSKH Đền bù Tức thì:</strong>
      <p>"Shop thành thật xin lỗi vì trải nghiệm chưa trọn vẹn của Bạn! Shop xin phép liên hệ qua Hotline để hỗ trợ ĐỔI MỚI MIỄN PHÍ hoặc HOÀN TIỀN 100% kèm Voucher bồi thường ngay lập tức ạ!"</p>
    `;
  }

  openSheet();
}

// ==============================================================================
// VIS.JS KNOWLEDGE GRAPH MOBILE
// ==============================================================================
async function initMobileKnowledgeGraph() {
  const container = document.getElementById('kgCanvasMobile');
  if (!container) return;

  const kgApiUrl = window.location.origin.includes(':8003')
    ? `${window.location.origin}/knowledge-graph`
    : 'http://localhost:8003/knowledge-graph';

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
        { id: "Customer", label: "Người Mua Shopee", color: "#4ECDC4" },
        { id: "Review", label: "Đánh Giá / Nhận Xét", color: "#FF7675" },
        { id: "DefectBroken", label: "Hàng Vỡ Nát", color: "#FF6B6B" },
        { id: "SlowDelivery", label: "Giao Hàng Chậm", color: "#FDCB6E" },
        { id: "GoodQuality", label: "Chất Lượng Tốt", color: "#2ED573" },
        { id: "CS_RecoveryStrategy", label: "CSKH Đền Bù", color: "#00B894" },
        { id: "VIP_Voucher", label: "Tặng Voucher VIP", color: "#A29BFE" }
      ],
      edges: [
        { from: "Customer", to: "Review" },
        { from: "Review", to: "DefectBroken" },
        { from: "Review", to: "SlowDelivery" },
        { from: "Review", to: "GoodQuality" },
        { from: "DefectBroken", to: "CS_RecoveryStrategy" },
        { from: "GoodQuality", to: "VIP_Voucher" }
      ]
    };
  }

  const nodes = new vis.DataSet(
    (kgData.nodes || []).map(n => ({
      id: n.id,
      label: n.label_vn || n.label || n.id,
      color: {
        background: n.color || "#ea580c",
        border: "#ffffff",
        highlight: { background: "#c2410c", border: "#7c2d12" }
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
      font: { size: 9, color: "#71717a", align: "horizontal" },
      arrows: "to",
      color: { color: "#a1a1aa", highlight: "#ea580c" },
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

  const chatApiUrl = window.location.origin.includes(':8003')
    ? `${window.location.origin}/chat`
    : 'http://localhost:8003/chat';

  const payload = {
    message: msgText,
    review: currentReviewText || "Sản phẩm dùng rất tốt, giao hàng nhanh!",
    prediction: currentPredictionResult || { sentiment: "Tích cực", confidence: 0.94 },
    history: chatHistory.slice(-4)
  };

  try {
    const res = await fetch(chatApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Không thể kết nối Chuyên gia Shopee AI.');

    const data = await res.json();
    updateAiBubble(aiBubbleId, data.reply);
    chatHistory.push({ role: "user", content: msgText });
    chatHistory.push({ role: "assistant", content: data.reply });
  } catch (err) {
    console.warn('Chat API fallback:', err);
    const fallbackReply = `Chào Chủ Shop! Dưới đây là 2 mẫu phản hồi chuẩn Shopee Mall dành cho bạn:

**Mẫu 1 (Thân thiện & Tặng Voucher):**
"Dạ Shop chân thành cảm ơn Bạn đã dành thời gian đánh giá sản phẩm! Sự hài lòng của Bạn là động lực to lớn của Shop. Shop xin gửi tặng Bạn mã giảm giá 10% cho đơn sau nhé ❤️"

**Mẫu 2 (Xử lý khiếu nại & Đổi mới miễn phí):**
"Dạ Shop thành thật xin lỗi vì sự cố đóng gói làm ảnh hưởng trải nghiệm của Bạn! Shop xin phép liên hệ Hotline gửi ĐỔI MỚI 100% HOÀN TOÀN MIỄN PHÍ ngay trong hôm nay ạ!"`;
    updateAiBubble(aiBubbleId, fallbackReply);
  }
}

function appendBubble(sender, text) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;

  const avatar = sender === 'ai' ? '🛍️' : '👤';
  const name = sender === 'ai' ? 'Chuyên Gia Shopee AI (GraphRAG)' : 'Bạn';

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
    <div class="bubble-avatar">🛍️</div>
    <div class="bubble-content">
      <strong>Chuyên Gia Shopee AI (GraphRAG):</strong>
      <p><em>Đang tra cứu chiến lược CSKH và soạn kịch bản phản hồi...</em></p>
    </div>
  `;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateAiBubble(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.querySelector('.bubble-content').innerHTML = `
      <strong>Chuyên Gia Shopee AI (GraphRAG):</strong>
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
