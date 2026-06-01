import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAtPU5Dsf5opwqlOUVn6QzKVJ1JTNhYfzM',
  authDomain: 'medical-logistics-system-dc1cd.firebaseapp.com',
  projectId: 'medical-logistics-system-dc1cd',
  storageBucket: 'medical-logistics-system-dc1cd.firebasestorage.app',
  messagingSenderId: '642469138148',
  appId: '1:642469138148:web:4aac96ce35d32d8132a6f1',
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const COL_APPLICATIONS = collection(db, 'applications');

// ── Districts ─────────────────────────────────────────
const DISTRICTS = {
  "台北市":["中正區","大同區","中山區","松山區","大安區","萬華區","信義區","士林區","北投區","內湖區","南港區","文山區"],
  "新北市":["板橋區","三重區","中和區","永和區","新莊區","新店區","樹林區","鶯歌區","三峽區","淡水區","汐止區","瑞芳區","土城區","蘆洲區","五股區","泰山區","林口區","深坑區","石碇區","坪林區","三芝區","石門區","八里區","平溪區","雙溪區","貢寮區","金山區","萬里區","烏來區"],
  "基隆市":["仁愛區","信義區","中正區","中山區","安樂區","暖暖區","七堵區"],
  "桃園市":["桃園區","中壢區","平鎮區","八德區","楊梅區","蘆竹區","大溪區","龍潭區","龜山區","大園區","觀音區","新屋區","復興區"],
  "新竹市":["東區","北區","香山區"],
  "新竹縣":["竹北市","竹東鎮","新埔鎮","關西鎮","湖口鄉","新豐鄉","峨眉鄉","寶山鄉","北埔鄉","橫山鄉","芎林鄉","尖石鄉","五峰鄉"],
  "苗栗縣":["苗栗市","頭份市","竹南鎮","後龍鎮","通霄鎮","苑裡鎮","造橋鄉","西湖鄉","頭屋鄉","公館鄉","銅鑼鄉","三義鄉","三灣鄉","南庄鄉","大湖鄉","獅潭鄉","泰安鄉"],
  "台中市":["中區","東區","南區","西區","北區","西屯區","南屯區","北屯區","豐原區","東勢區","大甲區","清水區","沙鹿區","梧棲區","后里區","神岡區","潭子區","大雅區","新社區","石岡區","外埔區","大安區","烏日區","大肚區","龍井區","霧峰區","太平區","大里區","和平區"],
  "彰化縣":["彰化市","鹿港鎮","和美鎮","線西鄉","伸港鄉","福興鄉","秀水鄉","花壇鄉","芬園鄉","員林市","溪湖鎮","田中鎮","大村鄉","埔鹽鄉","埔心鄉","永靖鄉","社頭鄉","二水鄉","北斗鎮","二林鎮","田尾鄉","埤頭鄉","芳苑鄉","大城鄉","竹塘鄉","溪州鄉"],
  "南投縣":["南投市","埔里鎮","草屯鎮","竹山鎮","集集鎮","名間鄉","鹿谷鄉","中寮鄉","魚池鄉","國姓鄉","水里鄉","信義鄉","仁愛鄉"],
  "雲林縣":["斗六市","斗南鎮","虎尾鎮","西螺鎮","土庫鎮","北港鎮","古坑鄉","大埤鄉","莿桐鄉","林內鄉","二崙鄉","崙背鄉","麥寮鄉","東勢鄉","褒忠鄉","臺西鄉","元長鄉","四湖鄉","口湖鄉","水林鄉"],
  "嘉義市":["東區","西區"],
  "嘉義縣":["太保市","朴子市","布袋鎮","大林鎮","民雄鄉","溪口鄉","新港鄉","六腳鄉","東石鄉","義竹鄉","鹿草鄉","水上鄉","中埔鄉","竹崎鄉","梅山鄉","番路鄉","大埔鄉","阿里山鄉"],
  "台南市":["中西區","東區","南區","北區","安平區","安南區","永康區","歸仁區","新化區","左鎮區","玉井區","楠西區","南化區","仁德區","關廟區","龍崎區","官田區","麻豆區","佳里區","西港區","七股區","將軍區","學甲區","北門區","新營區","後壁區","白河區","東山區","六甲區","下營區","柳營區","鹽水區","善化區","大內區","山上區","新市區","安定區"],
  "高雄市":["新興區","前金區","苓雅區","鹽埕區","鼓山區","旗津區","前鎮區","三民區","楠梓區","小港區","左營區","仁武區","大社區","岡山區","路竹區","阿蓮區","田寮區","燕巢區","橋頭區","梓官區","彌陀區","永安區","湖內區","鳳山區","大寮區","林園區","鳥松區","大樹區","旗山區","美濃區","六龜區","內門區","杉林區","甲仙區","桃源區","那瑪夏區","茂林區","茄萣區"],
  "屏東縣":["屏東市","潮州鎮","東港鎮","恆春鎮","萬丹鄉","長治鄉","麟洛鄉","九如鄉","里港鄉","鹽埔鄉","高樹鄉","萬巒鄉","內埔鄉","竹田鄉","新埤鄉","枋寮鄉","新園鄉","崁頂鄉","林邊鄉","南州鄉","佳冬鄉","琉球鄉","車城鄉","滿州鄉","枋山鄉","三地門鄉","霧台鄉","瑪家鄉","泰武鄉","來義鄉","春日鄉","獅子鄉","牡丹鄉"],
  "宜蘭縣":["宜蘭市","羅東鎮","蘇澳鎮","頭城鎮","礁溪鄉","壯圍鄉","員山鄉","冬山鄉","五結鄉","三星鄉","大同鄉","南澳鄉"],
  "花蓮縣":["花蓮市","鳳林鎮","玉里鎮","新城鄉","吉安鄉","壽豐鄉","光復鄉","豐濱鄉","瑞穗鄉","富里鄉","秀林鄉","萬榮鄉","卓溪鄉"],
  "台東縣":["台東市","成功鎮","關山鎮","長濱鄉","海端鄉","池上鄉","東河鄉","鹿野鄉","卑南鄉","大武鄉","太麻里鄉","金峰鄉","達仁鄉","綠島鄉","蘭嶼鄉","延平鄉"],
  "澎湖縣":["馬公市","湖西鄉","白沙鄉","西嶼鄉","望安鄉","七美鄉"],
  "金門縣":["金城鎮","金湖鎮","金沙鎮","金寧鄉","烈嶼鄉","烏坵鄉"],
  "連江縣":["南竿鄉","北竿鄉","莒光鄉","東引鄉"],
};

