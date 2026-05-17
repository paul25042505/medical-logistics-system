import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ── Firebase ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyAtPU5Dsf5opwqlOUVn6QzKVJ1JTNhYfzM',
  authDomain: 'medical-logistics-system-dc1cd.firebaseapp.com',
  projectId: 'medical-logistics-system-dc1cd',
  storageBucket: 'medical-logistics-system-dc1cd.firebasestorage.app',
  messagingSenderId: '642469138148',
  appId: '1:642469138148:web:4aac96ce35d32d8132a6f1',
  measurementId: 'G-LVW2QSSFNT',
};

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch {}

let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache() });
} catch {
  db = getFirestore(app);
}
const auth    = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ── Refs ──────────────────────────────────────────────
const COL_RECRUITS   = collection(db, 'recruits');
const COL_BATCHES    = collection(db, 'batches');
const COL_RECRUITERS = collection(db, 'recruiters');
const COL_LEADS      = collection(db, 'leads');
const COL_PERSONNEL     = collection(db, 'personnel');
const COL_USERS         = collection(db, 'users');
const COL_APPLICATIONS  = collection(db, 'applications');
const COL_VEHICLES      = collection(db, 'vehicles');
const COL_UNIFORM_POINTS  = collection(db, 'uniformPoints');
const COL_ACCOUNT_REQS    = collection(db, 'accountRequests');
const DOC_ADMIN      = doc(db, 'settings', 'admin');

// ── State ─────────────────────────────────────────────
let records       = [];
let batches       = [];
let recruiters    = [];
let leads         = [];
let adminSettings = { units: [], battalions: [], companies: [] };

let currentTab     = 'civilian';
let editingId      = null;
let detailId       = null;
let editingBatchId = null;
let editingRcrId   = null;

let personnel          = [];
let personnelUnitFilter = [];
let editingPersonnelId = null;
let viewingPersonnelId = null;

let applications    = [];
let viewingAppId    = null;

let vehicles        = [];
let editingVehicleId = null;

let uniformPoints     = [];
let editingUpId       = null;
let upUnitFilter      = '';
const currentYearMonth = new Date().toISOString().slice(0, 7); // "2026-05"
let upSelectedMonth   = currentYearMonth;

let accountRequests   = [];
let registeredUsers   = [];

// ── Roles ─────────────────────────────────────────────
const ROLES = {
  admin:     { label: '系統管理員',   pages: new Set(['home','profile','trainee-list','batch-sched','interview-query','recruiters','leads','personnel','applications','vehicles','uniform-points','admin']) },
  manager:   { label: '業務主管',     pages: new Set(['home','profile','trainee-list','batch-sched','interview-query','recruiters','leads','personnel','applications','vehicles','uniform-points']) },
  recruit:   { label: '招募管理承辦', pages: new Set(['home','profile','trainee-list','batch-sched','interview-query','recruiters','leads']) },
  personnel: { label: '人事管理承辦', pages: new Set(['home','profile','personnel','applications']) },
  logistics: { label: '後勤管理承辦', pages: new Set(['home','profile','vehicles','uniform-points']) },
  member:    { label: '一般成員',     pages: new Set(['home','profile']) },
};
let currentRole = 'member';

function applyRolePermissions(role) {
  currentRole = role;
  // Role-restricted nav items
  document.querySelectorAll('li[data-roles]').forEach(li => {
    li.style.display = li.dataset.roles.split(',').includes(role) ? '' : 'none';
  });
  // Section labels
  const show = {
    admin:     ['recruit','personnel','logistics','system'],
    manager:   ['recruit','personnel','logistics'],
    recruit:   ['recruit','logistics'],
    personnel: ['personnel','logistics'],
    logistics: ['logistics'],
    member:    [],
  }[role] || [];
  ['recruit','personnel','logistics','system'].forEach(s => {
    const el = document.getElementById(`nav-section-${s}`);
    if (el) el.style.display = show.includes(s) ? '' : 'none';
  });
  // Admin nav item
  document.getElementById('admin-nav-item').style.display = role === 'admin' ? '' : 'none';
  // Redirect if current page unauthorized
  const allowed = ROLES[role]?.pages || ROLES.member.pages;
  const active  = document.querySelector('.page.active')?.id?.replace('page-', '');
  if (active && !allowed.has(active)) navigateTo('home');
}

// ── LINE browser detection ────────────────────────────
(function() {
  const ua = navigator.userAgent || '';
  if (/Line\//i.test(ua)) {
    const warning = document.getElementById('line-browser-warning');
    const loginBtn = document.getElementById('google-login-btn');
    if (warning) warning.style.display = '';
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.style.opacity = '0.4';
      loginBtn.style.cursor  = 'not-allowed';
      loginBtn.title = '請先跳出 LINE 瀏覽器';
    }
  }
})();

// ── Auth ──────────────────────────────────────────────
const ADMIN_EMAIL = 'paul25042505@gmail.com';
const authPage    = document.getElementById('auth-page');
const mainHeader  = document.querySelector('header');
const mainLayout  = document.querySelector('.layout');
let currentUser   = null;
let appStarted    = false;

function showAuthScreen(screen) {
  authPage.style.display = '';
  mainHeader.style.display = 'none';
  mainLayout.style.display = 'none';
  document.getElementById('loading-screen').style.display = 'none';
  ['login', 'register', 'pending'].forEach(s => {
    document.getElementById(`auth-screen-${s}`).style.display = s === screen ? '' : 'none';
  });
}

function showApp(user, userData) {
  authPage.style.display = 'none';
  mainHeader.style.display = '';
  mainLayout.style.display = '';
  document.getElementById('header-email').textContent = userData.name || user.displayName || user.email || '';
  const role = userData.role || (userData.admin || user.email === ADMIN_EMAIL ? 'admin' : 'member');
  applyRolePermissions(role);
}

onAuthStateChanged(auth, async user => {
  if (!user) { showAuthScreen('login'); return; }
  currentUser = user;
  const userRef  = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const isAdmin = user.email === ADMIN_EMAIL;
    await setDoc(userRef, {
      email:       user.email || '',
      displayName: user.displayName || '',
      name:        user.displayName || '',
      approved:    isAdmin,
      admin:       isAdmin,
      role:        isAdmin ? 'admin' : 'member',
      provider:    'google.com',
      createdAt:   new Date().toISOString(),
      lastLogin:   new Date().toISOString(),
    });
    if (isAdmin) {
      showApp(user, { name: user.displayName, admin: true, role: 'admin' });
      if (!appStarted) { appStarted = true; startApp(); }
    } else {
      document.getElementById('reg-email-display').textContent = user.email;
      document.getElementById('reg-name').value = user.displayName || '';
      showAuthScreen('register');
    }
  } else {
    const userData = userSnap.data();
    await updateDoc(userRef, { lastLogin: new Date().toISOString() });
    if (userData.approved) {
      showApp(user, userData);
      if (!appStarted) { appStarted = true; startApp(); }
    } else {
      document.getElementById('pending-email-display').textContent = user.email;
      showAuthScreen('pending');
    }
  }
});

// DEV 快速登入（僅 localhost / file:// 顯示）
const devBtn = document.getElementById('dev-login-btn');
const isDev  = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';
document.getElementById('dev-section').style.display = isDev ? '' : 'none';
devBtn.addEventListener('click', () => {
  const name = document.getElementById('dev-name').value.trim() || '開發模式';
  const role = document.getElementById('dev-role').value || 'admin';
  currentUser = { email: ADMIN_EMAIL, displayName: name, uid: 'dev-uid' };
  showApp(currentUser, { name, admin: role === 'admin', role });
  if (!appStarted) { appStarted = true; startApp(); }
});

// Google 登入
document.getElementById('google-login-btn').addEventListener('click', async () => {
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try { await signInWithPopup(auth, googleProvider); }
  catch (e) {
    console.error('[Google Login]', e.code, e.message);
    const m = {
      'auth/popup-closed-by-user':      '登入視窗已關閉，請再試一次',
      'auth/cancelled-popup-request':   '登入已取消，請再試一次',
      'auth/popup-blocked':             '瀏覽器封鎖了登入視窗，請允許彈出視窗後再試',
      'auth/network-request-failed':    '網路連線失敗，請確認網路後再試',
      'auth/unauthorized-domain':       '此網域未在 Firebase 授權清單，請聯絡管理員',
      'auth/operation-not-allowed':     'Google 登入尚未啟用，請聯絡管理員',
      'auth/internal-error':            '登入服務暫時異常，請稍後再試',
      'auth/user-disabled':             '此帳號已被停用',
    };
    errEl.innerHTML = (m[e.code] || '登入失敗，請再試一次') +
      `<br><span style="font-size:11px;opacity:0.6">(${e.code || e.message})</span>`;
  }
});

// 提交申請
document.getElementById('submit-register-btn').addEventListener('click', async () => {
  const name  = document.getElementById('reg-name').value.trim();
  const errEl = document.getElementById('reg-error');
  errEl.textContent = '';
  if (!name) { errEl.textContent = '請填寫您的姓名'; return; }
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { name });
    document.getElementById('pending-email-display').textContent = currentUser.email;
    showAuthScreen('pending');
  } catch (e) { errEl.textContent = '送出失敗，請再試一次'; }
});

// 取消申請（回到登入畫面並登出）
document.getElementById('reg-cancel-btn').addEventListener('click', async () => {
  await signOut(auth);
});

// 登出
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('pending-logout-btn').addEventListener('click', () => signOut(auth));

// 管理員核准
window.approveUser = async function(uid) {
  try {
    await updateDoc(doc(db, 'users', uid), { approved: true });
    alert('已核准');
  } catch (e) { alert('核准失敗：' + e.message); }
};

// ── Loading ───────────────────────────────────────────
const loaded = new Set();
function markLoaded(key) {
  loaded.add(key);
  if (loaded.size >= 10) {
    const ls = document.getElementById('loading-screen');
    if (ls) ls.style.display = 'none';
  }
}

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

// ── Utilities ─────────────────────────────────────────
function calcAge(bd) {
  if (!bd) return '';
  const t = new Date(), d = new Date(bd);
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
}
function intentionClass(v) {
  return v === '高' ? 'tag-高' : v === '中' ? 'tag-中' : v === '低' ? 'tag-低' : 'tag-default';
}
function formatDate(d) { return d ? d.replace(/-/g, '/') : '—'; }
function daysFromToday(ds) {
  if (!ds) return null;
  const t = new Date(); t.setHours(0,0,0,0);
  const d = new Date(ds); d.setHours(0,0,0,0);
  return Math.round((d - t) / 86400000);
}
function getEffectiveIntention(r) {
  const ivs = r.interviews || [];
  for (let i = ivs.length - 1; i >= 0; i--) {
    if (ivs[i].intention) return ivs[i].intention;
  }
  return '';
}
const BATCH_TYPE_LABELS = { military: '新訓轉服', civilian: '社會青年', both: '兩者皆有' };

// ── District cascade ──────────────────────────────────
function updateDistrict(city, selectedDistrict) {
  const sel = document.getElementById('f-district');
  const districts = city ? (DISTRICTS[city] || []) : [];
  sel.disabled = districts.length === 0;
  sel.innerHTML = districts.length === 0
    ? '<option value="">請先選縣市</option>'
    : '<option value="">請選擇區域</option>' + districts.map(d =>
        `<option${d === selectedDistrict ? ' selected' : ''}>${d}</option>`).join('');
}
document.getElementById('f-city').addEventListener('change', function () {
  updateDistrict(this.value, '');
});

function initCitySelect(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  Object.keys(DISTRICTS).forEach(c => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = c;
    sel.appendChild(opt);
  });
}

function updateDistrictSel(cityId, distId, selected) {
  const city = document.getElementById(cityId)?.value || '';
  const sel  = document.getElementById(distId);
  if (!sel) return;
  const districts = city ? (DISTRICTS[city] || []) : [];
  sel.disabled = districts.length === 0;
  sel.innerHTML = districts.length === 0
    ? '<option value="">請先選縣市</option>'
    : '<option value="">請選擇鄉鎮市區</option>' + districts.map(d =>
        `<option${d === selected ? ' selected' : ''}>${d}</option>`).join('');
}

function fmtAddress(p) {
  const parts = [p.addrCity, p.addrDistrict, p.addrDetail].filter(Boolean);
  return parts.length ? parts.join('') : (p.address || '');
}

initCitySelect('prof-addr-city');
initCitySelect('pf-addr-city');

document.getElementById('prof-addr-city').addEventListener('change', function () {
  updateDistrictSel('prof-addr-city', 'prof-addr-district', '');
});
document.getElementById('pf-addr-city').addEventListener('change', function () {
  updateDistrictSel('pf-addr-city', 'pf-addr-district', '');
});

// ── Admin dropdowns ───────────────────────────────────
function populateAdminDropdowns() {
  const fill = (id, arr) => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="">請選擇</option>' + (arr || []).map(x => `<option>${x}</option>`).join('');
    if ((arr || []).includes(cur)) el.value = cur;
  };
  fill('f-unit',      adminSettings.units      || []);
  fill('f-battalion', adminSettings.battalions || []);
  fill('f-company',   adminSettings.companies  || []);
}

// ── Admin page render ─────────────────────────────────
function renderAdminPage() {
  const makeList = (listId, arr, key) => {
    const el = document.getElementById(listId);
    if (!el) return;
    el.innerHTML = (arr && arr.length)
      ? arr.map((item, i) =>
          `<li class="admin-list-item">
            <span>${item}</span>
            <div class="admin-item-actions">
              <button class="admin-order-btn" onclick="moveAdminItem('${key}',${i},'up')" ${i === 0 ? 'disabled' : ''}>▲</button>
              <button class="admin-order-btn" onclick="moveAdminItem('${key}',${i},'down')" ${i === arr.length - 1 ? 'disabled' : ''}>▼</button>
              <button class="btn-icon danger" onclick="removeAdminItem('${key}',${i})">✕</button>
            </div>
          </li>`).join('')
      : '<li style="color:var(--text-muted);font-size:13px;padding:8px 0">尚無項目</li>';
  };
  makeList('admin-unit-list',      adminSettings.units,      'units');
  makeList('admin-battalion-list', adminSettings.battalions, 'battalions');
  makeList('admin-company-list',   adminSettings.companies,  'companies');

  // ── 帳號 / 申請整合清單 ──
  renderAdminAccountsSection();
}

