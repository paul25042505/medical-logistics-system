import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL, listAll, getMetadata
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
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
const storage = getStorage(app);
const auth    = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ── Refs ──────────────────────────────────────────────
const COL_RECRUITS   = collection(db, 'recruits');
const COL_BATCHES    = collection(db, 'batches');
const COL_RECRUITERS = collection(db, 'recruiters');
const COL_ACTIVITIES = collection(db, 'activities');
const COL_LEADS      = collection(db, 'leads');
const COL_PERSONNEL  = collection(db, 'personnel');
const COL_USERS      = collection(db, 'users');
const DOC_ADMIN      = doc(db, 'settings', 'admin');

// ── State ─────────────────────────────────────────────
let records       = [];
let batches       = [];
let recruiters    = [];
let activities    = [];
let leads         = [];
let adminSettings = { units: [], battalions: [], companies: [] };

let currentTab     = 'civilian';
let editingId      = null;
let detailId       = null;
let editingBatchId = null;
let editingRcrId   = null;
let pendingFiles   = [];

let personnel          = [];
let personnelUnitFilter = [];
let editingPersonnelId = null;
let viewingPersonnelId = null;

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
  const isAdmin = userData.admin || user.email === ADMIN_EMAIL;
  document.getElementById('admin-nav-item').style.display = isAdmin ? '' : 'none';
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
      provider:    'google.com',
      createdAt:   new Date().toISOString(),
      lastLogin:   new Date().toISOString(),
    });
    if (isAdmin) {
      showApp(user, { name: user.displayName, admin: true });
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
devBtn.style.display = isDev ? '' : 'none';
devBtn.addEventListener('click', () => {
  showApp({ email: ADMIN_EMAIL, displayName: '開發模式' }, { name: '開發模式', admin: true });
  if (!appStarted) { appStarted = true; startApp(); }
});

// Google 登入
document.getElementById('google-login-btn').addEventListener('click', async () => {
  document.getElementById('login-error').textContent = '';
  try { await signInWithPopup(auth, googleProvider); }
  catch (e) {
    const m = { 'auth/popup-closed-by-user': '登入視窗已關閉', 'auth/network-request-failed': '網路連線失敗' };
    document.getElementById('login-error').textContent = m[e.code] || '登入失敗，請再試一次';
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
  if (loaded.size >= 7) {
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
const ACT_TYPE_LABELS = { school: '學校宣傳', booth: '擺攤活動', visit: '家訪', other: '其他' };
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
}

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
  'activity':        () => { renderActivities(); updateStorageBar(); },
  'leads':           () => renderLeads(),
  'profile':         () => renderProfilePage(),
  'admin':           () => { renderAdminPage(); },
  'personnel':       () => { renderPersonnelUnitFilters(); renderPersonnel(); },
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
    recruiters.map(rc => `<option>${rc.rank} ${rc.name}</option>`).join('');
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
  const c = document.getElementById('recruiter-list');
  if (!recruiters.length) {
    c.innerHTML = `<div class="empty-state"><div class="icon">🪖</div><p>尚無招募員，點擊「＋ 新增招募員」開始建立</p></div>`;
    return;
  }
  c.innerHTML = recruiters.map(rc => `
    <div class="recruiter-card">
      <div class="recruiter-avatar">${rc.name?.[0] || '?'}</div>
      <div class="recruiter-info">
        <div class="recruiter-name">${rc.rank} ${rc.name}</div>
        ${rc.phone ? `<div class="recruiter-meta">📞 ${rc.phone}</div>` : ''}
      </div>
      <div class="recruit-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="openRecruiterEdit('${rc.id}')">✏️</button>
        <button class="btn-icon danger" onclick="deleteRecruiter('${rc.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

document.getElementById('addRecruiterBtn').addEventListener('click', () => {
  editingRcrId = null;
  document.getElementById('recruiter-modal-title').textContent = '新增招募員';
  ['r-rank','r-name','r-phone'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('recruiterModalOverlay').classList.add('open');
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

window.openRecruiterEdit = function (id) {
  editingRcrId = id;
  const rc = recruiters.find(x => x.id === id);
  if (!rc) return;
  document.getElementById('recruiter-modal-title').textContent = '編輯招募員';
  document.getElementById('r-rank').value  = rc.rank  || '';
  document.getElementById('r-name').value  = rc.name  || '';
  document.getElementById('r-phone').value = rc.phone || '';
  document.getElementById('recruiterModalOverlay').classList.add('open');
};

window.deleteRecruiter = async function (id) {
  const rc = recruiters.find(x => x.id === id);
  if (!rc || !confirm(`確定要刪除「${rc.rank} ${rc.name}」嗎？`)) return;
  try { await deleteDoc(doc(db, 'recruiters', id)); } catch (e) { console.error(e); }
};

// ── Storage 使用量 ────────────────────────────────────
async function updateStorageBar() {
  const textEl = document.getElementById('storage-used-text');
  const barEl  = document.getElementById('storage-bar-fill');
  if (!textEl || !barEl) return;
  try {
    const root   = ref(storage, 'activities');
    const top    = await listAll(root);
    const items  = [...top.items];
    for (const prefix of top.prefixes) {
      const sub = await listAll(prefix);
      items.push(...sub.items);
    }
    const sizes = await Promise.all(items.map(i => getMetadata(i).then(m => m.size || 0).catch(() => 0)));
    const totalBytes = sizes.reduce((a, b) => a + b, 0);
    const usedMB  = totalBytes / 1024 / 1024;
    const limitGB = 5;
    const pct     = Math.min((usedMB / (limitGB * 1024)) * 100, 100);
    const label   = usedMB < 1024
      ? `已使用 ${usedMB.toFixed(1)} MB / ${limitGB} GB`
      : `已使用 ${(usedMB / 1024).toFixed(2)} GB / ${limitGB} GB`;
    textEl.textContent = label;
    barEl.style.width  = pct + '%';
    barEl.className    = 'storage-bar-fill ' + (pct > 80 ? 'bar-danger' : pct > 50 ? 'bar-warning' : 'bar-ok');
  } catch (e) {
    if (textEl) textEl.textContent = '無法取得空間資訊';
  }
}

// ── 下載面板 ──────────────────────────────────────────
const downloadPanel   = document.getElementById('download-panel');
const downloadDateList = document.getElementById('download-date-list');
const checkAllBox     = document.getElementById('download-check-all');

document.getElementById('downloadAllPhotosBtn').addEventListener('click', () => {
  const withPhotos = activities.filter(a => (a.photos || []).length > 0)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!withPhotos.length) { alert('目前沒有任何照片'); return; }

  downloadDateList.innerHTML = withPhotos.map(act => `
    <label class="download-date-item">
      <input type="checkbox" class="dl-check" data-id="${act.id}" checked>
      <div class="download-date-item-info">
        <div class="download-date-item-name">${formatDate(act.date)}${act.location ? '　📍' + act.location : ''}</div>
        <div class="download-date-item-count">${act.photos.length} 張照片</div>
      </div>
    </label>`).join('');

  checkAllBox.checked = true;
  downloadPanel.style.display = '';
});

checkAllBox.addEventListener('change', () => {
  document.querySelectorAll('.dl-check').forEach(c => { c.checked = checkAllBox.checked; });
});

document.getElementById('downloadCancelBtn').addEventListener('click', () => {
  downloadPanel.style.display = 'none';
});

document.getElementById('downloadConfirmBtn').addEventListener('click', async () => {
  const selected = [...document.querySelectorAll('.dl-check:checked')].map(c => c.dataset.id);
  if (!selected.length) { alert('請至少選擇一個活動'); return; }

  const chosenActs = activities.filter(a => selected.includes(a.id));
  const allPhotos  = chosenActs.flatMap(act =>
    (act.photos || []).map((url, i) => ({ url, folder: `${act.date || '未知日期'}_${act.location || act.id}`, idx: i + 1 }))
  );

  const confirmBtn = document.getElementById('downloadConfirmBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = '準備中…';

  try {
    const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
    const zip = new JSZip();
    for (let i = 0; i < allPhotos.length; i++) {
      const { url, folder, idx } = allPhotos[i];
      confirmBtn.textContent = `下載中 ${i + 1}/${allPhotos.length}…`;
      const res  = await fetch(url);
      const blob = await res.blob();
      const ext  = blob.type.split('/')[1] || 'jpg';
      zip.file(`${folder}/${idx}.${ext}`, blob);
    }
    confirmBtn.textContent = '產生壓縮檔…';
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(content);
    a.download = '招募活動照片.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    downloadPanel.style.display = 'none';
  } catch (e) {
    alert('下載失敗：' + e.message);
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = '⬇ 開始下載';
  }
});

// ── 招募活動 Render ───────────────────────────────────
function renderActivities() {
  const c = document.getElementById('activity-list');
  if (!activities.length) {
    c.innerHTML = `<div class="empty-state"><div class="icon">📸</div><p>尚無招募活動，點擊「＋ 新增活動」開始記錄</p></div>`;
    return;
  }
  const sorted = [...activities].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  c.innerHTML = sorted.map(act => {
    const thumb = act.photos?.[0]
      ? `<div class="activity-thumb" style="background-image:url('${act.photos[0]}')"></div>`
      : `<div class="activity-thumb-empty">📷</div>`;
    const typeLabel = ACT_TYPE_LABELS[act.type] || act.type || '';
    return `<div class="activity-card" onclick="openActivityDetail('${act.id}')">
      ${thumb}
      <div class="activity-card-body">
        <div class="activity-date">${formatDate(act.date)}</div>
        ${typeLabel ? `<span class="tag tag-default" style="font-size:11px">${typeLabel}</span>` : ''}
        ${act.location ? `<div class="activity-location">📍 ${act.location}</div>` : ''}
        ${act.note ? `<div class="activity-note">${act.note}</div>` : ''}
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${(act.photos||[]).length} 張照片</div>
      </div>
      <button class="btn-icon danger" style="position:absolute;top:8px;right:8px"
        onclick="event.stopPropagation();deleteActivity('${act.id}')">🗑️</button>
    </div>`;
  }).join('');
}

// ── 活動 Modal ────────────────────────────────────────
document.getElementById('addActivityBtn').addEventListener('click', openActivityModal);
document.getElementById('activityModalClose').addEventListener('click', closeActivityModal);
document.getElementById('activityCancelBtn').addEventListener('click', closeActivityModal);
document.getElementById('activityModalOverlay').addEventListener('click', e => {
  if (e.target.id === 'activityModalOverlay') closeActivityModal();
});

function openActivityModal() {
  pendingFiles = [];
  ['act-location','act-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('act-date').value  = '';
  document.getElementById('act-type').value  = 'school';
  document.getElementById('upload-preview').innerHTML = '';
  document.getElementById('uploadPrompt').style.display = '';
  document.getElementById('upload-progress').style.display = 'none';
  document.getElementById('photo-input').value = '';
  document.getElementById('activityModalOverlay').classList.add('open');
}

function closeActivityModal() {
  document.getElementById('activityModalOverlay').classList.remove('open');
  pendingFiles = [];
}

// Upload area
const uploadArea = document.getElementById('uploadArea');
const photoInput = document.getElementById('photo-input');

uploadArea.addEventListener('click', () => photoInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  addFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/')));
});
photoInput.addEventListener('change', function () {
  addFiles([...this.files]);
  this.value = '';
});

function addFiles(files) {
  pendingFiles = [...pendingFiles, ...files];
  renderUploadPreview();
}

function renderUploadPreview() {
  const container = document.getElementById('upload-preview');
  document.getElementById('uploadPrompt').style.display = pendingFiles.length ? 'none' : '';
  container.innerHTML = pendingFiles.map((file, i) => {
    const url = URL.createObjectURL(file);
    return `<div class="preview-thumb">
      <img src="${url}" alt="">
      <button class="preview-remove" onclick="removePendingFile(${i})">✕</button>
    </div>`;
  }).join('');
}

window.removePendingFile = function (idx) {
  pendingFiles.splice(idx, 1);
  renderUploadPreview();
};

document.getElementById('activitySaveBtn').addEventListener('click', async () => {
  const date = document.getElementById('act-date').value;
  if (!date) { alert('請填寫活動日期'); return; }
  const btn = document.getElementById('activitySaveBtn');
  btn.disabled = true;

  const data = {
    date,
    type:     document.getElementById('act-type').value,
    location: document.getElementById('act-location').value.trim(),
    note:     document.getElementById('act-note').value.trim(),
    photos:   [],
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(COL_ACTIVITIES, data);

    if (pendingFiles.length > 0) {
      document.getElementById('upload-progress').style.display = '';
      const urls = [];

      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        const ext  = file.name.split('.').pop() || 'jpg';
        const storageRef = ref(storage, `activities/${docRef.id}/${Date.now()}_${i}.${ext}`);

        await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file);
          task.on('state_changed',
            snap => {
              const pct = Math.round(((i + snap.bytesTransferred / snap.totalBytes) / pendingFiles.length) * 100);
              document.getElementById('progressFill').style.width = pct + '%';
              document.getElementById('progressText').textContent =
                `上傳中 ${i + 1}/${pendingFiles.length}… ${pct}%`;
            },
            reject,
            async () => { urls.push(await getDownloadURL(task.snapshot.ref)); resolve(); }
          );
        });
      }
      await updateDoc(docRef, { photos: urls });
    }
    closeActivityModal();
  } catch (e) {
    console.error(e);
    alert('儲存失敗，請稍後再試');
  } finally {
    btn.disabled = false;
    document.getElementById('upload-progress').style.display = 'none';
  }
});

// ── 活動詳情 Modal ────────────────────────────────────
window.openActivityDetail = function (id) {
  const act = activities.find(x => x.id === id);
  if (!act) return;
  const typeLabel = ACT_TYPE_LABELS[act.type] || act.type || '';
  document.getElementById('activityDetailTitle').textContent =
    `${formatDate(act.date)}${typeLabel ? ' · ' + typeLabel : ''}`;

  const photos = act.photos || [];
  const photoHTML = photos.length
    ? `<div class="photo-gallery">${photos.map(url =>
        `<img class="gallery-img" src="${url}" onclick="openLightbox('${url}')" alt="">`).join('')}</div>`
    : '<div style="color:var(--text-muted);padding:12px 0">尚無照片</div>';

  document.getElementById('activityDetailBody').innerHTML = `
    <div class="form-section">
      <div class="detail-grid">
        ${act.location ? `<div class="detail-item"><div class="detail-label">地點</div><div class="detail-value">📍 ${act.location}</div></div>` : ''}
        ${act.note ? `<div class="detail-item"><div class="detail-label">說明</div><div class="detail-value">${act.note}</div></div>` : ''}
      </div>
    </div>
    <div class="form-section">
      <h4 style="margin-bottom:12px">照片（${photos.length} 張）</h4>
      ${photoHTML}
    </div>`;

  document.getElementById('activityDetailOverlay').classList.add('open');
};

document.getElementById('activityDetailClose').addEventListener('click',
  () => document.getElementById('activityDetailOverlay').classList.remove('open'));
document.getElementById('activityDetailOverlay').addEventListener('click', e => {
  if (e.target.id === 'activityDetailOverlay') document.getElementById('activityDetailOverlay').classList.remove('open');
});

window.deleteActivity = async function (id) {
  if (!confirm('確定要刪除此活動及所有照片嗎？')) return;
  try { await deleteDoc(doc(db, 'activities', id)); } catch (e) { console.error(e); }
};

// ── Lightbox ──────────────────────────────────────────
window.openLightbox = function (url) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox').classList.add('open');
};
window.closeLightbox = function () {
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightbox-img').src = '';
};

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
async function renderProfilePage() {
  if (!currentUser) return;
  const snap = await getDoc(doc(db, 'users', currentUser.uid));
  const userData = snap.exists() ? snap.data() : {};
  const profile  = userData.profile || {};
  const sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  sv('prof-name',  profile.name  || userData.name  || userData.displayName || '');
  sv('prof-rank',  profile.rank);
  sv('prof-duty',  profile.duty);
  sv('prof-unit',  profile.unit);
  sv('prof-phone', profile.phone);
  sv('prof-notes', profile.notes);
}

window.saveProfile = async function () {
  if (!currentUser) return;
  const gv  = id => document.getElementById(id)?.value?.trim() || '';
  const profile = {
    name:      gv('prof-name'),
    rank:      gv('prof-rank'),
    duty:      gv('prof-duty'),
    unit:      document.getElementById('prof-unit').value,
    phone:     gv('prof-phone'),
    notes:     gv('prof-notes'),
    updatedAt: new Date().toISOString(),
  };
  const btn = document.getElementById('prof-save-btn');
  btn.disabled = true;
  btn.textContent = '儲存中…';
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { profile });
    if (profile.name) document.getElementById('header-email').textContent = profile.name;
    btn.textContent = '✓ 已儲存';
    setTimeout(() => { btn.disabled = false; btn.textContent = '儲存'; }, 2000);
  } catch (e) {
    console.error(e);
    alert('儲存失敗');
    btn.disabled = false;
    btn.textContent = '儲存';
  }
};

// ── Start App (called after login) ────────────────────
function startApp() {
  document.getElementById('loading-screen').style.display = '';

  onSnapshot(DOC_ADMIN, snap => {
    adminSettings = snap.exists() ? snap.data() : { units: [], battalions: [], companies: [] };
    renderAdminPage();
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

  onSnapshot(COL_ACTIVITIES, snap => {
    activities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('page-activity').classList.contains('active')) renderActivities();
    markLoaded('activities');
  }, () => markLoaded('activities'));

  onSnapshot(COL_LEADS, snap => {
    leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('page-leads').classList.contains('active')) renderLeads();
    markLoaded('leads');
  }, () => markLoaded('leads'));

  onSnapshot(COL_PERSONNEL, snap => {
    personnel = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('page-personnel').classList.contains('active')) renderPersonnel();
    markLoaded('personnel');
  }, () => markLoaded('personnel'));

  onSnapshot(COL_USERS, snap => {
    const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const el = document.getElementById('admin-users-list');
    if (!el) return;
    if (!allUsers.length) {
      el.innerHTML = '<li style="color:var(--text-muted);font-size:13px;padding:8px 0">尚無帳號</li>';
      return;
    }
    el.innerHTML = allUsers.map(u => `
      <li class="admin-list-item">
        <div>
          <div style="font-weight:600;font-size:14px">${u.name || u.displayName || '—'}</div>
          <div style="font-size:12px;color:var(--text-muted)">${u.email}</div>
        </div>
        <div class="admin-item-actions">
          ${u.admin
            ? `<span style="font-size:12px;color:var(--accent);font-weight:600">管理員</span>`
            : u.approved
              ? `<span style="font-size:12px;color:var(--green)">✓ 已核准</span>`
              : `<button class="btn btn-primary btn-sm" onclick="approveUser('${u.id}')">核准</button>`
          }
        </div>
      </li>`).join('');
  }, () => {});
}

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

  tbody.innerHTML = filtered.map((p, i) => {
    const age      = calcAge(p.birthDate);
    const idMasked = p.idNumber
      ? p.idNumber.slice(0, 1) + '●●●●●●●' + p.idNumber.slice(-2)
      : '—';
    return `<tr class="personnel-row" data-id="${p.id}">
      <td class="col-seq">${i + 1}</td>
      <td class="col-unit"><span class="unit-tag">${p.unit || '—'}</span></td>
      <td class="col-rank">${p.rank || '—'}</td>
      <td class="col-name"><strong>${p.name || '—'}</strong></td>
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
function openPersonnelForm(id) {
  editingPersonnelId = id;
  clearPersonnelForm();
  populatePersonnelUnit();
  if (id) {
    document.getElementById('personnel-modal-title').textContent = '編輯人員';
    const p = personnel.find(x => x.id === id);
    if (p) fillPersonnelForm(p);
  } else {
    document.getElementById('personnel-modal-title').textContent = '新增人員';
  }
  document.getElementById('personnelModalOverlay').classList.add('open');
}

function clearPersonnelForm() {
  ['pf-name','pf-rank','pf-phone','pf-idNumber',
   'pf-emergencyName','pf-emergencyRel','pf-emergencyPhone','pf-address','pf-notes']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['pf-unit','pf-gender','pf-bloodType']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('pf-birthDate').value = '';
  document.getElementById('pf-joinDate').value  = '';
}

function fillPersonnelForm(p) {
  const sv = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
  sv('pf-unit', p.unit);   sv('pf-rank', p.rank);     sv('pf-name', p.name);
  sv('pf-gender', p.gender);                           sv('pf-birthDate', p.birthDate);
  sv('pf-idNumber', p.idNumber);                       sv('pf-phone', p.phone);
  sv('pf-bloodType', p.bloodType);                     sv('pf-joinDate', p.joinDate);
  sv('pf-emergencyName', p.emergencyName);             sv('pf-emergencyRel', p.emergencyRel);
  sv('pf-emergencyPhone', p.emergencyPhone);           sv('pf-address', p.address);
  sv('pf-notes', p.notes);
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
    bloodType:      document.getElementById('pf-bloodType').value,
    joinDate:       document.getElementById('pf-joinDate').value,
    emergencyName:  gv('pf-emergencyName'),
    emergencyRel:   gv('pf-emergencyRel'),
    emergencyPhone: gv('pf-emergencyPhone'),
    address:        gv('pf-address'),
    notes:          gv('pf-notes'),
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
                   '電話','血型','到職日','緊急聯絡人','關係','緊急聯絡電話','戶籍地址','備註'];
  const rows = filtered.map((p, i) => [
    i + 1, p.unit || '', p.rank || '', p.name || '', p.gender || '',
    p.birthDate || '', calcAge(p.birthDate) || '', p.idNumber || '', p.phone || '',
    p.bloodType || '', p.joinDate || '', p.emergencyName || '', p.emergencyRel || '',
    p.emergencyPhone || '', p.address || '', p.notes || '',
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
        ${row('血型',     p.bloodType)}
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
    ${(p.address || p.notes) ? `
    <div class="pd-section">
      <div class="pd-section-title">其他資訊</div>
      <div class="pd-grid">
        ${row('戶籍地址', p.address)}
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