// ── City/District cascade ─────────────────────────────
function initCity(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  Object.keys(DISTRICTS).forEach(c => {
    const o = document.createElement('option');
    o.value = o.textContent = c;
    sel.appendChild(o);
  });
}
function updateDistrict(cityId, distId, selected = '') {
  const city = document.getElementById(cityId)?.value || '';
  const sel  = document.getElementById(distId);
  if (!sel) return;
  const list = city ? (DISTRICTS[city] || []) : [];
  sel.disabled = list.length === 0;
  sel.innerHTML = list.length === 0
    ? '<option value="">請先選縣市</option>'
    : '<option value="">請選擇鄉鎮市區</option>' + list.map(d =>
        `<option${d === selected ? ' selected' : ''}>${d}</option>`).join('');
}

['f-addrCity','f-curCity'].forEach(initCity);
document.getElementById('f-addrCity').addEventListener('change', () => updateDistrict('f-addrCity','f-addrDistrict'));
document.getElementById('f-curCity').addEventListener('change',  () => updateDistrict('f-curCity','f-curDistrict'));

// Same-address checkbox
document.getElementById('f-sameAddr').addEventListener('change', function () {
  document.getElementById('currentAddrFields').style.display = this.checked ? 'none' : '';
});

// ── Family members ────────────────────────────────────
const FM_RELATIONS = ['父','母','配偶','兄','弟','姊','妹','祖父','祖母','外祖父','外祖母','子','女','其他'];
let fmCount = 0;