// ── 整合帳號申請 + 已登入帳號 ─────────────────────────
function renderAdminAccountsSection() {
  const container = document.getElementById('admin-unified-users-list');
  if (!container) return;

  const pending = accountRequests.filter(r => r.status === 'pending');
  const done    = accountRequests.filter(r => r.status !== 'pending');

  // 紅色 badge
  const badge = document.getElementById('acct-req-badge');
  if (badge) {
    badge.textContent  = pending.length || '';
    badge.style.display = pending.length ? '' : 'none';
  }

  // ── helper: 單一申請列 ──
  function reqRow(r) {
    const emailLow    = (r.email || '').toLowerCase();
    const dupUser     = registeredUsers.find(u => (u.email || '').toLowerCase() === emailLow && emailLow);
    const dupPersonnel = personnel.find(p =>
      (p.email && (p.email).toLowerCase() === emailLow && emailLow) ||
      (p.name  && p.name === r.name)
    );
    const rid  = r.id.replace(/'/g, "\\'");

    let notice = '';
    if (dupPersonnel) {
      notice = `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;
                  padding:5px 10px;font-size:11px;color:#92400e;margin-top:6px">
        ⚠️ 與人員管理「${dupPersonnel.name}」可能重複
      </div>`;
    } else if (dupUser) {
      notice = `<div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:6px;
                  padding:5px 10px;font-size:11px;color:#1d4ed8;margin-top:6px">
        ℹ️ 此 Email 已有登入紀錄（${dupUser.name || dupUser.email}）
      </div>`;
    }

    const actionBtns = dupPersonnel
      ? `<button class="btn btn-sm btn-secondary" onclick="approveReqMerge('${rid}','${dupPersonnel.id}')">合併到現有人員</button>
         <button class="btn btn-sm btn-primary"   onclick="approveReqCreate('${rid}')">建立新人員</button>`
      : `<button class="btn btn-sm btn-primary"   onclick="approveReqCreate('${rid}')">✓ 核准建立人員</button>`;

    return `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap">
        <div style="flex:1;min-width:160px">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-weight:700;font-size:14px">${r.name || '—'}</span>
            ${r.unit ? `<span class="unit-tag">${r.unit}</span>` : ''}
            <span style="font-size:11px;background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:99px;font-weight:700">📬 待審核</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
            📧 ${r.email || '—'}&ensp;・&ensp;🕐 ${fmtUpTs(r.requestedAt)}
          </div>
          ${notice}
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex-shrink:0;margin-top:2px">
          ${actionBtns}
          <button class="btn btn-sm btn-secondary" onclick="markAcctReqDone('${rid}')">略過</button>
        </div>
      </div>
    </div>`;
  }

  // ── helper: 單一已登入帳號列 ──
  function userRow(u) {
    const statusHtml = u.admin
      ? `<span style="font-size:12px;color:var(--accent);font-weight:600">管理員</span>`
      : u.approved
        ? `<span style="font-size:12px;color:var(--green)">✓ 已核准</span>`
        : `<button class="btn btn-primary btn-sm" onclick="approveUser('${u.id}')">核准</button>`;
    // 若此帳號對應到某個 accountRequest 有記錄，顯示來源
    const fromReq = done.find(r => (r.email || '').toLowerCase() === (u.email || '').toLowerCase());
    return `<div class="admin-list-item">
      <div>
        <div style="font-weight:600;font-size:14px">${u.name || u.displayName || '—'}</div>
        <div style="font-size:12px;color:var(--text-muted)">${u.email}${fromReq ? '&ensp;<span style="color:#16a34a;font-size:11px">（已建立人員）</span>' : ''}</div>
      </div>
      <div class="admin-item-actions">${statusHtml}</div>
    </div>`;
  }

  let html = '';

  // ── 待審核申請區 ──
  html += `<div style="font-size:12px;font-weight:700;color:var(--text-muted);
              letter-spacing:.4px;text-transform:uppercase;margin:4px 0 8px">
    📬 待審核申請 ${pending.length ? `（${pending.length}）` : ''}
  </div>`;
  if (pending.length) {
    html += pending.map(reqRow).join('');
  } else {
    html += `<div style="font-size:13px;color:var(--text-muted);padding:6px 0 10px">暫無待審核申請</div>`;
  }

  // ── 分隔線 ──
  html += `<div style="border-top:2px solid var(--border);margin:14px 0 10px"></div>
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);
        letter-spacing:.4px;text-transform:uppercase;margin-bottom:8px">
      ✅ 已登入帳號 ${registeredUsers.length ? `（${registeredUsers.length}）` : ''}
    </div>`;

  if (!registeredUsers.length) {
    html += `<div style="font-size:13px;color:var(--text-muted);padding:6px 0">尚無帳號</div>`;
  } else {
    html += registeredUsers.map(userRow).join('');
  }

  container.innerHTML = html;
}

window.markAcctReqDone = async function(id) {
  try { await updateDoc(doc(db, 'accountRequests', id), { status: 'done' }); }
  catch(e) { console.error(e); alert('更新失敗'); }
};

// ── 核准申請：建立新人員 ──────────────────────────────
window.approveReqCreate = async function(id) {
  const req = accountRequests.find(r => r.id === id);
  if (!req) return;

  // 若此 email 已登入但未核准 → 一併開通
  const existUser = registeredUsers.find(u =>
    (u.email || '').toLowerCase() === (req.email || '').toLowerCase()
  );

  try {
    // 建立人員記錄
    const newRef = doc(COL_PERSONNEL);
    await setDoc(newRef, {
      name:        req.name  || '',
      unit:        req.unit  || '',
      email:       req.email || '',
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
      createdFrom: 'accountRequest',
    });

    // 同步核准已登入帳號（若有）
    if (existUser && !existUser.approved && !existUser.admin) {
      await updateDoc(doc(db, 'users', existUser.id), { approved: true });
    }

    // 補上 personnelId 給尚未連結的服裝點數記錄
    const relPoints = uniformPoints.filter(
      rp => !rp.personnelId && rp.ownerName === req.name
    );
    for (const rp of relPoints) {
      await updateDoc(doc(db, 'uniformPoints', rp.id), { personnelId: newRef.id });
    }

    // 標記申請已完成
    await updateDoc(doc(db, 'accountRequests', id), {
      status:        'approved',
      approvedAt:    serverTimestamp(),
      personnelDocId: newRef.id,
    });

    alert(`✓ 已核准「${req.name}」並建立人員記錄。${existUser && !existUser.approved ? '\n帳號已同步開通。' : ''}`);
  } catch(e) {
    console.error(e);
    alert('操作失敗：' + e.message);
  }
};

// ── 核准申請：合併到現有人員 ─────────────────────────
window.approveReqMerge = async function(reqId, personnelDocId) {
  const req  = accountRequests.find(r => r.id === reqId);
  const pers = personnel.find(p => p.id === personnelDocId);
  if (!req || !pers) return;

  const replace = confirm(
    `將「${req.name}」合併到現有人員「${pers.name}」\n\n` +
    `點「確認」= 用申請資料補充更新現有人員的 email / 單位\n` +
    `點「取消」= 僅標記完成，不更新現有資料`
  );

  try {
    if (replace) {
      await updateDoc(doc(db, 'personnel', personnelDocId), {
        ...(req.email && !pers.email ? { email: req.email } : {}),
        ...(req.unit  && !pers.unit  ? { unit:  req.unit  } : {}),
        updatedAt: serverTimestamp(),
      });
    }

    // 同步核准帳號（若有）
    const existUser = registeredUsers.find(u =>
      (u.email || '').toLowerCase() === (req.email || '').toLowerCase()
    );
    if (existUser && !existUser.approved && !existUser.admin) {
      await updateDoc(doc(db, 'users', existUser.id), { approved: true });
    }

    // 補上 personnelId 給相關服裝點數
    const relPoints = uniformPoints.filter(
      rp => !rp.personnelId && rp.ownerName === req.name
    );
    for (const rp of relPoints) {
      await updateDoc(doc(db, 'uniformPoints', rp.id), { personnelId: personnelDocId });
    }

    await updateDoc(doc(db, 'accountRequests', reqId), {
      status:        replace ? 'merged' : 'done',
      approvedAt:    serverTimestamp(),
      personnelDocId,
    });

    alert(replace
      ? `✓ 已合併到「${pers.name}」的人員記錄。`
      : '已標記完成（保留現有資料）。'
    );
  } catch(e) {
    console.error(e);
    alert('操作失敗：' + e.message);
  }
};

window.moveAdminItem = async function (key, idx, dir) {
  const arr = [...(adminSettings[key] || [])];
  const newIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= arr.length) return;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  try { await setDoc(DOC_ADMIN, { ...adminSettings, [key]: arr }); }
  catch (e) { console.error(e); }
};

async function addAdminItem(key, inputId) {
  const input = document.getElementById(inputId);
  const val = input.value.trim();
  if (!val) return;
  const updated = { ...adminSettings, [key]: [...(adminSettings[key] || []), val] };
  try {
    await setDoc(DOC_ADMIN, updated);
    input.value = '';
  } catch (e) {
    console.error('後台儲存失敗:', e);
    alert(`儲存失敗：${e.message}\n\n請到 Firebase Console → Firestore → Rules，將規則改為 allow read, write: if true;`);
  }
}

window.removeAdminItem = async function (key, idx) {
  const arr = [...(adminSettings[key] || [])];
  arr.splice(idx, 1);
  await setDoc(DOC_ADMIN, { ...adminSettings, [key]: arr });
};

document.getElementById('admin-unit-add').addEventListener('click',
  () => addAdminItem('units', 'admin-unit-input'));
document.getElementById('admin-battalion-add').addEventListener('click',
  () => addAdminItem('battalions', 'admin-battalion-input'));
document.getElementById('admin-company-add').addEventListener('click',
  () => addAdminItem('companies', 'admin-company-input'));

['admin-unit-input','admin-battalion-input','admin-company-input'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (id === 'admin-unit-input')      addAdminItem('units',      id);
    else if (id === 'admin-battalion-input') addAdminItem('battalions', id);
    else addAdminItem('companies', id);
  });
});

// ── Sidebar ───────────────────────────────────────────
const sidebar  = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebarBackdrop');
const isMobile = () => window.innerWidth <= 768;

function initSidebar() { if (!isMobile()) sidebar.classList.remove('collapsed'); }

document.getElementById('menuBtn').addEventListener('click', () => {
  const collapsed = sidebar.classList.contains('collapsed');
  sidebar.classList.toggle('collapsed', !collapsed);
  if (isMobile()) backdrop.classList.toggle('visible', collapsed);
});
backdrop.addEventListener('click', () => {
  sidebar.classList.add('collapsed');
  backdrop.classList.remove('visible');
});
window.addEventListener('resize', initSidebar);
initSidebar();

// ── Navigation ────────────────────────────────────────
const PAGE_INIT = {
  'home':            () => {},
  'trainee-list':    () => renderList(),
  'batch-sched':     () => renderBatchSched(),
  'interview-query': () => renderInterviewQuery(),
  'recruiters':      () => renderRecruiters(),
  'leads':           () => fetchLeadsFromSheets(),
  'profile':         () => { renderProfilePage(); renderMyVehicles(); }, // renderMyUniformPoints 由 renderProfilePage 在 profileData 載入後呼叫
  'admin':           () => { renderAdminPage(); },
  'personnel':       () => { renderPersonnelUnitFilters(); renderPersonnel(); },
  'applications':    () => renderApplications(),
  'vehicles':        () => renderVehiclesPage(),
  'uniform-points':  () => renderUniformPointsPage(),
};

document.querySelectorAll('.nav-link:not(.nav-coming)').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    if (backdrop.classList.contains('visible') || isMobile()) { sidebar.classList.add('collapsed'); backdrop.classList.remove('visible'); }
    const page = link.dataset.page;
    if (!page) return;
    navigateTo(page);
  });
});

function navigateTo(page) {
  const allowed = ROLES[currentRole]?.pages || ROLES.member.pages;
  if (!allowed.has(page)) return;
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const link = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (link) link.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const sec = document.getElementById('page-' + page);
  if (sec) sec.classList.add('active');
  if (PAGE_INIT[page]) PAGE_INIT[page]();
}

// ── Tabs ──────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    renderList();
  });
});

// ── Search / Filter ───────────────────────────────────
document.getElementById('searchInput').addEventListener('input', renderList);
document.getElementById('filterIntention').addEventListener('change', renderList);

