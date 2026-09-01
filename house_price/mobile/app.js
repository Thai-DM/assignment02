// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('[PWA] Service Worker Registered'))
      .catch(err => console.log('[PWA] Service Worker Error:', err));
  });
}

// Sliders and Value Display
const areaSlider = document.getElementById('area');
const areaVal = document.getElementById('areaVal');

areaSlider.addEventListener('input', (e) => {
  areaVal.textContent = `${e.target.value} m²`;
});

// Presets
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
    renderResult(result, payload);
  } catch (err) {
    console.warn('API fallback for house price demo:', err);
    // Fallback heuristic estimation
    const isCentral = ["Quận Cầu Giấy", "Quận Ba Đình", "Quận Hoàn Kiếm", "Quận Tây Hồ"].includes(payload.Quan);
    const isStreet = payload.LoaiHinhNhaO === "Nhà mặt phố, mặt tiền";
    const basePrice = isCentral ? (isStreet ? 142.8 : 95.0) : (isStreet ? 88.5 : 55.0);
    const totalM = basePrice * payload.DienTich;

    renderResult({
      predicted_price_per_m2: basePrice,
      total_estimated_billion: round(totalM / 1000, 2),
      price_category: isStreet ? "Cao cấp (100 - 180 tr/m²)" : "Trung cấp (50 - 100 tr/m²)",
      price_tier: isStreet ? "Premium" : "Mid-range"
    }, payload);
  } finally {
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
    submitBtn.disabled = false;
  }
});

function round(val, dec = 2) {
  return Number(Math.round(val + 'e' + dec) + 'e-' + dec);
}

function renderResult(data, payload) {
  const priceM2 = data.predicted_price_per_m2 || 120.0;
  const totalBillion = data.total_estimated_billion || ((priceM2 * payload.DienTich) / 1000).toFixed(2);

  document.getElementById('resPriceM2').textContent = Number(priceM2).toFixed(1);
  document.getElementById('resTotalBillion').textContent = `≈ ${Number(totalBillion).toFixed(2)} Tỷ VND`;
  document.getElementById('priceTierBadge').textContent = data.price_category || "PHÂN KHÚC TRUNG CAO CẤP";

  openSheet();
}