function addFamilyMember(data = {}) {
  fmCount++;
  const id = fmCount;
  const row = document.createElement('div');
  row.className = 'fm-row';
  row.dataset.id = id;
  row.innerHTML = `
    <select class="fm-rel" title="稱謂">
      <option value="">稱謂</option>
      ${FM_RELATIONS.map(r => `<option${r === data.relation ? ' selected' : ''}>${r}</option>`).join('')}
    </select>
    <input class="fm-name" type="text" placeholder="姓名" value="${data.name || ''}" title="姓名">
    <input class="fm-age" type="number" min="0" max="120" placeholder="年齡" value="${data.age || ''}" title="年齡">
    <input class="fm-job" type="text" placeholder="職業" value="${data.job || ''}" title="職業">
    <input class="fm-phone" type="tel" placeholder="電話" value="${data.phone || ''}" title="電話">
    <button type="button" class="fm-del" title="移除">✕</button>
  `;
  row.querySelector('.fm-del').addEventListener('click', () => row.remove());
  document.getElementById('fm-list').appendChild(row);
}

document.getElementById('addFmBtn').addEventListener('click', () => addFamilyMember());

// Pre-add 3 blank members
addFamilyMember({ relation: '父' });
addFamilyMember({ relation: '母' });
addFamilyMember({ relation: '配偶' });

// ── Friends / close contacts ──────────────────────────
let frCount = 0;

function addFriend(data = {}) {
  frCount++;
  const id = frCount;
  const row = document.createElement('div');
  row.className = 'fr-row';
  row.dataset.id = id;
  row.innerHTML = `
    <input class="fr-rel" type="text" placeholder="稱謂（女友/好友/同學…）" value="${data.relation || ''}" title="稱謂">
    <input class="fr-name" type="text" placeholder="姓名" value="${data.name || ''}" title="姓名">
    <input class="fr-age" type="number" min="0" max="120" placeholder="年齡" value="${data.age || ''}" title="年齡">
    <input class="fr-job" type="text" placeholder="職業" value="${data.job || ''}" title="職業">
    <input class="fr-phone" type="tel" placeholder="電話" value="${data.phone || ''}" title="電話">
    <input class="fr-meet" type="text" placeholder="如何認識/常去處所" value="${data.meetInfo || ''}" title="如何認識/常去處所">
    <button type="button" class="fm-del" title="移除">✕</button>
  `;
  row.querySelector('.fm-del').addEventListener('click', () => row.remove());
  document.getElementById('fr-list').appendChild(row);
}

document.getElementById('addFrBtn').addEventListener('click', () => addFriend());

// ── Multi-step navigation ─────────────────────────────
const TOTAL_STEPS = 6;
let currentStep = 1;

function gotoStep(step) {
  document.querySelectorAll('.step-panel').forEach(p => {
    p.classList.toggle('active', parseInt(p.dataset.step) === step);
  });
  document.querySelectorAll('.prog-step').forEach(s => {
    const n = parseInt(s.dataset.step);
    s.classList.remove('active','done');
    if (n < step) s.classList.add('done');
    else if (n === step) s.classList.add('active');
  });
  document.getElementById('prevBtn').style.display = step > 1 ? '' : 'none';
  document.getElementById('nextBtn').style.display = step < TOTAL_STEPS ? '' : 'none';
  document.getElementById('submitBtn').style.display = step === TOTAL_STEPS ? '' : 'none';
  document.getElementById('stepHint').textContent = `第 ${step} 步 / 共 ${TOTAL_STEPS} 步`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  currentStep = step;
}

// ── Validation ────────────────────────────────────────
const REQUIRED = {
  1: [
    { id: 'f-name',     msg: '請輸入姓名' },
    { id: 'f-gender',   msg: '請選擇性別' },
    { id: 'f-birthDate',msg: '請填寫出生日期' },
    { id: 'f-phone',    msg: '請填寫聯絡電話' },
  ],
  6: [
    { id: 'f-motivation', msg: '請填寫您的動機' },
    { id: 'f-emgName',    msg: '請填寫緊急聯絡人' },
    { id: 'f-emgPhone',   msg: '請填寫緊急聯絡電話' },
  ],
};

function validateStep(step) {
  const rules = REQUIRED[step] || [];
  let ok = true;
  rules.forEach(({ id, msg }) => {
    const el = document.getElementById(id);
    const grp = el?.closest('.fgroup');
    if (!el?.value.trim()) {
      grp?.classList.add('has-error');
      if (grp) grp.querySelector('.ferr').textContent = msg;
      ok = false;
    } else {
      grp?.classList.remove('has-error');
    }
  });
  return ok;
}