// ── Render: 訓員列表 ──────────────────────────────────
function renderList() {
  const q  = document.getElementById('searchInput').value.trim().toLowerCase();
  const fi = document.getElementById('filterIntention').value;

  const filtered = records.filter(r => {
    if (r.type !== currentTab) return false;
    if (fi && getEffectiveIntention(r) !== fi) return false;
    if (q && !(r.name + r.phone + r.batch + r.unit).toLowerCase().includes(q)) return false;
    return true;
  });

  const container = document.getElementById('recruit-list');
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>尚無資料，點擊「＋ 新增」開始建立</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(r => {
    const age = calcAge(r.birthDate);
    const eff = getEffectiveIntention(r);
    const meta = [
      r.gender && `性別：${r.gender}`,
      age && `${age}歲`,
      r.phone && `📞 ${r.phone}`,
      r.batch && `梯次：${r.batch}`,
      currentTab === 'military' && r.unit && r.unit,
    ].filter(Boolean).join(' · ');

    const tags = [
      eff && `<span class="tag ${intentionClass(eff)}">${eff}意願</span>`,
      r.interviews?.length && `<span class="tag tag-default">約談 ${r.interviews.length} 次</span>`,
      r.specialty && `<span class="tag tag-default">${r.specialty}</span>`,
    ].filter(Boolean).join('');

    return `<div class="recruit-card intention-${eff}" data-id="${r.id}">
      <div class="recruit-avatar">${r.name?.[0] || '?'}</div>
      <div class="recruit-info">
        <div class="recruit-name">${r.name || '（未填姓名）'}</div>
        ${meta ? `<div class="recruit-meta">${meta}</div>` : ''}
        ${tags ? `<div class="recruit-tags" style="margin-top:6px">${tags}</div>` : ''}
      </div>
      <div class="recruit-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="openEdit('${r.id}')">✏️</button>
        <button class="btn-icon danger" onclick="deleteRecord('${r.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.recruit-card').forEach(card => {
    card.addEventListener('click', () => openDetail(card.dataset.id));
  });
}

// ── 訓員 Form ─────────────────────────────────────────
document.getElementById('addBtn').addEventListener('click', () => openForm(null));
document.getElementById('cancelBtn').addEventListener('click', closeForm);
document.getElementById('modalClose').addEventListener('click', closeForm);
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target.id === 'modalOverlay') closeForm();
});

document.querySelectorAll('input[name="type"]').forEach(r => {
  r.addEventListener('change', () => {
    const isMil = document.querySelector('input[name="type"]:checked').value === 'military';
    document.getElementById('military-section').style.display = isMil ? '' : 'none';
  });
});

document.getElementById('f-batch').addEventListener('change', function () {
  const b = batches.find(x => x.name === this.value);
  if (!b) return;
  const sv = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  sv('f-unit', b.unit);
  sv('f-enrollDate', b.enrollDate);
  sv('f-serviceDate', b.w8Enlist);
});

function populateBatchDropdown(selectedName) {
  const sel = document.getElementById('f-batch');
  sel.innerHTML = '<option value="">請選擇梯次（可選）</option>' +
    batches.map(b => `<option${b.name === selectedName ? ' selected' : ''}>${b.name}</option>`).join('');
}

function openForm(id) {
  editingId = id;
  clearForm();
  populateBatchDropdown('');
  populateAdminDropdowns();
  if (id) {
    document.getElementById('modal-title').textContent = '編輯訓員';
    const r = records.find(x => x.id === id);
    if (r) fillForm(r);
  } else {
    document.getElementById('modal-title').textContent = '新增訓員';
    document.querySelector(`input[name="type"][value="${currentTab}"]`).checked = true;
    document.getElementById('military-section').style.display = currentTab === 'military' ? '' : 'none';
  }
  document.getElementById('modalOverlay').classList.add('open');
}

window.openEdit = function (id) { openForm(id); };

function closeForm() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
}

function clearForm() {
  ['f-name','f-phone','f-line','f-department','f-specialty','f-seatNumber','f-notes']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['f-gender','f-city','f-education','f-batch','f-unit','f-battalion','f-company']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('f-birthDate').value = '';
  document.getElementById('f-enrollDate').value = '';
  document.getElementById('f-serviceDate').value = '';
  document.querySelectorAll('input[name="license"]').forEach(cb => cb.checked = false);
  document.querySelector('input[name="type"][value="civilian"]').checked = true;
  document.getElementById('military-section').style.display = 'none';
  updateDistrict('', '');
}

function fillForm(r) {
  document.querySelector(`input[name="type"][value="${r.type}"]`).checked = true;
  document.getElementById('military-section').style.display = r.type === 'military' ? '' : 'none';
  const sv = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
  sv('f-name', r.name); sv('f-birthDate', r.birthDate);
  sv('f-gender', r.gender); sv('f-phone', r.phone); sv('f-line', r.line);
  sv('f-city', r.city);
  updateDistrict(r.city, r.district);
  sv('f-education', r.education); sv('f-department', r.department);
  sv('f-specialty', r.specialty); sv('f-notes', r.notes);
  if (r.licenses) document.querySelectorAll('input[name="license"]')
    .forEach(cb => { cb.checked = r.licenses.includes(cb.value); });
  populateBatchDropdown(r.batch || '');
  sv('f-batch', r.batch);
  if (r.type === 'military') {
    sv('f-unit', r.unit); sv('f-battalion', r.battalion);
    sv('f-company', r.company); sv('f-seatNumber', r.seatNumber);
    sv('f-enrollDate', r.enrollDate); sv('f-serviceDate', r.serviceDate);
  }
}

function readForm() {
  const type = document.querySelector('input[name="type"]:checked').value;
  const gv = id => document.getElementById(id)?.value?.trim() || '';
  const rec = {
    type,
    name:       gv('f-name'),
    birthDate:  document.getElementById('f-birthDate').value,
    gender:     document.getElementById('f-gender').value,
    phone:      gv('f-phone'),
    line:       gv('f-line'),
    city:       document.getElementById('f-city').value,
    district:   document.getElementById('f-district').value,
    education:  document.getElementById('f-education').value,
    department: gv('f-department'),
    specialty:  gv('f-specialty'),
    licenses:   [...document.querySelectorAll('input[name="license"]:checked')].map(cb => cb.value),
    notes:      gv('f-notes'),
    batch:      gv('f-batch'),
  };
  if (type === 'military') {
    rec.unit        = document.getElementById('f-unit').value;
    rec.battalion   = document.getElementById('f-battalion').value;
    rec.company     = document.getElementById('f-company').value;
    rec.seatNumber  = gv('f-seatNumber');
    rec.enrollDate  = document.getElementById('f-enrollDate').value;
    rec.serviceDate = document.getElementById('f-serviceDate').value;
  }
  return rec;
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  const data = readForm();
  if (!data.name) { alert('請填寫姓名'); return; }
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  try {
    if (editingId) {
      await updateDoc(doc(db, 'recruits', editingId), data);
    } else {
      currentTab = data.type;
      document.querySelectorAll('.tab-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
      await addDoc(COL_RECRUITS, { ...data, interviews: [], createdAt: serverTimestamp() });
    }
    closeForm();
  } catch (e) { console.error(e); alert('儲存失敗'); }
  finally { btn.disabled = false; }
});

window.deleteRecord = async function (id) {
  const r = records.find(x => x.id === id);
  if (!r || !confirm(`確定要刪除「${r.name}」的資料嗎？`)) return;
  try { await deleteDoc(doc(db, 'recruits', id)); } catch (e) { console.error(e); }
};

// ── 訓員詳情 Modal ────────────────────────────────────
document.getElementById('detailClose').addEventListener('click', closeDetail);
document.getElementById('detailOverlay').addEventListener('click', e => {
  if (e.target.id === 'detailOverlay') closeDetail();
});

function openDetail(id) {
  detailId = id;
  const r = records.find(x => x.id === id);
  if (!r) return;
  document.getElementById('detail-title').textContent = r.name || '（未填姓名）';
  renderDetail(r);
  document.getElementById('detailOverlay').classList.add('open');
}
window.openDetail = openDetail;

function closeDetail() {
  document.getElementById('detailOverlay').classList.remove('open');
  detailId = null;
}

function renderDetail(r) {
  const age = calcAge(r.birthDate);
  const eff = getEffectiveIntention(r);
  const fld = (label, val) => val
    ? `<div class="detail-item"><div class="detail-label">${label}</div><div class="detail-value">${val}</div></div>`
    : '';

  const basic = [
    fld('類型', r.type === 'civilian' ? '社會青年' : '新訓轉服'),
    fld('所屬梯次', r.batch),
    fld('性別', r.gender),
    fld('出生日期', r.birthDate ? `${formatDate(r.birthDate)}（${age}歲）` : ''),
    fld('電話', r.phone), fld('LINE', r.line),
    fld('地址', [r.city, r.district].filter(Boolean).join(' ')),
    fld('學歷', r.education), fld('科系', r.department), fld('專長', r.specialty),
    fld('駕照', r.licenses?.length ? r.licenses.join('、') : ''),
    fld('目前意願', eff ? `<span class="tag ${intentionClass(eff)}">${eff}意願</span>` : ''),
    fld('備註', r.notes),
  ].filter(Boolean).join('');

  let milSection = '';
  if (r.type === 'military') {
    milSection = `<div class="form-section"><div class="section-title">軍中資訊</div>
      <div class="detail-grid">
        ${fld('單位', r.unit)} ${fld('營級', r.battalion)}
        ${fld('連級', r.company)} ${fld('座號', r.seatNumber)}
        ${fld('接訓日期', formatDate(r.enrollDate))}
        ${fld('八週起役日期', formatDate(r.serviceDate))}
      </div></div>`;
  }

  const ivs = r.interviews || [];
  const ivHTML = !ivs.length
    ? '<div style="color:var(--text-muted);font-size:13px;padding:12px 0">尚無約談紀錄</div>'
    : [...ivs].reverse().map((iv, i) => {
        const realIdx = ivs.length - 1 - i;
        return `<div class="interview-card intention-${iv.intention || ''}">
          <div class="interview-card-header">
            <span class="interview-date">${formatDate(iv.date)}</span>
            <div style="display:flex;align-items:center;gap:8px">
              ${iv.intention ? `<span class="tag ${intentionClass(iv.intention)}">${iv.intention}意願</span>` : ''}
              <button class="iv-delete" onclick="deleteInterview('${r.id}',${realIdx})">✕</button>
            </div>
          </div>
          <div class="interview-card-body">
            ${iv.content ? `<div class="interview-field"><span>內容：</span>${iv.content}</div>` : ''}
            ${iv.issues ? `<div class="interview-field"><span>猶豫原因：</span>${iv.issues}</div>` : ''}
            ${iv.parentReaction ? `<div class="interview-field"><span>家長反應：</span>${iv.parentReaction}</div>` : ''}
            ${iv.handler ? `<div class="interview-field"><span>負責招募員：</span>${iv.handler}</div>` : ''}
          </div>
        </div>`;
      }).join('');

  document.getElementById('detail-body').innerHTML = `
    <div class="form-section"><div class="section-title">基本資料</div>
      <div class="detail-grid">${basic}</div>
    </div>
    ${milSection}
    <div class="form-section">
      <div class="interview-header">
        <h4>約談紀錄（${ivs.length} 次）</h4>
        <button class="btn btn-primary btn-sm" onclick="openInterview('${r.id}')">＋ 新增約談</button>
      </div>
      <div class="interview-list">${ivHTML}</div>
    </div>`;
}

// ── 約談 Modal ────────────────────────────────────────
window.openInterview = function (recruitId) {
  detailId = recruitId;
  ['iv-content','iv-issues','iv-parentReaction'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('iv-intention').value = '';
  document.getElementById('iv-date').value = new Date().toISOString().slice(0, 10);
  const sel = document.getElementById('iv-handler');
  sel.innerHTML = '<option value="">請選擇</option>' +
    personnel.filter(p => p.isRecruiter).map(p => `<option>${p.rank} ${p.name}</option>`).join('');
  document.getElementById('interviewOverlay').classList.add('open');
};

['interviewClose','interviewCancel'].forEach(id => {
  document.getElementById(id).addEventListener('click',
    () => document.getElementById('interviewOverlay').classList.remove('open'));
});
document.getElementById('interviewOverlay').addEventListener('click', e => {
  if (e.target.id === 'interviewOverlay') document.getElementById('interviewOverlay').classList.remove('open');
});

document.getElementById('interviewSave').addEventListener('click', async () => {
  const date = document.getElementById('iv-date').value;
  if (!date) { alert('請填寫約談日期'); return; }
  const iv = {
    date,
    intention:      document.getElementById('iv-intention').value,
    content:        document.getElementById('iv-content').value.trim(),
    issues:         document.getElementById('iv-issues').value.trim(),
    parentReaction: document.getElementById('iv-parentReaction').value.trim(),
    handler:        document.getElementById('iv-handler').value,
  };
  const r = records.find(x => x.id === detailId);
  if (!r) return;
  try {
    await updateDoc(doc(db, 'recruits', detailId), { interviews: [...(r.interviews || []), iv] });
    document.getElementById('interviewOverlay').classList.remove('open');
  } catch (e) { console.error(e); alert('儲存失敗'); }
});

window.deleteInterview = async function (rId, idx) {
  if (!confirm('確定要刪除這筆約談紀錄嗎？')) return;
  const r = records.find(x => x.id === rId);
  if (!r) return;
  const updated = [...(r.interviews || [])];
  updated.splice(idx, 1);
  try { await updateDoc(doc(db, 'recruits', rId), { interviews: updated }); }
  catch (e) { console.error(e); }
};

// ── 梯次期程 ──────────────────────────────────────────
const SCHED_FIELDS = [
  { key: 'enrollDate',    label: '接訓日（入營）' },
  { key: 'willDeadline',  label: '意願截止日' },
  { key: 'w8Supplement',  label: '八週補件截止' },
  { key: 'w8Enlist',      label: '八週起役日' },
  { key: 'w12Supplement', label: '十二週補件截止' },
  { key: 'w12Enlist',     label: '十二週起役日' },
];

function renderBatchSched() {
  const c = document.getElementById('batch-sched-content');
  if (!batches.length) {
    c.innerHTML = `<div class="empty-state"><div class="icon">📅</div><p>尚無梯次，點擊「＋ 新增梯次」開始建立</p></div>`;
    return;
  }
  c.innerHTML = batches.map(b => {
    const rows = SCHED_FIELDS.map(f => {
      if (!b[f.key]) return '';
      const days = daysFromToday(b[f.key]);
      let badge = '';
      if (days !== null) {
        if      (days < 0)   badge = `<span class="days-badge past">已過 ${Math.abs(days)} 天</span>`;
        else if (days === 0) badge = `<span class="days-badge today">今天</span>`;
        else if (days <= 7)  badge = `<span class="days-badge soon">剩 ${days} 天</span>`;
        else                 badge = `<span class="days-badge future">剩 ${days} 天</span>`;
      }
      return `<div class="sched-row">
        <span class="sched-label">${f.label}</span>
        <span class="sched-date">${formatDate(b[f.key])}</span>${badge}
      </div>`;
    }).filter(Boolean).join('');

    const typeTag = b.type
      ? `<span class="tag tag-default" style="font-size:11px;margin-left:6px">${BATCH_TYPE_LABELS[b.type] || b.type}</span>`
      : '';
    return `<div class="batch-card">
      <div class="batch-card-header">
        <div>
          <div class="batch-name">${b.name}${typeTag}</div>
          ${b.unit ? `<div class="batch-unit">${b.unit}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-icon" onclick="openBatchEdit('${b.id}')">✏️</button>
          <button class="btn-icon danger" onclick="deleteBatch('${b.id}')">🗑️</button>
        </div>
      </div>
      <div class="sched-list">${rows || '<div style="color:var(--text-muted);font-size:13px">尚未填寫期程</div>'}</div>
    </div>`;
  }).join('');
}

function populateBUnitSelect(selectedVal) {
  const sel = document.getElementById('b-unit');
  if (!sel) return;
  sel.innerHTML = '<option value="">請選擇</option>' +
    (adminSettings.units || []).map(u => `<option${u === selectedVal ? ' selected' : ''}>${u}</option>`).join('');
}

document.getElementById('addBatchBtn').addEventListener('click', () => {
  editingBatchId = null;
  document.getElementById('batch-modal-title').textContent = '新增梯次';
  ['b-name','b-enrollDate','b-willDeadline',
   'b-w8Supplement','b-w8Enlist','b-w12Supplement','b-w12Enlist']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('b-type').value = 'military';
  populateBUnitSelect('');
  document.getElementById('batchModalOverlay').classList.add('open');
});
document.getElementById('batchModalClose').addEventListener('click',
  () => document.getElementById('batchModalOverlay').classList.remove('open'));
document.getElementById('batchCancelBtn').addEventListener('click',
  () => document.getElementById('batchModalOverlay').classList.remove('open'));
document.getElementById('batchModalOverlay').addEventListener('click', e => {
  if (e.target.id === 'batchModalOverlay') document.getElementById('batchModalOverlay').classList.remove('open');
});

document.getElementById('batchSaveBtn').addEventListener('click', async () => {
  const name = document.getElementById('b-name').value.trim();
  if (!name) { alert('請填寫梯次名稱'); return; }
  const gv = id => document.getElementById(id)?.value || '';
  const data = {
    name, type: gv('b-type'), unit: document.getElementById('b-unit').value,
    enrollDate: gv('b-enrollDate'), willDeadline: gv('b-willDeadline'),
    w8Supplement: gv('b-w8Supplement'), w8Enlist: gv('b-w8Enlist'),
    w12Supplement: gv('b-w12Supplement'), w12Enlist: gv('b-w12Enlist'),
  };
  try {
    if (editingBatchId) {
      await updateDoc(doc(db, 'batches', editingBatchId), data);
    } else {
      await addDoc(COL_BATCHES, { ...data, createdAt: serverTimestamp() });
    }
    document.getElementById('batchModalOverlay').classList.remove('open');
  } catch (e) { console.error(e); alert('儲存失敗'); }
});

window.openBatchEdit = function (id) {
  editingBatchId = id;
  const b = batches.find(x => x.id === id);
  if (!b) return;
  document.getElementById('batch-modal-title').textContent = '編輯梯次';
  const sv = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = v || ''; };
  sv('b-name', b.name); sv('b-type', b.type);
  populateBUnitSelect(b.unit || '');
  sv('b-enrollDate', b.enrollDate); sv('b-willDeadline', b.willDeadline);
  sv('b-w8Supplement', b.w8Supplement); sv('b-w8Enlist', b.w8Enlist);
  sv('b-w12Supplement', b.w12Supplement); sv('b-w12Enlist', b.w12Enlist);
  document.getElementById('batchModalOverlay').classList.add('open');
};

window.deleteBatch = async function (id) {
  const b = batches.find(x => x.id === id);
  if (!b || !confirm(`確定要刪除梯次「${b.name}」嗎？`)) return;
  try { await deleteDoc(doc(db, 'batches', id)); } catch (e) { console.error(e); }
};

// ── 約談紀錄查詢 ──────────────────────────────────────
document.getElementById('ivqSearch').addEventListener('input', renderInterviewQuery);
document.getElementById('ivqIntention').addEventListener('change', renderInterviewQuery);
document.getElementById('ivqDateFrom').addEventListener('change', renderInterviewQuery);
document.getElementById('ivqDateTo').addEventListener('change', renderInterviewQuery);

function renderInterviewQuery() {
  const q  = document.getElementById('ivqSearch').value.trim().toLowerCase();
  const fi = document.getElementById('ivqIntention').value;
  const df = document.getElementById('ivqDateFrom').value;
  const dt = document.getElementById('ivqDateTo').value;

  const results = [];
  records.forEach(r => {
    (r.interviews || []).forEach((iv, idx) => {
      if (fi && iv.intention !== fi) return;
      if (df && iv.date < df) return;
      if (dt && iv.date > dt) return;
      if (q && !(r.name + iv.content + iv.handler + iv.issues).toLowerCase().includes(q)) return;
      results.push({ r, iv, idx });
    });
  });
  results.sort((a, b) => b.iv.date.localeCompare(a.iv.date));

  const c = document.getElementById('interview-query-list');
  if (!results.length) {
    c.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>沒有符合條件的約談紀錄</p></div>`;
    return;
  }
  c.innerHTML = results.map(({ r, iv }) => `
    <div class="ivq-card">
      <div class="ivq-header">
        <div class="ivq-who">
          <span class="ivq-name">${r.name}</span>
          <span class="tag tag-default" style="font-size:11px">${r.type === 'civilian' ? '社會青年' : '新訓轉服'}</span>
          ${iv.intention ? `<span class="tag ${intentionClass(iv.intention)}">${iv.intention}意願</span>` : ''}
        </div>
        <span class="ivq-date">${formatDate(iv.date)}</span>
      </div>
      <div class="ivq-body">
        ${iv.content ? `<div class="interview-field"><span>內容：</span>${iv.content}</div>` : ''}
        ${iv.issues ? `<div class="interview-field"><span>猶豫原因：</span>${iv.issues}</div>` : ''}
        ${iv.handler ? `<div class="interview-field"><span>負責招募員：</span>${iv.handler}</div>` : ''}
      </div>
    </div>`).join('');
}

// ── 招募員管理 ────────────────────────────────────────
function renderRecruiters() {
  const c    = document.getElementById('recruiter-list');
  const recs = personnel.filter(p => p.isRecruiter);
  if (!recs.length) {
    c.innerHTML = `<div class="empty-state"><div class="icon">🪖</div><p>尚無招募員，點擊「＋ 新增招募員」新增人員並設定</p></div>`;
    return;
  }
  c.innerHTML = recs.map(p => `
    <div class="recruiter-card">
      <div class="recruiter-avatar">${p.name?.[0] || '?'}</div>
      <div class="recruiter-info">
        <div class="recruiter-name">${p.rank} ${p.name}</div>
        ${p.unit  ? `<div class="recruiter-meta">🏢 ${p.unit}</div>` : ''}
        ${p.phone ? `<div class="recruiter-meta">📞 ${p.phone}</div>` : ''}
      </div>
      <div class="recruit-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="openPersonnelEdit('${p.id}')">✏️</button>
        <button class="btn-icon danger" onclick="unsetRecruiter('${p.id}')">✕</button>
      </div>
    </div>`).join('');
}

document.getElementById('addRecruiterBtn').addEventListener('click', () => {
  openPersonnelForm(null, true);
});
document.getElementById('recruiterModalClose').addEventListener('click',
  () => document.getElementById('recruiterModalOverlay').classList.remove('open'));
document.getElementById('recruiterCancelBtn').addEventListener('click',
  () => document.getElementById('recruiterModalOverlay').classList.remove('open'));
document.getElementById('recruiterModalOverlay').addEventListener('click', e => {
  if (e.target.id === 'recruiterModalOverlay') document.getElementById('recruiterModalOverlay').classList.remove('open');
});

document.getElementById('recruiterSaveBtn').addEventListener('click', async () => {
  const rank = document.getElementById('r-rank').value.trim();
  const name = document.getElementById('r-name').value.trim();
  if (!rank || !name) { alert('請填寫級職與姓名'); return; }
  const data = { rank, name, phone: document.getElementById('r-phone').value.trim() };
  try {
    if (editingRcrId) {
      await updateDoc(doc(db, 'recruiters', editingRcrId), data);
    } else {
      await addDoc(COL_RECRUITERS, { ...data, createdAt: serverTimestamp() });
    }
    document.getElementById('recruiterModalOverlay').classList.remove('open');
  } catch (e) { console.error(e); alert('儲存失敗'); }
});

window.unsetRecruiter = async function (id) {
  const p = personnel.find(x => x.id === id);
  if (!p || !confirm(`確定要取消「${p.rank} ${p.name}」的招募員資格嗎？`)) return;
  try { await updateDoc(doc(db, 'personnel', id), { isRecruiter: false }); }
  catch (e) { console.error(e); alert('操作失敗'); }
};

// ── Storage 使用量 ────────────────────────────────────



// ── Google Sheets fetch ───────────────────────────────
async function fetchLeadsFromSheets() {
  const apiKey  = adminSettings.sheetsApiKey  || '';
  const sheetId = adminSettings.sheetsSheetId || '';
  const statusEl = document.getElementById('leads-load-status');

  if (!apiKey || !sheetId) {
    if (statusEl) statusEl.innerHTML =
      '⚠️ 尚未設定 Google Sheets 來源，請至「後台管理 → 問卷填答來源」填寫。';
    renderLeads();
    return;
  }

  if (statusEl) statusEl.textContent = '讀取中…';
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:L?key=${apiKey}`;
    const res  = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const json = await res.json();
    const rows = (json.values || []).slice(1); // 去掉標題列

    leads = rows
      .map((row, i) => ({
        id:                    `sheet-${i}`,
        submittedAt:           row[0]  || '',
        name:                  row[1]  || '',
        age:                   row[2]  || '',
        identity:              row[3]  || '',
        school:                row[4]  || '',
        phone:                 row[5]  || '',
        location:              row[6]  || '',
        interests:             row[7]  || '',
        workValues:            row[8]  || '',
        militaryConsideration: row[9]  || '',
        wantToKnow:            row[10] || '',
        lineConsent:           row[11] || '',
      }))
      .filter(l => l.name || l.phone); // 過濾完全空白的列

    const now = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    if (statusEl) statusEl.textContent = `共 ${leads.length} 筆｜最後更新 ${now}`;
    renderLeads();
  } catch (e) {
    console.error('[Sheets]', e);
    if (statusEl) statusEl.innerHTML =
      `<span style="color:#dc2626">❌ 讀取失敗：${e.message}</span>`;
    renderLeads();
  }
}

