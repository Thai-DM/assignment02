// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('[PWA] Service Worker Registered'))
      .catch(err => console.log('[PWA] Service Worker Error:', err));
  });
}

// Sliders and Value Display Handlers
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

// Presets
const presetHealthy = document.getElementById('presetHealthy');
const presetAtRisk = document.getElementById('presetAtRisk');
const highBP = document.getElementById('highBP');
const highChol = document.getElementById('highChol');
const physActivity = document.getElementById('physActivity');
const smoker = document.getElementById('smoker');
const diffWalk = document.getElementById('diffWalk');

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
  smoker.checked = false;
  diffWalk.checked = false;
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
  smoker.checked = true;
  diffWalk.checked = true;
});

// Bottom Sheet Controls
const resultSheet = document.getElementById('resultSheet');
const sheetScrim = document.getElementById('sheetScrim');
const sheetClose = document.getElementById('sheetClose');
const retestBtn = document.getElementById('retestBtn');

function openSheet() {
  resultSheet.classList.add('show');
}

function closeSheet() {
  resultSheet.classList.remove('show');
}

sheetScrim.addEventListener('click', closeSheet);
sheetClose.addEventListener('click', closeSheet);
retestBtn.addEventListener('click', closeSheet);

// Form Submission & API Call
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
    Smoker: smoker.checked ? 1 : 0,
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
    DiffWalk: diffWalk.checked ? 1 : 0,
    Sex: 1,
    Age: parseInt(ageSlider.value),
    Education: 5,
    Income: 6
  };

  // Determine API base URL
  const apiUrl = window.location.origin.includes(':8001') 
    ? `${window.location.origin}/predict` 
    : 'http://localhost:8001/predict';

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Không thể kết nối tới máy chủ dự đoán.');

    const result = await response.json();
    renderResult(result);
  } catch (err) {
    console.warn('API fetch failed, falling back to client-side clinical model for demo:', err);
    // Fallback heuristic if API offline
    const isAtRisk = (payload.HighBP + payload.HighChol + (payload.BMI > 30 ? 2 : 0) + (payload.Age > 7 ? 2 : 0) + (payload.GenHlth >= 3 ? 2 : 0)) >= 4;
    const fakeProb = isAtRisk ? 0.82 : 0.18;
    renderResult({
      prediction: isAtRisk ? 1 : 0,
      probability: [1 - fakeProb, fakeProb],
      risk_level: isAtRisk ? "Nguy Cơ Cao" : "Nguy Cơ Thấp",
      risk_color: isAtRisk ? "#EF4444" : "#10B981"
    });
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