document.getElementById('nextBtn').addEventListener('click', () => {
  if (!validateStep(currentStep)) { showToast('請填寫必填欄位'); return; }
  gotoStep(currentStep + 1);
});
document.getElementById('prevBtn').addEventListener('click', () => gotoStep(currentStep - 1));

// ── Submit ────────────────────────────────────────────
document.getElementById('submitBtn').addEventListener('click', async () => {
  if (!validateStep(6)) { showToast('請填寫必填欄位'); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '送出中…';

  // Family members (now includes name and phone)
  const familyMembers = [];
  document.querySelectorAll('#fm-list .fm-row').forEach(row => {
    const rel   = row.querySelector('.fm-rel').value;
    const name  = row.querySelector('.fm-name').value;
    const age   = row.querySelector('.fm-age').value;
    const job   = row.querySelector('.fm-job').value;
    const phone = row.querySelector('.fm-phone').value;
    if (rel || name || age || job || phone) {
      familyMembers.push({ relation: rel, name, age: age ? parseInt(age) : '', job, phone });
    }
  });

  // Friends / close contacts
  const friends = [];
  document.querySelectorAll('#fr-list .fr-row').forEach(row => {
    const relation = row.querySelector('.fr-rel').value;
    const name     = row.querySelector('.fr-name').value;
    const age      = row.querySelector('.fr-age').value;
    const job      = row.querySelector('.fr-job').value;
    const phone    = row.querySelector('.fr-phone').value;
    const meetInfo = row.querySelector('.fr-meet').value;
    if (relation || name || age || job || phone || meetInfo) {
      friends.push({ relation, name, age: age ? parseInt(age) : '', job, phone, meetInfo });
    }
  });

  // Checkboxes
  const licenses          = [...document.querySelectorAll('[name="license"]:checked')].map(c => c.value);
  const hobbies           = [...document.querySelectorAll('[name="hobby"]:checked')].map(c => c.value);
  const personalDebtTypes = [...document.querySelectorAll('[name="personalDebtType"]:checked')].map(c => c.value);
  const familyDebtTypes   = [...document.querySelectorAll('[name="familyDebtType"]:checked')].map(c => c.value);

  // Same-address
  const sameAddr = document.getElementById('f-sameAddr').checked;

  const data = {
    // 基本資料
    name:        gv('f-name'),
    gender:      gv('f-gender'),
    birthDate:   gv('f-birthDate'),
    birthPlace:  gv('f-birthPlace'),
    bloodType:   gv('f-bloodType'),
    idNumber:    gv('f-idNumber'),
    phone:       gv('f-phone'),
    homePhone:   gv('f-homePhone'),
    lineId:      gv('f-lineId'),
    email:       gv('f-email'),
    marital:     gv('f-marital'),
    addrCity:    gv('f-addrCity'),
    addrDistrict:gv('f-addrDistrict'),
    addrDetail:  gv('f-addrDetail'),
    curAddrCity:     sameAddr ? gv('f-addrCity')     : gv('f-curCity'),
    curAddrDistrict: sameAddr ? gv('f-addrDistrict') : gv('f-curDistrict'),
    curAddrDetail:   sameAddr ? gv('f-addrDetail')   : gv('f-curDetail'),
    // 學歷工作
    education:   gv('f-education'),
    school:      gv('f-school'),
    department:  gv('f-department'),
    studyStatus: gv('f-studyStatus'),
    job:         gv('f-job'),
    company:     gv('f-company'),
    jobType:     gv('f-jobType'),
    salary:      gv('f-salary'),
    workHistory: gv('f-workHistory'),
    military:    gv('f-military'),
    militaryUnit:gv('f-militaryUnit'),
    militaryExp: gv('f-militaryExp'),
    // 興趣專長
    licenses,
    hobbies,
    hobbyOther:           gv('f-hobbyOther'),
    skills:               gv('f-skills'),
    english:              gv('f-english'),
    otherLang:            gv('f-otherLang'),
    certs:                gv('f-certs'),
    socialAccounts:       gv('f-socialAccounts'),
    vehicles:             gv('f-vehicles'),
    religion:             gv('f-religion'),
    swimming:             gv('f-swimming'),
    clubExp:              gv('f-clubExp'),
    tradeArt:             gv('f-trade-art'),
    tradeElec:            gv('f-trade-elec'),
    tradeCarp:            gv('f-trade-carp'),
    tradeCook:            gv('f-trade-cook'),
    tradeBread:           gv('f-trade-bread'),
    tradeHvac:            gv('f-trade-hvac'),
    tradeOtherYears:      gv('f-trade-other-years'),
    tradeOtherName:       gv('f-trade-other-name'),
    wordSkill:            gv('f-word-skill'),
    excelSkill:           gv('f-excel-skill'),
    pptSkill:             gv('f-ppt-skill'),
    drawingSoftware:      gv('f-drawing-software'),
    drawingSkill:         gv('f-drawing-skill'),
    gaming:               gv('f-gaming'),
    gamingAccount:        gv('f-gaming-account'),
    gamingName:           gv('f-gaming-name'),
    hasCompetition:       gv('f-has-competition'),
    competitionDetail:    gv('f-competition-detail'),
    hasCertification:     gv('f-has-certification'),
    certificationDetail:  gv('f-certification-detail'),
    // 家庭
    children:             gv('f-children'),
    homeCity:             gv('f-homeCity'),
    familyNote:           gv('f-familyNote'),
    familyHarmony:        gv('f-family-harmony'),
    parentsdivorced:      gv('f-parents-divorced'),
    divorceReason:        gv('f-divorce-reason'),
    familyIllness:        gv('f-family-illness'),
    familyIllnessWho:     gv('f-family-illness-who'),
    familyIllnessDisease: gv('f-family-illness-disease'),
    familyEconomic:       gv('f-family-economic'),
    parentDeceased:       gv('f-parent-deceased'),
    parentDeceasedCause:  gv('f-parent-deceased-cause'),
    siblingDeceased:      gv('f-sibling-deceased'),
    familyMembers,
    friends,
    // 個人背景
    criminalRecord:       gv('f-criminal'),
    criminalRecordDetail: gv('f-criminal-detail'),
    relationshipStatus:   gv('f-relationship'),
    hasPartner:           gv('f-has-partner'),
    partnerHarmony:       gv('f-partner-harmony'),
    moneyDispute:         gv('f-money-dispute'),
    personalDebt:         gv('f-personal-debt'),
    personalDebtTypes,
    personalDebtAmount:   gv('f-personal-debt-amount'),
    familyDebt:           gv('f-family-debt'),
    familyDebtTypes,
    familyDebtAmount:     gv('f-family-debt-amount'),
    hasTattoo:            gv('f-tattoo'),
    gangHistory:          gv('f-gang'),
    gangName:             gv('f-gang-name'),
    gangPeriod:           gv('f-gang-period'),
    gangContact:          gv('f-gang-contact'),
    // 其他
    motivation:       gv('f-motivation'),
    strength:         gv('f-strength'),
    availDate:        gv('f-availDate'),
    relocate:         gv('f-relocate'),
    health:           gv('f-health'),
    healthNote:       gv('f-healthNote'),
    emergencyName:    gv('f-emgName'),
    emergencyRel:     gv('f-emgRel'),
    emergencyPhone:   gv('f-emgPhone'),
    notes:            gv('f-notes'),
    // Meta
    status:      'pending',
    submittedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(COL_APPLICATIONS, data);
    const code = docRef.id.slice(0, 8).toUpperCase();
    document.getElementById('form-wrap').style.display = 'none';
    document.getElementById('success-screen').style.display = 'block';
    document.getElementById('success-code').textContent = '# ' + code;
    document.querySelector('.prog-wrap').style.display = 'none';
  } catch (e) {
    console.error(e);
    showToast('送出失敗，請稍後再試');
    btn.disabled = false;
    btn.textContent = '✔ 送出申請';
  }
});

// ── Helpers ───────────────────────────────────────────
function gv(id) { return document.getElementById(id)?.value?.trim() || ''; }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// Init
gotoStep(1);