document.getElementById('leads-refresh-btn')?.addEventListener('click', fetchLeadsFromSheets);

// ── 後台 Google Sheets 設定 ────────────────────────────
function renderAdminSheetsSettings() {
  const el1 = document.getElementById('admin-sheets-apikey');
  const el2 = document.getElementById('admin-sheets-id');
  if (el1) el1.value = adminSettings.sheetsApiKey  || '';
  if (el2) el2.value = adminSettings.sheetsSheetId || '';
}

document.getElementById('admin-sheets-save')?.addEventListener('click', async () => {
  const apiKey  = document.getElementById('admin-sheets-apikey').value.trim();
  const sheetId = document.getElementById('admin-sheets-id').value.trim();
  const st = document.getElementById('admin-sheets-status');
  st.textContent = '儲存中…';
  try {
    await setDoc(DOC_ADMIN, { ...adminSettings, sheetsApiKey: apiKey, sheetsSheetId: sheetId });
    st.textContent = '✅ 已儲存';
    setTimeout(() => { st.textContent = ''; }, 3000);
  } catch(e) { st.textContent = '❌ 儲存失敗：' + e.message; }
});

document.getElementById('admin-sheets-test')?.addEventListener('click', async () => {
  const apiKey  = document.getElementById('admin-sheets-apikey').value.trim();
  const sheetId = document.getElementById('admin-sheets-id').value.trim();
  const st = document.getElementById('admin-sheets-status');
  if (!apiKey || !sheetId) { st.textContent = '⚠️ 請先填寫 API Key 和試算表 ID'; return; }
  st.textContent = '測試中…';
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:L1?key=${apiKey}`;
    const res  = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const json = await res.json();
    const headers = (json.values?.[0] || []).join('、');
    st.innerHTML = `✅ 連線成功！欄位：${headers || '（無欄位）'}`;
  } catch(e) { st.innerHTML = `❌ 失敗：${e.message}`; }
});

// ── 問卷填答 Render ───────────────────────────────────
function renderLeads() {
  const q = (document.getElementById('leads-search')?.value || '').trim().toLowerCase();
  const container = document.getElementById('leads-list');
  if (!container) return;

  const filtered = leads.filter(l => {
    if (!q) return true;
    return [l.name, l.phone, l.school, l.location].some(f => (f || '').toLowerCase().includes(q));
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📝</div><p>尚無問卷填答資料</p></div>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));

  container.innerHTML = sorted.map(l => {
    const fields = [
      l.age          && `年齡：${l.age}`,
      l.identity     && `身分：${l.identity}`,
      l.school       && `學校／工作：${l.school}`,
      l.phone        && `聯絡方式：${l.phone}`,
      l.location     && `活動地點：${l.location}`,
      l.interests    && `有興趣方向：${l.interests}`,
      l.workValues   && `最在意工作的：${l.workValues}`,
      l.militaryConsideration && `曾考慮國軍：${l.militaryConsideration}`,
      l.wantToKnow   && `想了解內容：${l.wantToKnow}`,
      l.lineConsent  && `加入LINE：${l.lineConsent}`,
    ].filter(Boolean);

    const ts = l.submittedAt ? l.submittedAt.replace('T', ' ').slice(0, 16) : '—';

    return `<div class="lead-card">
      <div class="lead-card-header">
        <span class="lead-name">${l.name || '（未填姓名）'}</span>
        <span class="lead-time">${ts}</span>
      </div>
      <div class="lead-fields">
        ${fields.map(f => `<div class="lead-field">${f}</div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

document.getElementById('leads-search').addEventListener('input', renderLeads);

// ── 個人資料 ──────────────────────────────────────────
let profileData = {};   // 目前已載入的個人資料

// 切換到檢視模式並渲染
function showProfileViewMode(p) {
  document.getElementById('prof-edit-mode').style.display = 'none';
  document.getElementById('prof-edit-btn').style.display  = '';
  const view = document.getElementById('prof-view-mode');
  view.style.display = '';

  if (!p || !p.name) {
    view.innerHTML = '<div class="prof-empty-hint">尚未填寫個人資料，請點擊「✏️ 編輯」開始建立。</div>';
    return;
  }

  const calcAge = bd => {
    if (!bd) return '';
    const b = new Date(bd), today = new Date();
    let age = today.getFullYear() - b.getFullYear();
    if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--;
    return age + ' 歲';
  };

  const row = (label, val) => val
    ? `<div class="prof-info-row"><span class="prof-info-label">${label}</span><span class="prof-info-val">${val}</span></div>`
    : '';

  const hasBasic     = p.unit || p.rank || p.gender || p.birthDate || p.idNumber || p.phone || p.joinDate;
  const hasEmergency = p.emergencyName || p.emergencyRel || p.emergencyPhone;
  const hasOther     = p.addrCity || p.addrDetail || p.address || p.notes;

  view.innerHTML = `
    <div class="prof-view-name">${p.name}</div>
    ${hasBasic ? `
    <div class="prof-info-section">
      <div class="prof-info-section-title">基本資料</div>
      ${row('所屬單位', p.unit)}
      ${row('級職', p.rank)}
      ${row('性別', p.gender)}
      ${row('出生年月日', p.birthDate ? `${p.birthDate}（${calcAge(p.birthDate)}）` : '')}
      ${row('身分證字號', p.idNumber)}
      ${row('聯絡電話', p.phone)}
      ${row('到職日', p.joinDate)}
    </div>` : ''}
    ${hasEmergency ? `
    <div class="prof-info-section">
      <div class="prof-info-section-title">緊急聯絡資料</div>
      ${row('緊急聯絡人', p.emergencyName)}
      ${row('與本人關係', p.emergencyRel)}
      ${row('緊急聯絡電話', p.emergencyPhone)}
    </div>` : ''}
    ${hasOther ? `
    <div class="prof-info-section">
      <div class="prof-info-section-title">其他資訊</div>
      ${row('戶籍地址', fmtAddress(p))}
      ${row('備註', p.notes)}
    </div>` : ''}
  `;
}

// 切換到編輯模式並填入目前資料
function showProfileEditMode(p) {
  const sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  sv('prof-name',          p.name);
  sv('prof-rank',          p.rank);
  sv('prof-unit',          p.unit);
  sv('prof-gender',        p.gender);
  sv('prof-birthDate',     p.birthDate);
  sv('prof-idNumber',      p.idNumber);
  sv('prof-phone',         p.phone);
  sv('prof-joinDate',      p.joinDate);
  sv('prof-emergencyName', p.emergencyName);
  sv('prof-emergencyRel',  p.emergencyRel);
  sv('prof-emergencyPhone',p.emergencyPhone);
  sv('prof-addr-city',     p.addrCity);
  updateDistrictSel('prof-addr-city', 'prof-addr-district', p.addrDistrict);
  sv('prof-addr-detail',   p.addrDetail);
  sv('prof-notes',         p.notes);

  document.getElementById('prof-view-mode').style.display  = 'none';
  document.getElementById('prof-edit-btn').style.display   = 'none';
  document.getElementById('prof-edit-mode').style.display  = '';
}

async function renderProfilePage() {
  if (!currentUser) return;
  const uid = currentUser.uid;

  // ① 嘗試 personnel/{uid}（標準路徑）
  let snap = await getDoc(doc(db, 'personnel', uid));

  if (!snap.exists()) {
    // ② 以 email 在已載入的 personnel 陣列中尋找（帳號申請核准後建立的記錄）
    const email = (currentUser.email || '').toLowerCase();
    const emailMatch = email
      ? personnel.find(p => p.id !== uid && p.email && p.email.toLowerCase() === email)
      : null;

    if (emailMatch) {
      // 自動遷移：把資料複製到 personnel/{uid}，刪除舊記錄
      await setDoc(doc(db, 'personnel', uid), { ...emailMatch, uid, updatedAt: serverTimestamp() });
      try { await deleteDoc(doc(db, 'personnel', emailMatch.id)); } catch {}
      snap = await getDoc(doc(db, 'personnel', uid));
    } else {
      // ③ 舊版：嘗試從 users/{uid}.profile 遷移
      const userSnap = await getDoc(doc(db, 'users', uid));
      const ud = userSnap.exists() ? userSnap.data() : {};
      profileData = ud.profile ? { ...ud.profile, uid } : { uid };
      showProfileViewMode(profileData);
      renderMyUniformPoints();
      return;
    }
  }

  profileData = snap.exists() ? snap.data() : { uid };
  showProfileViewMode(profileData);
  renderMyUniformPoints(); // profileData 已設定完畢才呼叫
}

// 編輯按鈕
document.getElementById('prof-edit-btn').addEventListener('click', () => {
  showProfileEditMode(profileData);
});

// 取消按鈕
document.getElementById('prof-cancel-btn').addEventListener('click', () => {
  showProfileViewMode(profileData);
});

// 儲存按鈕
document.getElementById('prof-save-btn').addEventListener('click', async () => {
  if (!currentUser) return;
  const gv = id => document.getElementById(id)?.value?.trim() || '';
  const name = gv('prof-name');
  if (!name) { alert('請填寫姓名'); document.getElementById('prof-name').focus(); return; }

  const data = {
    uid:           currentUser.uid,
    name,
    rank:          gv('prof-rank'),
    unit:          document.getElementById('prof-unit').value,
    gender:        document.getElementById('prof-gender').value,
    birthDate:     gv('prof-birthDate'),
    idNumber:      gv('prof-idNumber'),
    phone:         gv('prof-phone'),
    joinDate:      gv('prof-joinDate'),
    emergencyName: gv('prof-emergencyName'),
    emergencyRel:  gv('prof-emergencyRel'),
    emergencyPhone:gv('prof-emergencyPhone'),
    addrCity:      document.getElementById('prof-addr-city').value,
    addrDistrict:  document.getElementById('prof-addr-district').value,
    addrDetail:    gv('prof-addr-detail'),
    notes:         gv('prof-notes'),
    updatedAt:     serverTimestamp(),
  };
  // 若是首次建立，加上 createdAt
  if (!profileData.createdAt) data.createdAt = serverTimestamp();

  const btn = document.getElementById('prof-save-btn');
  btn.disabled = true;
  btn.textContent = '儲存中…';
  try {
    // 寫入 personnel/{uid}，同步到人員資訊管理
    await setDoc(doc(db, 'personnel', currentUser.uid), data, { merge: true });
    // 更新 header 顯示名稱
    const headerEl = document.getElementById('header-email');
    if (headerEl) headerEl.textContent = name;
    // 快取本地
    profileData = { ...profileData, ...data };
    showProfileViewMode(profileData);
    btn.textContent = '✓ 已儲存';
    setTimeout(() => { btn.disabled = false; btn.textContent = '儲存'; }, 1800);
  } catch (e) {
    console.error(e);
    alert('儲存失敗：' + e.message);
    btn.disabled = false;
    btn.textContent = '儲存';
  }
});

// ── Start App (called after login) ────────────────────
function startApp() {
  document.getElementById('loading-screen').style.display = '';

  onSnapshot(DOC_ADMIN, snap => {
    adminSettings = snap.exists() ? snap.data() : { units: [], battalions: [], companies: [] };
    renderAdminPage();
    renderAdminSheetsSettings();
    populateAdminDropdowns();
    if (document.getElementById('page-personnel').classList.contains('active')) renderPersonnelUnitFilters();
    populatePersonnelUnit();
    markLoaded('admin');
  }, () => markLoaded('admin'));

  onSnapshot(COL_RECRUITS, snap => {
    records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    records.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-TW'));
    if (document.getElementById('page-trainee-list').classList.contains('active')) renderList();
    if (document.getElementById('page-interview-query').classList.contains('active')) renderInterviewQuery();
    if (detailId && document.getElementById('detailOverlay').classList.contains('open')) {
      const r = records.find(x => x.id === detailId);
      if (r) renderDetail(r);
    }
    markLoaded('recruits');
  }, () => markLoaded('recruits'));

  onSnapshot(COL_BATCHES, snap => {
    batches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    batches.sort((a, b) => (b.enrollDate || '').localeCompare(a.enrollDate || ''));
    if (document.getElementById('page-batch-sched').classList.contains('active')) renderBatchSched();
    const curBatch = document.getElementById('f-batch')?.value || '';
    populateBatchDropdown(curBatch);
    markLoaded('batches');
  }, () => markLoaded('batches'));

  onSnapshot(COL_RECRUITERS, snap => {
    recruiters = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('page-recruiters').classList.contains('active')) renderRecruiters();
    markLoaded('recruiters');
  }, () => markLoaded('recruiters'));


  // leads 不再用 Firestore listener，改由 fetchLeadsFromSheets() 讀取
  markLoaded('leads');

  onSnapshot(COL_PERSONNEL, snap => {
    personnel = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('page-personnel').classList.contains('active')) renderPersonnel();
    if (document.getElementById('page-recruiters').classList.contains('active')) renderRecruiters();
    markLoaded('personnel');
  }, () => markLoaded('personnel'));

  onSnapshot(COL_USERS, snap => {
    registeredUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 角色管理列表（仍直接渲染，與 accounts 分開）
    const roleEl = document.getElementById('admin-role-list');
    if (roleEl) {
      const approved = registeredUsers.filter(u => u.approved);
      roleEl.innerHTML = !approved.length
        ? '<li style="color:var(--text-muted);font-size:13px;padding:8px 0">尚無已核准用戶</li>'
        : approved.map(u => {
            const curRole = u.role || (u.admin ? 'admin' : 'member');
            const opts = Object.entries(ROLES)
              .map(([k, v]) => `<option value="${k}"${curRole === k ? ' selected' : ''}>${v.label}</option>`)
              .join('');
            return `
            <li class="admin-list-item">
              <div>
                <div style="font-weight:600;font-size:14px">${u.name || u.displayName || '—'}</div>
                <div style="font-size:12px;color:var(--text-muted)">${u.email}</div>
              </div>
              <div class="admin-item-actions">
                <select class="role-select" onchange="changeUserRole('${u.id}', this.value)">${opts}</select>
              </div>
            </li>`;
          }).join('');
    }

    // 重新渲染整合帳號區塊
    if (document.getElementById('page-admin').classList.contains('active')) renderAdminAccountsSection();
  }, () => {});

  onSnapshot(COL_APPLICATIONS, snap => {
    applications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    applications.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
    if (document.getElementById('page-applications').classList.contains('active')) renderApplications();
    markLoaded('applications');
  }, () => markLoaded('applications'));

  onSnapshot(COL_VEHICLES, snap => {
    vehicles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    vehicles.sort((a, b) => (a.ownerName || '').localeCompare(b.ownerName || '', 'zh-TW'));
    if (document.getElementById('page-vehicles').classList.contains('active')) renderVehiclesPage();
    if (document.getElementById('page-profile').classList.contains('active')) renderMyVehicles();
    markLoaded('vehicles');
  }, () => markLoaded('vehicles'));

  onSnapshot(COL_UNIFORM_POINTS, snap => {
    uniformPoints = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    uniformPoints.sort((a, b) => (a.ownerName || '').localeCompare(b.ownerName || '', 'zh-TW'));
    if (document.getElementById('page-uniform-points').classList.contains('active')) renderUniformPointsPage();
    if (document.getElementById('page-profile').classList.contains('active')) renderMyUniformPoints();
    markLoaded('uniformPoints');
  }, () => markLoaded('uniformPoints'));

  onSnapshot(COL_ACCOUNT_REQS, snap => {
    accountRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    accountRequests.sort((a, b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0));
    if (document.getElementById('page-admin').classList.contains('active')) renderAdminPage();
    markLoaded('accountRequests');
  }, () => markLoaded('accountRequests'));
}

window.changeUserRole = async function(uid, role) {
  try { await updateDoc(doc(db, 'users', uid), { role }); }
  catch(e) { console.error(e); alert('角色更新失敗'); }
};

// ══════════════════════════════════════════════════════
// ── 人員資訊管理 ─────────────────────────────────────
// ══════════════════════════════════════════════════════

function populatePersonnelUnit() {
  const sel = document.getElementById('pf-unit');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">請選擇</option>' +
    PERSONNEL_UNITS.map(u => `<option${u === cur ? ' selected' : ''}>${u}</option>`).join('');
}

const PERSONNEL_UNITS = ['衛生營營部', '衛生營第一連', '衛生營第二連'];

function renderPersonnelUnitFilters() {
  const units  = PERSONNEL_UNITS;
  const chips  = document.getElementById('personnelUnitChips');
  if (!chips) return;
  const allActive = personnelUnitFilter.length === 0;
  chips.innerHTML =
    `<button class="unit-chip${allActive ? ' active' : ''}" data-unit="">全部</button>` +
    units.map(u =>
      `<button class="unit-chip${personnelUnitFilter.includes(u) ? ' active' : ''}" data-unit="${u}">${u}</button>`
    ).join('');
  chips.querySelectorAll('.unit-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const unit = chip.dataset.unit;
      if (unit === '') {
        personnelUnitFilter = [];
      } else {
        const idx = personnelUnitFilter.indexOf(unit);
        if (idx >= 0) personnelUnitFilter.splice(idx, 1);
        else          personnelUnitFilter.push(unit);
      }
      renderPersonnelUnitFilters();
      renderPersonnel();
    });
  });
}

function renderPersonnel() {
  const q      = document.getElementById('personnelSearch')?.value.trim().toLowerCase() || '';
  const sortBy = document.getElementById('personnelSortBy')?.value || 'unit';

  let filtered = personnel.filter(p => {
    if (personnelUnitFilter.length > 0 && !personnelUnitFilter.includes(p.unit)) return false;
    if (q && !(p.name + p.phone + p.idNumber + p.rank + p.unit).toLowerCase().includes(q)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'unit') {
      const uc = (adminSettings.units || []).indexOf(a.unit) - (adminSettings.units || []).indexOf(b.unit);
      if (uc !== 0) return uc;
      return (a.name || '').localeCompare(b.name || '', 'zh-TW');
    }
    if (sortBy === 'rank') return (a.rank || '').localeCompare(b.rank || '', 'zh-TW');
    return (a.name || '').localeCompare(b.name || '', 'zh-TW');
  });

  const tbody   = document.getElementById('personnelTableBody');
  const emptyEl = document.getElementById('personnelEmpty');
  const statsEl = document.getElementById('personnelStats');
  if (!tbody) return;

  // 統計列
  const unitCounts = {};
  filtered.forEach(p => { const u = p.unit || '（未分配）'; unitCounts[u] = (unitCounts[u] || 0) + 1; });
  const unitSummary = Object.entries(unitCounts).map(([u, c]) => `${u} ${c} 人`).join('　');
  statsEl.textContent = `顯示 ${filtered.length} / ${personnel.length} 人${unitSummary ? '　' + unitSummary : ''}`;

  if (!filtered.length) {
    tbody.innerHTML = '';
    emptyEl.style.display = '';
    return;
  }
  emptyEl.style.display = 'none';

  // 偵測重複：相同姓名的人員
  const nameCount = {};
  filtered.forEach(p => { if (p.name) nameCount[p.name] = (nameCount[p.name] || 0) + 1; });

  tbody.innerHTML = filtered.map((p, i) => {
    const age      = calcAge(p.birthDate);
    const idMasked = p.idNumber
      ? p.idNumber.slice(0, 1) + '●●●●●●●' + p.idNumber.slice(-2)
      : '—';
    const isDup = p.name && nameCount[p.name] > 1;
    const dupBadge = isDup
      ? ` <span title="同名人員可能重複" style="font-size:10px;background:#fef3c7;color:#d97706;
            padding:1px 5px;border-radius:4px;cursor:pointer" onclick="flagDupPersonnel('${p.id}','${(p.name||'').replace(/'/g,"\\'")}')">⚠️ 重複</span>`
      : '';
    return `<tr class="personnel-row" data-id="${p.id}">
      <td class="col-seq">${i + 1}</td>
      <td class="col-unit"><span class="unit-tag">${p.unit || '—'}</span></td>
      <td class="col-rank">${p.rank || '—'}</td>
      <td class="col-name"><strong>${p.name || '—'}</strong>${dupBadge}${p.isRecruiter ? ' <span class="recruiter-badge">招募員</span>' : ''}</td>
      <td class="col-gender">${p.gender || '—'}</td>
      <td class="col-age">${age || '—'}</td>
      <td class="col-phone">${p.phone || '—'}</td>
      <td class="col-id pii-mask">${idMasked}</td>
      <td class="col-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="openPersonnelEdit('${p.id}')">✏️</button>
        <button class="btn-icon danger" onclick="deletePersonnel('${p.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.personnel-row').forEach(row => {
    row.addEventListener('click', () => openPersonnelDetail(row.dataset.id));
  });
}

// ── 人員 Form ─────────────────────────────────────────
function openPersonnelForm(id, preRecruiter = false) {
  editingPersonnelId = id;
  clearPersonnelForm();
  populatePersonnelUnit();
  if (id) {
    document.getElementById('personnel-modal-title').textContent = '編輯人員';
    const p = personnel.find(x => x.id === id);
    if (p) fillPersonnelForm(p);
  } else {
    document.getElementById('personnel-modal-title').textContent = '新增人員';
    if (preRecruiter) document.getElementById('pf-isRecruiter').checked = true;
  }
  document.getElementById('personnelModalOverlay').classList.add('open');
}

function clearPersonnelForm() {
  ['pf-name','pf-rank','pf-phone','pf-idNumber',
   'pf-emergencyName','pf-emergencyRel','pf-emergencyPhone','pf-addr-detail','pf-notes']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['pf-unit','pf-gender','pf-addr-city']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  updateDistrictSel('pf-addr-city', 'pf-addr-district', '');
  document.getElementById('pf-birthDate').value = '';
  document.getElementById('pf-joinDate').value  = '';
  document.getElementById('pf-isRecruiter').checked = false;
}

function fillPersonnelForm(p) {
  const sv = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
  sv('pf-unit', p.unit);   sv('pf-rank', p.rank);     sv('pf-name', p.name);
  sv('pf-gender', p.gender);                           sv('pf-birthDate', p.birthDate);
  sv('pf-idNumber', p.idNumber);                       sv('pf-phone', p.phone);
  sv('pf-joinDate', p.joinDate);
  sv('pf-emergencyName', p.emergencyName);             sv('pf-emergencyRel', p.emergencyRel);
  sv('pf-emergencyPhone', p.emergencyPhone);
  sv('pf-addr-city', p.addrCity);
  updateDistrictSel('pf-addr-city', 'pf-addr-district', p.addrDistrict);
  sv('pf-addr-detail', p.addrDetail);
  sv('pf-notes', p.notes);
  document.getElementById('pf-isRecruiter').checked = p.isRecruiter || false;
}

function readPersonnelForm() {
  const gv = id => document.getElementById(id)?.value?.trim() || '';
  return {
    unit:           document.getElementById('pf-unit').value,
    rank:           gv('pf-rank'),
    name:           gv('pf-name'),
    gender:         document.getElementById('pf-gender').value,
    birthDate:      document.getElementById('pf-birthDate').value,
    idNumber:       gv('pf-idNumber').toUpperCase(),
    phone:          gv('pf-phone'),
    joinDate:       document.getElementById('pf-joinDate').value,
    emergencyName:  gv('pf-emergencyName'),
    emergencyRel:   gv('pf-emergencyRel'),
    emergencyPhone: gv('pf-emergencyPhone'),
    addrCity:       document.getElementById('pf-addr-city').value,
    addrDistrict:   document.getElementById('pf-addr-district').value,
    addrDetail:     gv('pf-addr-detail'),
    notes:          gv('pf-notes'),
    isRecruiter:    document.getElementById('pf-isRecruiter').checked,
  };
}

function closePersonnelForm() {
  document.getElementById('personnelModalOverlay').classList.remove('open');
  editingPersonnelId = null;
}

document.getElementById('personnelAddBtn').addEventListener('click', () => openPersonnelForm(null));
document.getElementById('personnelCancelBtn').addEventListener('click', closePersonnelForm);
document.getElementById('personnelModalClose').addEventListener('click', closePersonnelForm);
document.getElementById('personnelModalOverlay').addEventListener('click', e => {
  if (e.target.id === 'personnelModalOverlay') closePersonnelForm();
});

document.getElementById('personnelSaveBtn').addEventListener('click', async () => {
  const data = readPersonnelForm();
  if (!data.name) { alert('請填寫姓名'); return; }
  if (!data.unit) { alert('請選擇單位'); return; }
  const btn = document.getElementById('personnelSaveBtn');
  btn.disabled = true;
  try {
    if (editingPersonnelId) {
      await updateDoc(doc(db, 'personnel', editingPersonnelId), data);
    } else {
      await addDoc(COL_PERSONNEL, { ...data, createdAt: serverTimestamp() });
    }
    closePersonnelForm();
  } catch (e) { console.error(e); alert('儲存失敗：' + e.message); }
  finally { btn.disabled = false; }
});

window.openPersonnelEdit = function (id) {
  closePersonnelDetail();
  openPersonnelForm(id);
};

// ── 重複人員處理 ──────────────────────────────────────
window.flagDupPersonnel = function(id, name) {
  const dups = personnel.filter(p => p.name === name);
  if (dups.length < 2) { alert('目前偵測不到重複記錄。'); return; }

  // 顯示所有同名記錄，讓承辦人選擇要保留哪一筆
  const lines = dups.map((p, i) =>
    `${i + 1}. ${p.name}｜${p.unit || '無單位'}｜${p.email || '無Email'}｜${p.id === id ? '← 目前這筆' : ''}`
  ).join('\n');
  const keepIdx = prompt(
    `發現 ${dups.length} 筆同名「${name}」記錄：\n\n${lines}\n\n輸入要【保留】的編號（其餘將刪除）：`
  );
  const keepNum = parseInt(keepIdx, 10);
  if (!keepNum || keepNum < 1 || keepNum > dups.length) return;

  const keepId  = dups[keepNum - 1].id;
  const delDups = dups.filter(p => p.id !== keepId);

  if (!confirm(`確定刪除 ${delDups.length} 筆重複記錄，保留「${dups[keepNum-1].name}」(${dups[keepNum-1].unit || '無單位'})?`)) return;

  Promise.all(delDups.map(p => deleteDoc(doc(db, 'personnel', p.id))))
    .then(() => alert('✓ 重複記錄已刪除。'))
    .catch(e => alert('刪除失敗：' + e.message));
};

window.deletePersonnel = async function (id) {
  const p = personnel.find(x => x.id === id);
  if (!p || !confirm(`確定要刪除「${p.name}」的資料嗎？此操作無法復原。`)) return;
  try { await deleteDoc(doc(db, 'personnel', id)); }
  catch (e) { console.error(e); alert('刪除失敗'); }
};

// ── 搜尋 / 排序 事件 ──────────────────────────────────
document.getElementById('personnelSearch').addEventListener('input', renderPersonnel);
document.getElementById('personnelSortBy').addEventListener('change', renderPersonnel);

// ── 匯出 CSV ──────────────────────────────────────────
document.getElementById('personnelExportBtn').addEventListener('click', () => {
  const q = document.getElementById('personnelSearch')?.value.trim().toLowerCase() || '';
  const filtered = personnel.filter(p => {
    if (personnelUnitFilter.length > 0 && !personnelUnitFilter.includes(p.unit)) return false;
    if (q && !(p.name + p.phone + p.idNumber + p.rank + p.unit).toLowerCase().includes(q)) return false;
    return true;
  });

  const headers = ['序號','單位','級職','姓名','性別','出生年月日','年齡','身分證字號',
                   '電話','到職日','緊急聯絡人','關係','緊急聯絡電話','戶籍地址','備註'];
  const rows = filtered.map((p, i) => [
    i + 1, p.unit || '', p.rank || '', p.name || '', p.gender || '',
    p.birthDate || '', calcAge(p.birthDate) || '', p.idNumber || '', p.phone || '',
    p.joinDate || '', p.emergencyName || '', p.emergencyRel || '',
    p.emergencyPhone || '', fmtAddress(p), p.notes || '',
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `人員名冊_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── 人員詳情 Modal ────────────────────────────────────
function openPersonnelDetail(id) {
  viewingPersonnelId = id;
  const p = personnel.find(x => x.id === id);
  if (!p) return;
  document.getElementById('personnel-detail-title').textContent =
    [p.rank, p.name].filter(Boolean).join(' ');
  renderPersonnelDetailBody(p);
  document.getElementById('personnelDetailOverlay').classList.add('open');
}
window.openPersonnelDetail = openPersonnelDetail;

function closePersonnelDetail() {
  document.getElementById('personnelDetailOverlay').classList.remove('open');
  viewingPersonnelId = null;
}

function renderPersonnelDetailBody(p) {
  const age = calcAge(p.birthDate);
  const row = (label, val) =>
    val ? `<div class="pd-row"><span class="pd-label">${label}</span><span class="pd-val">${val}</span></div>` : '';

  document.getElementById('personnelDetailBody').innerHTML = `
    ${p.isRecruiter ? '<div class="pd-recruiter-banner">🪖 招募員</div>' : ''}
    <div class="pd-section">
      <div class="pd-section-title">基本資料</div>
      <div class="pd-grid">
        ${row('單位',     p.unit)}
        ${row('級職',     p.rank)}
        ${row('姓名',     p.name)}
        ${row('性別',     p.gender)}
        ${row('出生日期', p.birthDate ? formatDate(p.birthDate) + `（${age} 歲）` : '')}
        ${row('身分證',   p.idNumber)}
        ${row('電話',     p.phone)}
        ${row('到職日',   formatDate(p.joinDate))}
      </div>
    </div>
    ${(p.emergencyName || p.emergencyPhone) ? `
    <div class="pd-section">
      <div class="pd-section-title">緊急聯絡資料</div>
      <div class="pd-grid">
        ${row('緊急聯絡人', p.emergencyName)}
        ${row('與本人關係', p.emergencyRel)}
        ${row('緊急聯絡電話', p.emergencyPhone)}
      </div>
    </div>` : ''}
    ${(p.addrCity || p.addrDetail || p.address || p.notes) ? `
    <div class="pd-section">
      <div class="pd-section-title">其他資訊</div>
      <div class="pd-grid">
        ${row('戶籍地址', fmtAddress(p))}
        ${row('備註',     p.notes)}
      </div>
    </div>` : ''}
  `;
}

document.getElementById('personnelDetailClose').addEventListener('click', closePersonnelDetail);
document.getElementById('personnelDetailClose2').addEventListener('click', closePersonnelDetail);
document.getElementById('personnelDetailOverlay').addEventListener('click', e => {
  if (e.target.id === 'personnelDetailOverlay') closePersonnelDetail();
});
document.getElementById('personnelDetailEditBtn').addEventListener('click', () => {
  const id = viewingPersonnelId;
  closePersonnelDetail();
  openPersonnelForm(id);
});

// ── 批次匯入 ──────────────────────────────────────────
const IMPORT_COL_MAP = {
  '單位': 'unit', '級職': 'rank', '姓名': 'name', '性別': 'gender',
  '出生年月日': 'birthDate', '身分證字號': 'idNumber', '電話': 'phone',
  '到職日': 'joinDate', '緊急聯絡人': 'emergencyName',
  '關係': 'emergencyRel', '緊急聯絡電話': 'emergencyPhone',
  '戶籍地址': 'address', '備註': 'notes'
};
const IMPORT_REQUIRED = ['unit', 'rank', 'name'];

let importRows = [];   // parsed valid rows ready to write

function openImportModal() {
  importRows = [];
  document.getElementById('importStep1').style.display = '';
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importFileInfo').style.display = 'none';
  document.getElementById('importFileInput').value = '';
  document.getElementById('importBackBtn').style.display = 'none';
  document.getElementById('importConfirmBtn').style.display = 'none';
  document.getElementById('personnelImportOverlay').classList.add('open');
}

function closeImportModal() {
  document.getElementById('personnelImportOverlay').classList.remove('open');
}

// Template download
document.getElementById('importTplBtn').addEventListener('click', () => {
  const headers = ['單位','級職','姓名','性別','出生年月日','身分證字號',
                   '電話','到職日','緊急聯絡人','關係','緊急聯絡電話','戶籍地址','備註'];
  const sample  = ['衛生營第一連','上兵','王小明','男','2000/01/01',
                   'A123456789','0912345678','2024/01/01','王大明','父','0912345679','台北市某區某路1號',''];
  const csv = [headers, sample]
    .map(r => r.map(c => `"${c.replace(/"/g,'""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = '人員匯入範本.csv'; a.click();
  URL.revokeObjectURL(url);
});

// File input / drag-drop
const dropzone  = document.getElementById('importDropzone');
const fileInput = document.getElementById('importFileInput');

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleImportFile(fileInput.files[0]);
});
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault(); dropzone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleImportFile(e.dataTransfer.files[0]);
});

document.getElementById('importClearBtn').addEventListener('click', () => {
  fileInput.value = '';
  document.getElementById('importFileInfo').style.display = 'none';
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importStep1').style.display = '';
  document.getElementById('importBackBtn').style.display = 'none';
  document.getElementById('importConfirmBtn').style.display = 'none';
  importRows = [];
});

function handleImportFile(file) {
  document.getElementById('importFileName').textContent = file.name;
  document.getElementById('importFileInfo').style.display = 'flex';

  const reader = new FileReader();
  reader.onload = e => {
    let text = e.target.result;
    // strip BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    parseAndPreviewCSV(text);
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { result.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseAndPreviewCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { alert('檔案內容為空或格式不符'); return; }

  const headerRaw = parseCSVLine(lines[0]);
  // skip 序號 column if present
  const startIdx = headerRaw[0].trim() === '序號' ? 1 : 0;
  const headers  = headerRaw.slice(startIdx).map(h => h.trim());

  const fieldKeys = headers.map(h => IMPORT_COL_MAP[h] || null);

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]).slice(startIdx);
    const obj   = {};
    fieldKeys.forEach((key, idx) => {
      if (key) obj[key] = (cells[idx] || '').trim();
    });
    // validation
    const missing = IMPORT_REQUIRED.filter(f => !obj[f]);
    parsed.push({ obj, missing, rowNo: i });
  }

  importRows = parsed.filter(r => r.missing.length === 0).map(r => r.obj);

  // Render preview
  const tbody = document.getElementById('importPreviewBody');
  tbody.innerHTML = '';
  parsed.forEach(({ obj, missing, rowNo }) => {
    const ok  = missing.length === 0;
    const tr  = document.createElement('tr');
    tr.className = ok ? 'row-ok' : 'row-err';
    const statusCell = ok
      ? `<td class="import-status-ok">✔ 正常</td>`
      : `<td class="import-status-err">✘ 缺少${missing.map(f => ({unit:'單位',rank:'級職',name:'姓名'}[f]||f)).join('、')}</td>`;
    tr.innerHTML = statusCell +
      ['unit','rank','name','gender','birthDate','idNumber','phone','joinDate','notes']
        .map(k => `<td>${obj[k] || ''}</td>`).join('');
    tbody.appendChild(tr);
  });

  const okCount  = importRows.length;
  const errCount = parsed.length - okCount;
  document.getElementById('importPreviewSummary').innerHTML =
    `共 <strong>${parsed.length}</strong> 筆：` +
    `<span class="ok-count">✔ ${okCount} 筆可匯入</span>` +
    (errCount ? `　<span class="err-count">✘ ${errCount} 筆資料不完整（將略過）</span>` : '');

  document.getElementById('importStep1').style.display = 'none';
  document.getElementById('importStep2').style.display = '';
  document.getElementById('importBackBtn').style.display = '';
  document.getElementById('importConfirmBtn').style.display = okCount > 0 ? '' : 'none';
}

// Back button
document.getElementById('importBackBtn').addEventListener('click', () => {
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importStep1').style.display = '';
  document.getElementById('importBackBtn').style.display = 'none';
  document.getElementById('importConfirmBtn').style.display = 'none';
  importRows = [];
});

// Confirm import
document.getElementById('importConfirmBtn').addEventListener('click', async () => {
  if (importRows.length === 0) return;
  const btn = document.getElementById('importConfirmBtn');
  btn.disabled = true;
  btn.textContent = '匯入中…';
  try {
    for (const row of importRows) {
      await addDoc(COL_PERSONNEL, {
        ...row,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    closeImportModal();
    alert(`✔ 成功匯入 ${importRows.length} 筆人員資料`);
  } catch (err) {
    alert('匯入失敗：' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✔ 確認匯入';
  }
});

// Wire up open/close
document.getElementById('personnelImportBtn').addEventListener('click', openImportModal);
document.getElementById('personnelImportClose').addEventListener('click', closeImportModal);
document.getElementById('importCancelBtn').addEventListener('click', closeImportModal);
document.getElementById('personnelImportOverlay').addEventListener('click', e => {
  if (e.target.id === 'personnelImportOverlay') closeImportModal();
});

// ══════════════════════════════════════════════════════
// ── 車輛資訊 ──────────────────────────────────────────
// ══════════════════════════════════════════════════════

// ── Status config ─────────────────────────────────────
const VS = {
  pending:  { label: '待送紙本', color: '#d97706', bg: '#fef3c7' },
  applying: { label: '申請中',   color: '#2563eb', bg: '#dbeafe' },
  issued:   { label: '已核發',   color: '#16a34a', bg: '#dcfce7' },
};
function vsBadge(status) {
  const s = VS[status] || VS.pending;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;color:${s.color};background:${s.bg}">${s.label}</span>`;
}

// ── Vehicle doc keys ──────────────────────────────────
// ── Modal open/close ──────────────────────────────────
window.openVehicleModal = function(id = null) {
  editingVehicleId = id;
  const v = id ? vehicles.find(x => x.id === id) : null;
  document.getElementById('vehicle-modal-title').textContent = v ? '編輯車輛' : '新增車輛';

  // 人員下拉（從 personnel 清單帶入）
  const pSel = document.getElementById('v-personnel');
  const sorted = [...personnel].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-TW'));
  pSel.innerHTML = '<option value="">請選擇人員</option>' +
    sorted.map(p => `<option value="${p.id}" data-uid="${p.uid || ''}" data-name="${p.name || ''}" data-unit="${p.unit || ''}">${p.name}${p.unit ? '（' + p.unit + '）' : ''}</option>`).join('');

  // 編輯時預選人員
  if (v?.personnelId) pSel.value = v.personnelId;
  else if (v?.ownerName) {
    const match = personnel.find(p => p.name === v.ownerName);
    if (match) pSel.value = match.id;
  }

  document.getElementById('v-type').value  = v?.type  || '';
  document.getElementById('v-plate').value = v?.plate || '';
  document.getElementById('v-brand').value = v?.brand || '';
  document.getElementById('v-color').value = v?.color || '';
  document.getElementById('vehicleModalOverlay').classList.add('open');
};

function closeVehicleModal() {
  document.getElementById('vehicleModalOverlay').classList.remove('open');
}
document.getElementById('vehicleModalClose').addEventListener('click',  closeVehicleModal);
document.getElementById('vehicleCancelBtn').addEventListener('click',   closeVehicleModal);
document.getElementById('vehicleModalOverlay').addEventListener('click', e => { if (e.target.id === 'vehicleModalOverlay') closeVehicleModal(); });

// ── Save vehicle ──────────────────────────────────────
document.getElementById('vehicleSaveBtn').addEventListener('click', async () => {
  const pSel  = document.getElementById('v-personnel');
  const pOpt  = pSel.options[pSel.selectedIndex];
  const type  = document.getElementById('v-type').value;
  const plate = document.getElementById('v-plate').value.trim().toUpperCase();

  if (!pSel.value)  { alert('請選擇人員'); return; }
  if (!type || !plate) { alert('請填寫車種和車牌'); return; }

  const data = {
    personnelId: pSel.value,
    uid:         pOpt?.dataset.uid  || '',
    ownerName:   pOpt?.dataset.name || '',
    unit:        pOpt?.dataset.unit || '',
    type, plate,
    brand: document.getElementById('v-brand').value.trim(),
    color: document.getElementById('v-color').value.trim(),
  };

  try {
    if (editingVehicleId) {
      await updateDoc(doc(db, 'vehicles', editingVehicleId), data);
    } else {
      data.status    = 'pending';
      data.createdAt = serverTimestamp();
      await addDoc(COL_VEHICLES, data);
    }
    closeVehicleModal();
  } catch(e) { console.error(e); alert('儲存失敗'); }
});

// ── My vehicles (profile page) — 唯讀顯示 ───────────
function renderMyVehicles() {
  const el = document.getElementById('my-vehicle-list');
  if (!el) return;
  const uid  = currentUser?.uid || 'dev-uid';
  const mine = vehicles.filter(v => v.uid === uid);
  if (!mine.length) {
    el.innerHTML = '<div class="prof-empty-hint">尚無車輛資訊，請聯絡承辦人協助登記</div>';
    return;
  }
  el.innerHTML = mine.map(v => {
    const status = v.status || 'pending';
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:22px">${v.type === '汽車' ? '🚗' : '🏍'}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:700;font-size:15px;font-family:monospace;letter-spacing:1px">${v.plate}</span>
          ${vsBadge(status)}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${v.type}${v.brand ? '・' + v.brand : ''}${v.color ? '・' + v.color : ''}</div>
        ${status === 'applying' ? `<div style="font-size:11px;color:#2563eb;margin-top:4px">⏳ 申請中，等待核發</div>` : ''}
        ${status === 'issued'   ? `<div style="font-size:11px;color:#16a34a;margin-top:4px">✅ 車證已核發</div>` : ''}
      </div>
    </div>`;
  }).join('') + '<div style="padding-bottom:4px"></div>';
}

// ── Vehicles management page ──────────────────────────
function renderVehiclesPage() {
  const q      = (document.getElementById('vehicleSearch')?.value || '').toLowerCase();
  const type   = document.getElementById('vehicleTypeFilter')?.value   || '';
  const status = document.getElementById('vehicleStatusFilter')?.value || '';
  const unit   = document.getElementById('vehicleUnitFilter')?.value   || '';

  let list = vehicles;
  if (q)      list = list.filter(v => (v.ownerName||'').toLowerCase().includes(q) || (v.plate||'').toLowerCase().includes(q));
  if (type)   list = list.filter(v => v.type === type);
  if (status) list = list.filter(v => (v.status || 'pending') === status);
  if (unit)   list = list.filter(v => v.unit === unit);

  const unitSel = document.getElementById('vehicleUnitFilter');
  if (unitSel) {
    const units = [...new Set(vehicles.map(v => v.unit).filter(Boolean))].sort();
    const cur   = unitSel.value;
    unitSel.innerHTML = '<option value="">全部單位</option>' + units.map(u => `<option${u === cur ? ' selected' : ''}>${u}</option>`).join('');
  }

  const statsEl = document.getElementById('vehicleStats');
  if (statsEl) {
    const pending  = vehicles.filter(v => (v.status||'pending') === 'pending').length;
    const applying = vehicles.filter(v => v.status === 'applying').length;
    const issued   = vehicles.filter(v => v.status === 'issued').length;
    statsEl.textContent = `共 ${vehicles.length} 筆 ／ 待送紙本 ${pending} ／ 申請中 ${applying} ／ 已核發 ${issued}`;
  }

  const tbody   = document.getElementById('vehicleTableBody');
  const emptyEl = document.getElementById('vehicleEmpty');
  if (!list.length) { tbody.innerHTML = ''; emptyEl.style.display = ''; return; }
  emptyEl.style.display = 'none';

  tbody.innerHTML = list.map((v, i) => {
    const st = v.status || 'pending';
    const nextBtn = st === 'pending'
      ? `<button class="btn btn-primary btn-sm" onclick="changeVehicleStatus('${v.id}','applying')">申請中</button>`
      : st === 'applying'
      ? `<button class="btn btn-primary btn-sm" style="background:var(--green)" onclick="changeVehicleStatus('${v.id}','issued')">已核發</button>`
      : `<span style="font-size:12px;color:var(--green);font-weight:600">✓ 核發完成</span>`;
    return `
    <tr>
      <td class="col-seq">${i + 1}</td>
      <td class="col-name">${v.ownerName || '—'}</td>
      <td class="col-unit"><span class="unit-tag">${v.unit || '—'}</span></td>
      <td>${v.type === '汽車' ? '🚗' : '🏍'} ${v.type || '—'}</td>
      <td style="font-family:monospace;font-weight:700;letter-spacing:1px">${v.plate || '—'}</td>
      <td>${v.brand || '—'}</td>
      <td>${v.color || '—'}</td>
      <td>${vsBadge(st)}</td>
      <td class="col-actions" style="white-space:nowrap">
        ${nextBtn}
        <button class="btn-icon danger" style="margin-left:4px" onclick="deleteVehicle('${v.id}','${v.plate}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

document.getElementById('vehicleSearch')?.addEventListener('input', renderVehiclesPage);
document.getElementById('vehicleTypeFilter')?.addEventListener('change', renderVehiclesPage);
document.getElementById('vehicleStatusFilter')?.addEventListener('change', renderVehiclesPage);
document.getElementById('vehicleUnitFilter')?.addEventListener('change', renderVehiclesPage);

// ── Change status ─────────────────────────────────────
window.changeVehicleStatus = async function(id, newStatus) {
  const v = vehicles.find(x => x.id === id);
  if (!v) return;
  const labels = { applying: '申請中', issued: '已核發' };
  if (!confirm(`確認將「${v.plate}」狀態更新為「${labels[newStatus]}」？`)) return;
  try {
    const update = { status: newStatus };
    if (newStatus === 'applying') update.appliedAt  = serverTimestamp();
    if (newStatus === 'issued')   update.issuedAt   = serverTimestamp();
    await updateDoc(doc(db, 'vehicles', id), update);
  } catch(e) { console.error(e); alert('更新失敗'); }
};

// ── Delete vehicle ────────────────────────────────────
window.deleteVehicle = async function(id, plate) {
  if (!confirm(`確定要刪除車牌「${plate}」的車輛資訊？`)) return;
  try { await deleteDoc(doc(db, 'vehicles', id)); }
  catch(e) { console.error(e); alert('刪除失敗'); }
};

// ── Export CSV ────────────────────────────────────────
document.getElementById('vehicleExportBtn')?.addEventListener('click', () => {
  if (!vehicles.length) { alert('尚無車輛資料'); return; }
  const cols = ['姓名','單位','車種','車牌','廠牌','顏色','狀態'];
  const rows = vehicles.map(v => [
    v.ownerName, v.unit, v.type, v.plate, v.brand, v.color,
    VS[v.status || 'pending']?.label || '待送紙本',
  ].map(x => `"${(x||'').replace(/"/g,'""')}"`));
  const csv = '﻿' + [cols.map(c => `"${c}"`).join(','), ...rows.map(r => r.join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `車輛申請_${new Date().toLocaleDateString('zh-TW').replace(/\//g,'-')}.csv`;
  a.click();
});

// ══════════════════════════════════════════════════════
// ── 服裝供售點數 ──────────────────────────────────────
// ══════════════════════════════════════════════════════

const UP_UNITS = ['衛生營營部', '衛生營第一連', '衛生營第二連'];

// ── Helpers ───────────────────────────────────────────
function getRecordYearMonth(r) {
  if (r.yearMonth) return r.yearMonth;
  const ts = r.submittedAt || r.createdAt || r.updatedAt;
  if (!ts) return currentYearMonth;
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toISOString().slice(0, 7);
  } catch { return currentYearMonth; }
}

function fmtYearMonth(ym) {
  if (!ym) return '—';
  const [y, m] = ym.split('-');
  return `${y}年${parseInt(m)}月`;
}

function fmtUpTs(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function renderUniformPointsPage() {
  // ── Month chips ──
  const monthChips = document.getElementById('upMonthChips');
  if (monthChips) {
    const monthSet = new Set([currentYearMonth]);
    uniformPoints.forEach(r => monthSet.add(getRecordYearMonth(r)));
    const months = [...monthSet].sort((a, b) => b.localeCompare(a));
    monthChips.innerHTML = months.map(m =>
      `<button class="unit-chip${upSelectedMonth === m ? ' active' : ''}" data-month="${m}">${fmtYearMonth(m)}${m === currentYearMonth ? ' ★' : ''}</button>`
    ).join('');
    monthChips.querySelectorAll('[data-month]').forEach(chip => {
      chip.addEventListener('click', () => {
        upSelectedMonth = chip.dataset.month;
        renderUniformPointsPage();
      });
    });
  }

  // ── Unit chips ──
  const unitChips = document.getElementById('upUnitChips');
  if (unitChips) {
    unitChips.innerHTML =
      `<button class="unit-chip${!upUnitFilter ? ' active' : ''}" data-unit="">全部</button>` +
      UP_UNITS.map(u =>
        `<button class="unit-chip${upUnitFilter === u ? ' active' : ''}" data-unit="${u}">${u}</button>`
      ).join('');
    unitChips.querySelectorAll('[data-unit]').forEach(chip => {
      chip.addEventListener('click', () => {
        upUnitFilter = chip.dataset.unit;
        renderUniformPointsPage();
      });
    });
  }

  // ── Filter by month ──
  const q = (document.getElementById('upSearch')?.value || '').toLowerCase();
  let list = uniformPoints.filter(r => getRecordYearMonth(r) === upSelectedMonth);
  if (upUnitFilter) list = list.filter(r => r.unit === upUnitFilter);
  if (q)            list = list.filter(r => (r.ownerName || '').toLowerCase().includes(q));

  // ── Stats ──
  const statsEl = document.getElementById('upStats');
  if (statsEl) {
    const totalQuota     = list.reduce((s, r) => s + (Number(r.quota)     || 0), 0);
    const totalRemaining = list.reduce((s, r) => s + (Number(r.remaining) || 0), 0);
    const totalUsed      = totalQuota - totalRemaining;
    statsEl.textContent = `${fmtYearMonth(upSelectedMonth)} ／ 已申報 ${list.length} 人 ／ 配額 ${totalQuota} 點 ／ 已使用 ${totalUsed} 點 ／ 剩餘 ${totalRemaining} 點`;
  }

  // ── Submitted table ──
  const tbody   = document.getElementById('upTableBody');
  const emptyEl = document.getElementById('upEmpty');
  if (!list.length) { tbody.innerHTML = ''; emptyEl.style.display = ''; }
  else {
    emptyEl.style.display = 'none';
    tbody.innerHTML = list.map((r, i) => {
      const quota     = Number(r.quota)     || 0;
      const remaining = Number(r.remaining) || 0;
      const used      = quota - remaining;
      const remColor  = remaining < 0 ? 'color:#dc2626;font-weight:700'
                      : remaining === 0 ? 'color:#64748b'
                      : 'color:#16a34a;font-weight:600';
      const ts = fmtUpTs(r.submittedAt || r.updatedAt || r.createdAt);
      return `
      <tr>
        <td class="col-seq">${i + 1}</td>
        <td class="col-name">${r.ownerName || '—'}</td>
        <td class="col-unit"><span class="unit-tag">${r.unit || '—'}</span></td>
        <td style="text-align:right">${quota}</td>
        <td style="text-align:right;${remColor}">${remaining}</td>
        <td style="text-align:right">${used}</td>
        <td style="font-size:12px;color:var(--text-muted)">${ts}</td>
        <td class="col-actions">
          <button class="btn-icon" onclick="openUniformPointsModal('${r.id}')">✏️</button>
          <button class="btn-icon danger" onclick="deleteUniformPoints('${r.id}','${r.ownerName}')">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Not-submitted section ──
  const notSection = document.getElementById('upNotSubmittedSection');
  const notList    = document.getElementById('upNotSubmittedList');
  const notCount   = document.getElementById('upNotSubmittedCount');
  if (notSection && notList) {
    const submittedPIds  = new Set(list.map(r => r.personnelId).filter(Boolean));
    const submittedNames = new Set(list.map(r => r.ownerName).filter(Boolean));
    const basePersonnel  = upUnitFilter
      ? personnel.filter(p => p.unit === upUnitFilter)
      : personnel;
    const missing = basePersonnel.filter(p =>
      !submittedPIds.has(p.id) && !submittedNames.has(p.name)
    );
    if (missing.length) {
      notSection.style.display = '';
      notCount.textContent = `（${missing.length} 人）`;
      notList.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px">` +
        missing.map(p =>
          `<div style="display:flex;align-items:center;gap:6px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:6px 12px;font-size:13px">
            <span style="font-weight:600">${p.name}</span>
            <span style="color:var(--text-muted);font-size:11px">${p.unit || ''}</span>
          </div>`
        ).join('') + `</div>`;
    } else {
      notSection.style.display = 'none';
    }
  }
}

document.getElementById('upSearch')?.addEventListener('input', renderUniformPointsPage);

// ── Modal ─────────────────────────────────────────────
let upManualMode = false;

window.openUniformPointsModal = function(id = null) {
  editingUpId  = id;
  upManualMode = false;
  const r = id ? uniformPoints.find(x => x.id === id) : null;

  document.getElementById('up-modal-title').textContent = id ? '編輯點數記錄' : '新增點數記錄';

  // Reset manual/select mode
  document.getElementById('up-select-section').style.display      = '';
  document.getElementById('up-manual-section').style.display      = 'none';
  document.getElementById('up-manual-unit-section').style.display = 'none';
  document.getElementById('up-manual-name').value = '';
  document.getElementById('up-manual-unit').value = '';

  // Populate personnel dropdown
  const pSel = document.getElementById('up-personnel');
  const sorted = [...personnel].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-TW'));
  pSel.innerHTML = '<option value="">請選擇人員</option>' +
    sorted.map(p => `<option value="${p.id}" data-name="${p.name}" data-unit="${p.unit || ''}">${p.name}${p.unit ? '（' + p.unit + '）' : ''}</option>`).join('');

  // Submitted-at display row (only when editing)
  const subRow = document.getElementById('up-submitted-row');
  if (r) {
    const ts = fmtUpTs(r.submittedAt || r.createdAt);
    document.getElementById('up-submitted-display').value = ts;
    subRow.style.display = ts !== '—' ? '' : 'none';
  } else {
    subRow.style.display = 'none';
  }

  // Fill existing values
  if (r) {
    if (r.personnelId) {
      pSel.value = r.personnelId;
    } else {
      upManualMode = true;
      document.getElementById('up-select-section').style.display      = 'none';
      document.getElementById('up-manual-section').style.display      = '';
      document.getElementById('up-manual-unit-section').style.display = '';
      document.getElementById('up-manual-name').value = r.ownerName || '';
      document.getElementById('up-manual-unit').value = r.unit      || '';
    }
    document.getElementById('up-quota').value     = r.quota     ?? '';
    document.getElementById('up-remaining').value = r.remaining ?? '';
    calcUpUsed();
  } else {
    pSel.value = '';
    document.getElementById('up-quota').value     = '';
    document.getElementById('up-remaining').value = '';
    document.getElementById('up-used').value      = '';
  }
  // Show month info in title
  const ym = id ? getRecordYearMonth(uniformPoints.find(x => x.id === id)) : upSelectedMonth;
  document.getElementById('up-modal-title').textContent =
    (id ? '編輯' : '新增') + '點數記錄（' + fmtYearMonth(ym) + '）';

  document.getElementById('upModalOverlay').classList.add('open');
};

function calcUpUsed() {
  const q = Number(document.getElementById('up-quota').value)     || 0;
  const r = Number(document.getElementById('up-remaining').value) || 0;
  document.getElementById('up-used').value = q - r;
}

document.getElementById('up-quota')?.addEventListener('input',     calcUpUsed);
document.getElementById('up-remaining')?.addEventListener('input', calcUpUsed);

// Toggle manual mode
document.getElementById('up-toggle-manual')?.addEventListener('click', () => {
  upManualMode = true;
  document.getElementById('up-select-section').style.display      = 'none';
  document.getElementById('up-manual-section').style.display      = '';
  document.getElementById('up-manual-unit-section').style.display = '';
  document.getElementById('up-manual-name').focus();
});

document.getElementById('up-cancel-manual')?.addEventListener('click', () => {
  upManualMode = false;
  document.getElementById('up-select-section').style.display      = '';
  document.getElementById('up-manual-section').style.display      = 'none';
  document.getElementById('up-manual-unit-section').style.display = 'none';
});

function closeUpModal() {
  document.getElementById('upModalOverlay').classList.remove('open');
}
document.getElementById('upModalClose')?.addEventListener('click',  closeUpModal);
document.getElementById('upCancelBtn')?.addEventListener('click',   closeUpModal);
document.getElementById('upModalOverlay')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeUpModal();
});

// ── Save ──────────────────────────────────────────────
document.getElementById('upSaveBtn')?.addEventListener('click', async () => {
  let ownerName   = '';
  let unit        = '';
  let personnelId = null;

  if (upManualMode) {
    ownerName = document.getElementById('up-manual-name').value.trim();
    unit      = document.getElementById('up-manual-unit').value;
    if (!ownerName) { alert('請輸入姓名'); return; }
    if (!unit)      { alert('請選擇單位'); return; }
  } else {
    const pSel = document.getElementById('up-personnel');
    const opt  = pSel.options[pSel.selectedIndex];
    if (!pSel.value) { alert('請選擇人員'); return; }
    personnelId = pSel.value;
    ownerName   = opt.dataset.name || opt.text;
    unit        = opt.dataset.unit || '';
  }

  const quotaEl     = document.getElementById('up-quota');
  const remainingEl = document.getElementById('up-remaining');
  if (quotaEl.value === '')     { alert('請輸入配額點數'); return; }
  if (remainingEl.value === '') { alert('請輸入剩餘點數'); return; }
  const quota     = Number(quotaEl.value);
  const remaining = Number(remainingEl.value);
  const used      = quota - remaining;

  const yearMonth = editingUpId
    ? (uniformPoints.find(x => x.id === editingUpId)?.yearMonth || upSelectedMonth)
    : upSelectedMonth;

  const data = {
    personnelId,
    ownerName,
    unit,
    quota,
    remaining,
    used,
    yearMonth,
    updatedAt: serverTimestamp(),
  };

  try {
    if (editingUpId) {
      await updateDoc(doc(db, 'uniformPoints', editingUpId), data);
    } else {
      data.submittedAt = serverTimestamp();
      await addDoc(COL_UNIFORM_POINTS, data);
    }
    closeUpModal();
  } catch(e) { console.error(e); alert('儲存失敗：' + e.message); }
});

// ── Delete ────────────────────────────────────────────
window.deleteUniformPoints = async function(id, name) {
  if (!confirm(`確定要刪除「${name}」的點數記錄？`)) return;
  try { await deleteDoc(doc(db, 'uniformPoints', id)); }
  catch(e) { console.error(e); alert('刪除失敗'); }
};

// ── Export CSV ────────────────────────────────────────
document.getElementById('uniformPointsExportBtn')?.addEventListener('click', () => {
  if (!uniformPoints.length) { alert('尚無點數資料'); return; }
  const cols = ['姓名', '單位', '配額點數', '剩餘點數', '使用點數', '填寫時間'];
  const rows = uniformPoints.map(r => {
    const quota     = Number(r.quota)     || 0;
    const remaining = Number(r.remaining) || 0;
    const used      = quota - remaining;
    return [`"${r.ownerName || ''}"`, `"${r.unit || ''}"`, quota, remaining, used, `"${fmtUpTs(r.submittedAt || r.createdAt)}"`];
  });
  const csv = '﻿' + [cols.map(c => `"${c}"`).join(','), ...rows.map(r => r.join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `服裝供售點數_${new Date().toLocaleDateString('zh-TW').replace(/\//g,'-')}.csv`;
  a.click();
});

// ══════════════════════════════════════════════════════
// ── 個人資料頁：服裝供售點數 ──────────────────────────
// ══════════════════════════════════════════════════════

function renderMyUniformPoints() {
  const viewEl = document.getElementById('up-profile-view');
  if (!viewEl || !currentUser) return;

  const uid      = currentUser.uid;
  const myName   = profileData?.name || '';

  // 比對 personnelId 或姓名（公開表單不一定有 personnelId）
  const myRecords = uniformPoints
    .filter(r =>
      r.personnelId === uid ||
      (!r.personnelId && myName && r.ownerName === myName)
    )
    .sort((a, b) => getRecordYearMonth(b).localeCompare(getRecordYearMonth(a)));

  const thisMonth = myRecords.find(r => getRecordYearMonth(r) === currentYearMonth);
  const prevRecords = myRecords.filter(r => getRecordYearMonth(r) !== currentYearMonth);

  // ── 點數卡片 HTML helper ──
  function monthCard(r, isCurrent = false) {
    const quota     = Number(r.quota)     || 0;
    const remaining = Number(r.remaining) || 0;
    const used      = quota - remaining;
    const remColor  = remaining < 0 ? '#dc2626' : remaining === 0 ? '#94a3b8' : '#16a34a';
    const usePct    = quota > 0 ? Math.min(100, Math.round(used / quota * 100)) : 0;
    const barColor  = usePct >= 90 ? '#dc2626' : usePct >= 60 ? '#d97706' : '#2563eb';
    const ts        = fmtUpTs(r.submittedAt || r.updatedAt || r.createdAt);
    const ym        = fmtYearMonth(getRecordYearMonth(r));

    return `
    <div style="background:var(--bg);border-radius:10px;padding:14px 16px;margin-bottom:10px;
                ${isCurrent ? 'border:2px solid #2563eb' : 'border:1px solid var(--border)'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:13px;font-weight:700;color:${isCurrent ? '#2563eb' : 'var(--text-muted)'}">
          ${isCurrent ? '📅 本月 ' : ''}${ym}
        </span>
        ${isCurrent ? '<span style="font-size:11px;background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:99px;font-weight:700">✅ 已申報</span>' : ''}
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;margin-bottom:10px">
        <div style="background:#fff;border-radius:8px;padding:10px 6px">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">配額</div>
          <div style="font-size:${isCurrent ? '20' : '16'}px;font-weight:700;color:#2563eb">${quota}</div>
        </div>
        <div style="background:#fff;border-radius:8px;padding:10px 6px">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">剩餘</div>
          <div style="font-size:${isCurrent ? '20' : '16'}px;font-weight:700;color:${remColor}">${remaining}</div>
        </div>
        <div style="background:#fff;border-radius:8px;padding:10px 6px">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">使用</div>
          <div style="font-size:${isCurrent ? '20' : '16'}px;font-weight:700">${used}</div>
        </div>
      </div>

      <!-- 使用率進度條 -->
      ${quota > 0 ? `
      <div style="height:5px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${usePct}%;background:${barColor};border-radius:99px;transition:width .5s"></div>
      </div>
      <div style="font-size:10px;color:var(--text-muted);text-align:right;margin-bottom:4px">使用率 ${usePct}%</div>
      ` : ''}

      <div style="font-size:11px;color:var(--text-muted);text-align:right">最後更新：${ts}</div>
    </div>`;
  }

  let html = '';

  // ── 本月狀態 ──
  if (thisMonth) {
    html += monthCard(thisMonth, true);
  } else {
    html += `
    <div style="background:#fef3c7;border:1.5px solid #fcd34d;border-radius:10px;
                padding:13px 15px;margin-bottom:12px;font-size:13px;color:#92400e">
      ⚠️ 本月（${fmtYearMonth(currentYearMonth)}）尚未申報點數，請點擊「更新本月點數」填寫。
    </div>`;
  }

  // ── 歷史記錄 ──
  if (myRecords.length === 0) {
    // 完全沒有任何記錄
    html = '<div class="prof-empty-hint">尚無服裝供售點數申報紀錄</div>';
  } else {
    // 有記錄：不管有沒有歷史，都顯示歷史區塊標題
    html += `
    <div style="display:flex;align-items:center;gap:8px;margin:16px 0 10px;padding-bottom:8px;border-bottom:2px solid var(--border)">
      <span style="font-size:13px;font-weight:700">📂 歷史申報紀錄</span>
      <span style="font-size:12px;color:var(--text-muted)">${prevRecords.length > 0 ? `共 ${prevRecords.length} 筆` : '暫無'}</span>
    </div>`;
    if (prevRecords.length) {
      html += prevRecords.map(r => monthCard(r, false)).join('');
    } else {
      html += `<div class="prof-empty-hint" style="margin:0 0 8px">過往月份尚無申報記錄</div>`;
    }
  }

  viewEl.innerHTML = html;
}

// ── Profile form event handlers ───────────────────────
document.getElementById('up-prof-open-btn')?.addEventListener('click', () => {
  // pre-fill with current month's data if exists
  const uid = currentUser?.uid;
  const existing = uid ? uniformPoints.find(r => r.personnelId === uid && getRecordYearMonth(r) === currentYearMonth) : null;
  document.getElementById('up-prof-month-label').textContent = `申報月份：${fmtYearMonth(currentYearMonth)}`;
  document.getElementById('up-prof-quota').value     = existing?.quota     ?? '';
  document.getElementById('up-prof-remaining').value = existing?.remaining ?? '';
  document.getElementById('up-prof-used').value      = existing ? (Number(existing.quota) - Number(existing.remaining)) : '';
  document.getElementById('up-profile-form').style.display = '';
  document.getElementById('up-prof-quota').focus();
});

document.getElementById('up-prof-cancel-btn')?.addEventListener('click', () => {
  document.getElementById('up-profile-form').style.display = 'none';
});

document.getElementById('up-prof-quota')?.addEventListener('input', () => {
  const q = Number(document.getElementById('up-prof-quota').value) || 0;
  const r = Number(document.getElementById('up-prof-remaining').value) || 0;
  document.getElementById('up-prof-used').value = q - r;
});
document.getElementById('up-prof-remaining')?.addEventListener('input', () => {
  const q = Number(document.getElementById('up-prof-quota').value) || 0;
  const r = Number(document.getElementById('up-prof-remaining').value) || 0;
  document.getElementById('up-prof-used').value = q - r;
});

document.getElementById('up-prof-save-btn')?.addEventListener('click', async () => {
  if (!currentUser) return;
  const quotaEl     = document.getElementById('up-prof-quota');
  const remainingEl = document.getElementById('up-prof-remaining');
  if (quotaEl.value === '')     { alert('請輸入配額點數'); quotaEl.focus(); return; }
  if (remainingEl.value === '') { alert('請輸入剩餘點數'); remainingEl.focus(); return; }

  const uid       = currentUser.uid;
  const quota     = Number(quotaEl.value);
  const remaining = Number(remainingEl.value);
  const used      = quota - remaining;
  const name      = profileData?.name || currentUser.displayName || '';
  const unit      = profileData?.unit || '';

  const data = {
    personnelId: uid,
    ownerName:   name,
    unit,
    quota,
    remaining,
    used,
    yearMonth:   currentYearMonth,
    submittedAt: serverTimestamp(),
    source:      'profile',
  };

  const btn = document.getElementById('up-prof-save-btn');
  btn.disabled = true;
  try {
    const existing = uniformPoints.find(r => r.personnelId === uid && getRecordYearMonth(r) === currentYearMonth);
    if (existing) {
      await updateDoc(doc(db, 'uniformPoints', existing.id), data);
    } else {
      await addDoc(COL_UNIFORM_POINTS, data);
    }
    document.getElementById('up-profile-form').style.display = 'none';
    // Navigate to uniform-points if accessible
    const allowed = ROLES[currentRole]?.pages || ROLES.member.pages;
    if (allowed.has('uniform-points')) navigateTo('uniform-points');
  } catch(e) { console.error(e); alert('儲存失敗：' + e.message); }
  finally { btn.disabled = false; }
});

// ── 帳號申請：新增為人員 ──────────────────────────────
window.addPersonnelFromRequest = function(reqId, name, unit) {
  openPersonnelForm(null);
  setTimeout(() => {
    const nameEl = document.getElementById('pf-name');
    const unitEl = document.getElementById('pf-unit');
    if (nameEl) nameEl.value = name || '';
    if (unitEl) unitEl.value = unit || '';
  }, 50);
};

// ══════════════════════════════════════════════════════
// ── 入職申請 ─────────────────────────────────────────
// ══════════════════════════════════════════════════════

function renderApplications() {
  const q   = (document.getElementById('appSearch')?.value || '').trim().toLowerCase();
  const st  = document.getElementById('appStatusFilter')?.value || '';
  let list  = applications;
  if (q)  list = list.filter(a => (a.name||'').toLowerCase().includes(q) || (a.phone||'').includes(q));
  if (st) list = list.filter(a => a.status === st);

  const pending  = applications.filter(a => a.status === 'pending').length;
  const imported = applications.filter(a => a.status === 'imported').length;
  const statsEl  = document.getElementById('appStats');
  if (statsEl) statsEl.textContent = `共 ${applications.length} 筆 ／ 待處理 ${pending} ／ 已匯入 ${imported}`;

  const el = document.getElementById('app-list');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📥</div><p>尚無申請資料</p></div>`;
    return;
  }
  el.innerHTML = list.map(a => {
    const ts = a.submittedAt?.toDate?.() || null;
    const dateStr = ts ? ts.toLocaleDateString('zh-TW') : '—';
    const isPending = a.status !== 'imported';
    return `
    <div class="recruit-card" onclick="openAppDetail('${a.id}')" style="border-left-color:${isPending ? 'var(--yellow)' : 'var(--green)'}">
      <div class="recruit-avatar">${(a.name||'?')[0]}</div>
      <div class="recruit-info">
        <div class="recruit-name">${a.name || '—'}
          <span class="tag ${isPending ? 'tag-中' : ''}" style="${!isPending ? 'background:var(--green-bg);color:var(--green)' : ''};margin-left:8px">
            ${isPending ? '待處理' : '已匯入'}
          </span>
        </div>
        <div class="recruit-meta">
          <span>📞 ${a.phone || '—'}</span>
          <span>🎂 ${a.birthDate || '—'}</span>
          <span>📅 ${dateStr}</span>
          ${a.education ? `<span>🎓 ${a.education}</span>` : ''}
        </div>
      </div>
      <div class="recruit-actions">
        <button class="btn-icon danger" onclick="event.stopPropagation();deleteApplication('${a.id}','${(a.name||'').replace(/'/g,"\\'")}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('appSearch')?.addEventListener('input', renderApplications);
document.getElementById('appStatusFilter')?.addEventListener('change', renderApplications);

// ── Detail modal ──────────────────────────────────────
window.openAppDetail = function(id) {
  const a = applications.find(x => x.id === id);
  if (!a) return;
  viewingAppId = id;

  const ts = a.submittedAt?.toDate?.() || null;
  const dateStr = ts ? ts.toLocaleString('zh-TW') : '—';

  const row  = (label, val) => val ? `<div class="pd-row"><div class="pd-label">${label}</div><div class="pd-val">${val}</div></div>` : '';
  const sec  = (title) => `<div class="pd-section-title">${title}</div>`;
  const grid = (items) => `<div class="pd-grid">${items}</div>`;

  const addr = [a.addrCity, a.addrDistrict, a.addrDetail].filter(Boolean).join('');
  const cur  = [a.curAddrCity, a.curAddrDistrict, a.curAddrDetail].filter(Boolean).join('');
  const licenses = Array.isArray(a.licenses) ? a.licenses.join('、') : (a.licenses || '—');
  const hobbies  = Array.isArray(a.hobbies)  ? a.hobbies.join('、')  : (a.hobbies  || '—');
  const fmRows = Array.isArray(a.familyMembers) && a.familyMembers.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px">
        <thead><tr style="background:var(--bg)"><th style="padding:6px 10px;text-align:left">關係</th><th style="padding:6px 10px;text-align:left">年齡</th><th style="padding:6px 10px;text-align:left">職業</th></tr></thead>
        <tbody>${a.familyMembers.map(m => `<tr><td style="padding:6px 10px">${m.relation||'—'}</td><td style="padding:6px 10px">${m.age||'—'}</td><td style="padding:6px 10px">${m.job||'—'}</td></tr>`).join('')}</tbody>
      </table>`
    : '無';

  document.getElementById('app-detail-title').textContent = `入職申請 — ${a.name || '—'}`;
  document.getElementById('app-detail-body').innerHTML = `
    <div class="pd-section">
      ${sec('📋 基本資料')}
      ${grid(`
        ${row('姓名', a.name)} ${row('性別', a.gender)}
        ${row('出生年月日', a.birthDate)} ${row('身分證', a.idNumber)}
        ${row('電話', a.phone)} ${row('LINE', a.lineId)}
        ${row('Email', a.email)} ${row('婚姻狀況', a.marital)}
        ${row('戶籍地址', addr || '—')} ${row('現居地址', cur || addr || '—')}
      `)}
    </div>
    <div class="pd-section">
      ${sec('🎓 學歷與工作')}
      ${grid(`
        ${row('最高學歷', a.education)} ${row('學校', a.school)}
        ${row('科系', a.department)} ${row('在學狀態', a.studyStatus)}
        ${row('目前職業', a.job)} ${row('工作單位', a.company)}
        ${row('工作性質', a.jobType)} ${row('月薪範圍', a.salary)}
        ${row('兵役狀況', a.military)} ${row('服役單位', a.militaryUnit)}
      `)}
      ${a.workHistory ? `<div style="margin-top:10px"><div class="pd-label">工作經歷</div><div class="pd-val" style="white-space:pre-wrap">${a.workHistory}</div></div>` : ''}
      ${a.militaryExp ? `<div style="margin-top:6px"><div class="pd-label">服役經歷</div><div class="pd-val" style="white-space:pre-wrap">${a.militaryExp}</div></div>` : ''}
    </div>
    <div class="pd-section">
      ${sec('⭐ 興趣與專長')}
      ${grid(`
        ${row('駕照', licenses)} ${row('興趣', hobbies)}
        ${row('英語程度', a.english)} ${row('其他語言', a.otherLang)}
      `)}
      ${a.skills ? `<div style="margin-top:6px"><div class="pd-label">專業技能</div><div class="pd-val" style="white-space:pre-wrap">${a.skills}</div></div>` : ''}
      ${a.certs  ? `<div style="margin-top:6px"><div class="pd-label">持有證照</div><div class="pd-val" style="white-space:pre-wrap">${a.certs}</div></div>` : ''}
    </div>
    <div class="pd-section">
      ${sec('👨‍👩‍👧 家庭狀況')}
      ${grid(`${row('子女數', a.children)} ${row('家庭所在縣市', a.homeCity)}`)}
      ${a.familyNote ? `<div style="margin-top:6px"><div class="pd-label">家庭簡介</div><div class="pd-val">${a.familyNote}</div></div>` : ''}
      <div style="margin-top:10px"><div class="pd-label" style="margin-bottom:4px">家庭成員</div>${fmRows}</div>
    </div>
    <div class="pd-section">
      ${sec('📋 其他資訊')}
      ${grid(`${row('可報到日期', a.availDate)} ${row('接受派遣', a.relocate)} ${row('健康狀況', a.health)}`)}
      ${a.motivation ? `<div style="margin-top:6px"><div class="pd-label">加入動機</div><div class="pd-val" style="white-space:pre-wrap">${a.motivation}</div></div>` : ''}
      ${a.strength   ? `<div style="margin-top:6px"><div class="pd-label">個人優勢</div><div class="pd-val" style="white-space:pre-wrap">${a.strength}</div></div>` : ''}
      ${a.healthNote ? `<div style="margin-top:6px"><div class="pd-label">健康備註</div><div class="pd-val">${a.healthNote}</div></div>` : ''}
      ${grid(`${row('緊急聯絡人', a.emergencyName)} ${row('關係', a.emergencyRel)} ${row('緊急電話', a.emergencyPhone)}`)}
      ${a.notes ? `<div style="margin-top:6px"><div class="pd-label">其他備註</div><div class="pd-val" style="white-space:pre-wrap">${a.notes}</div></div>` : ''}
    </div>
    <div style="font-size:12px;color:var(--text-muted);text-align:right;margin-top:8px">申請時間：${dateStr}</div>
  `;

  const importBtn = document.getElementById('appImportBtn');
  importBtn.textContent = a.status === 'imported' ? '✓ 已匯入' : '⬆ 匯入人員資料';
  importBtn.disabled = a.status === 'imported';

  document.getElementById('appDetailOverlay').classList.add('open');
};

document.getElementById('appDetailClose').addEventListener('click',  () => document.getElementById('appDetailOverlay').classList.remove('open'));
document.getElementById('appDetailClose2').addEventListener('click', () => document.getElementById('appDetailOverlay').classList.remove('open'));

document.getElementById('appDeleteBtn').addEventListener('click', () => {
  const a = applications.find(x => x.id === viewingAppId);
  if (a) deleteApplication(a.id, a.name || '此筆申請');
});

window.deleteApplication = async function(id, name) {
  if (!confirm(`確定要刪除「${name}」的入職申請？此動作無法復原。`)) return;
  try {
    await deleteDoc(doc(db, 'applications', id));
    document.getElementById('appDetailOverlay').classList.remove('open');
  } catch(e) {
    console.error(e);
    alert('刪除失敗，請稍後再試');
  }
};
document.getElementById('appDetailOverlay').addEventListener('click', e => {
  if (e.target.id === 'appDetailOverlay') document.getElementById('appDetailOverlay').classList.remove('open');
});

// ── Print ─────────────────────────────────────────────
document.getElementById('appPrintBtn').addEventListener('click', () => {
  const body   = document.getElementById('app-detail-body').innerHTML;
  const title  = document.getElementById('app-detail-title').textContent;
  const win    = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="zh-TW"><head>
    <meta charset="UTF-8"><title>${title}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Segoe UI',sans-serif; font-size:13px; color:#1e293b; padding:24px 32px; }
      h1 { font-size:18px; font-weight:700; margin-bottom:4px; color:#0b1f3a; }
      .subtitle { font-size:12px; color:#64748b; margin-bottom:20px; padding-bottom:12px; border-bottom:2px solid #0b1f3a; }
      .pd-section { margin-bottom:18px; }
      .pd-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#64748b; margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid #dde3ea; }
      .pd-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; }
      .pd-row { display:flex; flex-direction:column; gap:1px; }
      .pd-label { font-size:10px; color:#64748b; font-weight:600; text-transform:uppercase; }
      .pd-val { font-size:13px; color:#1e293b; }
      table { width:100%; border-collapse:collapse; font-size:12px; margin-top:4px; }
      th,td { padding:5px 8px; text-align:left; border:1px solid #dde3ea; }
      th { background:#f0f4f8; }
      @media print { body { padding:12px 16px; } }
    </style>
  </head><body>
    <h1>${title}</h1>
    <div class="subtitle">列印日期：${new Date().toLocaleDateString('zh-TW')}</div>
    ${body}
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
});

// ── Import to personnel ────────────────────────────────
document.getElementById('appImportBtn').addEventListener('click', async () => {
  const a = applications.find(x => x.id === viewingAppId);
  if (!a || a.status === 'imported') return;
  if (!confirm(`確認將「${a.name}」的基本資料匯入人員管理？`)) return;

  const btn = document.getElementById('appImportBtn');
  btn.disabled = true;
  btn.textContent = '匯入中…';

  try {
    await addDoc(COL_PERSONNEL, {
      name:           a.name || '',
      gender:         a.gender || '',
      birthDate:      a.birthDate || '',
      idNumber:       a.idNumber || '',
      phone:          a.phone || '',
      addrCity:       a.addrCity || '',
      addrDistrict:   a.addrDistrict || '',
      addrDetail:     a.addrDetail || '',
      emergencyName:  a.emergencyName || '',
      emergencyRel:   a.emergencyRel || '',
      emergencyPhone: a.emergencyPhone || '',
      notes:          a.notes || '',
      unit:           '',
      rank:           '',
      joinDate:       '',
      isRecruiter:    false,
      importedFrom:   viewingAppId,
      createdAt:      serverTimestamp(),
    });
    await updateDoc(doc(db, 'applications', viewingAppId), { status: 'imported' });
    btn.textContent = '✓ 已匯入';
    alert(`「${a.name}」已匯入人員管理，請至人員資訊管理補齊級職與單位。`);
    document.getElementById('appDetailOverlay').classList.remove('open');
  } catch (e) {
    console.error(e);
    alert('匯入失敗，請稍後再試');
    btn.disabled = false;
    btn.textContent = '⬆ 匯入人員資料';
  }
});

// ── Export CSV ────────────────────────────────────────
document.getElementById('appExportBtn')?.addEventListener('click', () => {
  if (!applications.length) { alert('尚無申請資料'); return; }
  const cols = ['姓名','性別','出生年月日','身分證','電話','LINE','Email','婚姻','最高學歷','學校','科系','職業','工作單位','兵役','駕照','興趣','專長','緊急聯絡人','緊急關係','緊急電話','加入動機','申請日期','狀態'];
  const rows = applications.map(a => [
    a.name, a.gender, a.birthDate, a.idNumber, a.phone, a.lineId, a.email, a.marital,
    a.education, a.school, a.department, a.job, a.company, a.military,
    Array.isArray(a.licenses) ? a.licenses.join('|') : '',
    Array.isArray(a.hobbies)  ? a.hobbies.join('|')  : '',
    a.skills, a.emergencyName, a.emergencyRel, a.emergencyPhone, a.motivation,
    a.submittedAt?.toDate?.()?.toLocaleDateString('zh-TW') || '',
    a.status === 'imported' ? '已匯入' : '待處理',
  ].map(v => `"${(v||'').toString().replace(/"/g,'""')}"`));
  const csv = '﻿' + [cols.map(c => `"${c}"`).join(','), ...rows.map(r => r.join(','))].join('\n');
  const a2  = document.createElement('a');
  a2.href   = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a2.download = `入職申請_${new Date().toLocaleDateString('zh-TW').replace(/\//g,'-')}.csv`;
  a2.click();
});
