import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache,
  collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, serverTimestamp
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
const COL_FITNESS         = collection(db, 'fitnessTests');
const COL_ACCOUNT_REQS    = collection(db, 'accountRequests');
const COL_MED_SUPPLIES    = collection(db, 'medSupplies');
const COL_MED_INV_LOGS    = collection(db, 'medInventoryLogs');
const COL_MED_EQUIPS      = collection(db, 'medEquipments');
const COL_EQUIP_TYPES    = collection(db, 'equipmentTypes');
const COL_CERTS = collection(db, 'personnelCerts');
const COL_FT_STANDBY   = collection(db, 'ftStandby');
const COL_FT_OFFICERS  = collection(db, 'ftOfficers');
const COL_COMMS_EQUIP  = collection(db, 'commsEquipment');
const COL_COMMS_SCHED  = collection(db, 'commsMaintSched');
const COL_COMMS_LOG    = collection(db, 'commsMaintLog');
const COL_COMMS_NAMES    = collection(db, 'commsEquipNames');
const COL_COMMS_MONTHLY  = collection(db, 'commsMonthlyReports');
const DOC_ADMIN      = doc(db, 'settings', 'admin');

// ── State ─────────────────────────────────────────────
let records       = [];
let batches       = [];
let recruiters    = [];
let leads         = [];
let adminSettings = { units: [], battalions: [], companies: [], medUnits: [], pharmacies: [] };

// 醫務所分區狀態
let currentMedPharmacyId = ''; // 目前選中的醫務所（藥材清點頁）
let medSupplyShowHidden  = false; // 是否顯示已隱藏藥材

let currentTab     = 'civilian';
let editingId      = null;
let detailId       = null;
let editingBatchId = null;
let editingRcrId   = null;

let personnel          = [];
let personnelUnitFilter = [];
let fitnessTests       = [];
let certifications = [];
let ftStandbyRecords = [];
let ftOfficers = [];
let commsEquipment = [];
let commsMaintSched = [];
let commsMaintLog = [];
let commsEquipNames = [];
let commsMonthlyReports = [];

const FITNESS_CATS = [
  { id: 'upperBody', label: '上肢肌力及肌耐力（擇一）', items: ['兩分鐘俯地挺身', '壺鈴平舉', '引體向上（單槓）', '屈臂懸垂（女性）'] },
  { id: 'core',      label: '腹部核心肌群（擇一）',     items: ['兩分鐘仰臥起坐', '平板撐體 (Plank)', '仰臥捲腹'] },
  { id: 'cardio',    label: '心肺耐力（擇一）',          items: ['三千公尺徒手跑步', '五公里健走', '二十公尺漸進式折返跑', '八百公尺游走', '五分鐘跳繩'] },
];
const CERT_TYPES = {
  '緊急救護': ['EMT-1', 'EMT-2', 'EMT-P'],
  '戰傷救護': ['CLS', 'CLS-I', 'CMC', 'CMC-I'],
};
let editingPersonnelId = null;
let viewingPersonnelId = null;

let applications    = [];
let viewingAppId    = null;

let vehicles        = [];
let editingVehicleId = null;

let medSupplies      = [];
let medInventoryLogs = [];
let medEquipments    = [];
let equipmentTypes    = [];

// 車輛狀態設定（提前至頂部避免 TDZ）
const VS = {
  pending:  { label: '待送紙本', color: '#d97706', bg: '#fef3c7' },
  applying: { label: '申請中',   color: '#2563eb', bg: '#dbeafe' },
  issued:   { label: '已核發',   color: '#16a34a', bg: '#dcfce7' },
};

// 服裝點數單位（提前至頂部避免 TDZ）
const UP_UNITS = ['衛生營營部', '衛生營第一連', '衛生營第二連'];

// ── 台灣熱門汽機車廠牌（中英對照）────────────────────
const CAR_BRANDS  = [
  'Toyota 豐田','Honda 本田','Nissan 日產','Mazda 馬自達','Ford 福特',
  'Mitsubishi 三菱','Hyundai 現代','Kia 起亞','Volkswagen 福斯',
  'BMW 寶馬','Mercedes-Benz 賓士','Lexus 凌志','Subaru 速霸陸',
  'Suzuki 鈴木','Isuzu 五十鈴','Tesla 特斯拉','Volvo 富豪',
  'Audi 奧迪','LUXGEN 納智捷',
];
const MOTO_BRANDS = [
  'Yamaha 山葉','Honda 本田','光陽 Kymco','三陽 SYM',
  'Suzuki 鈴木','Kawasaki 川崎','PGO','Aeon Motor 宏佳騰',
  '台鈴 Suzuki TW','Harley-Davidson 哈雷','BMW 寶馬',
];
const OTHER_BRAND = '其他（手動輸入）';

// 階級權重（數字越小階級越高）
const RANK_WEIGHT = {
  '少將':1,'上校':2,'中校':3,'少校':4,
  '上尉':5,'中尉':6,'少尉':7,
  '一等士官長':8,'二等士官長':9,'三等士官長':10,'士官長':11,
  '上士':12,'中士':13,'下士':14,
  '上等兵':15,'一等兵':16,'二等兵':17,'上兵':18,'列兵':19,
};
function rankWeight(rank) { return RANK_WEIGHT[rank] ?? 99; }

function getBrandOptions(type) {
  if (!type) return '<option value="">— 請先選車種 —</option>';
  const list = type === '機車' ? MOTO_BRANDS : CAR_BRANDS;
  return '<option value="">— 請選擇廠牌 —</option>' +
    list.map(b => `<option value="${b}">${b}</option>`).join('') +
    `<option value="${OTHER_BRAND}">${OTHER_BRAND}</option>`;
}

// 車輛/人員管理單位 = 衛生營單位（adminSettings.medUnits）
function getVehicleUnits() {
  return adminSettings.medUnits?.length ? adminSettings.medUnits : ['衛生營營部','衛生營第一連','衛生營第二連'];
}

function populateVehicleUnitSel(selId, selectedUnit = '') {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const units = getVehicleUnits();
  sel.innerHTML = '<option value="">— 請先選單位 —</option>' +
    units.map(u => `<option value="${u}"${u === selectedUnit ? ' selected' : ''}>${u}</option>`).join('');
}

function populateVehiclePersonnelSel(selId, unit, selectedId = '') {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const filtered = unit
    ? personnel.filter(p => p.unit === unit).sort((a, b) => rankWeight(a.rank) - rankWeight(b.rank) || (a.name||'').localeCompare(b.name||'','zh-TW'))
    : [];
  sel.innerHTML = filtered.length
    ? '<option value="">請選擇人員</option>' +
      filtered.map(p => `<option value="${p.id}" data-uid="${p.uid||''}" data-name="${p.name||''}" data-unit="${p.unit||''}"${p.id === selectedId ? ' selected' : ''}>${p.rank ? p.rank + ' ' : ''}${p.name}</option>`).join('')
    : '<option value="">此單位無人員</option>';
}

let uniformPoints     = [];
let editingUpId       = null;
let upUnitFilter      = '';
const currentYearMonth = new Date().toISOString().slice(0, 7); // "2026-05"
let upSelectedMonth   = currentYearMonth;

let accountRequests   = [];
let registeredUsers   = [];

// ── Roles ─────────────────────────────────────────────
const ROLES = {
  admin:     { label: '系統管理員',   pages: new Set(['home','profile','contacts','daily-inventory','trainee-list','batch-sched','recruiters','leads','personnel','applications','fitness-test','ft-standby','vehicles','uniform-points','comms-equipment','medical-supplies','medical-equipment','certifications','admin']) },
  manager:   { label: '業務主管',     pages: new Set(['home','profile','contacts','daily-inventory','trainee-list','batch-sched','recruiters','leads','personnel','applications','fitness-test','ft-standby','vehicles','uniform-points','comms-equipment','medical-supplies','medical-equipment','certifications']) },
  recruit:   { label: '招募管理承辦', pages: new Set(['home','profile','contacts','daily-inventory','trainee-list','batch-sched','recruiters','leads']) },
  personnel: { label: '人事管理承辦', pages: new Set(['home','profile','contacts','daily-inventory','personnel','applications','fitness-test','ft-standby','certifications']) },
  training:  { label: '訓練管理承辦', pages: new Set(['home','profile','contacts','daily-inventory','fitness-test','ft-standby']) },
  logistics: { label: '後勤管理承辦', pages: new Set(['home','profile','contacts','daily-inventory','vehicles','uniform-points','comms-equipment']) },
  medical:   { label: '醫療軍品承辦', pages: new Set(['home','profile','contacts','daily-inventory','medical-supplies','medical-equipment','certifications']) },
  member:    { label: '一般成員',     pages: new Set(['home','profile','contacts','daily-inventory']) },
};
const FEATURE_GROUPS = [
  { group: '招募管理', icon: '📋', features: [
    { id: 'trainee-list',    label: '訓員列表' },
    { id: 'batch-sched',     label: '梯次期程' },
    { id: 'recruiters',      label: '招募員管理' },
    { id: 'leads',           label: '問卷填答' },
  ]},
  { group: '人事管理', icon: '👤', features: [
    { id: 'personnel',    label: '人員資訊管理' },
    { id: 'applications', label: '入職申請' },
  ]},
  { group: '後勤管理', icon: '🚚', features: [
    { id: 'vehicles',       label: '車輛資訊管理' },
    { id: 'uniform-points', label: '服裝供售點數' },
  ]},
  { group: '後勤裝備管理', icon: '📡', features: [
    { id: 'comms-equipment', label: '通信裝備' },
  ]},
  { group: '訓練管理', icon: '🏃', features: [
    { id: 'fitness-test', label: '年度體測管理' },
    { id: 'ft-standby',   label: '體測駐點待命用車' },
  ]},
  { group: '醫療軍品暨預防醫學管理', icon: '💊', features: [
    { id: 'medical-supplies',   label: '藥材清點' },
    { id: 'medical-equipment',  label: '衛材裝備清點' },
    { id: 'certifications',     label: '證照管制' },
  ]},
];

let currentRole = 'member';
let currentUserUnitScope = null; // null = 全部單位, ['衛生營第一連'] = 限定單位
let roleConfig = {}; // loaded from Firestore, overrides ROLES pages

// 依 unitScope 過濾資料列表（管理員/主管永遠看全部）
function filterByUnitScope(list, field = 'unit') {
  if (!currentUserUnitScope || !currentUserUnitScope.length) return list;
  if (currentRole === 'admin' || currentRole === 'manager') return list;
  return list.filter(item => currentUserUnitScope.includes(item[field]));
}

function getRolePages(roleId) {
  if (roleConfig[roleId]) return new Set(roleConfig[roleId]);
  return ROLES[roleId]?.pages || new Set(['home','profile']);
}

function applyRolePermissions(role) {
  currentRole = role;
  const allowed = getRolePages(role);
  allowed.add('home');
  allowed.add('profile');
  // Role-restricted nav items
  document.querySelectorAll('li[data-roles]').forEach(li => {
    li.style.display = li.dataset.roles.split(',').includes(role) ? '' : 'none';
  });
  // Section labels
  const show = {
    admin:     ['recruit','personnel','training','logistics','comms-equip','medical','system'],
    manager:   ['recruit','personnel','training','logistics','comms-equip','medical'],
    recruit:   ['recruit'],
    personnel: ['personnel','training'],
    training:  ['training'],
    logistics: ['logistics','comms-equip'],
    medical:   ['medical'],
    member:    [],
  }[role] || [];
  ['recruit','personnel','training','logistics','comms-equip','medical','system'].forEach(s => {
    const el = document.getElementById(`nav-section-${s}`);
    if (el) el.style.display = show.includes(s) ? '' : 'none';
  });
  // Admin nav item
  document.getElementById('admin-nav-item').style.display = role === 'admin' ? '' : 'none';
  // Redirect if current page unauthorized
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

// ── UI Helpers（取代原生 alert/confirm，相容 iOS standalone）──
function showToast(msg, duration = 2800) {
  const container = document.getElementById('app-toast');
  if (!container) { console.log('[toast]', msg); return; }
  const el = document.createElement('div');
  el.className = 'app-toast-msg';
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function showConfirm(msg, onConfirm, onCancel) {
  const overlay = document.getElementById('app-confirm-overlay');
  const msgEl   = document.getElementById('app-confirm-msg');
  const okBtn   = document.getElementById('app-confirm-ok');
  const cancelBtn = document.getElementById('app-confirm-cancel');
  if (!overlay) {
    if (window.confirm(msg)) onConfirm?.();
    else onCancel?.();
    return;
  }
  msgEl.textContent = msg;
  const close = () => overlay.classList.remove('open');
  okBtn.onclick     = () => { close(); onConfirm?.(); };
  cancelBtn.onclick = () => { close(); onCancel?.(); };
  overlay.classList.add('open');
}

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
  // 顯示申請表時：從 Firestore 載入單位清單
  if (screen === 'register') {
    const unitSel = document.getElementById('reg-unit');
    if (unitSel && unitSel.options.length <= 1) {
      getDoc(doc(db, 'settings', 'admin')).then(snap => {
        // 申請表用衛生營單位（medUnits），若無則用預設值
        const data  = snap.exists() ? snap.data() : {};
        const units = data.medUnits?.length
          ? data.medUnits
          : ['衛生營營部', '衛生營第一連', '衛生營第二連'];
        unitSel.innerHTML = '<option value="">— 請選擇單位 —</option>' +
          units.map(u => `<option value="${u}">${u}</option>`).join('');
      }).catch(() => {});
    }
  }
}

function showApp(user, userData) {
  authPage.style.display = 'none';
  mainHeader.style.display = '';
  mainLayout.style.display = '';
  // Use personnel record name + rank if linked
  const me = personnel?.find?.(p => p.id === userData.personnelId || (p.email && p.email.toLowerCase() === (user.email||'').toLowerCase()));
  const displayName = me
    ? `${me.rank ? me.rank + ' ' : ''}${me.name}`.trim()
    : (userData.name || user.email || '');
  document.getElementById('header-email').textContent = displayName;
  const role = userData.role || (userData.admin || user.email === ADMIN_EMAIL ? 'admin' : 'member');
  // 載入資料範圍（空陣列或未設定 = 全部）
  currentUserUnitScope = (userData.unitScope && userData.unitScope.length) ? userData.unitScope : null;
  applyRolePermissions(role);
}

onAuthStateChanged(auth, async user => {
  if (!user) { showAuthScreen('login'); return; }
  currentUser = user;
  const userRef  = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const isAdmin = user.email === ADMIN_EMAIL;

    // 查看是否有管理員已核准的帳號申請（email 比對）
    let isPreApproved = false;
    if (!isAdmin && user.email) {
      try {
        const reqSnap = await getDocs(
          query(COL_ACCOUNT_REQS,
            where('email',  '==', user.email),
            where('status', 'in', ['approved', 'merged'])
          )
        );
        isPreApproved = !reqSnap.empty;
      } catch {}
    }

    const approved = isAdmin || isPreApproved;
    await setDoc(userRef, {
      email:       user.email || '',
      displayName: user.displayName || '',
      name:        user.displayName || '',
      approved,
      admin:       isAdmin,
      role:        isAdmin ? 'admin' : 'member',
      provider:    'google.com',
      createdAt:   new Date().toISOString(),
      lastLogin:   new Date().toISOString(),
    });

    // 若管理員已預先建立人員資料（以 email 比對），自動帶入並核准
    let autoApproved = false;
    if (user.email) {
      try {
        const presSnap = await getDocs(query(COL_PERSONNEL, where('email', '==', user.email)));
        if (!presSnap.empty) {
          const pData = presSnap.docs[0].data();
          const pId   = presSnap.docs[0].id;
          await updateDoc(userRef, {
            name:        pData.name  || user.displayName || '',
            rank:        pData.rank  || '',
            unit:        pData.unit  || '',
            phone:       pData.phone || '',
            personnelId: pId,
            approved:    true,   // auto-approve if admin pre-created personnel
          });
          // link personnel doc → user uid
          await updateDoc(doc(db, 'personnel', pId), { uid: user.uid });
          autoApproved = true;
        }
      } catch(e) { console.warn('auto-populate failed', e); }
    }

    if (approved || autoApproved) {
      showApp(user, { name: user.displayName, admin: isAdmin, role: isAdmin ? 'admin' : 'member' });
      if (!appStarted) { appStarted = true; startApp(); }
    } else {
      document.getElementById('reg-email-display').textContent = user.email;
      document.getElementById('reg-name').value = user.displayName || '';
      showAuthScreen('register');
    }
  } else {
    const userData = userSnap.data();
    await updateDoc(userRef, { lastLogin: new Date().toISOString() });
    // 補連結：現有帳號但 personnelId 尚未設定
    if (userData.approved && !userData.personnelId && user.email) {
      try {
        const presSnap = await getDocs(query(COL_PERSONNEL, where('email', '==', user.email)));
        if (!presSnap.empty) {
          const pId = presSnap.docs[0].id;
          await updateDoc(userRef, { personnelId: pId });
          await updateDoc(doc(db, 'personnel', pId), { uid: user.uid });
        }
      } catch(e) {}
    }
    if (userData.approved) {
      showApp(user, userData);
      if (!appStarted) { appStarted = true; startApp(); }
    } else {
      // 再次確認是否已有核准申請（成員先填表後才登入的情況）
      let isPreApproved = false;
      if (user.email) {
        try {
          const reqSnap = await getDocs(
            query(COL_ACCOUNT_REQS,
              where('email',  '==', user.email),
              where('status', 'in', ['approved', 'merged'])
            )
          );
          isPreApproved = !reqSnap.empty;
        } catch {}
      }
      if (isPreApproved) {
        await updateDoc(userRef, { approved: true });
        showApp(user, { ...userData, approved: true });
        if (!appStarted) { appStarted = true; startApp(); }
      } else {
        document.getElementById('pending-email-display').textContent = user.email;
        showAuthScreen('pending');
      }
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
let _loginInProgress = false;
document.getElementById('google-login-btn').addEventListener('click', async () => {
  if (_loginInProgress) return;
  _loginInProgress = true;
  const btn   = document.getElementById('google-login-btn');
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '登入中…';
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
  } finally {
    _loginInProgress = false;
    btn.disabled = false;
    btn.textContent = origText;
  }
});

// 提交申請
document.getElementById('submit-register-btn').addEventListener('click', async () => {
  const errEl = document.getElementById('reg-error');
  errEl.textContent = '';
  const name  = document.getElementById('reg-name').value.trim();
  const unit  = document.getElementById('reg-unit').value;
  const rank  = document.getElementById('reg-rank')?.value.trim()  || '';
  const phone = document.getElementById('reg-phone')?.value.trim() || '';

  if (!name) { errEl.textContent = '請填寫姓名';        return; }
  if (!unit) { errEl.textContent = '請選擇所屬單位';    return; }

  try {
    // 更新 users/{uid}
    await updateDoc(doc(db, 'users', currentUser.uid), { name, unit, rank, phone });

    // 立即建立 personnel/{uid}，核准後即在人員管理出現
    await setDoc(doc(db, 'personnel', currentUser.uid), {
      uid:         currentUser.uid,
      name, unit, rank, phone,
      email:       currentUser.email || '',
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
      createdFrom: 'googleRegister',
    }, { merge: true });

    document.getElementById('pending-email-display').textContent = currentUser.email;
    showAuthScreen('pending');
  } catch (e) { console.error(e); errEl.textContent = '送出失敗，請再試一次'; }
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

window.linkUserToPersonnel = async function(userId) {
  const sel = document.getElementById('link-sel-' + userId);
  const personnelDocId = sel?.value;
  if (!personnelDocId) { alert('請選擇要連結的人員'); return; }
  const u = registeredUsers.find(x => x.id === userId);
  const p = personnel.find(x => x.id === personnelDocId);
  if (!u || !p) return;
  if (!confirm(`將帳號「${u.email}」連結到「${p.rank||''} ${p.name}」？`)) return;
  try {
    await updateDoc(doc(db, 'users', userId), { personnelId: personnelDocId });
    await updateDoc(doc(db, 'personnel', personnelDocId), { uid: userId, email: u.email || '' });
    alert('✓ 連結成功');
  } catch(e) { alert('連結失敗：' + e.message); }
};

window.unlinkPersonnelAccount = async function() {
  if (!editingPersonnelId) return;
  if (!confirm('確定解除帳號綁定？解除後對方下次以相同信箱登入仍可自動重新連結。')) return;
  try {
    const p = personnel.find(x => x.id === editingPersonnelId);
    if (p?.uid) {
      try { await updateDoc(doc(db, 'users', p.uid), { personnelId: '' }); } catch {}
    }
    await updateDoc(doc(db, 'personnel', editingPersonnelId), { uid: '' });
    fillPersonnelForm({ ...(p || {}), uid: '' });
    alert('已解除綁定');
  } catch(e) { alert('解除失敗：' + e.message); }
};

// ── Loading ───────────────────────────────────────────
const loaded = new Set();
let _loadingTimer = null;
function hideLoadingScreen() {
  const ls = document.getElementById('loading-screen');
  if (ls) ls.style.display = 'none';
  if (_loadingTimer) { clearTimeout(_loadingTimer); _loadingTimer = null; }
}
function markLoaded(key) {
  loaded.add(key);
  if (loaded.size >= 17) hideLoadingScreen();
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
  makeList('admin-medunit-list',   adminSettings.medUnits,   'medUnits');

  // ── 醫務所清單 ──
  const pharmaEl = document.getElementById('admin-pharmacy-list');
  if (pharmaEl) {
    const pArr = adminSettings.pharmacies || [];
    pharmaEl.innerHTML = pArr.length
      ? pArr.map((p, i) => `
          <li class="admin-list-item">
            <span>🏥 ${p.name}</span>
            <div class="admin-item-actions">
              <button class="admin-order-btn" onclick="movePharmacy(${i},'up')"  ${i === 0 ? 'disabled' : ''}>▲</button>
              <button class="admin-order-btn" onclick="movePharmacy(${i},'down')" ${i === pArr.length - 1 ? 'disabled' : ''}>▼</button>
              <button class="btn-icon danger" onclick="removePharmacy('${p.id}')">✕</button>
            </div>
          </li>`).join('')
      : '<li style="color:var(--text-muted);font-size:13px;padding:8px 0">尚無醫務所</li>';
  }

  // ── 帳號 / 申請整合清單 ──
  renderAdminAccountsSection();

  // ── 帳號角色＋單位範圍分配 ──
  renderUserRoleAssignment();

  // ── 角色業務設定 ──
  renderRoleConfig();
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

    // 檢查是否已連結人員記錄（只用 uid / personnelId，不用 email，避免解除綁定後仍顯示連結）
    const linkedPers = personnel.find(p =>
      p.uid === u.id ||
      p.id  === u.personnelId
    );

    return `<div style="padding:8px 10px;background:var(--bg);border-radius:6px;font-size:13px;margin-bottom:4px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div>
          <div style="font-weight:600;font-size:14px;color:var(--text)">${u.name || u.displayName || '—'}</div>
          <div style="font-size:12px;color:#64748b;word-break:break-all;margin-top:1px">${u.email || '—'}</div>
          ${linkedPers ? `<div style="font-size:11px;color:#16a34a;margin-top:2px">🔗 ${linkedPers.rank||''} ${linkedPers.name}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">${statusHtml}</div>
      </div>
      ${(u.approved || u.admin) && !linkedPers ? `
      <div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <select id="link-sel-${u.id}" style="flex:1;min-width:0;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px">
          <option value="">— 選擇要連結的人員 —</option>
          ${(() => {
            const unitOrder = [...new Set(
              (adminSettings.medUnits || []).concat(
                [...personnel].map(p => p.unit).filter(Boolean)
              )
            )];
            const grouped = {};
            [...personnel]
              .sort((a,b) => rankWeight(a.rank) - rankWeight(b.rank) || (a.name||'').localeCompare(b.name||'','zh-TW'))
              .forEach(p => {
                const u = p.unit || '其他';
                if (!grouped[u]) grouped[u] = [];
                grouped[u].push(p);
              });
            return unitOrder
              .filter(u => grouped[u])
              .concat(Object.keys(grouped).filter(u => !unitOrder.includes(u)))
              .map(unit => `<optgroup label="${unit}">${
                grouped[unit].map(p => `<option value="${p.id}">${p.rank ? p.rank+' ' : ''}${p.name}</option>`).join('')
              }</optgroup>`)
              .join('');
          })()}
        </select>
        <button class="btn btn-sm btn-primary" onclick="linkUserToPersonnel('${u.id}')">連結人員</button>
      </div>` : ''}
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

  // 若已有同 email 的人員記錄 → 自動合併，不建立重複
  const emailLow = (req.email || '').toLowerCase();
  const preLinkPers = emailLow
    ? personnel.find(p => p.email && p.email.toLowerCase() === emailLow)
    : null;

  if (preLinkPers) {
    try {
      const updates = { updatedAt: serverTimestamp() };
      if (req.unit  && !preLinkPers.unit)  updates.unit  = req.unit;
      if (existUser) updates.uid = existUser.id;
      await updateDoc(doc(db, 'personnel', preLinkPers.id), updates);
      if (existUser) {
        await updateDoc(doc(db, 'users', existUser.id), {
          approved: true,
          personnelId: preLinkPers.id,
        });
      }
      await updateDoc(doc(db, 'accountRequests', id), {
        status: 'approved', approvedAt: serverTimestamp(), personnelDocId: preLinkPers.id,
      });
      alert(`✓ 已核准「${req.name}」並自動連結至現有人員記錄「${preLinkPers.name}」`);
    } catch(e) { console.error(e); alert('操作失敗：' + e.message); }
    return;
  }

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
      await updateDoc(doc(db, 'users', existUser.id), { approved: true, personnelId: newRef.id });
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
  () => addAdminItem('units',      'admin-unit-input'));
document.getElementById('admin-battalion-add').addEventListener('click',
  () => addAdminItem('battalions', 'admin-battalion-input'));
document.getElementById('admin-company-add').addEventListener('click',
  () => addAdminItem('companies',  'admin-company-input'));
document.getElementById('admin-medunit-add').addEventListener('click',
  () => addAdminItem('medUnits',   'admin-medunit-input'));

// ── 醫務所 CRUD ───────────────────────────────────────
document.getElementById('admin-pharmacy-add')?.addEventListener('click', async () => {
  const input = document.getElementById('admin-pharmacy-input');
  const name  = input?.value.trim();
  if (!name) return;
  const id    = 'pha_' + Date.now();
  const arr   = [...(adminSettings.pharmacies || []), { id, name }];
  await setDoc(DOC_ADMIN, { ...adminSettings, pharmacies: arr });
  if (input) input.value = '';
});

window.removePharmacy = async function(id) {
  if (!confirm('確定刪除此醫務所？相關藥材資料不受影響，但篩選可能失效。')) return;
  const arr = (adminSettings.pharmacies || []).filter(p => p.id !== id);
  await setDoc(DOC_ADMIN, { ...adminSettings, pharmacies: arr });
};

window.movePharmacy = async function(idx, dir) {
  const arr = [...(adminSettings.pharmacies || [])];
  const newIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= arr.length) return;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  await setDoc(DOC_ADMIN, { ...adminSettings, pharmacies: arr });
};

[
  ['admin-unit-input',      'units'],
  ['admin-battalion-input', 'battalions'],
  ['admin-company-input',   'companies'],
  ['admin-medunit-input',   'medUnits'],
].forEach(([id, key]) => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') addAdminItem(key, id);
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
  'recruiters':      () => renderRecruiters(),
  'contacts':        () => renderContacts(),
  'leads':           () => fetchLeadsFromSheets(),
  'profile':         () => { renderProfilePage(); renderMyVehicles(); renderMyCertifications(); }, // renderMyUniformPoints 由 renderProfilePage 在 profileData 載入後呼叫
  'admin':           () => { renderAdminPage(); },
  'personnel':       () => { renderPersonnelUnitFilters(); renderPersonnel(); },
  'applications':    () => renderApplications(),
  'vehicles':          () => renderVehiclesPage(),
  'uniform-points':    () => renderUniformPointsPage(),
  'medical-supplies':  () => renderMedicalSupplies(),
  'medical-equipment': () => { switchMedEquipTab('list'); populateEquipTypeDropdowns(); },
  'comms-equipment':   () => { renderCommsEquipPage(); },
  'certifications':    () => renderCertificationsPage(),
  'daily-inventory':   () => renderDailyInventory(),
  'fitness-test':      () => {
    ftAdminTab = 'all';
    document.querySelectorAll('[data-ft-tab]').forEach(b => b.classList.toggle('active', b.dataset.ftTab === 'all'));
    populateFtUnitFilter();
    renderFitnessAdminPage();
  },
  'ft-standby':        () => { renderFtStandbyCalendar(); },
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
  const allowed = getRolePages(currentRole);
  allowed.add('home');
  allowed.add('profile');
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
    if (btn.dataset.medtab) return;       // handled by medtab listener
    if (btn.dataset.ftTab) return;        // handled by page-fitness-test listener
    if (btn.dataset.personnelTab) return; // handled by [data-personnel-tab] listener
    // Only clear active on sibling tabs in the same container to avoid wiping other pages' tab state
    btn.closest('.tabs')?.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
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
    recruiters.map(p => `<option>${p.rank} ${p.name}</option>`).join('');
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
  { key: 'carnivalDate',  label: '嘉年華' },
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
  ['b-name','b-enrollDate','b-carnivalDate','b-willDeadline',
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
    enrollDate: gv('b-enrollDate'), carnivalDate: gv('b-carnivalDate'), willDeadline: gv('b-willDeadline'),
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
  sv('b-enrollDate', b.enrollDate); sv('b-carnivalDate', b.carnivalDate); sv('b-willDeadline', b.willDeadline);
  sv('b-w8Supplement', b.w8Supplement); sv('b-w8Enlist', b.w8Enlist);
  sv('b-w12Supplement', b.w12Supplement); sv('b-w12Enlist', b.w12Enlist);
  document.getElementById('batchModalOverlay').classList.add('open');
};

window.deleteBatch = async function (id) {
  const b = batches.find(x => x.id === id);
  if (!b || !confirm(`確定要刪除梯次「${b.name}」嗎？`)) return;
  try { await deleteDoc(doc(db, 'batches', id)); } catch (e) { console.error(e); }
};

// ── 招募員管理 ────────────────────────────────────────
function renderRecruiters() {
  const c    = document.getElementById('recruiter-list');
  const recs = recruiters; // 使用獨立 recruiters 集合
  if (!recs.length) {
    c.innerHTML = `<div class="empty-state"><div class="icon">🪖</div><p>尚無招募員，點擊「＋ 新增招募員」建立</p></div>`;
    return;
  }

  const today     = new Date(); today.setHours(0,0,0,0);
  const day90     = new Date(today); day90.setDate(today.getDate() + 90);

  // 效期狀態 helper
  function certStatus(expiry) {
    if (!expiry) return null;
    const exp = new Date(expiry); exp.setHours(0,0,0,0);
    const diffDays = Math.ceil((exp - today) / 86400000);
    if (diffDays < 0)  return { label: `已過期 ${-diffDays} 天`, color: '#dc2626', bg: '#fef2f2', icon: '🚨' };
    if (diffDays === 0) return { label: '今日到期',              color: '#dc2626', bg: '#fef2f2', icon: '🚨' };
    if (diffDays <= 90) return { label: `剩 ${diffDays} 天`,     color: '#d97706', bg: '#fefce8', icon: '⚠️' };
    return { label: `剩 ${diffDays} 天`, color: '#16a34a', bg: '#f0fdf4', icon: '✅' };
  }

  // 警示橫幅（過期或 90 天內）
  const alertRecs = recs.filter(p => {
    if (!p.certExpiry) return false;
    const exp = new Date(p.certExpiry); exp.setHours(0,0,0,0);
    return exp <= day90;
  });

  let bannerHtml = '';
  if (alertRecs.length) {
    const items = alertRecs.map(p => {
      const s = certStatus(p.certExpiry);
      return `<span style="margin-right:12px">${s.icon} <strong>${p.name}</strong>（${p.certExpiry}，${s.label}）</span>`;
    }).join('');
    bannerHtml = `<div style="background:#fef3c7;border:1.5px solid #fcd34d;border-radius:10px;
        padding:10px 14px;margin-bottom:16px;font-size:13px;color:#92400e;line-height:1.8">
      ⏰ <strong>即將到期 / 已過期的招募員證照：</strong><br>${items}
    </div>`;
  }

  const cards = recs.map(p => {
    const s = certStatus(p.certExpiry);
    const expiryBadge = s
      ? `<div class="recruiter-meta" style="color:${s.color};font-weight:600">
           ${s.icon} 效期：${p.certExpiry}（${s.label}）
         </div>`
      : `<div class="recruiter-meta" style="color:var(--text-muted)">📋 效期：未填寫</div>`;

    return `<div class="recruiter-card" style="${s && s.color === '#dc2626' ? 'border:2px solid #fca5a5' : ''}">
      <div class="recruiter-avatar">${p.name?.[0] || '?'}</div>
      <div class="recruiter-info">
        <div class="recruiter-name">${p.rank || ''} ${p.name}</div>
        ${expiryBadge}
      </div>
      <div class="recruit-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="openRecruiterEdit('${p.id}')">✏️</button>
        <button class="btn-icon danger" onclick="deleteRecruiter('${p.id}','${(p.name||'').replace(/'/g,"\\'")}')">🗑</button>
      </div>
    </div>`;
  }).join('');

  c.innerHTML = bannerHtml + cards;
}

function openRecruiterModal(id = null) {
  editingRcrId = id;
  const r = id ? recruiters.find(x => x.id === id) : null;
  document.getElementById('recruiter-modal-title').textContent = r ? '編輯招募員' : '新增招募員';
  const sv = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = v ?? ''; };
  sv('r-rank',       r?.rank);
  sv('r-name',       r?.name);
  sv('r-certExpiry', r?.certExpiry || '');
  document.getElementById('recruiterModalOverlay').classList.add('open');
}

document.getElementById('addRecruiterBtn').addEventListener('click', () => openRecruiterModal(null));
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
  const data = {
    rank,
    name,
    certExpiry: document.getElementById('r-certExpiry').value || '',
  };
  try {
    if (editingRcrId) {
      await updateDoc(doc(db, 'recruiters', editingRcrId), data);
    } else {
      await addDoc(COL_RECRUITERS, { ...data, createdAt: serverTimestamp() });
    }
    document.getElementById('recruiterModalOverlay').classList.remove('open');
  } catch (e) { console.error(e); alert('儲存失敗'); }
});

window.openRecruiterEdit = id => openRecruiterModal(id);

window.deleteRecruiter = async function(id, name) {
  if (!confirm(`確定要刪除招募員「${name}」？`)) return;
  try { await deleteDoc(doc(db, 'recruiters', id)); }
  catch (e) { console.error(e); alert('刪除失敗'); }
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

    const ts = (() => {
      if (!l.submittedAt) return '—';
      if (l.submittedAt.includes('T')) {
        const d = new Date(l.submittedAt);
        if (!isNaN(d)) return d.toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
      return l.submittedAt;
    })();

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

  const myEmail = currentUser?.email || '';
  view.innerHTML = `
    <div class="prof-view-name">${p.name}</div>
    <div class="prof-info-section">
      <div class="prof-info-section-title">帳號</div>
      ${row('綁定信箱', myEmail)}
    </div>
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
  renderMyCertifications();
}

function renderMyCertifications() {
  const container = document.getElementById('my-certs-list');
  if (!container || !currentUser) return;
  const uid = currentUser.uid;
  const myCerts = certifications.filter(c => c.personnelId === uid);
  if (!myCerts.length) {
    container.innerHTML = '<div style="padding:12px 14px;color:var(--text-muted);font-size:14px">尚未登錄任何證照</div>';
    return;
  }
  // Group by category
  const byCategory = {};
  myCerts.forEach(c => {
    const cat = c.category || '其他';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(c);
  });
  container.innerHTML = Object.entries(byCategory).map(([cat, certs]) => `
    <div style="padding:4px 0">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;padding:6px 14px 2px">${cat}</div>
      ${certs.map(c => {
        const st = certExpiryStatus(c.expiryDate);
        return `<div class="cert-item-row" onclick="openCertEdit('${c.id}')">
          <div class="cert-item-left">
            <span class="cert-type-badge">${c.certType}</span>
            ${c.notes ? `<span class="cert-note">${c.notes}</span>` : ''}
          </div>
          <div class="cert-item-right">
            <span class="cert-status-badge" style="background:${st.bg};color:${st.color}">${st.label}</span>
            <span class="cert-date">${[c.issueDate ? '取得：'+c.issueDate : '', c.expiryDate ? '到期：'+c.expiryDate : ''].filter(Boolean).join('　')}</span>
            ${c.photoDataUrl ? `<button type="button" class="btn btn-sm btn-secondary" onclick="event.stopPropagation();viewCertPhoto('${c.id}')">🖼</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');
}

window.openMyCertAdd = function() {
  if (!currentUser) return;
  openCertAdd(currentUser.uid);
};

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
  // 安全備援：最多等 10 秒，無論如何都關閉載入畫面
  if (_loadingTimer) clearTimeout(_loadingTimer);
  _loadingTimer = setTimeout(hideLoadingScreen, 10000);

  onSnapshot(doc(db, 'settings', 'roleConfig'), snap => {
    if (snap.exists()) {
      roleConfig = snap.data();
      if (currentRole !== 'member') applyRolePermissions(currentRole);
    }
  });

  onSnapshot(DOC_ADMIN, snap => {
    try {
      const defaultSettings = { units: [], battalions: [], companies: [], medUnits: [], pharmacies: [] };
      adminSettings = snap.exists() ? { ...defaultSettings, ...snap.data() } : defaultSettings;
      // 若 medUnits 從未設定過，自動填入預設衛生營單位
      if (!adminSettings.medUnits?.length) {
        adminSettings.medUnits = ['衛生營營部', '衛生營第一連', '衛生營第二連'];
      }
      // 若 pharmacies 從未設定過，自動填入預設醫務所
      if (!adminSettings.pharmacies?.length) {
        adminSettings.pharmacies = [
          { id: 'pha_1', name: '成功北醫務所' },
          { id: 'pha_2', name: '嘉義中坑醫務所' },
        ];
      }
      // 若目前沒有選中醫務所，預設為第一個
      if (!currentMedPharmacyId && adminSettings.pharmacies.length) {
        currentMedPharmacyId = adminSettings.pharmacies[0].id;
      }
      renderAdminPage();
      renderAdminSheetsSettings();
      populateAdminDropdowns();
      populatePharmacySelects();
      renderPharmacyTabs();
      if (document.getElementById('page-medical-supplies')?.classList.contains('active')) renderMedicalSupplies();
      if (document.getElementById('page-personnel').classList.contains('active')) renderPersonnelUnitFilters();
      populatePersonnelUnit();
    } catch(e) { console.error('admin snapshot error', e); }
    markLoaded('admin');
  }, () => markLoaded('admin'));

  onSnapshot(COL_RECRUITS, snap => {
    try {
      records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      records.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-TW'));
      if (document.getElementById('page-trainee-list').classList.contains('active')) renderList();
      if (detailId && document.getElementById('detailOverlay').classList.contains('open')) {
        const r = records.find(x => x.id === detailId);
        if (r) renderDetail(r);
      }
    } catch(e) { console.error('recruits snapshot error', e); }
    markLoaded('recruits');
  }, () => markLoaded('recruits'));

  onSnapshot(COL_BATCHES, snap => {
    try {
      batches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      batches.sort((a, b) => (b.enrollDate || '').localeCompare(a.enrollDate || ''));
      if (document.getElementById('page-batch-sched').classList.contains('active')) renderBatchSched();
      const curBatch = document.getElementById('f-batch')?.value || '';
      populateBatchDropdown(curBatch);
    } catch(e) { console.error('batches snapshot error', e); }
    markLoaded('batches');
  }, () => markLoaded('batches'));

  onSnapshot(COL_RECRUITERS, snap => {
    try {
      recruiters = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (document.getElementById('page-recruiters').classList.contains('active')) renderRecruiters();
    } catch(e) { console.error('recruiters snapshot error', e); }
    markLoaded('recruiters');
  }, () => markLoaded('recruiters'));


  // leads 不再用 Firestore listener，改由 fetchLeadsFromSheets() 讀取
  markLoaded('leads');

  onSnapshot(COL_PERSONNEL, snap => {
    try {
      personnel = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (document.getElementById('page-personnel').classList.contains('active')) renderPersonnel();
      if (document.getElementById('page-recruiters').classList.contains('active')) renderRecruiters();
      if (document.getElementById('page-daily-inventory')?.classList.contains('active')) {
        populateDiRecorder();
        populateDiChargeUnit();
        populateDiChargePerson();
      }
      if (document.getElementById('page-fitness-test')?.classList.contains('active')) { populateFtUnitFilter(); renderFitnessAdminPage(); }
      // Refresh header name using actual personnel record
      if (currentUser) {
        const me = registeredUsers?.find?.(u => u.id === currentUser.uid);
        const linkedPers = personnel.find(p => p.id === (me?.personnelId) || p.id === currentUser.uid || (p.email && p.email.toLowerCase() === (currentUser.email||'').toLowerCase()));
        if (linkedPers) {
          const nameEl = document.getElementById('header-email');
          if (nameEl) nameEl.textContent = `${linkedPers.rank ? linkedPers.rank + ' ' : ''}${linkedPers.name}`.trim();
        }
      }
    } catch(e) { console.error('personnel snapshot error', e); }
    markLoaded('personnel');
  }, () => markLoaded('personnel'));

  onSnapshot(COL_USERS, snap => {
    registeredUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 角色＋單位範圍管理（合併渲染）
    renderUserRoleAssignment();

    // 重新渲染整合帳號區塊
    if (document.getElementById('page-admin').classList.contains('active')) renderAdminAccountsSection();

    if (currentUser) {
      const me = registeredUsers.find(u => u.id === currentUser.uid);
      if (me) {
        const linkedPers = personnel?.find?.(p => p.id === me.personnelId || p.id === currentUser.uid || (p.email && p.email.toLowerCase() === (me.email||currentUser.email||'').toLowerCase()));
        const nameEl = document.getElementById('header-email');
        if (nameEl) {
          const displayName = linkedPers
            ? `${linkedPers.rank ? linkedPers.rank + ' ' : ''}${linkedPers.name}`.trim()
            : (me.name || currentUser.email || '');
          nameEl.textContent = displayName;
        }
      }
    }
  }, () => {});

  onSnapshot(COL_APPLICATIONS, snap => {
    try {
      applications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      applications.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
      if (document.getElementById('page-applications').classList.contains('active')) renderApplications();
    } catch(e) { console.error('applications snapshot error', e); }
    markLoaded('applications');
  }, () => markLoaded('applications'));

  onSnapshot(COL_VEHICLES, snap => {
    try {
      vehicles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      vehicles.sort((a, b) => {
        const pa = personnel?.find?.(p => p.name === a.ownerName || p.id === a.personnelId);
        const pb = personnel?.find?.(p => p.name === b.ownerName || p.id === b.personnelId);
        const wa = rankWeight(pa?.rank || a.rank || '');
        const wb = rankWeight(pb?.rank || b.rank || '');
        if (wa !== wb) return wa - wb;
        return (a.ownerName || '').localeCompare(b.ownerName || '', 'zh-TW');
      });
      if (document.getElementById('page-vehicles').classList.contains('active')) renderVehiclesPage();
      if (document.getElementById('page-profile').classList.contains('active')) renderMyVehicles();
    } catch(e) { console.error('vehicles snapshot error', e); }
    markLoaded('vehicles');
  }, () => markLoaded('vehicles'));

  onSnapshot(COL_UNIFORM_POINTS, snap => {
    try {
      uniformPoints = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      uniformPoints.sort((a, b) => {
        const pa = personnel?.find?.(p => p.name === a.ownerName || p.id === a.personnelId);
        const pb = personnel?.find?.(p => p.name === b.ownerName || p.id === b.personnelId);
        const wa = rankWeight(pa?.rank || a.rank || '');
        const wb = rankWeight(pb?.rank || b.rank || '');
        if (wa !== wb) return wa - wb;
        return (a.ownerName || '').localeCompare(b.ownerName || '', 'zh-TW');
      });
      if (document.getElementById('page-uniform-points').classList.contains('active')) renderUniformPointsPage();
      if (document.getElementById('page-profile').classList.contains('active')) renderMyUniformPoints();
    } catch(e) { console.error('uniformPoints snapshot error', e); }
    markLoaded('uniformPoints');
  }, () => markLoaded('uniformPoints'));

  onSnapshot(COL_ACCOUNT_REQS, snap => {
    try {
      accountRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      accountRequests.sort((a, b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0));
      if (document.getElementById('page-admin').classList.contains('active')) renderAdminPage();
    } catch(e) { console.error('accountRequests snapshot error', e); }
    markLoaded('accountRequests');
  }, () => markLoaded('accountRequests'));

  onSnapshot(COL_FITNESS, snap => {
    try {
      fitnessTests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (document.getElementById('page-fitness-test')?.classList.contains('active')) renderFitnessAdminPage();
      renderFitnessProfile();
    } catch(e) { console.error('fitnessTests snapshot error', e); }
    markLoaded('fitnessTests');
  }, () => markLoaded('fitnessTests'));

  onSnapshot(COL_MED_SUPPLIES, snap => {
    try {
      medSupplies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      medSupplies.sort((a, b) => (a.name||'').localeCompare(b.name||'', 'zh-TW'));
      if (document.getElementById('page-medical-supplies')?.classList.contains('active')) renderMedicalSupplies();
      if (document.getElementById('page-daily-inventory')?.classList.contains('active')) renderDailyInventory();
    } catch(e) { console.error('medSupplies snapshot error', e); }
    markLoaded('medSupplies');
  }, () => markLoaded('medSupplies'));

  onSnapshot(COL_MED_INV_LOGS, snap => {
    try {
      medInventoryLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      medInventoryLogs.sort((a, b) => (b.date||'').localeCompare(a.date||''));
      if (document.getElementById('page-medical-supplies')?.classList.contains('active')) renderMedicalSupplies();
    } catch(e) { console.error('medInventoryLogs snapshot error', e); }
    markLoaded('medInventoryLogs');
  }, () => markLoaded('medInventoryLogs'));

  onSnapshot(COL_MED_EQUIPS, snap => {
    try {
      medEquipments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      medEquipments.sort((a, b) => (a.typeName||'').localeCompare(b.typeName||'', 'zh-TW') || (a.code||'').localeCompare(b.code||'', 'zh-TW'));
      if (document.getElementById('page-medical-equipment')?.classList.contains('active')) renderMedicalEquipment();
    } catch(e) { console.error('medEquipments snapshot error', e); }
    markLoaded('medEquipments');
  }, () => markLoaded('medEquipments'));

  onSnapshot(COL_EQUIP_TYPES, snap => {
    try {
      equipmentTypes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      equipmentTypes.sort((a, b) => (a.name||'').localeCompare(b.name||'', 'zh-TW'));
      if (document.getElementById('page-medical-equipment')?.classList.contains('active')) {
        renderEquipTypes();
        renderMedicalEquipment();
        populateEquipTypeDropdowns();
      }
    } catch(e) { console.error('equipmentTypes snapshot error', e); }
    markLoaded('equipmentTypes');
  }, () => markLoaded('equipmentTypes'));

  onSnapshot(COL_CERTS, snap => {
    try {
      certifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      certifications.sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
      if (document.getElementById('page-certifications')?.classList.contains('active')) renderCertificationsPage();
      if (document.getElementById('page-profile')?.classList.contains('active')) renderMyCertifications();
    } catch(e) { console.error('certifications snapshot error', e); }
    markLoaded('certifications');
  }, () => markLoaded('certifications'));

  onSnapshot(COL_FT_STANDBY, snap => {
    try {
      ftStandbyRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (document.getElementById('page-ft-standby')?.classList.contains('active')) {
        renderFtStandbyCalendar();
      }
    } catch(e) { console.error('ftStandby snapshot error', e); }
    markLoaded('ftStandby');
  }, () => markLoaded('ftStandby'));

  onSnapshot(COL_FT_OFFICERS, snap => {
    ftOfficers = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    renderFtsOfficerList();
    populateFtsOfficerSel(document.getElementById('fts-officer-sel')?.value || '');
  }, () => {});

  onSnapshot(COL_COMMS_EQUIP, snap => {
    commsEquipment = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.serialNumber || '').localeCompare(b.serialNumber || ''));
    if (document.getElementById('page-comms-equipment')?.classList.contains('active')) renderCommsEquipList();
    populateCommsEquipSelects();
  }, () => {});

  onSnapshot(COL_COMMS_SCHED, snap => {
    commsMaintSched = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));
    if (document.getElementById('page-comms-equipment')?.classList.contains('active')) renderCommsSchedList();
  }, () => {});

  onSnapshot(COL_COMMS_LOG, snap => {
    commsMaintLog = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.logDate || '').localeCompare(a.logDate || ''));
    if (document.getElementById('page-comms-equipment')?.classList.contains('active')) renderCommsLogList();
  }, () => {});

  onSnapshot(COL_COMMS_NAMES, snap => {
    commsEquipNames = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-TW'));
    renderCommsNames();
    populateCommsNameSel();
  }, () => {});

  onSnapshot(COL_COMMS_MONTHLY, snap => {
    commsMonthlyReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('page-comms-equipment')?.classList.contains('active') && commsTab === 'monthly') {
      renderCommsMonthly();
    }
  }, () => {});

  onSnapshot(COL_PERSONNEL_AUDIT, snap => {
    try {
      personnelAuditLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      personnelAuditLogs.sort((a, b) => (b.ts?.seconds || 0) - (a.ts?.seconds || 0));
      if (document.getElementById('personnel-pane-audit')?.style.display !== 'none') renderPersonnelAudit();
    } catch(e) { console.error('personnelAudit snapshot error', e); }
  }, () => {});
}

window.changeUserRole = async function(uid, role) {
  try { await updateDoc(doc(db, 'users', uid), { role }); }
  catch(e) { console.error(e); alert('角色更新失敗'); }
};

// ── 帳號角色＋資料範圍管理 ─────────────────────────────
function renderUserRoleAssignment() {
  const roleEl = document.getElementById('admin-role-list');
  if (!roleEl) return;

  const approved = registeredUsers.filter(u => u.approved || u.admin);
  if (!approved.length) {
    roleEl.innerHTML = '<li style="color:var(--text-muted);font-size:13px;padding:8px 0">尚無已核准用戶</li>';
    return;
  }

  const units = getVehicleUnits(); // ['衛生營營部','衛生營第一連','衛生營第二連']

  roleEl.innerHTML = approved.map(u => {
    const uid     = u.id.replace(/'/g, "\\'");
    const curRole = u.role || (u.admin ? 'admin' : 'member');
    const roleOpts = Object.entries(ROLES)
      .map(([k, v]) => `<option value="${k}"${curRole===k?' selected':''}>${v.label}</option>`)
      .join('');
    const userUnits = u.unitScope || [];
    const allActive = !userUnits.length;

    const unitPills = units.map(unit => {
      const shortName = unit.replace(/^衛生營/, '').trim() || unit;
      const active    = userUnits.includes(unit);
      return `<label class="unit-scope-pill${active ? ' active' : ''}">
        <input type="checkbox" value="${unit}" ${active ? 'checked' : ''}
          onchange="updateUserUnitScope('${uid}', this)">
        ${shortName}
      </label>`;
    }).join('');

    return `<li class="admin-list-item user-role-row" data-uid="${u.id}">
      <div class="user-role-info">
        <div style="font-weight:600;font-size:14px">${u.name || u.displayName || '—'}</div>
        <div style="font-size:12px;color:var(--text-muted)">${u.email}</div>
      </div>
      <div class="user-role-controls">
        <div class="user-role-section">
          <div class="user-role-lbl">業務</div>
          <select class="role-select" onchange="changeUserRole('${uid}', this.value)">${roleOpts}</select>
        </div>
        <div class="user-role-section">
          <div class="user-role-lbl">資料範圍</div>
          <div class="unit-scope-pills">
            <label class="unit-scope-pill${allActive ? ' active all-pill' : ' all-pill'}"
              onclick="setUserAllUnits('${uid}', this); return false;">全部</label>
            ${unitPills}
          </div>
        </div>
      </div>
    </li>`;
  }).join('');
}

window.updateUserUnitScope = async function(uid, checkbox) {
  const row       = checkbox.closest('.user-role-row');
  const checked   = [...row.querySelectorAll('.unit-scope-pills input:checked')].map(cb => cb.value);
  const allPill   = row.querySelector('.all-pill');
  // 更新 UI
  checkbox.closest('.unit-scope-pill').classList.toggle('active', checkbox.checked);
  if (allPill) allPill.classList.toggle('active', !checked.length);
  try { await updateDoc(doc(db, 'users', uid), { unitScope: checked }); }
  catch(e) { console.error(e); }
};

window.setUserAllUnits = async function(uid, allPill) {
  const row = allPill.closest('.user-role-row');
  // 取消全部勾選
  row.querySelectorAll('.unit-scope-pills input').forEach(cb => { cb.checked = false; });
  row.querySelectorAll('.unit-scope-pill').forEach(p => p.classList.remove('active'));
  allPill.classList.add('active');
  try { await updateDoc(doc(db, 'users', uid), { unitScope: [] }); }
  catch(e) { console.error(e); }
};

// ── 角色業務設定 ─────────────────────────────────────
let selectedRoleConfigId = 'manager';

function renderRoleConfig() {
  const sidebar  = document.getElementById('role-config-sidebar');
  const panel    = document.getElementById('role-config-panel');
  if (!sidebar || !panel) return;

  const configurableRoles = Object.entries(ROLES).filter(([k]) => k !== 'admin' && k !== 'member');

  sidebar.innerHTML = configurableRoles.map(([k, v]) => {
    const pages  = getRolePages(k);
    const count  = FEATURE_GROUPS.flatMap(g => g.features).filter(f => pages.has(f.id)).length;
    const total  = FEATURE_GROUPS.flatMap(g => g.features).length;
    return `<div class="role-config-item${k === selectedRoleConfigId ? ' active' : ''}" onclick="selectRoleConfig('${k}')">
      <div>
        <div class="role-config-item-label">${v.label}</div>
        <div class="role-config-item-count">${count} / ${total} 功能</div>
      </div>
      <div class="role-config-item-bar">
        <div class="role-config-item-bar-fill" style="width:${Math.round(count/total*100)}%"></div>
      </div>
    </div>`;
  }).join('');

  renderRoleConfigPanel(selectedRoleConfigId);
}

function renderRoleConfigPanel(roleId) {
  selectedRoleConfigId = roleId;
  const panel = document.getElementById('role-config-panel');
  if (!panel) return;
  const v = ROLES[roleId];
  if (!v) return;
  const pages = getRolePages(roleId);

  panel.innerHTML = `
    <div class="role-config-panel-header">
      <div>
        <div style="font-weight:700;font-size:16px">${v.label}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">勾選此角色可存取的功能頁面</div>
      </div>
      <button class="btn btn-primary btn-sm" id="saveRoleConfigBtn">💾 儲存</button>
    </div>
    <div class="role-perm-groups">
      ${FEATURE_GROUPS.map(g => `
        <div class="role-perm-group">
          <div class="role-perm-group-title">
            <label class="role-perm-group-check">
              <input type="checkbox" class="role-group-all"
                data-group="${g.group}"
                ${g.features.every(f => pages.has(f.id)) ? 'checked' : ''}
                onchange="toggleRoleGroup(this)">
              ${g.icon} ${g.group}
            </label>
          </div>
          <div class="role-perm-features">
            ${g.features.map(f => `
              <label class="role-perm-feature">
                <input type="checkbox" class="role-feature-cb" data-feature="${f.id}" ${pages.has(f.id) ? 'checked' : ''} onchange="syncGroupCheckbox(this)">
                ${f.label}
              </label>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>`;

  document.getElementById('saveRoleConfigBtn').addEventListener('click', () => saveRoleConfigForRole(roleId));

  // re-highlight sidebar
  document.querySelectorAll('.role-config-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('onclick')?.includes(`'${roleId}'`));
  });
}

window.selectRoleConfig = function(roleId) {
  selectedRoleConfigId = roleId;
  renderRoleConfigPanel(roleId);
  renderRoleConfig(); // refresh sidebar counts
};

window.toggleRoleGroup = function(cb) {
  const group   = cb.dataset.group;
  const checked = cb.checked;
  const grp     = FEATURE_GROUPS.find(g => g.group === group);
  if (!grp) return;
  grp.features.forEach(f => {
    const el = document.querySelector(`.role-feature-cb[data-feature="${f.id}"]`);
    if (el) el.checked = checked;
  });
};

window.syncGroupCheckbox = function(cb) {
  const featureId = cb.dataset.feature;
  const grp = FEATURE_GROUPS.find(g => g.features.some(f => f.id === featureId));
  if (!grp) return;
  const allChecked = grp.features.every(f => {
    const el = document.querySelector(`.role-feature-cb[data-feature="${f.id}"]`);
    return el?.checked;
  });
  const groupCb = document.querySelector(`.role-group-all[data-group="${grp.group}"]`);
  if (groupCb) groupCb.checked = allChecked;
};

async function saveRoleConfigForRole(roleId) {
  const cbs   = document.querySelectorAll('.role-feature-cb');
  const pages = ['home','profile'];
  cbs.forEach(cb => { if (cb.checked) pages.push(cb.dataset.feature); });
  try {
    const ref = doc(db, 'settings', 'roleConfig');
    await setDoc(ref, { [roleId]: pages }, { merge: true });
    roleConfig[roleId] = pages;
    renderRoleConfig();
    const btn = document.getElementById('saveRoleConfigBtn');
    if (btn) { btn.textContent = '✓ 已儲存'; btn.disabled = true; setTimeout(() => { btn.textContent = '💾 儲存'; btn.disabled = false; }, 1500); }
  } catch(e) { console.error(e); alert('儲存失敗'); }
}

// ══════════════════════════════════════════════════════
// ── 人員資訊管理 ─────────────────────────────────────
// ══════════════════════════════════════════════════════

function populatePersonnelUnit() {
  const sel = document.getElementById('pf-unit');
  if (!sel) return;
  const cur   = sel.value;
  const units = getVehicleUnits(); // 與車輛管理共用 medUnits
  sel.innerHTML = '<option value="">請選擇</option>' +
    units.map(u => `<option${u === cur ? ' selected' : ''}>${u}</option>`).join('');
}

// ── 通訊錄 ────────────────────────────────────────────
function renderContacts() {
  const listEl  = document.getElementById('contacts-list');
  const emptyEl = document.getElementById('contacts-empty');
  const q = (document.getElementById('contacts-search')?.value || '').toLowerCase();
  if (!listEl) return;

  const filtered = personnel.filter(p =>
    !q || (p.name + (p.rank || '') + (p.unit || '')).toLowerCase().includes(q)
  );

  if (!filtered.length) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const unitOrder = [...new Set(
    (adminSettings.medUnits || []).concat(filtered.map(p => p.unit).filter(Boolean))
  )];
  const grouped = {};
  filtered
    .sort((a, b) => rankWeight(a.rank) - rankWeight(b.rank) || (a.name || '').localeCompare(b.name || '', 'zh-TW'))
    .forEach(p => {
      const u = p.unit || '其他';
      if (!grouped[u]) grouped[u] = [];
      grouped[u].push(p);
    });

  const units = unitOrder.filter(u => grouped[u])
    .concat(Object.keys(grouped).filter(u => !unitOrder.includes(u)));

  listEl.innerHTML = units.map(unit => `
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">${unit}</div>
      ${grouped[unit].map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--white);border-radius:8px;margin-bottom:4px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
          <div>
            <span style="font-size:12px;color:var(--text-muted);margin-right:6px">${p.rank || ''}</span>
            <span style="font-weight:600;font-size:14px">${p.name || '—'}</span>
          </div>
          ${p.phone
            ? `<a href="tel:${p.phone}" style="font-size:14px;color:var(--accent);text-decoration:none;font-weight:500">📞 ${p.phone}</a>`
            : `<span style="font-size:13px;color:var(--text-muted)">—</span>`}
        </div>`).join('')}
    </div>`).join('');
}

document.getElementById('contacts-search')?.addEventListener('input', renderContacts);

// ── 編輯二次確認 ──────────────────────────────────────
function confirmEdit() {
  return confirm('進入編輯模式，操作將被系統記錄。\n\n確定繼續？');
}

function renderPersonnelUnitFilters() {
  const units = getVehicleUnits();
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

function isSeparated(p) {
  if (!p.separationDate) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(p.separationDate + 'T00:00:00') <= today;
}

function renderPersonnel() {
  const q      = document.getElementById('personnelSearch')?.value.trim().toLowerCase() || '';
  const sortBy = document.getElementById('personnelSortBy')?.value || 'rank';

  let filtered = filterByUnitScope(personnel).filter(p => {
    if (isSeparated(p)) return false;  // 已離職退伍者不顯示於主列表
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
    if (sortBy === 'rank') {
      const wr = rankWeight(a.rank) - rankWeight(b.rank);
      if (wr !== 0) return wr;
      return (a.name || '').localeCompare(b.name || '', 'zh-TW');
    }
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
      <td class="col-account">${
        p.uid
          ? `<span style="font-size:11px;background:#dcfce7;color:#16a34a;padding:2px 7px;border-radius:4px;white-space:nowrap">已綁定</span>`
          : `<span style="font-size:11px;background:#f1f5f9;color:#94a3b8;padding:2px 7px;border-radius:4px;white-space:nowrap">未綁定</span>`
      }</td>
      <td class="col-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="openPersonnelEdit('${p.id}')">✏️</button>
        <button class="btn-icon danger" onclick="deletePersonnel('${p.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.personnel-row').forEach(row => {
    row.addEventListener('click', () => openPersonnelEdit(row.dataset.id));
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
  document.getElementById('pf-birthDate').value      = '';
  document.getElementById('pf-joinDate').value       = '';
  document.getElementById('pf-certExpiry').value     = '';
  document.getElementById('pf-isRecruiter').checked  = false;
  document.getElementById('pf-certExpiry-group').style.display = 'none';
  const acctSec = document.getElementById('pf-account-section');
  if (acctSec) acctSec.style.display = 'none';
  document.getElementById('pf-isSeparated').checked = false;
  document.getElementById('pf-separation-fields').style.display = 'none';
  document.getElementById('pf-separationType').value = '離職';
  document.getElementById('pf-separationDate').value = '';
  document.getElementById('pf-separationUnitCode').value = '';
  document.getElementById('pf-separationUnitFull').value = '';
  updateSeparationTypeUI('離職');
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
  const isSep = !!(p.separationDate);
  document.getElementById('pf-isSeparated').checked = isSep;
  document.getElementById('pf-separation-fields').style.display = isSep ? '' : 'none';
  document.getElementById('pf-separationType').value = p.separationType || '離職';
  document.getElementById('pf-separationDate').value = p.separationDate || '';
  document.getElementById('pf-separationUnitCode').value = p.separationUnitCode || '';
  document.getElementById('pf-separationUnitFull').value = p.separationUnitFull || '';
  updateSeparationTypeUI(p.separationType || '離職');
  const expiryEl = document.getElementById('pf-certExpiry');
  if (expiryEl) expiryEl.value = p.certExpiry || '';
  document.getElementById('pf-certExpiry-group').style.display = p.isRecruiter ? '' : 'none';
  const acctSection = document.getElementById('pf-account-section');
  const acctDisplay = document.getElementById('pf-account-display');
  if (acctSection && acctDisplay) {
    acctSection.style.display = '';
    const badge = p.uid
      ? `<span style="background:#dcfce7;color:#16a34a;font-size:12px;padding:2px 10px;border-radius:6px;font-weight:600">已綁定</span>`
      : `<span style="background:#f1f5f9;color:#94a3b8;font-size:12px;padding:2px 10px;border-radius:6px">未綁定</span>`;
    const unbindBtn = p.uid
      ? `<button type="button" onclick="unlinkPersonnelAccount()"
           style="font-size:11px;padding:3px 10px;border:1px solid #fca5a5;background:#fff;color:#ef4444;border-radius:6px;cursor:pointer">
           解除綁定</button>`
      : '';
    acctDisplay.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${badge} ${unbindBtn}
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <label style="font-size:12px;color:#64748b;white-space:nowrap">綁定信箱</label>
        <input id="pf-email" type="email" value="${p.email || ''}" placeholder="輸入 Google 帳號信箱"
          style="flex:1;min-width:180px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px">
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px">預先填入信箱後儲存，對方申請帳號或登入時系統會自動連結，不需手動操作。</div>`;
  }
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
    isRecruiter:        document.getElementById('pf-isRecruiter').checked,
    certExpiry:         document.getElementById('pf-certExpiry')?.value || '',
    email:              document.getElementById('pf-email')?.value?.trim() || '',
    separationType:     document.getElementById('pf-isSeparated').checked ? (document.getElementById('pf-separationType').value || '離職') : '',
    separationDate:     document.getElementById('pf-isSeparated').checked ? (document.getElementById('pf-separationDate').value || '') : '',
    separationUnitCode: document.getElementById('pf-isSeparated').checked ? (document.getElementById('pf-separationUnitCode').value?.trim() || '') : '',
    separationUnitFull: document.getElementById('pf-isSeparated').checked ? (document.getElementById('pf-separationUnitFull').value?.trim() || '') : '',
  };
}

function closePersonnelForm() {
  document.getElementById('personnelModalOverlay').classList.remove('open');
  editingPersonnelId = null;
}

document.getElementById('personnelAddBtn').addEventListener('click', () => openPersonnelForm(null));

// 勾選招募員時顯示/隱藏證照效期欄位
document.getElementById('pf-isRecruiter')?.addEventListener('change', function() {
  const grp = document.getElementById('pf-certExpiry-group');
  const exp = document.getElementById('pf-certExpiry');
  if (grp) grp.style.display = this.checked ? '' : 'none';
  if (!this.checked && exp) exp.value = '';
});
document.getElementById('pf-isSeparated')?.addEventListener('change', function() {
  document.getElementById('pf-separation-fields').style.display = this.checked ? '' : 'none';
  if (this.checked) updateSeparationTypeUI(document.getElementById('pf-separationType').value);
});
document.getElementById('pf-separationType')?.addEventListener('change', function() {
  updateSeparationTypeUI(this.value);
});
function updateSeparationTypeUI(type) {
  const isResign = type === '離職';
  document.getElementById('pf-separationDate-label').textContent = isResign ? '離職日期' : '退伍日期';
  document.getElementById('pf-separation-unit-group').style.display    = isResign ? '' : 'none';
  document.getElementById('pf-separation-unitfull-group').style.display = isResign ? '' : 'none';
  if (!isResign) {
    document.getElementById('pf-separationUnitCode').value = '';
    document.getElementById('pf-separationUnitFull').value = '';
  }
}
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
      const orig = personnel.find(p => p.id === editingPersonnelId);
      if (orig && data.email !== (orig.email || '')) data.uid = '';
      await updateDoc(doc(db, 'personnel', editingPersonnelId), data);
    } else {
      await addDoc(COL_PERSONNEL, { ...data, createdAt: serverTimestamp() });
    }
    closePersonnelForm();
  } catch (e) { console.error(e); alert('儲存失敗：' + e.message); }
  finally { btn.disabled = false; }
});

// ── 稽核紀錄 ──────────────────────────────────────────
const COL_PERSONNEL_AUDIT = collection(db, 'personnelAuditLogs');
let personnelAuditLogs = [];

async function writeAuditLog(action, targetName) {
  try {
    // 取得用戶 IP（使用公開 API）
    let ip = '—';
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      const j = await r.json();
      ip = j.ip || '—';
    } catch {}

    const me = registeredUsers.find(u => u.id === currentUser?.uid);
    const me2 = personnel?.find?.(p => p.id === me?.personnelId);
    const accountLabel = (me2?.rank ? me2.rank + ' ' : '') + (me2?.name || me?.email || currentUser?.email || '—');

    await addDoc(COL_PERSONNEL_AUDIT, {
      action,
      targetName,
      account:   accountLabel,
      accountId: currentUser?.uid || '',
      ip,
      ts: serverTimestamp(),
    });
  } catch(e) { console.warn('Audit log failed:', e); }
}

function renderPersonnelAudit() {
  const tbody = document.getElementById('personnelAuditBody');
  const empty = document.getElementById('personnelAuditEmpty');
  const countEl = document.getElementById('personnel-audit-count');
  if (!tbody) return;
  if (!personnelAuditLogs.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    if (countEl) countEl.textContent = '共 0 筆紀錄';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (countEl) countEl.textContent = `共 ${personnelAuditLogs.length} 筆紀錄`;
  const actionColor = { '查看': '#3b82f6', '編輯': '#f59e0b', '新增': '#10b981', '刪除': '#ef4444' };
  tbody.innerHTML = personnelAuditLogs.map(log => {
    const ts = log.ts?.toDate?.() || new Date();
    const timeStr = ts.toLocaleString('zh-TW', { hour12: false });
    const color = actionColor[log.action] || '#6b7280';
    return `<tr>
      <td style="font-size:12px;color:var(--text-muted)">${timeStr}</td>
      <td style="font-size:13px">${log.account || '—'}</td>
      <td><span style="background:${color}20;color:${color};font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px">${log.action}</span></td>
      <td>${log.targetName || '—'}</td>
      <td style="font-family:monospace;font-size:12px;color:var(--text-muted)">${log.ip || '—'}</td>
    </tr>`;
  }).join('');
}

document.getElementById('personnelAuditClearBtn')?.addEventListener('click', async () => {
  if (!confirm('確定清除所有操作紀錄？此動作不可復原。')) return;
  try {
    const snap = await getDocs(COL_PERSONNEL_AUDIT);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  } catch(e) { alert('清除失敗：' + e.message); }
});

// 人員分頁 tab 切換
document.querySelectorAll('[data-personnel-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-personnel-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.personnelTab;
    document.getElementById('personnel-pane-list').style.display      = tab === 'list'      ? '' : 'none';
    document.getElementById('personnel-pane-audit').style.display     = tab === 'audit'     ? '' : 'none';
    document.getElementById('personnel-pane-separated').style.display = tab === 'separated' ? '' : 'none';
    if (tab === 'audit')     renderPersonnelAudit();
    if (tab === 'separated') renderSeparatedPersonnel();
  });
});

function renderSeparatedPersonnel() {
  const tbody   = document.getElementById('separatedTableBody');
  const emptyEl = document.getElementById('separatedEmpty');
  if (!tbody) return;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const list = [...personnel]
    .filter(p => p.separationDate)
    .sort((a, b) => (a.separationDate || '').localeCompare(b.separationDate || ''));

  if (!list.length) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  tbody.innerHTML = list.map((p, i) => {
    const effectDate = new Date(p.separationDate + 'T00:00:00');
    const effective  = effectDate <= today;
    const statusBadge = effective
      ? `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:8px;background:#f1f5f9;color:#64748b">已生效</span>`
      : `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:8px;background:#fef9c3;color:#ca8a04">待生效</span>`;
    const typeBadge = `<span style="font-size:12px;font-weight:700;padding:2px 8px;border-radius:8px;background:${p.separationType === '退伍' ? '#eff6ff' : '#fef3c7'};color:${p.separationType === '退伍' ? '#2563eb' : '#d97706'}">${p.separationType || '離職'}</span>`;
    return `
    <tr class="personnel-row" data-id="${p.id}" style="cursor:pointer" onclick="openPersonnelDetail('${p.id}')">
      <td class="col-seq">${i + 1}</td>
      <td class="col-unit"><span class="unit-tag">${p.unit || '—'}</span></td>
      <td class="col-rank">${p.rank || '—'}</td>
      <td>${p.name || '—'}</td>
      <td>${typeBadge}</td>
      <td>${statusBadge}</td>
      <td>${p.separationDate || '—'}</td>
      <td>${p.separationUnitCode || '—'}</td>
      <td>${p.separationUnitFull || '—'}</td>
    </tr>`;
  }).join('');
}

window.openPersonnelEdit = function (id) {
  if (!confirmEdit()) return;
  const p = personnel.find(x => x.id === id);
  const name = p ? `${p.rank || ''} ${p.name}`.trim() : id;
  writeAuditLog('編輯', name);
  closePersonnelDetail();
  openPersonnelForm(id);
};

// 從已登入帳號列表為尚未建立人員記錄的使用者預填並開啟人員表單
window.createPersonnelForUser = function(uid, name, email) {
  // 先切到人員管理頁
  navigateTo('personnel');
  setTimeout(() => {
    openPersonnelForm(null);
    const sv = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
    sv('pf-name', name);
    // 使用者 doc id 與未來的 personnel doc id 對齊（存在 editingPersonnelId）
    editingPersonnelId = uid;
  }, 200);
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

  const accountBadge = p.uid
    ? `<span style="background:#dcfce7;color:#16a34a;font-size:12px;padding:2px 10px;border-radius:6px;font-weight:600">已綁定</span> <span style="font-size:13px;color:#64748b">${p.email || ''}</span>`
    : `<span style="background:#f1f5f9;color:#94a3b8;font-size:12px;padding:2px 10px;border-radius:6px">未綁定</span>`;

  document.getElementById('personnelDetailBody').innerHTML = `
    ${p.isRecruiter ? '<div class="pd-recruiter-banner">🪖 招募員</div>' : ''}
    <div class="pd-section">
      <div class="pd-section-title">帳號</div>
      <div class="pd-grid">
        <div class="pd-row" style="grid-column:1/-1"><span class="pd-label">綁定狀態</span><span class="pd-val">${accountBadge}</span></div>
      </div>
    </div>
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
  openPersonnelEdit(viewingPersonnelId);
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

  // 單位下拉
  const initUnit = v?.unit || '';
  populateVehicleUnitSel('v-unit', initUnit);

  // 人員下拉（依單位篩選）
  populateVehiclePersonnelSel('v-personnel', initUnit, v?.personnelId || '');
  if (!v?.personnelId && v?.ownerName) {
    const match = personnel.find(p => p.name === v.ownerName);
    if (match) document.getElementById('v-personnel').value = match.id;
  }

  // 單位切換 → 更新人員
  const unitSel = document.getElementById('v-unit');
  unitSel.onchange = () => populateVehiclePersonnelSel('v-personnel', unitSel.value);

  // 車種 / 廠牌
  const type = v?.type || '';
  document.getElementById('v-type').value  = type;
  document.getElementById('v-plate').value = v?.plate || '';
  document.getElementById('v-color').value = v?.color || '';

  // 廠牌下拉（未選車種時 disabled）
  const brandSel    = document.getElementById('v-brand-select');
  const brandCustom = document.getElementById('v-brand-custom');
  brandSel.innerHTML = getBrandOptions(type);
  brandSel.disabled  = !type;
  const savedBrand = v?.brand || '';
  const allBrands  = [...CAR_BRANDS, ...MOTO_BRANDS];
  if (savedBrand && !allBrands.includes(savedBrand)) {
    brandSel.value        = OTHER_BRAND;
    brandCustom.value     = savedBrand;
    brandCustom.style.display = '';
  } else {
    brandSel.value            = savedBrand;
    brandCustom.style.display = 'none';
    brandCustom.value         = '';
  }

  // 車種切換 → 更新廠牌選項並啟用
  document.getElementById('v-type').onchange = function() {
    brandSel.innerHTML = getBrandOptions(this.value);
    brandSel.disabled  = !this.value;
    brandSel.value = ''; brandCustom.value = ''; brandCustom.style.display = 'none';
  };
  brandSel.onchange = function() {
    brandCustom.style.display = this.value === OTHER_BRAND ? '' : 'none';
    if (this.value !== OTHER_BRAND) brandCustom.value = '';
  };

  document.getElementById('vehicleModalOverlay').classList.add('open');
};

function closeVehicleModal() {
  document.getElementById('vehicleModalOverlay').classList.remove('open');
}

// ── 批次輸入 ──────────────────────────────────────────
function makeBatchRow() {
  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid var(--border)';

  const units    = getVehicleUnits();
  const unitOpts = '<option value="">— 選單位 —</option>' +
    units.map(u => `<option value="${u}">${u}</option>`).join('');

  tr.innerHTML = `
    <td style="padding:4px 4px">
      <select class="br-unit" style="width:100%;font-size:12px;padding:4px">
        ${unitOpts}
      </select>
    </td>
    <td style="padding:4px 4px">
      <select class="br-person" style="width:100%;font-size:12px;padding:4px">
        <option value="">請先選單位</option>
      </select>
    </td>
    <td style="padding:4px 4px">
      <select class="br-type" style="width:100%;font-size:12px;padding:4px">
        <option value="">選車種</option>
        <option value="汽車">🚗 汽車</option>
        <option value="機車">🏍 機車</option>
      </select>
    </td>
    <td style="padding:4px 4px">
      <select class="br-brand" style="width:100%;font-size:12px;padding:4px">
        ${getBrandOptions('')}
      </select>
      <input class="br-brand-custom" type="text" placeholder="手動輸入"
             style="display:none;width:100%;font-size:12px;padding:4px;margin-top:3px">
    </td>
    <td style="padding:4px 4px">
      <input class="br-plate" type="text" maxlength="10" placeholder="ABC-1234"
             style="width:100%;font-size:12px;padding:4px;text-transform:uppercase">
    </td>
    <td style="padding:4px 4px">
      <input class="br-color" type="text" placeholder="顏色"
             style="width:100%;font-size:12px;padding:4px">
    </td>
    <td style="padding:4px 2px;text-align:center">
      <button class="btn-icon danger br-del" title="刪除此行">✕</button>
    </td>`;

  // 單位 → 人員
  const unitSel   = tr.querySelector('.br-unit');
  const personSel = tr.querySelector('.br-person');
  unitSel.addEventListener('change', () => {
    const unit = unitSel.value;
    const filtered = unit
      ? personnel.filter(p => p.unit === unit).sort((a,b) => rankWeight(a.rank) - rankWeight(b.rank) || (a.name||'').localeCompare(b.name||'','zh-TW'))
      : [];
    personSel.innerHTML = filtered.length
      ? '<option value="">請選擇人員</option>' +
        filtered.map(p => `<option value="${p.id}" data-uid="${p.uid||''}" data-name="${p.name||''}" data-unit="${p.unit||''}">${p.rank ? p.rank + ' ' : ''}${p.name}</option>`).join('')
      : '<option value="">此單位無人員</option>';
    updateBatchCount();
  });

  // 車種 → 廠牌（立即更新選項）
  const typeSel     = tr.querySelector('.br-type');
  const brandSel    = tr.querySelector('.br-brand');
  const brandCustom = tr.querySelector('.br-brand-custom');
  typeSel.addEventListener('change', () => {
    brandSel.innerHTML = getBrandOptions(typeSel.value);
    brandSel.value = ''; brandCustom.value = ''; brandCustom.style.display = 'none';
    updateBatchCount();
  });
  // 預設先禁用廠牌（未選車種前）
  brandSel.disabled = true;
  typeSel.addEventListener('change', () => { brandSel.disabled = !typeSel.value; });
  brandSel.addEventListener('change', () => {
    brandCustom.style.display = brandSel.value === OTHER_BRAND ? '' : 'none';
    if (brandSel.value !== OTHER_BRAND) brandCustom.value = '';
  });

  tr.querySelector('.br-del').addEventListener('click', () => {
    tr.remove(); updateBatchCount();
  });

  tr.querySelectorAll('input,select').forEach(el =>
    el.addEventListener('input', updateBatchCount)
  );

  return tr;
}

function updateBatchCount() {
  const rows  = document.querySelectorAll('#vehicleBatchBody tr');
  const valid = [...rows].filter(r => {
    const unit   = r.querySelector('.br-unit')?.value;
    const person = r.querySelector('.br-person')?.value;
    const type   = r.querySelector('.br-type')?.value;
    const plate  = r.querySelector('.br-plate')?.value.trim();
    return unit && person && type && plate;
  }).length;
  document.getElementById('vehicleBatchCount').textContent = valid;
}

function openVehicleBatch() {
  const tbody = document.getElementById('vehicleBatchBody');
  tbody.innerHTML = '';
  tbody.appendChild(makeBatchRow());
  tbody.appendChild(makeBatchRow());
  tbody.appendChild(makeBatchRow());
  updateBatchCount();
  document.getElementById('vehicleBatchOverlay').classList.add('open');
}

function closeVehicleBatch() {
  document.getElementById('vehicleBatchOverlay').classList.remove('open');
  document.getElementById('vehicleBatchStatus').textContent = '';
}

document.getElementById('vehicleBatchBtn').addEventListener('click', openVehicleBatch);
document.getElementById('vehicleBatchClose').addEventListener('click',  closeVehicleBatch);
document.getElementById('vehicleBatchCancel').addEventListener('click', closeVehicleBatch);
document.getElementById('vehicleBatchOverlay').addEventListener('click', e => {
  if (e.target.id === 'vehicleBatchOverlay') closeVehicleBatch();
});
document.getElementById('vehicleBatchAddRow').addEventListener('click', () => {
  document.getElementById('vehicleBatchBody').appendChild(makeBatchRow());
  updateBatchCount();
});

document.getElementById('vehicleBatchSave').addEventListener('click', async () => {
  const rows   = [...document.querySelectorAll('#vehicleBatchBody tr')];
  const statusEl = document.getElementById('vehicleBatchStatus');
  const toSave = [];

  for (const r of rows) {
    const unitSel   = r.querySelector('.br-unit');
    const personSel = r.querySelector('.br-person');
    const typeSel   = r.querySelector('.br-type');
    const plateEl   = r.querySelector('.br-plate');
    const brandSel  = r.querySelector('.br-brand');
    const brandCust = r.querySelector('.br-brand-custom');
    const colorEl   = r.querySelector('.br-color');

    const unit   = unitSel?.value;
    const person = personSel?.value;
    const type   = typeSel?.value;
    const plate  = plateEl?.value.trim().toUpperCase();
    if (!unit || !person || !type || !plate) continue;  // 跳過未填完的行

    const pOpt  = personSel.options[personSel.selectedIndex];
    const brand = brandSel?.value === OTHER_BRAND
      ? (brandCust?.value.trim() || '')
      : (brandSel?.value || '');
    const pers  = personnel.find(p => p.id === person);

    toSave.push({
      personnelId: person,
      uid:         pOpt?.dataset.uid  || '',
      ownerName:   pOpt?.dataset.name || '',
      rank:        pers?.rank || '',
      unit,
      type, plate, brand,
      color:       colorEl?.value.trim() || '',
      status:      'pending',
      createdAt:   serverTimestamp(),
    });
  }

  if (!toSave.length) { alert('請至少填寫一筆完整資料（單位、人員、車種、車牌必填）'); return; }

  const btn = document.getElementById('vehicleBatchSave');
  btn.disabled = true;
  statusEl.textContent = `儲存中…（0 / ${toSave.length}）`;

  let done = 0;
  const errors = [];
  for (const data of toSave) {
    try {
      await addDoc(COL_VEHICLES, data);
      done++;
      statusEl.textContent = `儲存中…（${done} / ${toSave.length}）`;
    } catch(e) {
      errors.push(data.ownerName || data.plate);
    }
  }

  btn.disabled = false;
  if (errors.length) {
    statusEl.textContent = `完成 ${done} 筆，失敗 ${errors.length} 筆：${errors.join('、')}`;
  } else {
    statusEl.textContent = `✓ 成功儲存 ${done} 筆`;
    setTimeout(closeVehicleBatch, 1200);
  }
});
document.getElementById('vehicleModalClose').addEventListener('click',  closeVehicleModal);
document.getElementById('vehicleCancelBtn').addEventListener('click',   closeVehicleModal);
document.getElementById('vehicleModalOverlay').addEventListener('click', e => { if (e.target.id === 'vehicleModalOverlay') closeVehicleModal(); });

// ── Save vehicle ──────────────────────────────────────
document.getElementById('vehicleSaveBtn').addEventListener('click', async () => {
  const unitSel = document.getElementById('v-unit');
  const pSel    = document.getElementById('v-personnel');
  const pOpt    = pSel.options[pSel.selectedIndex];
  const type    = document.getElementById('v-type').value;
  const plate   = document.getElementById('v-plate').value.trim().toUpperCase();
  const brandSel    = document.getElementById('v-brand-select');
  const brandCustom = document.getElementById('v-brand-custom');
  const brand = brandSel.value === OTHER_BRAND
    ? brandCustom.value.trim()
    : brandSel.value;

  if (!unitSel.value) { alert('請先選擇單位'); return; }
  if (!pSel.value)    { alert('請選擇人員');   return; }
  if (!type || !plate){ alert('請填寫車種和車牌'); return; }

  const pers = personnel.find(p => p.id === pSel.value);
  const data = {
    personnelId: pSel.value,
    uid:         pOpt?.dataset.uid  || '',
    ownerName:   pOpt?.dataset.name || '',
    rank:        pers?.rank || '',
    unit:        unitSel.value,
    type, plate, brand,
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

  let list = filterByUnitScope(vehicles);
  if (q)      list = list.filter(v => (v.ownerName||'').toLowerCase().includes(q) || (v.plate||'').toLowerCase().includes(q));
  if (type)   list = list.filter(v => v.type === type);
  if (status) list = list.filter(v => (v.status || 'pending') === status);
  if (unit)   list = list.filter(v => v.unit === unit);

  // 依階級權重排序（高到低），同階再依姓名
  list = [...list].sort((a, b) => {
    const getR = v => { const p = personnel.find(x => x.id === v.personnelId) || personnel.find(x => x.name === v.ownerName); return p?.rank || v.rank || ''; };
    const wa = rankWeight(getR(a)), wb = rankWeight(getR(b));
    if (wa !== wb) return wa - wb;
    return (a.ownerName || '').localeCompare(b.ownerName || '', 'zh-TW');
  });

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
      <td class="col-rank">${(() => { const p = personnel.find(x => x.id === v.personnelId) || personnel.find(x => x.name === v.ownerName); return p?.rank || v.rank || '—'; })()}</td>
      <td class="col-name">${v.ownerName || '—'}</td>
      <td class="col-unit"><span class="unit-tag">${v.unit || '—'}</span></td>
      <td>${v.type === '汽車' ? '🚗' : '🏍'} ${v.type || '—'}</td>
      <td style="font-family:monospace;font-weight:700;letter-spacing:1px">${v.plate || '—'}</td>
      <td>${v.brand || '—'}</td>
      <td>${v.color || '—'}</td>
      <td>${vsBadge(st)}</td>
      <td class="col-actions" style="white-space:nowrap">
        ${nextBtn}
        <button class="btn-icon" style="margin-left:4px" onclick="openVehicleModal('${v.id}')">✏️</button>
        <button class="btn-icon danger" style="margin-left:2px" onclick="deleteVehicle('${v.id}','${v.plate}')">🗑</button>
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
  let list = filterByUnitScope(uniformPoints).filter(r => getRecordYearMonth(r) === upSelectedMonth);
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

  // ── Sort by rank weight ──
  list = [...list].sort((a, b) => {
    const pa = personnel?.find?.(p => p.name === a.ownerName || p.id === a.personnelId);
    const pb = personnel?.find?.(p => p.name === b.ownerName || p.id === b.personnelId);
    const wa = rankWeight(pa?.rank || a.rank || '');
    const wb = rankWeight(pb?.rank || b.rank || '');
    if (wa !== wb) return wa - wb;
    return (a.ownerName || '').localeCompare(b.ownerName || '', 'zh-TW');
  });

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
  const sorted = [...personnel].sort((a, b) => rankWeight(a.rank) - rankWeight(b.rank) || (a.name || '').localeCompare(b.name || '', 'zh-TW'));
  pSel.innerHTML = '<option value="">請選擇人員</option>' +
    sorted.map(p => `<option value="${p.id}" data-name="${p.name}" data-unit="${p.unit || ''}">${p.rank ? p.rank + ' ' : ''}${p.name}${p.unit ? '（' + p.unit + '）' : ''}</option>`).join('');

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
    const allowed = getRolePages(currentRole);
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

// ── 醫務所 helpers ─────────────────────────────────────

/** 將 pharmacies 同步到所有用到醫務所的 <select> */
function populatePharmacySelects() {
  const pArr = adminSettings.pharmacies || [];
  const opts = pArr.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  // 藥品 modal
  const msPharmacy = document.getElementById('ms-pharmacy');
  if (msPharmacy) {
    const cur = msPharmacy.value;
    msPharmacy.innerHTML = '<option value="">— 請選擇 —</option>' + opts;
    if (pArr.find(p => p.id === cur)) msPharmacy.value = cur;
  }

  // 每日清點 醫務所選單
  const diPharmacy = document.getElementById('di-pharmacy');
  if (diPharmacy) {
    const cur = diPharmacy.value;
    diPharmacy.innerHTML = '<option value="">— 請選擇 —</option>' + opts;
    if (pArr.find(p => p.id === cur)) diPharmacy.value = cur;
    else if (pArr.length) diPharmacy.value = pArr[0].id;
  }
}

/** 渲染藥材清點頁頂端的醫務所 tab 切換列 */
function renderPharmacyTabs() {
  const bar = document.getElementById('med-pharmacy-tabs');
  if (!bar) return;
  const pArr = adminSettings.pharmacies || [];
  if (!pArr.length) { bar.innerHTML = ''; return; }

  // 確保 currentMedPharmacyId 有效
  if (!pArr.find(p => p.id === currentMedPharmacyId)) {
    currentMedPharmacyId = pArr[0].id;
  }

  bar.innerHTML = pArr.map(p => `
    <button class="pharmacy-tab-btn ${p.id === currentMedPharmacyId ? 'active' : ''}"
            onclick="switchPharmacyTab('${p.id}')">
      🏥 ${p.name}
    </button>`).join('');
}

window.switchPharmacyTab = function(id) {
  currentMedPharmacyId = id;
  renderPharmacyTabs();
  renderMedicalSupplies();
  renderInventoryLogs();
};

// ── 藥材清點 ───────────────────────────────────────────

function renderMedicalSupplies() {
  const q      = (document.getElementById('medSupplySearch')?.value || '').toLowerCase();
  const cat    = document.getElementById('medSupplyCategoryFilter')?.value || '';
  const status = document.getElementById('medSupplyStatusFilter')?.value  || '';

  // 先按醫務所篩選，再按 sortOrder 排序
  let list = filterByUnitScope(medSupplies)
    .filter(s => !currentMedPharmacyId || s.pharmacyId === currentMedPharmacyId)
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || (a.name||'').localeCompare(b.name||'', 'zh-TW'));
  const pharmaList = list.filter(s => !s.hidden); // 醫務所範圍內的完整清單（供 stats 使用，不含隱藏）

  // 同步「顯示隱藏」按鈕外觀
  const showHiddenBtn = document.getElementById('medSupplyShowHiddenBtn');
  if (showHiddenBtn) {
    showHiddenBtn.classList.toggle('active', medSupplyShowHidden);
    showHiddenBtn.textContent = medSupplyShowHidden ? '👁 隱藏中' : '👁 顯示隱藏';
  }

  // 隱藏篩選
  if (!medSupplyShowHidden) list = list.filter(s => !s.hidden);

  if (q)      list = list.filter(s => (s.name||'').toLowerCase().includes(q) || (s.code||'').toLowerCase().includes(q));
  if (cat)    list = list.filter(s => s.category === cat);
  if (status) list = list.filter(s => (s.status || 'normal') === status);

  // 緊湊型 stats bar
  const statsEl = document.getElementById('medSupplyStats');
  if (statsEl) {
    const total   = pharmaList.length;
    const lowCnt  = pharmaList.filter(s => getMedSupplyStatus(s) === 'low').length;
    const expCnt  = pharmaList.filter(s => getMedSupplyStatus(s) === 'expired').length;
    statsEl.innerHTML = `<div class="med-stats-compact">
      <span class="msc-item">📦 總品項 <strong>${total}</strong></span>
      <span class="msc-sep">|</span>
      <span class="msc-item ${lowCnt ? 'warn' : ''}">⚠️ 庫存不足 <strong>${lowCnt}</strong></span>
      <span class="msc-sep">|</span>
      <span class="msc-item ${expCnt ? 'danger' : ''}">❌ 已過期 <strong>${expCnt}</strong></span>
    </div>`;
  }

  const tbody  = document.getElementById('medSupplyTableBody');
  const empty  = document.getElementById('medSupplyEmpty');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  // 找到目前醫務所最新的庫存紀錄
  const latestLog = medInventoryLogs.find(l =>
    !currentMedPharmacyId || l.pharmacyId === currentMedPharmacyId
  );
  const todayYM = new Date().toISOString().slice(0, 7);

  // 計算近 90 天日消耗量
  // 取過去 90 天內（按日期字串）的清點紀錄，計算每次間隔消耗，求平均日消耗
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recentLogs = medInventoryLogs
    .filter(l => (!currentMedPharmacyId || l.pharmacyId === currentMedPharmacyId) && l.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  // 建立各藥品的消耗量 map：{supplyId → avgDailyConsumption}
  const avgDailyMap = {};
  list.forEach(s => {
    if (recentLogs.length < 2) { avgDailyMap[s.id] = null; return; }
    // 取各筆紀錄中此藥品的總量
    const points = recentLogs
      .map(log => {
        const item = log.items?.find(it => it.supplyId === s.id);
        if (!item) return null;
        const total = (item.batches || []).reduce((sum, b) => sum + (Number(b.qty) || 0), 0);
        return { date: log.date, total };
      })
      .filter(Boolean);
    if (points.length < 2) { avgDailyMap[s.id] = null; return; }
    // 相鄰兩點差值 = 消耗（正為消耗，負為補充忽略）
    let totalConsumed = 0;
    for (let i = 1; i < points.length; i++) {
      const diff = points[i - 1].total - points[i].total;
      if (diff > 0) totalConsumed += diff;
    }
    const days = Math.max(1, Math.ceil(
      (new Date(points[points.length - 1].date) - new Date(points[0].date)) / 86400000
    ));
    avgDailyMap[s.id] = totalConsumed / days;
  });

  tbody.innerHTML = list.map((s, i) => {
    // 從最新紀錄取出此藥品的批次資料
    const logItem  = latestLog?.items?.find(it => it.supplyId === s.id);
    const batchArr = logItem?.batches || [];
    const totalQty = batchArr.reduce((sum, b) => sum + (Number(b.qty) || 0), 0);

    // 找最近到期的批次
    const validExpiries = batchArr.map(b => b.expiry).filter(Boolean).sort();
    const nearestExpiry = validExpiries[0] || '';

    // 狀態
    const st = getMedSupplyStatus(s);
    const statusBadge =
      st === 'expired' ? `<span class="mst-badge danger">已過期</span>` :
      st === 'low'     ? `<span class="mst-badge warn">效期偏短</span>` :
      logItem          ? `<span class="mst-badge ok">正常</span>` :
                         `<span class="mst-badge grey">未清點</span>`;

    // 效期顯示（若最近到期已過期，標紅）
    let expiryHtml = '—';
    if (nearestExpiry) {
      const isExpired = nearestExpiry < todayYM;
      const isSoon    = !isExpired && nearestExpiry <= addMonths(todayYM, 3);
      expiryHtml = `<span style="color:${isExpired ? 'var(--red)' : isSoon ? 'var(--yellow)' : 'inherit'};font-weight:${isExpired||isSoon?'700':'400'}">
        ${nearestExpiry.replace('-','/')}
      </span>`;
    }

    const isHidden = !!s.hidden;
    return `
    <tr data-supply-id="${s.id}" draggable="true" class="med-supply-row${isHidden ? ' mst-row-hidden' : ''}">
      <td class="col-seq mst-col-drag">
        <span class="drag-handle" title="拖曳可排序">⠿</span>
      </td>
      <td class="mst-name"><strong>${s.name || '—'}</strong>${isHidden ? ' <span class="mst-hidden-tag">已隱藏</span>' : ''}</td>
      <td class="mst-cat"><span class="mst-cat-tag">${s.category || '—'}</span></td>
      <td class="mst-unit">${s.unit || '—'}</td>
      <td class="mst-qty"><strong style="font-size:15px">${logItem ? totalQty : '—'}</strong></td>
      <td class="mst-expiry">${expiryHtml}</td>
      <td class="mst-avg">${avgDailyMap[s.id] != null ? avgDailyMap[s.id].toFixed(2) : '<span style="color:var(--text-muted);font-size:11px">—</span>'}</td>
      <td class="mst-base">${avgDailyMap[s.id] != null ? Math.ceil(avgDailyMap[s.id] * 15) : '<span style="color:var(--text-muted);font-size:11px">—</span>'}</td>
      <td class="mst-safe">${(() => {
        const avg = avgDailyMap[s.id];
        if (avg == null) return '<span style="color:var(--text-muted);font-size:11px">—</span>';
        const safe = Math.ceil(avg * 10);
        const cur  = logItem ? batchArr.reduce((sum, b) => sum + (Number(b.qty) || 0), 0) : null;
        const low  = cur != null && cur <= safe;
        return `<span style="${low ? 'color:var(--red);font-weight:700' : ''}">${safe}${low && cur != null ? ` ⚠️` : ''}</span>`;
      })()}</td>
      <td class="mst-status">${statusBadge}</td>
      <td class="col-actions">
        <button class="btn-icon" onclick="editMedSupply('${s.id}')">✏️</button>
        <button class="btn-icon${isHidden ? ' active' : ''}" title="${isHidden ? '取消隱藏' : '隱藏此藥品'}" onclick="toggleMedSupplyHidden('${s.id}',${isHidden})">${isHidden ? '🙈' : '👁'}</button>
        <button class="btn-icon danger" onclick="deleteMedSupply('${s.id}','${(s.name||'').replace(/'/g,"\\'")}')">🗑</button>
      </td>
    </tr>`;
  }).join('');

  // 啟動拖曳排序
  initMedSupplyDragSort(tbody);
}

// ── 藥材清單 拖曳排序 ─────────────────────────────────
function initMedSupplyDragSort(tbody) {
  let dragSrc  = null;
  let lastOver = null;

  tbody.querySelectorAll('.med-supply-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = 'move';
      // 延遲加 class，讓瀏覽器先截圖拖曳影像
      setTimeout(() => row.classList.add('dragging'), 0);
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      if (lastOver) { lastOver.classList.remove('drag-over'); lastOver = null; }
      if (dragSrc) saveMedDragOrder();
      dragSrc = null;
    });

    row.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === row) return;
      e.dataTransfer.dropEffect = 'move';
      if (lastOver && lastOver !== row) lastOver.classList.remove('drag-over');
      lastOver = row;
      row.classList.add('drag-over');
      // 依滑鼠位置決定插入前或後
      const rect = row.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        tbody.insertBefore(dragSrc, row);
      } else {
        tbody.insertBefore(dragSrc, row.nextSibling);
      }
    });

    row.addEventListener('drop', e => e.preventDefault());
  });

  // 讓 tbody 本身也接受 drop（避免無法放置到末尾時卡住）
  tbody.addEventListener('dragover', e => e.preventDefault());
  tbody.addEventListener('drop',     e => e.preventDefault());

  async function saveMedDragOrder() {
    const rows = [...tbody.querySelectorAll('.med-supply-row')];
    await Promise.all(rows.map((r, idx) =>
      updateDoc(doc(db, 'medSupplies', r.dataset.supplyId), { sortOrder: idx + 1 })
        .catch(err => console.error('排序儲存失敗', err))
    ));
  }
}

document.getElementById('medSupplySearch')?.addEventListener('input', renderMedicalSupplies);
document.getElementById('medSupplyCategoryFilter')?.addEventListener('change', renderMedicalSupplies);
document.getElementById('medSupplyStatusFilter')?.addEventListener('change', renderMedicalSupplies);
document.getElementById('medSupplyShowHiddenBtn')?.addEventListener('click', () => {
  medSupplyShowHidden = !medSupplyShowHidden;
  renderMedicalSupplies();
});
// ── 藥材品項 CRUD ─────────────────────────────────────
let editingMedSupplyId = null;

function openMedSupplyModal(id = null) {
  editingMedSupplyId = id;
  const s = id ? medSupplies.find(x => x.id === id) : null;
  document.getElementById('med-supply-modal-title').textContent = s ? '編輯藥材品項' : '新增藥材品項';
  populatePharmacySelects(); // 確保選單是最新的
  const sv = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = v ?? ''; };
  sv('ms-name',     s?.name);
  sv('ms-category', s?.category);
  sv('ms-unit',     s?.unit);
  // 醫務所：編輯時帶入原值，新增時帶入目前選中的醫務所分頁
  const msPharmacy = document.getElementById('ms-pharmacy');
  if (msPharmacy) msPharmacy.value = s?.pharmacyId || currentMedPharmacyId || '';
  document.getElementById('medSupplyModalOverlay').classList.add('open');
}

function closeMedSupplyModal() {
  document.getElementById('medSupplyModalOverlay').classList.remove('open');
}

function getMedSupplyStatus(s) {
  // With simplified catalog (no qty/expiry stored), derive from latest log
  const latest = medInventoryLogs[0];
  if (!latest) return 'normal';
  const logItem = (latest.items || []).find(i => i.supplyId === s.id);
  if (!logItem) return 'normal';
  const todayYM = new Date().toISOString().slice(0, 7);
  const batches = logItem.batches || [];
  if (batches.some(b => b.expiry && b.expiry < todayYM)) return 'expired';
  if (batches.some(b => b.expiry && b.expiry <= addMonths(todayYM, 3))) return 'low';
  return 'normal';
}

document.getElementById('addMedSupplyBtn')?.addEventListener('click', () => openMedSupplyModal(null));
document.getElementById('medSupplyModalClose')?.addEventListener('click',  closeMedSupplyModal);
document.getElementById('medSupplyCancelBtn')?.addEventListener('click',   closeMedSupplyModal);
document.getElementById('medSupplyModalOverlay')?.addEventListener('click', e => {
  if (e.target.id === 'medSupplyModalOverlay') closeMedSupplyModal();
});

document.getElementById('medSupplySaveBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('ms-name')?.value.trim();
  if (!name) { alert('請輸入藥品名稱'); return; }

  const gv = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const pharmacyId = gv('ms-pharmacy');
  if (!pharmacyId) { alert('請選擇所屬醫務所'); return; }

  const data = {
    name,
    pharmacyId,
    category: gv('ms-category'),
    unit:     gv('ms-unit'),
  };

  try {
    if (editingMedSupplyId) {
      await updateDoc(doc(db, 'medSupplies', editingMedSupplyId), data);
    } else {
      const maxOrder = medSupplies.reduce((m, s) => Math.max(m, s.sortOrder ?? 0), 0);
      await addDoc(COL_MED_SUPPLIES, { ...data, sortOrder: maxOrder + 1, createdAt: serverTimestamp() });
    }
    closeMedSupplyModal();
  } catch(e) { console.error(e); alert('儲存失敗：' + e.message); }
});

window.editMedSupply = id => openMedSupplyModal(id);

window.saveMedSupplyOrder = async function(id, val) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 1) return;
  try { await updateDoc(doc(db, 'medSupplies', id), { sortOrder: n }); }
  catch(e) { console.error('排序儲存失敗', e); }
};

window.deleteMedSupply = async function(id, name) {
  if (!confirm(`確定要刪除「${name}」？`)) return;
  try { await deleteDoc(doc(db, 'medSupplies', id)); }
  catch(e) { alert('刪除失敗'); }
};

window.toggleMedSupplyHidden = async function(id, currentlyHidden) {
  try {
    await updateDoc(doc(db, 'medSupplies', id), { hidden: !currentlyHidden });
  } catch(e) { console.error('隱藏狀態儲存失敗', e); alert('操作失敗'); }
};

// ── 衛材裝備清點 ───────────────────────────────────────

function populateEquipTypeDropdowns() {
  const opts = equipmentTypes.map(t => `<option value="${t.id}">${t.name}${t.brand ? ` — ${t.brand}` : ''}${t.category ? `（${t.category}）` : ''}</option>`).join('');
  const typeFilter = document.getElementById('medEquipTypeFilter');
  if (typeFilter) {
    const cur = typeFilter.value;
    typeFilter.innerHTML = `<option value="">全部品項</option>${opts}`;
    typeFilter.value = cur;
  }
  const typeSelect = document.getElementById('me-type-select');
  if (typeSelect) {
    const cur = typeSelect.value;
    typeSelect.innerHTML = `<option value="">請選擇品項</option>${opts}`;
    typeSelect.value = cur;
  }
}

function renderEquipTypes() {
  const listEl = document.getElementById('medEquipTypeList');
  const empty  = document.getElementById('medEquipTypeEmpty');
  if (!listEl) return;
  if (!equipmentTypes.length) { listEl.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';
  listEl.innerHTML = equipmentTypes.map(t => `
    <div class="me-type-item">
      <div>
        <span class="me-type-name">${t.name}</span>
        ${t.brand ? `<span class="me-type-cat" style="background:#dbeafe;color:#1d4ed8">${t.brand}</span>` : ''}
        ${t.category ? `<span class="me-type-cat">${t.category}</span>` : ''}
        ${t.note ? `<span style="font-size:12px;color:var(--text-muted);margin-left:4px">${t.note}</span>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn-icon" onclick="editEquipType('${t.id}')">✏️</button>
        <button class="btn-icon danger" onclick="deleteEquipType('${t.id}','${(t.name||'').replace(/'/g,"\\'")}')">🗑</button>
      </div>
    </div>`).join('');
}

// ── Tab toggle ──
let medEquipTab = 'list'; // 'list' | 'types'
function switchMedEquipTab(tab) {
  medEquipTab = tab;
  const listPanel  = document.getElementById('medEquipListPanel');
  const typePanel  = document.getElementById('medEquipTypePanel');
  const addBtn     = document.getElementById('addMedEquipBtn');
  const tabBtn     = document.getElementById('medEquipTypeTabBtn');
  if (tab === 'types') {
    listPanel.style.display = 'none';
    typePanel.style.display = '';
    addBtn.style.display = 'none';
    tabBtn.textContent = '← 裝備清單';
    renderEquipTypes();
  } else {
    typePanel.style.display = 'none';
    listPanel.style.display = '';
    addBtn.style.display = '';
    tabBtn.textContent = '📋 品項管理';
    renderMedicalEquipment();
  }
}

document.getElementById('medEquipTypeTabBtn')?.addEventListener('click', () => {
  switchMedEquipTab(medEquipTab === 'types' ? 'list' : 'types');
});

// ── 批量校正 ─────────────────────────────────────────────
function renderBulkCalibList() {
  const date     = document.getElementById('bulk-calib-date')?.value;
  const listEl   = document.getElementById('bulk-calib-equip-list');
  const submitBtn = document.getElementById('bulk-calib-submit');
  if (!listEl) return;

  if (!date) {
    listEl.innerHTML = `<div style="color:#94a3b8;font-size:13px">請先選擇校正日期</div>`;
    if (submitBtn) submitBtn.style.display = 'none';
    return;
  }
  const equips = medEquipments.filter(e => e.status !== 'scrapped');
  if (!equips.length) {
    listEl.innerHTML = `<div style="color:#94a3b8;font-size:13px">尚無裝備資料</div>`;
    if (submitBtn) submitBtn.style.display = 'none';
    return;
  }
  if (submitBtn) submitBtn.style.display = '';

  // group by typeName
  const grouped = {};
  equips.forEach(e => {
    const k = e.typeName || '未分類';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(e);
  });

  listEl.innerHTML =
    `<div style="display:flex;gap:6px;margin-bottom:10px">
       <button type="button" onclick="bulkCalibSelectAll(true)"  class="btn btn-sm btn-secondary">全選</button>
       <button type="button" onclick="bulkCalibSelectAll(false)" class="btn btn-sm btn-secondary">取消全選</button>
     </div>` +
    Object.entries(grouped).map(([typeName, items]) =>
      `<div style="margin-bottom:10px">
         <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">${typeName}</div>
         ${items.map(e => {
           const alreadyDone = (e.calibrations || []).some(c => c.date === date);
           return `<label style="display:flex;align-items:center;gap:8px;padding:4px 2px;cursor:pointer">
             <input type="checkbox" class="bulk-calib-check" value="${e.id}" ${alreadyDone ? '' : 'checked'}>
             <span style="font-size:13px;flex:1">#${e.code || '—'}</span>
             ${alreadyDone ? `<span style="font-size:11px;color:#16a34a;font-weight:600">已記錄</span>` : ''}
           </label>`;
         }).join('')}
       </div>`
    ).join('');
}

window.bulkCalibSelectAll = (checked) => {
  document.querySelectorAll('.bulk-calib-check').forEach(cb => { cb.checked = checked; });
};

document.getElementById('bulk-calib-date')?.addEventListener('change', renderBulkCalibList);

document.getElementById('bulk-calib-submit')?.addEventListener('click', async () => {
  const date = document.getElementById('bulk-calib-date')?.value;
  if (!date) return;
  const selected = [...document.querySelectorAll('.bulk-calib-check:checked')].map(cb => cb.value);
  if (!selected.length) { alert('請勾選至少一台裝備'); return; }
  const btn = document.getElementById('bulk-calib-submit');
  if (btn) { btn.disabled = true; btn.textContent = '儲存中…'; }
  try {
    await Promise.all(selected.map(id => {
      const e = medEquipments.find(x => x.id === id);
      const existing = e?.calibrations || [];
      if (existing.some(c => c.date === date)) return Promise.resolve();
      const updated = [{ date }, ...existing].sort((a, b) => b.date.localeCompare(a.date));
      return updateDoc(doc(db, 'medEquipments', id), { calibrations: updated });
    }));
    document.getElementById('bulk-calib-date').value = '';
    renderBulkCalibList();
    alert(`✓ 已為 ${selected.length} 台裝備新增校正記錄`);
  } catch(err) {
    console.error(err);
    alert('儲存失敗：' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✓ 批量新增校正日期'; }
  }
});

function renderMedicalEquipment() {
  const q      = (document.getElementById('medEquipSearch')?.value || '').toLowerCase();
  const typeId = document.getElementById('medEquipTypeFilter')?.value || '';
  const status = document.getElementById('medEquipStatusFilter')?.value  || '';

  let list = filterByUnitScope(medEquipments);
  if (q)      list = list.filter(e => (e.typeName||'').toLowerCase().includes(q) || (e.code||'').toLowerCase().includes(q));
  if (typeId) list = list.filter(e => e.typeId === typeId);
  if (status) list = list.filter(e => (e.status || 'normal') === status);

  const statsEl = document.getElementById('medEquipStats');
  if (statsEl) {
    const all         = filterByUnitScope(medEquipments);
    const total       = all.length;
    const maintenance = all.filter(e => e.status === 'maintenance').length;
    const scrapped    = all.filter(e => e.status === 'scrapped').length;
    statsEl.innerHTML = `<div class="med-stats-bar">
      <div class="med-stat-card"><div class="val">${total}</div><div class="lbl">總台數</div></div>
      <div class="med-stat-card yellow"><div class="val" style="color:var(--yellow)">${maintenance}</div><div class="lbl">維修中</div></div>
      <div class="med-stat-card red"><div class="val" style="color:var(--red)">${scrapped}</div><div class="lbl">已報廢</div></div>
    </div>`;
  }

  const listEl = document.getElementById('medEquipList');
  const empty  = document.getElementById('medEquipEmpty');
  if (!listEl) return;
  if (!list.length) { listEl.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  const statusBadge = s => {
    if (s === 'scrapped')    return `<span class="tag" style="background:var(--red-bg);color:var(--red)">已報廢</span>`;
    if (s === 'maintenance') return `<span class="tag" style="background:var(--yellow-bg);color:var(--yellow)">維修中</span>`;
    return `<span class="tag" style="background:var(--green-bg);color:var(--green)">堪用</span>`;
  };

  const batteryDisplay = d => {
    if (!d) return '<span style="color:var(--text-muted)">未設定</span>';
    const diff = Math.ceil((new Date(d) - new Date()) / 86400000);
    const color = diff < 30 ? 'var(--red)' : diff < 90 ? 'var(--yellow)' : 'var(--text)';
    return `<span style="color:${color}">${formatDate(d)}${diff < 0 ? '（已過期）' : diff < 90 ? `（剩 ${diff} 天）` : ''}</span>`;
  };

  // Group by typeName for display
  const grouped = {};
  list.forEach(e => {
    const key = e.typeId || '__none__';
    if (!grouped[key]) grouped[key] = { typeName: e.typeName || '未分類', category: e.typeCategory || '', items: [] };
    grouped[key].items.push(e);
  });

  listEl.innerHTML = Object.values(grouped).map(g => `
    <div class="me-group">
      <div class="me-group-header">
        <span class="me-group-name">${g.typeName}</span>
        ${g.category ? `<span class="di-drug-cat">${g.category}</span>` : ''}
        <span class="me-group-count">${g.items.length} 台</span>
      </div>
      ${g.items.map(e => `
        <div class="me-card">
          <div class="me-card-header">
            <div>
              <div class="me-card-name">#${e.code || '—'}</div>
            </div>
            <div class="me-card-header-right">
              ${statusBadge(e.status || 'normal')}
              <div class="me-card-actions">
                <button class="btn-icon" onclick="editMedEquip('${e.id}')">✏️</button>
                <button class="btn-icon danger" onclick="deleteMedEquip('${e.id}','${(e.code||'').replace(/'/g,"\\'")}')">🗑</button>
              </div>
            </div>
          </div>
          <div class="me-fields">
            ${e.battery1 ? `<div class="me-field"><div class="me-field-label">電池1效期</div><div class="me-field-value">${batteryDisplay(e.battery1)}</div></div>` : ''}
            ${e.battery2 ? `<div class="me-field"><div class="me-field-label">電池2效期</div><div class="me-field-value">${batteryDisplay(e.battery2)}</div></div>` : ''}
            ${e.pad1 ? `<div class="me-field"><div class="me-field-label">貼片1效期</div><div class="me-field-value">${batteryDisplay(e.pad1)}</div></div>` : ''}
            ${e.pad2 ? `<div class="me-field"><div class="me-field-label">貼片2效期</div><div class="me-field-value">${batteryDisplay(e.pad2)}</div></div>` : ''}
            ${(e.calibrations||[]).length ? `<div class="me-field"><div class="me-field-label">最近校正</div><div class="me-field-value">${formatDate(e.calibrations[0]?.date)}</div></div>` : ''}
            ${e.note ? `<div class="me-field"><div class="me-field-label">備註</div><div class="me-field-value">${e.note}</div></div>` : ''}
          </div>
        </div>`).join('')}
    </div>`).join('');
}

document.getElementById('medEquipSearch')?.addEventListener('input', renderMedicalEquipment);
document.getElementById('medEquipTypeFilter')?.addEventListener('change', renderMedicalEquipment);
document.getElementById('medEquipStatusFilter')?.addEventListener('change', renderMedicalEquipment);

// ── 衛材裝備 CRUD ──────────────────────────────────────
let editingMedEquipId = null;

let tempCalibrations = [];

function renderMeCalibrations() {
  const el = document.getElementById('me-calibrations-list');
  if (!el) return;
  if (!tempCalibrations.length) {
    el.innerHTML = `<span style="color:#94a3b8;font-size:12px">尚無校正記錄</span>`;
    return;
  }
  el.innerHTML = tempCalibrations.map(c =>
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:13px">📅 ${c.date}</span>
      <button type="button" onclick="removeCalibration('${c.date}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:0 4px">✕</button>
    </div>`
  ).join('');
}

window.removeCalibration = (date) => {
  tempCalibrations = tempCalibrations.filter(c => c.date !== date);
  renderMeCalibrations();
};

function openMedEquipModal(id = null) {
  editingMedEquipId = id;
  const e = id ? medEquipments.find(x => x.id === id) : null;
  document.getElementById('med-equip-modal-title').textContent = e ? '編輯裝備' : '新增裝備';
  populateEquipTypeDropdowns();
  const sv = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = v ?? ''; };
  sv('me-type-select', e?.typeId || '');
  sv('me-code',        e?.code);
  sv('me-battery1',    e?.battery1 || '');
  sv('me-battery2',    e?.battery2 || '');
  sv('me-pad1',        e?.pad1 || '');
  sv('me-pad2',        e?.pad2 || '');
  sv('me-status',      e?.status || 'normal');
  sv('me-note',        e?.note);
  const dateEl = document.getElementById('me-calib-date');
  if (dateEl) dateEl.value = '';
  tempCalibrations = [...(e?.calibrations || [])].sort((a, b) => b.date.localeCompare(a.date));
  renderMeCalibrations();
  document.getElementById('medEquipModalOverlay').classList.add('open');
}

function closeMedEquipModal() {
  document.getElementById('medEquipModalOverlay').classList.remove('open');
}

document.getElementById('addMedEquipBtn')?.addEventListener('click', () => openMedEquipModal(null));
document.getElementById('medEquipModalClose')?.addEventListener('click', closeMedEquipModal);
document.getElementById('medEquipCancelBtn')?.addEventListener('click', closeMedEquipModal);
document.getElementById('medEquipModalOverlay')?.addEventListener('click', e => {
  if (e.target.id === 'medEquipModalOverlay') closeMedEquipModal();
});

document.getElementById('me-add-calib-btn')?.addEventListener('click', () => {
  const dateEl = document.getElementById('me-calib-date');
  const date = dateEl?.value;
  if (!date) { alert('請選擇校正日期'); return; }
  if (!tempCalibrations.find(c => c.date === date)) {
    tempCalibrations.unshift({ date });
    tempCalibrations.sort((a, b) => b.date.localeCompare(a.date));
    renderMeCalibrations();
  }
  if (dateEl) dateEl.value = '';
});

document.getElementById('medEquipSaveBtn')?.addEventListener('click', async () => {
  const typeId = document.getElementById('me-type-select')?.value;
  const code   = document.getElementById('me-code')?.value.trim();
  if (!typeId) { alert('請選擇裝備品項'); return; }
  if (!code)   { alert('請輸入序號／編號'); return; }
  const typeObj = equipmentTypes.find(t => t.id === typeId);
  const gv = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const data = {
    typeId,
    typeName:     typeObj?.name || '',
    typeCategory: typeObj?.category || '',
    code,
    battery1:     gv('me-battery1'),
    battery2:     gv('me-battery2'),
    pad1:         gv('me-pad1'),
    pad2:         gv('me-pad2'),
    status:       gv('me-status') || 'normal',
    note:         gv('me-note'),
    calibrations: tempCalibrations,
  };
  try {
    if (editingMedEquipId) {
      await updateDoc(doc(db, 'medEquipments', editingMedEquipId), data);
    } else {
      await addDoc(COL_MED_EQUIPS, { ...data, createdAt: serverTimestamp() });
    }
    closeMedEquipModal();
  } catch(e) { console.error(e); alert('儲存失敗：' + e.message); }
});

window.editMedEquip = id => openMedEquipModal(id);

window.deleteMedEquip = async function(id, code) {
  if (!confirm(`確定要刪除序號「${code}」的裝備？此操作無法復原。`)) return;
  try { await deleteDoc(doc(db, 'medEquipments', id)); }
  catch(e) { alert('刪除失敗：' + e.message); }
};

// ── 裝備品項類型管理 ──
let editingEquipTypeId = null;

function openEquipTypeModal(id = null) {
  editingEquipTypeId = id;
  const t = id ? equipmentTypes.find(x => x.id === id) : null;
  document.getElementById('equip-type-modal-title').textContent = t ? '編輯品項' : '新增品項';
  const sv = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = v ?? ''; };
  sv('et-name',     t?.name);
  sv('et-brand',    t?.brand || '');
  sv('et-category', t?.category || '');
  sv('et-note',     t?.note);
  document.getElementById('equipTypeModalOverlay').classList.add('open');
}

function closeEquipTypeModal() {
  document.getElementById('equipTypeModalOverlay').classList.remove('open');
}

document.getElementById('addEquipTypeBtn')?.addEventListener('click', () => openEquipTypeModal(null));
document.getElementById('equipTypeModalClose')?.addEventListener('click', closeEquipTypeModal);
document.getElementById('equipTypeCancelBtn')?.addEventListener('click', closeEquipTypeModal);
document.getElementById('equipTypeModalOverlay')?.addEventListener('click', e => {
  if (e.target.id === 'equipTypeModalOverlay') closeEquipTypeModal();
});

document.getElementById('equipTypeSaveBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('et-name')?.value.trim();
  if (!name) { alert('請輸入品項名稱'); return; }
  const data = {
    name,
    brand:    document.getElementById('et-brand')?.value.trim() || '',
    category: document.getElementById('et-category')?.value.trim() || '',
    note:     document.getElementById('et-note')?.value.trim() || '',
  };
  try {
    if (editingEquipTypeId) {
      await updateDoc(doc(db, 'equipmentTypes', editingEquipTypeId), data);
    } else {
      await addDoc(COL_EQUIP_TYPES, { ...data, createdAt: serverTimestamp() });
    }
    closeEquipTypeModal();
  } catch(e) { console.error(e); alert('儲存失敗：' + e.message); }
});

window.editEquipType = id => openEquipTypeModal(id);

window.deleteEquipType = async function(id, name) {
  if (!confirm(`確定要刪除品項「${name}」？\n（已建立的裝備紀錄不受影響）`)) return;
  try { await deleteDoc(doc(db, 'equipmentTypes', id)); }
  catch(e) { alert('刪除失敗：' + e.message); }
};

// ── 每日清點 helpers ───────────────────────────────────

/** 填充 本日車長人員 下拉選單（以單位 optgroup 分組） */
// 清點人 下拉（按單位分組，預設選目前登入者）
function populateDiRecorder() {
  const sel = document.getElementById('di-recorder');
  if (!sel) return;
  const cur = sel.value;

  const unitOrder = adminSettings.units || [];
  const unitMap = {};
  (personnel || []).forEach(p => {
    const u = p.unit || '其他';
    if (!unitMap[u]) unitMap[u] = [];
    unitMap[u].push(p);
  });
  // 按 adminSettings 單位順序排
  const units = Object.keys(unitMap).sort((a, b) => {
    const ia = unitOrder.indexOf(a), ib = unitOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1; if (ib !== -1) return 1;
    return a.localeCompare(b, 'zh-TW');
  });

  sel.innerHTML = '<option value="">— 請選擇 —</option>' +
    units.map(unit => {
      const opts = (unitMap[unit] || [])
        .sort((a, b) => rankWeight(a.rank) - rankWeight(b.rank))
        .map(p => `<option value="${p.id}">${p.rank ? p.rank + ' ' : ''}${p.name}</option>`)
        .join('');
      return `<optgroup label="${unit}">${opts}</optgroup>`;
    }).join('');

  // 預設選目前登入者
  if (!cur && currentUser) {
    const me = registeredUsers?.find?.(u => u.id === currentUser.uid);
    const linked = (personnel || []).find(p =>
      p.id === me?.personnelId || p.id === currentUser.uid ||
      (p.email && p.email.toLowerCase() === (currentUser.email || '').toLowerCase())
    );
    if (linked) sel.value = linked.id;
  } else if (cur && [...sel.options].some(o => o.value === cur)) {
    sel.value = cur;
  }
}

// 本日車長：先選單位
function populateDiChargeUnit() {
  const sel = document.getElementById('di-charge-unit');
  if (!sel) return;
  const cur = sel.value;
  const unitOrder = adminSettings.units || [];
  const units = [...new Set((personnel || []).map(p => p.unit).filter(Boolean))];
  units.sort((a, b) => {
    const ia = unitOrder.indexOf(a), ib = unitOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1; if (ib !== -1) return 1;
    return a.localeCompare(b, 'zh-TW');
  });
  sel.innerHTML = '<option value="">— 選擇單位 —</option>' +
    units.map(u => `<option value="${u}">${u}</option>`).join('');
  if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
}

// 本日車長：依所選單位篩人員（按階級排序）
function populateDiChargePerson() {
  const sel = document.getElementById('di-charge-person');
  if (!sel) return;
  const cur = sel.value;
  const unitFilter = document.getElementById('di-charge-unit')?.value || '';

  let people = [...(personnel || [])];
  if (unitFilter) people = people.filter(p => p.unit === unitFilter);
  people.sort((a, b) => {
    const wr = rankWeight(a.rank) - rankWeight(b.rank);
    if (wr !== 0) return wr;
    return (a.name || '').localeCompare(b.name || '', 'zh-TW');
  });

  sel.innerHTML = '<option value="">— 請選擇人員 —</option>' +
    people.map(p => `<option value="${p.id}">${p.rank ? p.rank + ' ' : ''}${p.name}</option>`).join('');

  if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
}

// ── 每日清點 ───────────────────────────────────────────
function renderDailyInventory() {
  const diDate = document.getElementById('di-date');
  if (diDate && !diDate.value) {
    const t = new Date();
    diDate.value = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  }

  // 同步醫務所選單、清點人、本日車長
  populatePharmacySelects();
  populateDiRecorder();
  populateDiChargeUnit();
  populateDiChargePerson();

  const container = document.getElementById('di-drug-list');
  const empty     = document.getElementById('di-empty');
  if (!container) return;

  // 按所選醫務所篩選藥品，並依 sortOrder 排序（與藥材清點頁一致），排除隱藏品項
  const selectedPharmaId = document.getElementById('di-pharmacy')?.value || '';
  const list = filterByUnitScope(medSupplies)
    .filter(s => (!selectedPharmaId || s.pharmacyId === selectedPharmaId) && !s.hidden)
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || (a.name||'').localeCompare(b.name||'', 'zh-TW'));
  if (!list.length) {
    container.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = list.map(s => `
    <div class="di-drug-card" data-supply-id="${s.id}" data-name="${(s.name||'').replace(/"/g,'&quot;')}" data-unit="${s.unit||''}">
      <div class="di-drug-card-header">
        <div>
          <span class="di-drug-name">${s.name || '—'}</span>
          ${s.category ? `<span class="di-drug-cat">${s.category}</span>` : ''}
        </div>
        <span class="di-drug-unit">${s.unit || ''}</span>
      </div>
      <div class="di-batch-header">
        <span>效期（年/月）</span>
        <span>數量</span>
        <span></span>
      </div>
      <div class="di-batch-rows">
        <div class="di-batch-row">
          <input type="month" class="di-batch-expiry" placeholder="效期">
          <input type="number" class="di-batch-qty" min="0" inputmode="numeric" pattern="[0-9]*" placeholder="數量">
          <button type="button" class="di-batch-remove" onclick="removeDiBatchRow(this)" title="移除此批次">×</button>
        </div>
      </div>
      <button type="button" class="di-add-batch-btn" onclick="addDiBatchRow(this)">＋ 新增批次</button>
    </div>
  `).join('');
}

function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

window.addDiBatchRow = function(btn) {
  const rows = btn.previousElementSibling; // .di-batch-rows
  const row  = document.createElement('div');
  row.className = 'di-batch-row';
  row.innerHTML = `
    <input type="month" class="di-batch-expiry" placeholder="效期">
    <input type="number" class="di-batch-qty" min="0" inputmode="numeric" pattern="[0-9]*" placeholder="數量">
    <button type="button" class="di-batch-remove" onclick="removeDiBatchRow(this)" title="移除">×</button>`;
  rows.appendChild(row);
};

window.removeDiBatchRow = function(btn) {
  const rows = btn.closest('.di-batch-rows');
  if (rows.querySelectorAll('.di-batch-row').length <= 1) {
    // Keep at least one row, just clear it
    btn.closest('.di-batch-row').querySelectorAll('input').forEach(i => i.value = '');
    return;
  }
  btn.closest('.di-batch-row').remove();
};

document.getElementById('di-load-prev-btn')?.addEventListener('click', () => {
  if (!medInventoryLogs.length) { showToast('尚無清點紀錄可帶入'); return; }
  // 優先找同醫務所的最新紀錄
  const pharmaId = document.getElementById('di-pharmacy')?.value || '';
  const latest = pharmaId
    ? (medInventoryLogs.find(l => l.pharmacyId === pharmaId) || medInventoryLogs[0])
    : medInventoryLogs[0];
  showConfirm(
    `帶入 ${latest.date}（${latest.pharmacyName || ''}${latest.recorderName || latest.recorder}）的清點數據？`,
    () => {
      document.querySelectorAll('.di-drug-card').forEach(card => {
        const sid = card.dataset.supplyId;
        const logItem = (latest.items || []).find(i => i.supplyId === sid);
        if (!logItem) return;

        const rowsContainer = card.querySelector('.di-batch-rows');
        if (!rowsContainer) return;
        rowsContainer.innerHTML = '';

        const batches = logItem.batches || (logItem.counted != null ? [{ qty: logItem.counted, expiry: logItem.expiry || '' }] : []);
        if (!batches.length) batches.push({ qty: '', expiry: '' });

        batches.forEach(b => {
          const row = document.createElement('div');
          row.className = 'di-batch-row';
          row.innerHTML = `
            <input type="month" class="di-batch-expiry" value="${b.expiry || ''}" placeholder="效期">
            <input type="number" class="di-batch-qty" value="${b.qty ?? ''}" min="0" inputmode="numeric" pattern="[0-9]*" placeholder="數量">
            <button type="button" class="di-batch-remove" onclick="removeDiBatchRow(this)" title="移除">×</button>`;
          rowsContainer.appendChild(row);
        });
      });
      showToast('✓ 已帶入最新清點數據');
    }
  );
});

// ── 清點紀錄 ───────────────────────────────────────────
function renderInventoryLogs() {
  const container = document.getElementById('med-inv-log-list');
  const empty     = document.getElementById('med-inv-log-empty');
  if (!container) return;

  const logs = currentMedPharmacyId
    ? medInventoryLogs.filter(l => l.pharmacyId === currentMedPharmacyId)
    : medInventoryLogs;

  if (!logs.length) {
    container.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = logs.map(log => {
    // Find the previous log for the same pharmacy (for 帳面 comparison)
    const sortedLogs = [...medInventoryLogs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const logIdx = sortedLogs.findIndex(l => l.id === log.id);
    const prevLog = sortedLogs.slice(logIdx + 1).find(l => l.pharmacyId === log.pharmacyId);

    const getTotal = (item) => (item?.batches || []).reduce((s, b) => s + (b.qty ?? 0), 0)
                               + (item?.batches ? 0 : (item?.counted ?? 0));

    const itemsWithDiff = (log.items || []).map(i => {
      const counted  = getTotal(i);
      const prevItem = prevLog?.items?.find(pi => pi.supplyId === i.supplyId);
      const expected = prevItem != null ? getTotal(prevItem) : null;
      const diff     = expected != null ? counted - expected : null;
      const expiries = (i.batches || []).filter(b => b.expiry).map(b => b.expiry.replace(/-/g, '/')).join(' / ') || '—';
      return { ...i, counted, expected, diff, expiries };
    });

    const diffItems = itemsWithDiff.filter(i => i.diff !== null && i.diff !== 0);

    const itemRows = itemsWithDiff.map(i => {
      const diffStyle = i.diff === null ? '' : i.diff === 0 ? 'color:var(--green)' : i.diff > 0 ? 'color:var(--yellow);font-weight:700' : 'color:var(--red);font-weight:700';
      const diffText  = i.diff === null ? '—' : i.diff === 0 ? '0' : (i.diff > 0 ? '+' + i.diff : String(i.diff));
      return `<tr>
        <td>${i.name}</td>
        <td>${i.expiries}</td>
        <td style="text-align:right">${i.expected != null ? i.expected : '—'}</td>
        <td style="text-align:right">${i.counted}</td>
        <td style="text-align:right;${diffStyle}">${diffText}${i.diff !== null && i.diff !== 0 ? ' ' + (i.unit || '') : ''}</td>
        <td>${i.note || '—'}</td>
      </tr>`;
    }).join('');

    const sigHtml = log.signature
      ? `<div class="inv-log-sig-wrap"><img class="inv-log-sig-img" src="${log.signature}" alt="簽名"></div>`
      : '';

    const pharmaLabel = log.pharmacyName ? `<span style="margin-right:10px;background:var(--bg);border:1px solid var(--border);border-radius:99px;padding:2px 8px;font-size:11px;font-weight:600">🏥 ${log.pharmacyName}</span>` : '';
    const chargeLabel = log.chargeName   ? `<span style="margin-left:10px;font-size:12px;color:var(--text-muted)">🚗 ${log.chargeName}</span>` : '';

    return `<div class="inv-log-card">
      <div class="inv-log-card-header">
        <div>
          ${pharmaLabel}
          <span style="font-weight:700;font-size:15px">📅 ${log.date}</span>
          <span style="margin-left:10px;font-size:13px;color:var(--text-muted)">👤 ${log.recorderName || log.recorder || '—'}</span>
          ${chargeLabel}
          ${diffItems.length ? `<span style="margin-left:10px;background:var(--yellow-bg);color:var(--yellow);font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px">⚠️ ${diffItems.length} 項差異</span>` : `<span style="margin-left:10px;background:var(--green-bg);color:var(--green);font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px">✅ 無差異</span>`}
        </div>
        <button class="btn-icon danger" onclick="deleteInventoryLog('${log.id}')">🗑</button>
      </div>
      <div class="table-wrap" style="margin-top:10px">
        <table class="data-table" style="font-size:12px">
          <thead><tr><th>藥品</th><th>效期</th><th style="text-align:right">帳面</th><th style="text-align:right">實點</th><th style="text-align:right">差異</th><th>備註</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
      ${sigHtml}
    </div>`;
  }).join('');
}

window.deleteInventoryLog = async function(id) {
  if (!confirm('確定刪除此清點紀錄？')) return;
  try { await deleteDoc(doc(db, 'medInventoryLogs', id)); }
  catch(e) { alert('刪除失敗'); }
};

// ── 藥材清點 tabs ──────────────────────────────────────
document.querySelectorAll('[data-medtab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-medtab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.medtab;
    document.getElementById('medsup-pane-catalog').style.display = tab === 'catalog' ? '' : 'none';
    document.getElementById('medsup-pane-logs').style.display    = tab === 'logs'    ? '' : 'none';
    if (tab === 'logs') renderInventoryLogs();
  });
});

// di-pharmacy 變更時重新載入藥品清單
document.getElementById('di-pharmacy')?.addEventListener('change', () => {
  // 清空現有清點資料再重繪
  const container = document.getElementById('di-drug-list');
  if (container) container.innerHTML = '';
  renderDailyInventory();
});

// 選完單位後重整人員清單
document.getElementById('di-charge-unit')?.addEventListener('change', () => {
  populateDiChargePerson();
});

// ── 每日清點 submit ────────────────────────────────────
document.getElementById('di-submit-btn')?.addEventListener('click', () => {
  const date         = document.getElementById('di-date')?.value;
  const recorderEl   = document.getElementById('di-recorder');
  const recorder     = recorderEl?.options[recorderEl.selectedIndex]?.text || '';
  const pharmacyId   = document.getElementById('di-pharmacy')?.value || '';
  const chargeSelEl  = document.getElementById('di-charge-person');
  const chargeId     = chargeSelEl?.value || '';
  const chargeName   = chargeSelEl?.options[chargeSelEl.selectedIndex]?.text || '';

  if (!date)       { alert('請選擇清點日期'); return; }
  if (!recorder || recorder === '— 請選擇 —') { alert('請選擇清點人'); return; }
  if (!pharmacyId) { alert('請選擇醫務所'); return; }

  const pharmacyName = (adminSettings.pharmacies || []).find(p => p.id === pharmacyId)?.name || '';

  const items = [];
  document.querySelectorAll('.di-drug-card').forEach(card => {
    const batches = [];
    card.querySelectorAll('.di-batch-row').forEach(row => {
      const expiry = row.querySelector('.di-batch-expiry')?.value || '';
      const qty    = row.querySelector('.di-batch-qty')?.value;
      if (qty !== '' && qty !== null) {
        batches.push({ expiry, qty: Number(qty) });
      }
    });
    if (batches.length > 0) {
      items.push({
        supplyId: card.dataset.supplyId,
        name:     card.dataset.name,
        unit:     card.dataset.unit,
        batches,
      });
    }
  });

  if (!items.length) { alert('請至少填寫一項藥材數量'); return; }

  // Compare with latest log for same pharmacy
  const latest = medInventoryLogs.find(l => !pharmacyId || l.pharmacyId === pharmacyId);
  const diffs  = [];
  items.forEach(item => {
    const totalNow = item.batches.reduce((s, b) => s + b.qty, 0);
    const prevItem = latest?.items?.find(i => i.supplyId === item.supplyId);
    const prevBatches = prevItem?.batches || (prevItem ? [{ qty: prevItem.counted ?? 0 }] : []);
    const totalPrev = prevBatches.reduce((s, b) => s + (b.qty ?? 0), 0);
    if (prevItem && totalNow !== totalPrev) {
      diffs.push({ name: item.name, unit: item.unit, prev: totalPrev, now: totalNow, diff: totalNow - totalPrev });
    }
  });

  const summaryEl = document.getElementById('di-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `<div style="margin-bottom:10px;font-size:13px">
      🏥 <strong>${pharmacyName || pharmacyId}</strong>&ensp;
      📅 <strong>${date}</strong>&ensp;👤 <strong>${recorder}</strong>&ensp;
      ${chargeId ? `🚗 <strong>${chargeName}</strong>&ensp;` : ''}
      <span style="color:var(--text-muted)">共 ${items.length} 種藥材，${items.reduce((s,i)=>s+i.batches.length,0)} 批次</span>
    </div>` +
    (diffs.length
      ? `<div style="background:var(--yellow-bg);border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:4px">
          ⚠️ <strong>${diffs.length}</strong> 項與上次紀錄不同：<br>
          ${diffs.map(d=>`<span style="color:${d.diff<0?'var(--red)':'var(--yellow)'}">• ${d.name}（${d.prev}→${d.now}，${d.diff>0?'+':''}${d.diff} ${d.unit}）</span>`).join('<br>')}
        </div>`
      : (latest ? `<div style="background:var(--green-bg);border:1px solid #86efac;border-radius:8px;padding:10px 14px;font-size:12px">✅ 與上次紀錄一致，無差異</div>` : ''));
  }

  // Clear canvas
  const canvas = document.getElementById('sig-canvas');
  if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); }

  // Stash payload (include pharmacyId + chargeId)
  const overlay = document.getElementById('diSignModalOverlay');
  overlay.dataset.payload = JSON.stringify({
    date, recorder, pharmacyId, pharmacyName, chargeId, chargeName, items
  });
  overlay.classList.add('open');
});

document.getElementById('diSignModalClose')?.addEventListener('click',  () => document.getElementById('diSignModalOverlay').classList.remove('open'));
document.getElementById('diSignCancelBtn')?.addEventListener('click',   () => document.getElementById('diSignModalOverlay').classList.remove('open'));

document.getElementById('diSignConfirmBtn')?.addEventListener('click', async () => {
  const overlay   = document.getElementById('diSignModalOverlay');
  const sigData   = window.getSigDataURL?.();
  if (!sigData)   { alert('請先在框內簽名'); return; }

  const { date, recorder, pharmacyId, pharmacyName, chargeId, chargeName, items } = JSON.parse(overlay.dataset.payload || '{}');
  if (!date || !items) return;

  try {
    await addDoc(COL_MED_INV_LOGS, {
      date, recorder,
      recorderName:  recorder,
      recorderId:    currentUser?.uid || '',
      pharmacyId:    pharmacyId  || '',
      pharmacyName:  pharmacyName || '',
      chargeId:      chargeId    || '',
      chargeName:    chargeName  || '',
      signature:     sigData,   // base64 PNG
      items,
      createdAt: serverTimestamp(),
    });
    overlay.classList.remove('open');
    // Reset form
    document.getElementById('di-date').value = '';
    document.getElementById('di-recorder').value = '';
    document.getElementById('di-charge-unit').value = '';
    renderDailyInventory();
    alert(`✅ 清點完成！${pharmacyName ? pharmacyName + '・' : ''}${date}・清點人：${recorder}`);
  } catch(e) { console.error(e); alert('儲存失敗：' + e.message); }
});

// ── Canvas 手寫簽名 ─────────────────────────────────────
(function initSigCanvas() {
  let drawing = false;
  let hasDrawn = false;

  function getCanvas() { return document.getElementById('sig-canvas'); }
  function getCtx()    { const c = getCanvas(); return c ? c.getContext('2d') : null; }

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  }

  function startDraw(e) {
    e.preventDefault();
    const canvas = getCanvas(); if (!canvas) return;
    const ctx = getCtx();
    drawing = true;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = '#1e293b';
  }
  function draw(e) {
    e.preventDefault();
    if (!drawing) return;
    const canvas = getCanvas(); if (!canvas) return;
    const ctx = getCtx();
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasDrawn = true;
  }
  function endDraw(e) { e.preventDefault(); drawing = false; }

  document.addEventListener('mousedown',  e => { if (e.target.id === 'sig-canvas') startDraw(e); });
  document.addEventListener('mousemove',  e => { if (drawing) draw(e); });
  document.addEventListener('mouseup',    e => { if (drawing) endDraw(e); });
  document.addEventListener('touchstart', e => { if (e.target.id === 'sig-canvas') startDraw(e); }, { passive: false });
  document.addEventListener('touchmove',  e => { if (drawing) draw(e); },  { passive: false });
  document.addEventListener('touchend',   e => { if (drawing) endDraw(e); }, { passive: false });

  document.getElementById('sig-clear-btn')?.addEventListener('click', () => {
    const canvas = getCanvas(); if (!canvas) return;
    getCtx().clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
  });

  // Export method
  window.getSigDataURL = function() {
    const canvas = getCanvas();
    if (!canvas || !hasDrawn) return null;
    return canvas.toDataURL('image/png');
  };
})();

// ── 角色權限管理分頁切換 ──────────────────────────────
window.switchRoleMgmtTab = function(target) {
  ['perm','assign'].forEach(t => {
    const btn  = document.getElementById('role-tab-' + t);
    const pane = document.getElementById('role-pane-' + t);
    if (btn)  btn.classList.toggle('active', t === target);
    if (pane) pane.style.display = t === target ? 'block' : 'none';
  });
  if (target === 'assign') renderUserRoleAssignment();
};

// iOS Safari: attach touchend listeners directly to bypass scroll-container tap delay
(function() {
  ['perm', 'assign'].forEach(tab => {
    const btn = document.getElementById('role-tab-' + tab);
    if (!btn) return;
    let _pendingTouch = false;
    btn.addEventListener('touchend', function(e) {
      _pendingTouch = true;
      e.preventDefault();
      window.switchRoleMgmtTab(tab);
      setTimeout(function() { _pendingTouch = false; }, 600);
    }, { passive: false });
    btn.addEventListener('click', function() {
      if (!_pendingTouch) window.switchRoleMgmtTab(tab);
    });
  });
})();

// ══════════════════════════════════════════════════════
// ── 年度體測 ──────────────────────────────────────────
// ══════════════════════════════════════════════════════

// ── 個人資料頁：體測卡片 ──────────────────────────────
function renderFitnessProfile() {
  if (!currentUser) return;
  const view = document.getElementById('ft-prof-view');
  if (!view) return;

  const test = fitnessTests.find(t => t.personnelId === currentUser.uid);

  if (!test) {
    view.innerHTML = '<div class="prof-empty-hint">尚未設定體測計畫，點擊「設定 / 編輯」開始建立。</div>';
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const tDate = new Date(test.testDate + 'T00:00:00');
  const daysLeft = Math.round((tDate - today) / 86400000);

  const statusBadge = daysLeft > 0
    ? `<span class="ft-badge ft-badge-upcoming">⏳ 還剩 ${daysLeft} 天</span>`
    : daysLeft === 0
      ? `<span class="ft-badge ft-badge-today">📅 今天體測！</span>`
      : `<span class="ft-badge ft-badge-done">已體測</span>`;

  const itemsHtml = FITNESS_CATS.map(cat => {
    const item   = test.selectedItems?.[cat.id] || '—';
    const result = test.results?.[cat.id];
    const resBadge = result === 'pass'
      ? `<span class="ft-result pass">✅ 合格</span>`
      : result === 'fail'
        ? `<span class="ft-result fail">❌ 不合格</span>`
        : daysLeft <= 0 && item !== '—' ? `<span class="ft-result pending">待回報</span>` : '';
    return `<div class="ft-item-row">
      <div class="ft-item-meta"><span class="ft-cat">${cat.label}</span><span class="ft-item">${item}</span></div>
      ${resBadge}
    </div>`;
  }).join('');

  const resultSection = daysLeft <= 0 ? `
    <div class="ft-result-section">
      <div class="ft-result-title">回報體測結果</div>
      ${FITNESS_CATS.map(cat => {
        const item = test.selectedItems?.[cat.id];
        if (!item) return '';
        const res = test.results?.[cat.id];
        return `<div class="ft-result-row">
          <span class="ft-result-label">${cat.label}　${item}</span>
          <div class="ft-result-btns">
            <button class="ft-btn-result ${res==='pass'?'active-pass':''}" onclick="setFitnessResult('${test.id}','${cat.id}','pass')">✅ 合格</button>
            <button class="ft-btn-result ${res==='fail'?'active-fail':''}" onclick="setFitnessResult('${test.id}','${cat.id}','fail')">❌ 不合格</button>
          </div>
        </div>`;
      }).join('')}
    </div>` : '';

  const historyHtml = buildHistoryHtml(test);
  const passEntry   = getThisYearPass(test);

  // 今年已合格 → 顯示合格橫幅，不再顯示待體測資訊
  if (passEntry) {
    view.innerHTML = `
      <div class="ft-passed-banner">
        ✅ ${passEntry.testDate.slice(0,4)} 年度體測已合格
        <span style="font-size:12px;opacity:.8">（${passEntry.testDate}）</span>
      </div>
      ${historyHtml}`;
    return;
  }

  const currentSection = test.testDate ? `
    <div class="ft-header-row">
      <span class="ft-date-label">📅 ${test.testDate}</span>
      ${statusBadge}
    </div>
    ${itemsHtml}
    ${resultSection}` : `<div class="prof-empty-hint">尚未設定下次體測日期，點擊「設定 / 編輯」安排。</div>`;

  view.innerHTML = currentSection + historyHtml;
}

// 開啟編輯表單
document.getElementById('ft-prof-edit-btn')?.addEventListener('click', () => {
  const test = fitnessTests.find(t => t.personnelId === currentUser?.uid);
  const form = document.getElementById('ft-prof-form');
  const view = document.getElementById('ft-prof-view');
  if (!form || !view) return;

  // 填入日期
  const dateEl = document.getElementById('ft-date');
  if (dateEl) dateEl.value = test?.testDate || '';

  // 渲染項目選單
  const itemsForm = document.getElementById('ft-items-form');
  if (itemsForm) {
    itemsForm.innerHTML = FITNESS_CATS.map(cat => `
      <div class="form-group" style="margin-bottom:12px">
        <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block">${cat.label}</label>
        <select id="ft-sel-${cat.id}" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:14px">
          <option value="">— 請選擇 —</option>
          ${cat.items.map(it => `<option value="${it}" ${test?.selectedItems?.[cat.id]===it?'selected':''}>${it}</option>`).join('')}
        </select>
      </div>`).join('');
  }

  view.style.display = 'none';
  form.style.display = '';
});

document.getElementById('ft-prof-cancel-btn')?.addEventListener('click', () => {
  document.getElementById('ft-prof-form').style.display = 'none';
  document.getElementById('ft-prof-view').style.display = '';
});

document.getElementById('ft-prof-save-btn')?.addEventListener('click', async () => {
  if (!currentUser) return;
  const dateVal = document.getElementById('ft-date')?.value;
  if (!dateVal) { alert('請選擇體測日期'); return; }

  const selectedItems = {};
  FITNESS_CATS.forEach(cat => {
    selectedItems[cat.id] = document.getElementById('ft-sel-'+cat.id)?.value || '';
  });
  if (!Object.values(selectedItems).some(v => v)) { alert('請至少選擇一個體測項目'); return; }

  const btn = document.getElementById('ft-prof-save-btn');
  btn.disabled = true;
  try {
    const existing = fitnessTests.find(t => t.personnelId === currentUser.uid);
    const data = {
      personnelId:   currentUser.uid,
      name:          profileData?.name || '',
      unit:          profileData?.unit || '',
      testDate:      dateVal,
      selectedItems,
      updatedAt:     serverTimestamp(),
    };
    if (existing) {
      await updateDoc(doc(db, 'fitnessTests', existing.id), data);
    } else {
      await addDoc(COL_FITNESS, { ...data, results: {}, submittedAt: serverTimestamp() });
    }
    document.getElementById('ft-prof-form').style.display = 'none';
    document.getElementById('ft-prof-view').style.display = '';
  } catch(e) { console.error(e); alert('儲存失敗：' + e.message); }
  finally { btn.disabled = false; }
});

window.setFitnessResult = async function(testId, catId, result) {
  try {
    await updateDoc(doc(db, 'fitnessTests', testId), {
      [`results.${catId}`]: result,
      updatedAt: serverTimestamp(),
    });
  } catch(e) { alert('回報失敗：' + e.message); }
};

// ── 管理員頁：年度體測管理 ────────────────────────────
let ftAdminTab = 'all';

// 判斷是否今年已合格（history 有今年的 pass 紀錄）
function getThisYearPass(test) {
  if (!test) return null;
  const yr = String(new Date().getFullYear());
  return (test.history || []).find(h => h.status === 'pass' && (h.testDate || '').startsWith(yr));
}

function buildHistoryHtml(test) {
  const history = (test?.history || []).slice().reverse();
  if (!history.length) return '';
  return `<div class="ft-history-section">
    <div class="ft-history-title">歷次體測記錄</div>
    ${history.map(h => {
      const badges = FITNESS_CATS.map(cat => {
        const item = h.selectedItems?.[cat.id]; if (!item) return '';
        const res  = h.results?.[cat.id];
        return `<span class="ft-history-badge ${res==='pass'?'pass':res==='fail'?'fail':''}">${res==='pass'?'✅':res==='fail'?'❌':'⬜'} ${item}</span>`;
      }).filter(Boolean).join('');
      return `<div class="ft-history-row">
        <div class="ft-history-head">
          <span class="ft-history-date">📅 ${h.testDate}</span>
          <span class="ft-badge ${h.status==='pass'?'ft-badge-done':'ft-badge-fail'}">${h.status==='pass'?'✅ 合格':'❌ 不合格'}</span>
        </div>
        <div class="ft-history-items">${badges}</div>
      </div>`;
    }).join('')}
  </div>`;
}

document.getElementById('page-fitness-test')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-ft-tab]');
  if (!btn) return;
  ftAdminTab = btn.dataset.ftTab;
  document.querySelectorAll('[data-ft-tab]').forEach(b => b.classList.toggle('active', b.dataset.ftTab === ftAdminTab));
  renderFitnessAdminPage();
});

document.getElementById('ftUnitFilter')?.addEventListener('change', renderFitnessAdminPage);

function populateFtUnitFilter() {
  const sel = document.getElementById('ftUnitFilter');
  if (!sel) return;
  const units = [...new Set(filterByUnitScope(personnel).map(p => p.unit).filter(Boolean))].sort();
  const cur = sel.value;
  sel.innerHTML = `<option value="">全部單位</option>` + units.map(u => `<option value="${u}">${u}</option>`).join('');
  sel.value = cur;
}

function renderFitnessStats() {
  const panel = document.getElementById('ft-stats-panel');
  if (!panel) return;

  const allPersonnel = filterByUnitScope(personnel);
  const unitOrder = [...new Set(
    (adminSettings.medUnits || []).concat(allPersonnel.map(p => p.unit).filter(Boolean))
  )];

  const statsPerUnit = unitOrder
    .map(unit => {
      const members = allPersonnel.filter(p => p.unit === unit);
      if (!members.length) return null;
      const total    = members.length;
      const reported = members.filter(p => {
        const t = fitnessTests.find(x => x.personnelId === p.id || x.personnelId === p.uid);
        return !!t;
      }).length;
      const passed = members.filter(p => {
        const t = fitnessTests.find(x => x.personnelId === p.id || x.personnelId === p.uid);
        return !!getThisYearPass(t);
      }).length;
      return { unit, total, reported, passed };
    })
    .filter(Boolean);

  // Overall battalion stats
  const totalAll    = allPersonnel.length;
  const reportedAll = allPersonnel.filter(p => {
    const t = fitnessTests.find(x => x.personnelId === p.id || x.personnelId === p.uid);
    return !!t;
  }).length;
  const passedAll   = allPersonnel.filter(p => {
    const t = fitnessTests.find(x => x.personnelId === p.id || x.personnelId === p.uid);
    return !!getThisYearPass(t);
  }).length;

  const pct = (n, d) => d ? Math.round(n / d * 100) : 0;

  const unitCards = statsPerUnit.map(s => {
    const rPct = pct(s.reported, s.total);
    const qPct = pct(s.passed, s.total);
    const shortName = s.unit.replace(/^衛生營/, '').trim() || s.unit;
    return `<div class="ft-stat-card">
      <div class="ft-stat-unit">${shortName}</div>
      <div class="ft-stat-row">
        <span class="ft-stat-label">報進率</span>
        <span class="ft-stat-value">${s.reported}/${s.total}</span>
        <span class="ft-stat-pct">${rPct}%</span>
      </div>
      <div class="ft-stat-bar"><div class="ft-stat-bar-fill" style="width:${rPct}%;background:var(--accent)"></div></div>
      <div class="ft-stat-row" style="margin-top:6px">
        <span class="ft-stat-label">合格率</span>
        <span class="ft-stat-value">${s.passed}/${s.total}</span>
        <span class="ft-stat-pct ${qPct >= 80 ? 'ft-stat-green' : qPct >= 60 ? 'ft-stat-yellow' : 'ft-stat-red'}">${qPct}%</span>
      </div>
      <div class="ft-stat-bar"><div class="ft-stat-bar-fill" style="width:${qPct}%;background:${qPct >= 80 ? '#16a34a' : qPct >= 60 ? '#ca8a04' : '#dc2626'}"></div></div>
    </div>`;
  }).join('');

  const rAll = pct(reportedAll, totalAll);
  const qAll = pct(passedAll, totalAll);

  panel.innerHTML = `
    <div class="ft-stats-grid">${unitCards}
      <div class="ft-stat-card ft-stat-card-all">
        <div class="ft-stat-unit">全營</div>
        <div class="ft-stat-row">
          <span class="ft-stat-label">報進率</span>
          <span class="ft-stat-value">${reportedAll}/${totalAll}</span>
          <span class="ft-stat-pct">${rAll}%</span>
        </div>
        <div class="ft-stat-bar"><div class="ft-stat-bar-fill" style="width:${rAll}%;background:var(--accent)"></div></div>
        <div class="ft-stat-row" style="margin-top:6px">
          <span class="ft-stat-label">合格率</span>
          <span class="ft-stat-value">${passedAll}/${totalAll}</span>
          <span class="ft-stat-pct ${qAll >= 80 ? 'ft-stat-green' : qAll >= 60 ? 'ft-stat-yellow' : 'ft-stat-red'}">${qAll}%</span>
        </div>
        <div class="ft-stat-bar"><div class="ft-stat-bar-fill" style="width:${qAll}%;background:${qAll >= 80 ? '#16a34a' : qAll >= 60 ? '#ca8a04' : '#dc2626'}"></div></div>
      </div>
    </div>`;
}

function renderFitnessAdminPage() {
  try { renderFitnessStats(); } catch(e) { console.error('renderFitnessStats error', e); }
  const container = document.getElementById('ft-admin-list');
  if (!container) return;

  const today     = new Date(); today.setHours(0,0,0,0);
  const unitFilter = document.getElementById('ftUnitFilter')?.value || '';

  // 把 personnel 和 fitnessTests 合併
  let allPersonnel = filterByUnitScope(personnel);
  if (unitFilter) allPersonnel = allPersonnel.filter(p => p.unit === unitFilter);

  // 依階級權重排序（高到低），同階再依姓名
  allPersonnel = [...allPersonnel].sort((a, b) =>
    rankWeight(a.rank) - rankWeight(b.rank) || (a.name||'').localeCompare(b.name||'', 'zh-TW')
  );

  const rows = allPersonnel.map(p => {
    const test = fitnessTests.find(t => t.personnelId === p.id || t.personnelId === p.uid);
    return { p, test };
  });

  const filtered = rows.filter(({ p, test }) => {
    if (ftAdminTab === 'all')      return true;
    if (ftAdminTab === 'unset')    return !test || (!test.testDate && !getThisYearPass(test));
    if (!test) return false;
    if (ftAdminTab === 'reported') return !!getThisYearPass(test);
    if (ftAdminTab === 'upcoming') {
      if (getThisYearPass(test)) return false;
      if (!test.testDate) return false;
      const d = new Date(test.testDate + 'T00:00:00');
      return Math.round((d - today) / 86400000) >= 0;
    }
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state"><p>沒有符合條件的記錄</p></div>';
    return;
  }

  container.innerHTML = filtered.map(({ p, test }) => {
    const editBtn = `<button class="btn btn-sm btn-secondary" onclick="openFtEdit('${p.id}')">✏️ 編輯</button>`;

    if (!test) return `
      <div class="ft-admin-row">
        <div class="ft-admin-info">
          <span class="ft-admin-name">${p.rank||''} ${p.name}</span>
          <span class="unit-tag">${p.unit||'—'}</span>
        </div>
        <div class="ft-admin-right">
          <span class="ft-badge" style="background:#f1f5f9;color:#94a3b8">未設定</span>
          ${editBtn}
        </div>
      </div>`;

    // 今年已合格 → 優先顯示
    const passEntry = getThisYearPass(test);
    if (passEntry) return `
      <div class="ft-admin-row">
        <div class="ft-admin-info">
          <span class="ft-admin-name">${p.rank||''} ${p.name}</span>
          <span class="unit-tag">${p.unit||'—'}</span>
          <span class="ft-admin-date">合格日：${passEntry.testDate}</span>
        </div>
        <div class="ft-admin-right">
          <span class="ft-badge ft-badge-done">✅ 今年已合格</span>
          ${editBtn}
        </div>
      </div>`;

    const tDate = test.testDate ? new Date(test.testDate + 'T00:00:00') : null;
    const daysLeft = tDate ? Math.round((tDate - today) / 86400000) : null;
    const statusBadge = !tDate
      ? `<span class="ft-badge" style="background:#f1f5f9;color:#94a3b8">待安排補測</span>`
      : daysLeft > 0
        ? `<span class="ft-badge ft-badge-upcoming">還剩 ${daysLeft} 天</span>`
        : daysLeft === 0
          ? `<span class="ft-badge ft-badge-today">今天</span>`
          : `<span class="ft-badge ft-badge-done">已體測</span>`;

    const itemsHtml = FITNESS_CATS.map(cat => {
      const item = test.selectedItems?.[cat.id];
      if (!item) return '';
      const res = test.results?.[cat.id];
      const resBadge = res === 'pass' ? '✅' : res === 'fail' ? '❌' : (daysLeft !== null && daysLeft <= 0) ? '⬜' : '';
      return `<span class="ft-admin-item">${resBadge} ${item}</span>`;
    }).filter(Boolean).join('');

    return `<div class="ft-admin-row">
      <div class="ft-admin-info">
        <span class="ft-admin-name">${p.rank||''} ${p.name}</span>
        <span class="unit-tag">${p.unit||'—'}</span>
        ${test.testDate ? `<span class="ft-admin-date">📅 ${test.testDate}</span>` : ''}
        ${itemsHtml ? `<div class="ft-admin-items">${itemsHtml}</div>` : ''}
      </div>
      <div class="ft-admin-right">
        ${statusBadge}
        ${editBtn}
      </div>
    </div>`;
  }).join('');
}

// ── 承辦人編輯體測 Modal ──────────────────────────────
let ftEditPersonnelId = null;

window.openFtEdit = function(personnelId) {
  ftEditPersonnelId = personnelId;
  const p    = personnel.find(x => x.id === personnelId);
  const test = fitnessTests.find(t => t.personnelId === personnelId);

  document.getElementById('ft-edit-title').textContent =
    `編輯體測計畫 — ${p?.rank||''} ${p?.name||''}`;
  document.getElementById('ft-admin-date').value = test?.testDate || '';

  // 項目選單
  document.getElementById('ft-admin-items-form').innerHTML = FITNESS_CATS.map(cat => `
    <div class="form-group" style="margin-bottom:10px">
      <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block">${cat.label}</label>
      <select id="fta-sel-${cat.id}" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:14px">
        <option value="">— 請選擇 —</option>
        ${cat.items.map(it => `<option value="${it}" ${test?.selectedItems?.[cat.id]===it?'selected':''}>${it}</option>`).join('')}
      </select>
    </div>`).join('');

  // 結果回報
  document.getElementById('ft-admin-results-form').innerHTML = FITNESS_CATS.map(cat => {
    const item = test?.selectedItems?.[cat.id];
    const res  = test?.results?.[cat.id];
    return `<div style="display:flex;flex-direction:column;gap:6px;padding:10px 0;border-bottom:1px solid var(--border)" data-cat-id="${cat.id}" data-result="${res || ''}">
      <span style="font-size:13px;font-weight:500">${cat.label}${item ? '　' + item : ''}</span>
      <div style="display:flex;gap:6px">
        <button class="ft-btn-result ${res==='pass'?'active-pass':''}" onclick="ftAdminSetResult('${cat.id}','pass',this)">✅ 合格</button>
        <button class="ft-btn-result ${res==='fail'?'active-fail':''}" onclick="ftAdminSetResult('${cat.id}','fail',this)">❌ 不合格</button>
        <button class="ft-btn-result" onclick="ftAdminSetResult('${cat.id}','',this)">清除</button>
      </div>
    </div>`;
  }).join('');

  // 歷史紀錄顯示在 modal 底部
  const histSec = document.getElementById('ft-edit-history');
  if (histSec) histSec.innerHTML = buildHistoryHtml(test);

  document.getElementById('ftEditOverlay').classList.add('open');
};

window.ftAdminSetResult = function(catId, val, btn) {
  const row = btn.closest('div[style*="border-bottom"]');
  row.querySelectorAll('.ft-btn-result').forEach(b => {
    b.classList.remove('active-pass','active-fail');
  });
  if (val === 'pass') btn.classList.add('active-pass');
  if (val === 'fail') btn.classList.add('active-fail');
  btn.dataset.chosen = val;
  // store on the row for later reading
  row.dataset.catId = catId;
  row.dataset.result = val;
};

document.getElementById('ftEditClose')?.addEventListener('click',  () => document.getElementById('ftEditOverlay').classList.remove('open'));
document.getElementById('ftEditCancel')?.addEventListener('click', () => document.getElementById('ftEditOverlay').classList.remove('open'));

document.getElementById('ftEditSave')?.addEventListener('click', async () => {
  if (!ftEditPersonnelId) return;
  const dateVal = document.getElementById('ft-admin-date')?.value;
  if (!dateVal) { alert('請選擇體測日期'); return; }

  const selectedItems = {};
  FITNESS_CATS.forEach(cat => {
    selectedItems[cat.id] = document.getElementById('fta-sel-'+cat.id)?.value || '';
  });

  const results = {};
  document.querySelectorAll('#ft-admin-results-form [data-cat-id]').forEach(row => {
    if (row.dataset.catId) results[row.dataset.catId] = row.dataset.result || '';
  });
  // 也讀取沒被點過的（原始值）
  const existing = fitnessTests.find(t => t.personnelId === ftEditPersonnelId);
  FITNESS_CATS.forEach(cat => {
    if (!(cat.id in results)) results[cat.id] = existing?.results?.[cat.id] || '';
  });

  const p = personnel.find(x => x.id === ftEditPersonnelId);
  const btn = document.getElementById('ftEditSave');
  btn.disabled = true;
  try {
    const data = {
      personnelId: ftEditPersonnelId,
      name:        p?.name || '',
      unit:        p?.unit || '',
      testDate:    dateVal,
      selectedItems,
      results,
      updatedAt:   serverTimestamp(),
    };
    if (existing) {
      await updateDoc(doc(db, 'fitnessTests', existing.id), data);
    } else {
      await addDoc(COL_FITNESS, { ...data, submittedAt: serverTimestamp() });
    }
    document.getElementById('ftEditOverlay').classList.remove('open');
  } catch(e) { console.error(e); alert('儲存失敗：' + e.message); }
  finally { btn.disabled = false; }
});

// ── 歸檔此次體測 ──────────────────────────────────────
document.getElementById('ftEditArchive')?.addEventListener('click', async () => {
  if (!ftEditPersonnelId) return;

  const dateVal = document.getElementById('ft-admin-date')?.value;
  if (!dateVal) { alert('請先設定體測日期才能歸檔'); return; }

  const selectedItems = {};
  FITNESS_CATS.forEach(cat => {
    selectedItems[cat.id] = document.getElementById('fta-sel-'+cat.id)?.value || '';
  });

  const results = {};
  document.querySelectorAll('#ft-admin-results-form [data-cat-id]').forEach(row => {
    if (row.dataset.catId) results[row.dataset.catId] = row.dataset.result || '';
  });
  const existing = fitnessTests.find(t => t.personnelId === ftEditPersonnelId);
  FITNESS_CATS.forEach(cat => {
    if (!(cat.id in results)) results[cat.id] = existing?.results?.[cat.id] || '';
  });

  const hasResult = Object.values(results).some(v => v === 'pass' || v === 'fail');
  if (!hasResult) { alert('請先記錄至少一項體測結果再歸檔'); return; }

  const allPassed = FITNESS_CATS.every(cat => {
    const item = selectedItems[cat.id];
    return !item || results[cat.id] === 'pass';
  });
  const overallStatus = allPassed ? 'pass' : 'fail';
  const label = overallStatus === 'pass' ? '✅ 合格' : '❌ 不合格';

  if (!confirm(`將 ${dateVal} 的體測結果（${label}）歸檔記錄？\n歸檔後當前體測日期將清空，可重新安排下次體測。`)) return;

  const currentHistory = existing?.history || [];
  const entry = { testDate: dateVal, selectedItems, results, status: overallStatus, archivedAt: new Date().toISOString() };

  const btn = document.getElementById('ftEditArchive');
  btn.disabled = true;
  try {
    const p = personnel.find(x => x.id === ftEditPersonnelId);
    const data = {
      personnelId: ftEditPersonnelId,
      name: p?.name || '',
      unit: p?.unit || '',
      testDate: '',
      selectedItems: {},
      results: {},
      history: [...currentHistory, entry],
      updatedAt: serverTimestamp(),
    };
    if (existing) {
      await updateDoc(doc(db, 'fitnessTests', existing.id), data);
    } else {
      await addDoc(COL_FITNESS, { ...data, submittedAt: serverTimestamp() });
    }
    document.getElementById('ftEditOverlay').classList.remove('open');
  } catch(e) { console.error(e); alert('歸檔失敗：' + e.message); }
  finally { btn.disabled = false; }
});

// ── 體測駐點待命用車 ───────────────────────────────────

let ftsYear  = new Date().getFullYear();
let ftsMonth = new Date().getMonth(); // 0-based
let ftsSelectedDate = null;
let ftsEditingId = null;

function renderFtStandbyCalendar() {
  const cal = document.getElementById('fts-calendar');
  if (!cal) return;

  const label = document.getElementById('fts-month-label');
  if (label) label.textContent = `${ftsYear} 年 ${ftsMonth + 1} 月`;

  const todayStr = new Date().toISOString().slice(0, 10);
  const daysInMonth = new Date(ftsYear, ftsMonth + 1, 0).getDate();
  const firstDow = new Date(ftsYear, ftsMonth, 1).getDay(); // 0=Sun

  const DOW_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
  let html = DOW_LABELS.map(d => `<div class="fts-cal-dow">${d}</div>`).join('');

  // Empty cells before 1st
  for (let i = 0; i < firstDow; i++) html += `<div class="fts-cal-cell empty"><span class="fts-cal-day">0</span></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${ftsYear}-${String(ftsMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const rec = ftStandbyRecords.find(r => r.date === dateStr);
    const dow = (firstDow + d - 1) % 7;
    const classes = ['fts-cal-cell',
      dow === 0 ? 'sunday' : dow === 6 ? 'saturday' : '',
      dateStr === todayStr ? 'today' : '',
      dateStr === ftsSelectedDate ? 'selected' : '',
    ].filter(Boolean).join(' ');
    const badge = rec ? `<span class="fts-cal-badge">🚑 ${rec.vehicleNumber || '待命'}</span>` : '';
    html += `<div class="${classes}" data-fts-date="${dateStr}">
      <span class="fts-cal-day">${d}</span>
      ${badge}
    </div>`;
  }
  cal.innerHTML = html;

  // Render detail panel for selected date
  renderFtStandbyDetail(ftsSelectedDate);
}

function renderFtStandbyDetail(dateStr) {
  const panel = document.getElementById('fts-detail-panel');
  if (!panel) return;
  if (!dateStr) { panel.innerHTML = ''; return; }

  const rec = ftStandbyRecords.find(r => r.date === dateStr);
  const [y, m, d] = dateStr.split('-');
  const dow = ['日','一','二','三','四','五','六'][new Date(dateStr + 'T00:00:00').getDay()];
  const dateLabel = `${y} 年 ${+m} 月 ${+d} 日（${dow}）`;

  if (!rec) {
    panel.innerHTML = `
      <div class="fts-detail-card">
        <div class="fts-detail-header">
          <span class="fts-detail-date">${dateLabel}</span>
          <button type="button" class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3)" onclick="openFtsEdit('${dateStr}')">＋ 新增派遣</button>
        </div>
        <div style="padding:20px 16px;color:var(--text-muted);font-size:14px;text-align:center">此日期尚無待命用車派遣紀錄</div>
      </div>`;
    return;
  }

  const emtBadge = emt => emt ? `<span class="fts-person-emt">${emt}</span>` : '';
  const officerBlock = rec.officerName ? `
        <div class="fts-person-block">
          <div class="fts-person-role">🔷 醫官</div>
          <div class="fts-person-name">${rec.officerName}</div>
          ${rec.officerPhone ? `<div class="fts-person-phone">📞 ${rec.officerPhone}</div>` : ''}
        </div>` : '';
  panel.innerHTML = `
    <div class="fts-detail-card">
      <div class="fts-detail-header">
        <div>
          <div class="fts-detail-date">${dateLabel}</div>
          <div class="fts-detail-vehicle">🚑 ${rec.vehicleNumber || '—'}</div>
        </div>
        <button type="button" class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3)" onclick="openFtsEdit('${dateStr}')">✏️ 編輯</button>
      </div>
      <div class="fts-detail-body">
        ${officerBlock}
        <div class="fts-person-block">
          <div class="fts-person-role">🎖 車長</div>
          <div class="fts-person-name">${rec.commanderRank || ''} ${rec.commanderName || '—'}</div>
          ${emtBadge(rec.commanderEmt)}
          ${rec.commanderPhone ? `<div class="fts-person-phone">📞 ${rec.commanderPhone}</div>` : ''}
        </div>
        <div class="fts-person-block">
          <div class="fts-person-role">🚗 駕駛</div>
          <div class="fts-person-name">${rec.driverRank || ''} ${rec.driverName || '—'}</div>
          ${emtBadge(rec.driverEmt)}
          ${rec.driverPhone ? `<div class="fts-person-phone">📞 ${rec.driverPhone}</div>` : ''}
        </div>
      </div>
      ${rec.notes ? `<div class="fts-detail-notes">備註：${rec.notes}</div>` : ''}
    </div>`;
}

// Calendar click
document.getElementById('fts-calendar')?.addEventListener('click', e => {
  const cell = e.target.closest('[data-fts-date]');
  if (!cell) return;
  ftsSelectedDate = cell.dataset.ftsDate;
  renderFtStandbyCalendar();
});

document.getElementById('fts-prev-month')?.addEventListener('click', () => {
  ftsMonth--;
  if (ftsMonth < 0) { ftsMonth = 11; ftsYear--; }
  renderFtStandbyCalendar();
});
document.getElementById('fts-next-month')?.addEventListener('click', () => {
  ftsMonth++;
  if (ftsMonth > 11) { ftsMonth = 0; ftsYear++; }
  renderFtStandbyCalendar();
});
document.getElementById('fts-today-btn')?.addEventListener('click', () => {
  const now = new Date();
  ftsYear = now.getFullYear();
  ftsMonth = now.getMonth();
  ftsSelectedDate = now.toISOString().slice(0, 10);
  renderFtStandbyCalendar();
});

// ── helper: 取某人員最高 EMT 證照 ──
function getBestEmt(personnelId) {
  if (!personnelId) return '';
  const emtCerts = certifications.filter(c => c.personnelId === personnelId && c.category === '緊急救護');
  for (const level of ['EMT-P', 'EMT-2', 'EMT-1']) {
    if (emtCerts.find(c => c.certType === level)) return level;
  }
  return '';
}

// ── 填充單位下拉 ──
function populateFtsUnitSel(selId, selectedUnit = '') {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const units = [...new Set(personnel.map(p => p.unit).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">全部單位</option>' +
    units.map(u => `<option value="${u}" ${u === selectedUnit ? 'selected' : ''}>${u}</option>`).join('');
}

// ── 填充人員下拉（依單位過濾） ──
function populateFtsPersonSel(selId, unit = '', selectedId = '') {
  const sel = document.getElementById(selId);
  if (!sel) return;
  let list = unit ? personnel.filter(p => p.unit === unit) : [...personnel];
  list = list.sort((a, b) => rankWeight(a.rank) - rankWeight(b.rank) || (a.name||'').localeCompare(b.name||'', 'zh-TW'));
  sel.innerHTML = '<option value="">請選擇人員</option>' +
    list.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.rank||''} ${p.name}</option>`).join('');
}

// ── 依選取人員自動填電話 & EMT ──
function ftsAutoFill(personSelId, phoneId, emtDisplayId) {
  const pid = document.getElementById(personSelId)?.value || '';
  const p   = personnel.find(x => x.id === pid);
  const phoneEl = document.getElementById(phoneId);
  if (phoneEl) phoneEl.value = p?.phone || '';
  const emtEl = document.getElementById(emtDisplayId);
  if (!emtEl) return;
  const emt = getBestEmt(pid);
  emtEl.textContent = emt || '—';
  emtEl.dataset.emt = emt;
  emtEl.style.color = emt ? 'var(--primary)' : 'var(--text-muted)';
  emtEl.style.fontWeight = emt ? '700' : '';
}

// ── 醫官管理 ────────────────────────────────────────────
function populateFtsOfficerSel(selectedId) {
  const sel = document.getElementById('fts-officer-sel');
  if (!sel) return;
  const prev = selectedId || sel.value;
  sel.innerHTML = '<option value="">— 請選擇醫官 —</option>' +
    ftOfficers.map(o => `<option value="${o.id}"${o.id === prev ? ' selected' : ''}>${o.name || '—'}</option>`).join('');
  // auto-fill phone after populating list
  const phoneEl = document.getElementById('fts-officer-phone-display');
  if (phoneEl) {
    const officer = ftOfficers.find(o => o.id === sel.value);
    phoneEl.value = officer?.phone || '';
  }
}

function ftsOfficerAutoFill() {
  const sel = document.getElementById('fts-officer-sel');
  const phoneEl = document.getElementById('fts-officer-phone-display');
  if (!sel || !phoneEl) return;
  const officer = ftOfficers.find(o => o.id === sel.value);
  phoneEl.value = officer?.phone || '';
  try { updateFtsPreview(); } catch(e) { console.error('ftsPreview error', e); }
}

function renderFtsOfficerList() {
  const el = document.getElementById('ftsOfficerList');
  if (!el) return;
  if (!ftOfficers.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:12px 0">尚無醫官資料</div>';
    return;
  }
  el.innerHTML = ftOfficers.map(o => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px">${o.name || '—'}</div>
        <div style="font-size:12px;color:var(--muted)">${o.phone || '—'}</div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" onclick="ftsOfficerEdit('${o.id}')">✏️</button>
      <button type="button" class="btn btn-sm" style="background:#fee2e2;color:#dc2626" onclick="ftsOfficerDelete('${o.id}')">🗑</button>
    </div>`).join('');
}

window.ftsOfficerEdit = function(id) {
  const o = ftOfficers.find(x => x.id === id);
  if (!o) return;
  document.getElementById('ftsOfficerEditId').value = id;
  document.getElementById('ftsOfficerName').value   = o.name  || '';
  document.getElementById('ftsOfficerPhone').value  = o.phone || '';
  document.getElementById('ftsOfficerFormTitle').textContent = '編輯醫官';
};

window.ftsOfficerDelete = function(id) {
  showConfirm('確定刪除此醫官資料？', async () => {
    try { await deleteDoc(doc(db, 'ftOfficers', id)); showToast('已刪除'); }
    catch(e) { showToast('刪除失敗'); }
  });
};

window.openFtsOfficerBtn = function() {
  try {
    const overlay = document.getElementById('ftsOfficerMgmtOverlay');
    if (!overlay) { showToast('錯誤：找不到醫官管理視窗'); return; }
    document.getElementById('ftsOfficerEditId').value = '';
    document.getElementById('ftsOfficerName').value   = '';
    document.getElementById('ftsOfficerPhone').value  = '';
    document.getElementById('ftsOfficerFormTitle').textContent = '新增醫官';
    renderFtsOfficerList();
    overlay.classList.add('open');
  } catch(e) { console.error('openFtsOfficerBtn error', e); showToast('開啟失敗：' + e.message); }
};

document.getElementById('ftsOfficerMgmtClose')?.addEventListener('click',  () => document.getElementById('ftsOfficerMgmtOverlay').classList.remove('open'));
document.getElementById('ftsOfficerMgmtCancel')?.addEventListener('click', () => document.getElementById('ftsOfficerMgmtOverlay').classList.remove('open'));

document.getElementById('ftsOfficerSaveBtn')?.addEventListener('click', async () => {
  const name  = document.getElementById('ftsOfficerName').value.trim();
  const phone = document.getElementById('ftsOfficerPhone').value.trim();
  if (!name) { showToast('請填寫姓名'); return; }
  const id = document.getElementById('ftsOfficerEditId').value;
  try {
    if (id) {
      await updateDoc(doc(db, 'ftOfficers', id), { name, phone });
    } else {
      await addDoc(COL_FT_OFFICERS, { name, phone });
    }
    document.getElementById('ftsOfficerEditId').value = '';
    document.getElementById('ftsOfficerName').value   = '';
    document.getElementById('ftsOfficerPhone').value  = '';
    document.getElementById('ftsOfficerFormTitle').textContent = '新增醫官';
    showToast('已儲存');
  } catch(e) { showToast('儲存失敗：' + e.message); }
});

window.openFtsEdit = function(dateStr) {
  try {
  ftsEditingId = null;
  const rec = ftStandbyRecords.find(r => r.date === dateStr);
  if (rec) ftsEditingId = rec.id;
  document.getElementById('fts-edit-title').textContent = rec ? '編輯派遣資料' : '新增派遣資料';
  document.getElementById('fts-date').value    = dateStr;
  document.getElementById('fts-vehicle').value = rec?.vehicleNumber || '';
  document.getElementById('fts-notes').value   = rec?.notes         || '';
  populateFtsOfficerSel(rec?.officerPersonnelId || '');

  // Commander — find the personnel record to get unit for preselect
  const cmdPerson = rec?.commanderPersonnelId ? personnel.find(p => p.id === rec.commanderPersonnelId) : null;
  const cmdUnit   = cmdPerson?.unit || '';
  populateFtsUnitSel('fts-cmd-unit', cmdUnit);
  populateFtsPersonSel('fts-cmd-person', cmdUnit, rec?.commanderPersonnelId || '');
  ftsAutoFill('fts-cmd-person', 'fts-cmd-phone', 'fts-cmd-emt-display');

  // Driver
  const drvPerson = rec?.driverPersonnelId ? personnel.find(p => p.id === rec.driverPersonnelId) : null;
  const drvUnit   = drvPerson?.unit || '';
  populateFtsUnitSel('fts-drv-unit', drvUnit);
  populateFtsPersonSel('fts-drv-person', drvUnit, rec?.driverPersonnelId || '');
  ftsAutoFill('fts-drv-person', 'fts-drv-phone', 'fts-drv-emt-display');

  document.getElementById('ftsEditDelete').style.display = rec ? '' : 'none';
  document.getElementById('ftsEditOverlay').classList.add('open');
  try { updateFtsPreview(); } catch(e) { console.error('ftsPreview error', e); }
  } catch(e) { console.error('openFtsEdit error', e); showToast('開啟失敗：' + e.message); }
};

// Unit change → re-populate person list & reset auto-fill
document.getElementById('fts-cmd-unit')?.addEventListener('change', () => {
  populateFtsPersonSel('fts-cmd-person', document.getElementById('fts-cmd-unit').value, '');
  ftsAutoFill('fts-cmd-person', 'fts-cmd-phone', 'fts-cmd-emt-display');
  updateFtsPreview();
});
document.getElementById('fts-drv-unit')?.addEventListener('change', () => {
  populateFtsPersonSel('fts-drv-person', document.getElementById('fts-drv-unit').value, '');
  ftsAutoFill('fts-drv-person', 'fts-drv-phone', 'fts-drv-emt-display');
  updateFtsPreview();
});
// Person change → auto-fill
document.getElementById('fts-cmd-person')?.addEventListener('change', () => { ftsAutoFill('fts-cmd-person', 'fts-cmd-phone', 'fts-cmd-emt-display'); updateFtsPreview(); });
document.getElementById('fts-drv-person')?.addEventListener('change', () => { ftsAutoFill('fts-drv-person', 'fts-drv-phone', 'fts-drv-emt-display'); updateFtsPreview(); });
['fts-date','fts-vehicle','fts-notes'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updateFtsPreview);
});
document.getElementById('fts-officer-sel')?.addEventListener('change', ftsOfficerAutoFill);

function buildFtsMessageText() {
  const gv  = id => document.getElementById(id)?.value?.trim() || '';
  const dateStr = gv('fts-date');
  let dateLabel = dateStr;
  if (dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const rocYear = d.getFullYear() - 1911;
    dateLabel = `${rocYear}年${d.getMonth()+1}月${d.getDate()}日`;
  }
  const officerSel   = document.getElementById('fts-officer-sel');
  const officerObj   = ftOfficers.find(o => o.id === officerSel?.value);
  const officerName  = officerObj?.name  || '';
  const officerPhone = officerObj?.phone || '';
  const vehicle      = gv('fts-vehicle');
  const cmdPhone     = gv('fts-cmd-phone');
  const drvPhone     = gv('fts-drv-phone');
  const cmdSel  = document.getElementById('fts-cmd-person');
  const drvSel  = document.getElementById('fts-drv-person');
  const cmdText = cmdSel?.options[cmdSel.selectedIndex]?.text || '';
  const drvText = drvSel?.options[drvSel.selectedIndex]?.text || '';

  const lines = [];
  lines.push(`🟥${dateLabel}駐點資訊`);
  lines.push('🔷醫官');
  if (officerName)  lines.push(`🔺姓名：${officerName}`);
  if (officerPhone) lines.push(`🔺聯絡電話：${officerPhone}`);
  lines.push('🔷救護車');
  if (vehicle)   lines.push(`🔺車號：${vehicle}`);
  if (cmdText && cmdText !== '— 請選擇 —') {
    lines.push(`🔺車長：${cmdText}`);
    if (cmdPhone) lines.push(`🔺車長電話：${cmdPhone}`);
  }
  if (drvText && drvText !== '— 請選擇 —') {
    lines.push(`🔺駕駛：${drvText}`);
    if (drvPhone) lines.push(`🔺駕駛電話：${drvPhone}`);
  }
  return lines.join('\n');
}

function updateFtsPreview() {
  try {
    const el = document.getElementById('fts-msg-preview');
    if (el) el.textContent = buildFtsMessageText();
  } catch(e) { console.error('updateFtsPreview error', e); }
}

window.ftsCopyMessage = function() {
  const text = buildFtsMessageText();
  navigator.clipboard.writeText(text).then(() => showToast('已複製到剪貼簿')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); showToast('已複製到剪貼簿');
  });
};

document.getElementById('ftsEditClose')?.addEventListener('click',  () => document.getElementById('ftsEditOverlay').classList.remove('open'));
document.getElementById('ftsEditCancel')?.addEventListener('click', () => document.getElementById('ftsEditOverlay').classList.remove('open'));

document.getElementById('ftsEditSave')?.addEventListener('click', async () => {
  const btn = document.getElementById('ftsEditSave');
  const gv  = id => document.getElementById(id)?.value?.trim() || '';
  const date = gv('fts-date');
  if (!date) { showToast('請選擇日期'); return; }

  const cmdPid = document.getElementById('fts-cmd-person')?.value || '';
  const drvPid = document.getElementById('fts-drv-person')?.value || '';
  const cmdP   = personnel.find(p => p.id === cmdPid) || {};
  const drvP   = personnel.find(p => p.id === drvPid) || {};
  const data = {
    date,
    vehicleNumber:        gv('fts-vehicle'),
    officerPersonnelId:   document.getElementById('fts-officer-sel')?.value || '',
    officerName:          (() => { const o = ftOfficers.find(x => x.id === document.getElementById('fts-officer-sel')?.value); return o?.name  || ''; })(),
    officerPhone:         (() => { const o = ftOfficers.find(x => x.id === document.getElementById('fts-officer-sel')?.value); return o?.phone || ''; })(),
    commanderPersonnelId: cmdPid,
    commanderRank:        cmdP.rank  || '',
    commanderName:        cmdP.name  || '',
    commanderPhone:       cmdP.phone || '',
    commanderEmt:         document.getElementById('fts-cmd-emt-display')?.dataset.emt || '',
    driverPersonnelId:    drvPid,
    driverRank:           drvP.rank  || '',
    driverName:           drvP.name  || '',
    driverPhone:          drvP.phone || '',
    driverEmt:            document.getElementById('fts-drv-emt-display')?.dataset.emt || '',
    notes:                gv('fts-notes'),
    updatedAt:            serverTimestamp(),
  };
  btn.disabled = true; btn.textContent = '儲存中…';
  try {
    if (ftsEditingId) {
      await updateDoc(doc(db, 'ftStandby', ftsEditingId), data);
    } else {
      await addDoc(COL_FT_STANDBY, data);
    }
    document.getElementById('ftsEditOverlay').classList.remove('open');
    ftsSelectedDate = date;
    showToast('已儲存');
  } catch(e) { console.error(e); showToast('儲存失敗：' + e.message); }
  finally { btn.disabled = false; btn.textContent = '儲存'; }
});

document.getElementById('ftsEditDelete')?.addEventListener('click', () => {
  if (!ftsEditingId) return;
  showConfirm('確定要刪除此日期的派遣資料？', async () => {
    try {
      await deleteDoc(doc(db, 'ftStandby', ftsEditingId));
      document.getElementById('ftsEditOverlay').classList.remove('open');
      ftsSelectedDate = null;
      showToast('已刪除');
    } catch(e) { showToast('刪除失敗：' + e.message); }
  });
});

// ── 證照管制 ───────────────────────────────────────────

function certExpiryStatus(expiryDate) {
  if (!expiryDate) return { status: 'noexpiry', label: '無效期', color: '#64748b', bg: '#f1f5f9' };
  const today = new Date(); today.setHours(0,0,0,0);
  const exp   = new Date(expiryDate + 'T00:00:00');
  const days  = Math.round((exp - today) / 86400000);
  if (days < 0)   return { status: 'expired',  label: `已過期 ${-days} 天`, color: '#dc2626', bg: '#fee2e2' };
  if (days <= 60) return { status: 'expiring', label: `還剩 ${days} 天`, color: '#d97706', bg: '#fef3c7' };
  return { status: 'valid', label: '有效', color: '#16a34a', bg: '#dcfce7' };
}

function populateCertUnitSel(selectedUnit = '') {
  const sel = document.getElementById('cert-unit-sel');
  if (!sel) return;
  const units = [...new Set(personnel.map(p => p.unit).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">全部單位</option>' +
    units.map(u => `<option value="${u}" ${u === selectedUnit ? 'selected' : ''}>${u}</option>`).join('');
}

function populateCertPersonnelSel(selectedId = '') {
  const unit = document.getElementById('cert-unit-sel')?.value || '';
  const sel  = document.getElementById('cert-personnel-sel');
  if (!sel) return;
  let list = unit ? personnel.filter(p => p.unit === unit) : [...personnel];
  list = list.sort((a, b) =>
    rankWeight(a.rank) - rankWeight(b.rank) || (a.name||'').localeCompare(b.name||'', 'zh-TW')
  );
  sel.innerHTML = '<option value="">請選擇人員</option>' +
    list.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.rank||''} ${p.name}${unit ? '' : '（'+(p.unit||'')+'）'}</option>`).join('');
}

document.getElementById('cert-unit-sel')?.addEventListener('change', () => populateCertPersonnelSel(''));

function renderCertificationsPage() {
  const unitFilter     = document.getElementById('certUnitFilter')?.value || '';
  const categoryFilter = document.getElementById('certCategoryFilter')?.value || '';
  const statusFilter   = document.getElementById('certStatusFilter')?.value || '';
  const search         = (document.getElementById('certSearch')?.value || '').trim().toLowerCase();

  // Populate unit filter
  const unitSel = document.getElementById('certUnitFilter');
  if (unitSel) {
    const currentVal = unitSel.value;
    const units = [...new Set(personnel.map(p => p.unit).filter(Boolean))].sort();
    unitSel.innerHTML = '<option value="">全部單位</option>' +
      units.map(u => `<option value="${u}" ${u === currentVal ? 'selected' : ''}>${u}</option>`).join('');
  }

  let filtered = certifications.map(c => {
    const p = personnel.find(p => p.id === c.personnelId);
    return { ...c, personName: p ? `${p.rank||''} ${p.name}` : c.personnelName || '—', unit: p?.unit || c.unit || '' };
  });

  if (unitFilter)     filtered = filtered.filter(c => c.unit === unitFilter);
  if (categoryFilter) filtered = filtered.filter(c => c.category === categoryFilter);
  if (search)         filtered = filtered.filter(c => c.personName.toLowerCase().includes(search) || (c.notes||'').toLowerCase().includes(search));
  if (statusFilter)   filtered = filtered.filter(c => certExpiryStatus(c.expiryDate).status === statusFilter);

  // Stats
  const statsEl = document.getElementById('cert-stats');
  if (statsEl) {
    const total    = filtered.length;
    const expired  = filtered.filter(c => certExpiryStatus(c.expiryDate).status === 'expired').length;
    const expiring = filtered.filter(c => certExpiryStatus(c.expiryDate).status === 'expiring').length;
    statsEl.innerHTML = total ? `
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:13px">
        <span>共 <strong>${total}</strong> 筆</span>
        ${expired  ? `<span style="color:#dc2626">⚠️ 已過期 <strong>${expired}</strong> 筆</span>` : ''}
        ${expiring ? `<span style="color:#d97706">⏰ 即將到期 <strong>${expiring}</strong> 筆</span>` : ''}
      </div>` : '';
  }

  const container = document.getElementById('cert-list');
  const empty     = document.getElementById('cert-empty');
  if (!container) return;

  if (!filtered.length) {
    container.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  // Group: unit → person → certs[]
  const byUnit = {};
  filtered.forEach(c => {
    const u   = c.unit || '未分配';
    const pid = c.personnelId || c.personnelName || '—';
    if (!byUnit[u])       byUnit[u] = {};
    if (!byUnit[u][pid])  byUnit[u][pid] = { personName: c.personName, pid, certs: [] };
    byUnit[u][pid].certs.push(c);
  });

  container.innerHTML = Object.entries(byUnit).map(([unit, persons]) => `
    <div style="margin-bottom:24px">
      <div class="cert-unit-label">${unit}</div>
      ${Object.values(persons).map(({ personName, pid, certs }) => `
      <div class="cert-person-card">
        <div class="cert-person-header">
          <span class="cert-name">${personName}</span>
          <button type="button" class="btn btn-sm btn-primary" onclick="event.stopPropagation();openCertAddForPerson('${pid}')">＋ 新增</button>
        </div>
        <div class="cert-items">
          ${certs.map(c => {
            const st = certExpiryStatus(c.expiryDate);
            return `
            <div class="cert-item-row" onclick="openCertEdit('${c.id}')">
              <div class="cert-item-left">
                <span class="cert-type-badge">${c.category} · ${c.certType}</span>
                ${c.notes ? `<span class="cert-note">${c.notes}</span>` : ''}
              </div>
              <div class="cert-item-right">
                <span class="cert-status-badge" style="background:${st.bg};color:${st.color}">${st.label}</span>
                <span class="cert-date">${[c.issueDate ? '取得：'+c.issueDate : '', c.expiryDate ? '到期：'+c.expiryDate : ''].filter(Boolean).join('　')}</span>
                ${c.photoDataUrl ? `<button type="button" class="btn btn-sm btn-secondary" onclick="event.stopPropagation();viewCertPhoto('${c.id}')">🖼</button>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}
    </div>`).join('');
}

let editingCertId = null;
let _certPhotoDataUrl = null;

window.openCertEdit = function(id) {
  editingCertId = id;
  const c = certifications.find(c => c.id === id);
  if (!c) return;
  document.getElementById('cert-modal-title').textContent = '編輯證照';
  document.getElementById('certDeleteBtn').style.display = '';
  const person = personnel.find(p => p.id === c.personnelId);
  populateCertUnitSel(person?.unit || '');
  populateCertPersonnelSel(c.personnelId);
  document.getElementById('cert-category-sel').value = c.category || '';
  populateCertTypeSel(c.category || '', c.certType || '');
  document.getElementById('cert-issue-date').value  = c.issueDate  || '';
  document.getElementById('cert-expiry-date').value = c.expiryDate || '';
  document.getElementById('cert-notes').value       = c.notes      || '';
  _certPhotoDataUrl = c.photoDataUrl || null;
  updateCertPhotoPreview();
  document.getElementById('certModalOverlay').classList.add('open');
};

window.openCertAddForPerson = function(personnelId) {
  openCertAdd(personnelId);
};

function openCertAdd(preselectedPersonnelId = '') {
  editingCertId = null;
  _certPhotoDataUrl = null;
  document.getElementById('cert-modal-title').textContent = '新增證照';
  document.getElementById('certDeleteBtn').style.display = 'none';
  const person = personnel.find(p => p.id === preselectedPersonnelId);
  populateCertUnitSel(person?.unit || '');
  populateCertPersonnelSel(preselectedPersonnelId);
  document.getElementById('cert-category-sel').value = '';
  populateCertTypeSel('', '');
  document.getElementById('cert-issue-date').value  = '';
  document.getElementById('cert-expiry-date').value = '';
  document.getElementById('cert-notes').value       = '';
  updateCertPhotoPreview();
  document.getElementById('certModalOverlay').classList.add('open');
}

function closeCertModal() {
  document.getElementById('certModalOverlay').classList.remove('open');
  editingCertId = null;
  _certPhotoDataUrl = null;
}

function populateCertTypeSel(category, selectedType = '') {
  const sel = document.getElementById('cert-type-sel');
  if (!sel) return;
  const types = CERT_TYPES[category] || [];
  sel.innerHTML = types.length
    ? types.map(t => `<option value="${t}" ${t === selectedType ? 'selected' : ''}>${t}</option>`).join('')
    : '<option value="">請先選類別</option>';
}

function updateCertPhotoPreview() {
  const preview  = document.getElementById('cert-photo-preview');
  const img      = document.getElementById('cert-photo-img');
  const dropzone = document.getElementById('cert-photo-dropzone');
  if (_certPhotoDataUrl) {
    if (img) img.src = _certPhotoDataUrl;
    if (preview)  preview.style.display  = '';
    if (dropzone) dropzone.style.display = 'none';
  } else {
    if (preview)  preview.style.display  = 'none';
    if (dropzone) dropzone.style.display = '';
  }
}

async function compressImage(file, maxPx = 1200, quality = 0.82) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

window.viewCertPhoto = function(id) {
  const c = certifications.find(c => c.id === id);
  if (!c?.photoDataUrl) return;
  const img = document.getElementById('certPhotoFull');
  if (img) img.src = c.photoDataUrl;
  document.getElementById('certPhotoOverlay').classList.add('open');
};

// Wire up cert modal events
document.getElementById('addCertBtn')?.addEventListener('click', openCertAdd);
document.getElementById('certCancelBtn')?.addEventListener('click', closeCertModal);
document.getElementById('certModalClose')?.addEventListener('click', closeCertModal);
document.getElementById('certModalOverlay')?.addEventListener('click', e => {
  if (e.target.id === 'certModalOverlay') closeCertModal();
});
document.getElementById('certPhotoClose')?.addEventListener('click', () => document.getElementById('certPhotoOverlay').classList.remove('open'));
document.getElementById('certPhotoOverlay')?.addEventListener('click', e => {
  if (e.target.id === 'certPhotoOverlay') document.getElementById('certPhotoOverlay').classList.remove('open');
});

document.getElementById('cert-category-sel')?.addEventListener('change', function() {
  populateCertTypeSel(this.value, '');
});

document.getElementById('cert-photo-input')?.addEventListener('change', async function() {
  const file = this.files?.[0];
  if (!file) return;
  _certPhotoDataUrl = await compressImage(file);
  updateCertPhotoPreview();
  this.value = '';
});

document.getElementById('cert-photo-dropzone')?.addEventListener('dragover', e => e.preventDefault());
document.getElementById('cert-photo-dropzone')?.addEventListener('drop', async e => {
  e.preventDefault();
  const file = e.dataTransfer.files?.[0];
  if (file && file.type.startsWith('image/')) {
    _certPhotoDataUrl = await compressImage(file);
    updateCertPhotoPreview();
  }
});

document.getElementById('cert-photo-clear')?.addEventListener('click', () => {
  _certPhotoDataUrl = null;
  updateCertPhotoPreview();
});

document.getElementById('certUnitFilter')?.addEventListener('change', renderCertificationsPage);
document.getElementById('certCategoryFilter')?.addEventListener('change', renderCertificationsPage);
document.getElementById('certStatusFilter')?.addEventListener('change', renderCertificationsPage);
document.getElementById('certSearch')?.addEventListener('input', renderCertificationsPage);

document.getElementById('certDeleteBtn')?.addEventListener('click', () => {
  if (!editingCertId) return;
  showConfirm('確定刪除此證照紀錄？', async () => {
    try {
      await deleteDoc(doc(db, 'personnelCerts', editingCertId));
      closeCertModal();
    } catch(e) { showToast('刪除失敗：' + e.message); }
  });
});

document.getElementById('certSaveBtn')?.addEventListener('click', async () => {
  const personnelId = document.getElementById('cert-personnel-sel')?.value;
  const category    = document.getElementById('cert-category-sel')?.value;
  const certType    = document.getElementById('cert-type-sel')?.value;
  if (!personnelId) { showToast('請選擇人員'); return; }
  if (!category)    { showToast('請選擇證照類別'); return; }
  if (!certType)    { showToast('請選擇證照等級'); return; }

  const p = personnel.find(p => p.id === personnelId);
  const data = {
    personnelId,
    personnelName: p ? `${p.rank||''} ${p.name}`.trim() : '',
    unit:          p?.unit || '',
    category,
    certType,
    issueDate:     document.getElementById('cert-issue-date')?.value  || '',
    expiryDate:    document.getElementById('cert-expiry-date')?.value || '',
    notes:         document.getElementById('cert-notes')?.value?.trim() || '',
    photoDataUrl:  _certPhotoDataUrl || '',
    updatedAt:     serverTimestamp(),
  };

  const btn = document.getElementById('certSaveBtn');
  btn.disabled = true;
  btn.textContent = '儲存中…';
  try {
    if (editingCertId) {
      await updateDoc(doc(db, 'personnelCerts', editingCertId), data);
    } else {
      await addDoc(COL_CERTS, { ...data, createdAt: serverTimestamp() });
    }
    closeCertModal();
    showToast('✓ 已儲存');
  } catch(e) {
    console.error(e);
    showToast('儲存失敗：' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 儲存';
  }
});

// ══════════════════════════════════════════════════════
// ── 通信裝備管理 ───────────────────────────────────────
// ══════════════════════════════════════════════════════

const COMMS_PARTS = [
  '天線', '電池組', '充電器', '耳機麥克風',
  '機殼（前殼）', '機殼（後殼）', '螢幕／顯示器',
  '旋鈕／按鍵', '電源開關', '接頭／插槽', '防水封條', '揹帶／配件',
];

let commsTab = 'list'; // 'list' | 'schedule' | 'logs'
let editingCommsEquipId  = null;
let editingCommsSchedId  = null;
let editingCommsLogId    = null;

// ── 頁面入口 ──────────────────────────────────────────
function renderCommsEquipPage() {
  switchCommsTab(commsTab);
}

function switchCommsTab(tab) {
  commsTab = tab;
  document.querySelectorAll('[data-comms-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.commsTab === tab));
  document.getElementById('comms-pane-list').style.display     = tab === 'list'     ? '' : 'none';
  document.getElementById('comms-pane-schedule').style.display = tab === 'schedule' ? '' : 'none';
  document.getElementById('comms-pane-logs').style.display     = tab === 'logs'     ? '' : 'none';
  document.getElementById('comms-pane-monthly').style.display  = tab === 'monthly'  ? '' : 'none';
  document.getElementById('addCommsEquipBtn').style.display    = tab === 'list'     ? '' : 'none';
  if (tab === 'list')     renderCommsEquipList();
  if (tab === 'schedule') renderCommsSchedList();
  if (tab === 'logs')     renderCommsLogList();
  if (tab === 'monthly')  renderCommsMonthly();
}

// ── 裝備清單 渲染 ─────────────────────────────────────
function renderCommsEquipList() {
  const search = (document.getElementById('comms-search')?.value || '').toLowerCase();
  const statusF = document.getElementById('comms-status-filter')?.value || '';
  let list = commsEquipment.filter(e => {
    const matchSearch = !search ||
      (e.serialNumber || '').toLowerCase().includes(search) ||
      (e.name || '').toLowerCase().includes(search) ||
      (e.unit || '').toLowerCase().includes(search);
    const matchStatus = !statusF || e.status === statusF;
    return matchSearch && matchStatus;
  });

  const el = document.getElementById('comms-equip-list');
  const empty = document.getElementById('comms-equip-empty');
  if (!el) return;

  if (!list.length) { el.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';

  const statusColor = { '堪用': '#16a34a', '維修中': '#d97706', '報廢': '#dc2626' };
  el.innerHTML = list.map(e => {
    const lastLog = [...commsMaintLog].filter(l => l.equipmentId === e.id)
      .sort((a,b) => (b.logDate||'').localeCompare(a.logDate||''))[0];
    const nextSched = [...commsMaintSched].filter(s => s.equipmentId === e.id && s.status === '待保養')
      .sort((a,b) => (a.scheduledDate||'').localeCompare(b.scheduledDate||''))[0];
    return `
    <div style="background:var(--white);border-radius:12px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:700;font-size:15px">${e.name || '—'}</span>
            <span style="font-size:12px;font-weight:600;padding:2px 8px;border-radius:12px;background:${statusColor[e.status]||'#6b7280'}22;color:${statusColor[e.status]||'#6b7280'}">${e.status || '堪用'}</span>
          </div>
          <div style="font-size:13px;color:var(--text-muted);font-family:monospace">序號：${e.serialNumber || '—'}</div>
          ${e.unit  ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${e.unit}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn-icon" onclick="openCommsEquipModal('${e.id}')">✏️</button>
          <button class="btn-icon" onclick="openCommsSchedModal(null,'${e.id}')">📅</button>
          <button class="btn-icon" onclick="openCommsLogModal(null,'${e.id}')">📋</button>
        </div>
      </div>
      ${nextSched ? `<div style="margin-top:8px;font-size:12px;padding:5px 10px;background:#eff6ff;border-radius:8px;color:#1d4ed8">📅 下次進廠：${nextSched.scheduledDate}　${nextSched.maintenanceLevel}　${nextSched.maintenanceType}</div>` : ''}
      ${lastLog  ? `<div style="margin-top:4px;font-size:12px;padding:5px 10px;background:#f0fdf4;border-radius:8px;color:#15803d">📋 上次保養：${lastLog.logDate}　${lastLog.maintenanceLevel}　結果：${lastLog.overallResult || '—'}</div>` : ''}
      ${e.notes  ? `<div style="margin-top:6px;font-size:12px;color:var(--muted)">備註：${e.notes}</div>` : ''}
    </div>`;
  }).join('');
}

// ── 進廠排程 渲染 ─────────────────────────────────────
function renderCommsSchedList() {
  const el    = document.getElementById('comms-sched-list');
  const empty = document.getElementById('comms-sched-empty');
  if (!el) return;

  const today = new Date().toISOString().slice(0, 10);
  const statusColor = { '待保養': '#d97706', '完成': '#16a34a', '取消': '#6b7280' };

  if (!commsMaintSched.length) { el.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';

  // Group: upcoming first, then completed
  const upcoming  = commsMaintSched.filter(s => s.status === '待保養');
  const others    = commsMaintSched.filter(s => s.status !== '待保養');
  const sorted    = [...upcoming, ...others];

  el.innerHTML = sorted.map(s => {
    const equip = commsEquipment.find(e => e.id === s.equipmentId);
    const isOverdue = s.status === '待保養' && s.scheduledDate < today;
    return `
    <div style="background:var(--white);border-radius:12px;padding:14px 16px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);${isOverdue ? 'border-left:3px solid #dc2626' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-weight:700">${equip?.name || '—'}</span>
            <span style="font-size:12px;color:var(--muted);font-family:monospace">#${equip?.serialNumber || s.serialNumber || '—'}</span>
            <span style="font-size:12px;font-weight:600;padding:2px 8px;border-radius:12px;background:${statusColor[s.status]||'#6b7280'}22;color:${statusColor[s.status]||'#6b7280'}">${s.status}</span>
            ${isOverdue ? '<span style="font-size:11px;color:#dc2626;font-weight:700">已逾期</span>' : ''}
          </div>
          <div style="font-size:13px;margin-top:4px">
            📅 ${s.scheduledDate || '—'}
            　<span style="color:var(--primary);font-weight:600">${s.maintenanceLevel || ''}</span>
            　${s.maintenanceType || ''}
          </div>
          ${s.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">備註：${s.notes}</div>` : ''}
        </div>
        <button class="btn-icon" onclick="openCommsSchedModal('${s.id}')">✏️</button>
      </div>
    </div>`;
  }).join('');
}

// ── 保養紀錄 渲染 ─────────────────────────────────────
function renderCommsLogList() {
  const filterEquipId = document.getElementById('comms-log-equip-filter')?.value || '';
  const el    = document.getElementById('comms-log-list');
  const empty = document.getElementById('comms-log-empty');
  if (!el) return;

  let list = filterEquipId
    ? commsMaintLog.filter(l => l.equipmentId === filterEquipId)
    : [...commsMaintLog];

  if (!list.length) { el.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';

  el.innerHTML = list.map(l => {
    const equip = commsEquipment.find(e => e.id === l.equipmentId);
    const hasDeficiency = l.overallResult === '有缺失';
    const goodParts = (l.parts || []).filter(p => p.condition === '良好').length;
    const badParts  = (l.parts || []).filter(p => p.condition === '缺失').length;
    return `
    <div style="background:var(--white);border-radius:12px;padding:14px 16px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08)${hasDeficiency ? ';border-left:3px solid #f59e0b' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-weight:700">${equip?.name || '—'}</span>
            <span style="font-size:12px;color:var(--muted);font-family:monospace">#${equip?.serialNumber || l.serialNumber || '—'}</span>
            <span style="font-size:12px;font-weight:600;padding:2px 8px;border-radius:12px;background:${hasDeficiency?'#fef3c7':'#f0fdf4'};color:${hasDeficiency?'#d97706':'#16a34a'}">${l.overallResult || '良好'}</span>
          </div>
          <div style="font-size:13px;margin-top:4px">
            📅 ${l.logDate || '—'}
            　<span style="color:var(--primary);font-weight:600">${l.maintenanceLevel || ''}</span>
            　${l.maintenanceType || ''}
          </div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">
            零附件：良好 ${goodParts} 項　${badParts ? `⚠️ 缺失 ${badParts} 項` : ''}
            ${l.technician ? `　保養人：${l.technician}` : ''}
          </div>
          ${hasDeficiency && l.deficiencyProcess ? `<div style="font-size:12px;color:#d97706;margin-top:2px">處理流程：${l.deficiencyProcess}</div>` : ''}
          ${l.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">備註：${l.notes}</div>` : ''}
        </div>
        <button class="btn-icon" onclick="openCommsLogModal('${l.id}')">✏️</button>
      </div>
      ${badParts ? `<div style="margin-top:8px;padding:8px 10px;background:#fffbeb;border-radius:8px">
        <div style="font-size:12px;font-weight:600;color:#92400e;margin-bottom:4px">缺失零附件：</div>
        ${(l.parts||[]).filter(p=>p.condition==='缺失').map(p=>`<div style="font-size:12px;color:#92400e">• ${p.name}${p.notes?' — '+p.notes:''}</div>`).join('')}
      </div>` : ''}
    </div>`;
  }).join('');
}

// ── 月檢回報 ──────────────────────────────────────────
let commsMonthlyEquipId = null; // modal 正在回報的裝備 id
let commsMonthlyMonth   = '';   // modal 正在回報的月份

function getCommsMonthlyPickerValue() {
  const picker = document.getElementById('comms-monthly-picker');
  if (!picker) return '';
  if (!picker.value) {
    const now = new Date();
    const m = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    picker.value = m;
  }
  return picker.value;
}

function renderCommsMonthly() {
  const month   = getCommsMonthlyPickerValue();
  const cardsEl = document.getElementById('comms-monthly-cards');
  const emptyEl = document.getElementById('comms-monthly-empty');
  const progEl  = document.getElementById('comms-monthly-progress');
  const matWrap = document.getElementById('comms-monthly-matrix-wrap');
  if (!cardsEl) return;

  const equips = commsEquipment.filter(e => e.status !== '報廢');
  if (!equips.length) {
    cardsEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    if (progEl)  progEl.textContent = '';
    if (matWrap) matWrap.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const reports = commsMonthlyReports.filter(r => r.month === month);
  const reported = equips.filter(e => reports.some(r => r.equipmentId === e.id));
  if (progEl) progEl.textContent = `已回報 ${reported.length} / ${equips.length} 台`;

  cardsEl.innerHTML = equips.map(e => {
    const rep = reports.find(r => r.equipmentId === e.id);
    const missingParts = rep ? (rep.parts || []).filter(p => !p.ok) : [];
    const hasReport = !!rep;
    const hasMissing = missingParts.length > 0;

    let badgeHtml, statusText;
    if (!hasReport) {
      badgeHtml = `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:#f1f5f9;color:#64748b">未回報</span>`;
    } else if (hasMissing) {
      badgeHtml = `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:#fef3c7;color:#d97706">⚠️ 有缺失</span>`;
    } else {
      badgeHtml = `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:#dcfce7;color:#16a34a">✓ 良好</span>`;
    }

    const missingHtml = hasMissing
      ? `<div class="comms-monthly-missing">缺失：${missingParts.map(p => p.name).join('、')}</div>`
      : '';

    return `
    <div class="comms-monthly-card">
      <div class="comms-monthly-info">
        <div class="comms-monthly-name">${e.name || '—'}</div>
        <div class="comms-monthly-serial">#${e.serialNumber || '—'}${e.unit ? '　'+e.unit : ''}</div>
        ${missingHtml}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
        ${badgeHtml}
        <button class="btn btn-sm ${hasReport ? 'btn-secondary' : 'btn-primary'}" onclick="openCommsMonthlyModal('${e.id}','${month}')">
          ${hasReport ? '重新回報' : '回報'}
        </button>
      </div>
    </div>`;
  }).join('');

  // 矩陣：只要至少一台已回報就顯示
  if (reported.length > 0) {
    renderCommsMonthlyMatrix(equips, reports, month);
    if (matWrap) matWrap.style.display = '';
  } else {
    if (matWrap) matWrap.style.display = 'none';
  }
}

function renderCommsMonthlyMatrix(equips, reports, month) {
  const table = document.getElementById('comms-monthly-matrix');
  if (!table) return;

  // header row: 裝備序號
  const headerCells = equips.map(e => `<th title="${e.name}">${e.serialNumber || '—'}</th>`).join('');
  // rows: one per part
  const rows = COMMS_PARTS.map(partName => {
    const cells = equips.map(e => {
      const rep = reports.find(r => r.equipmentId === e.id);
      if (!rep) return `<td class="cell-none">—</td>`;
      const p = (rep.parts || []).find(x => x.name === partName);
      if (!p) return `<td class="cell-none">—</td>`;
      return p.ok
        ? `<td class="cell-ok">✓</td>`
        : `<td class="cell-bad">✗</td>`;
    }).join('');
    return `<tr><td class="cell-part">${partName}</td>${cells}</tr>`;
  }).join('');

  table.innerHTML = `
    <thead><tr><th style="text-align:left">零附件 \\ 裝備</th>${headerCells}</tr></thead>
    <tbody>${rows}</tbody>`;
}

window.openCommsMonthlyModal = function(equipId, month) {
  commsMonthlyEquipId = equipId;
  commsMonthlyMonth   = month;
  const equip = commsEquipment.find(e => e.id === equipId);
  document.getElementById('comms-monthly-modal-title').textContent = `月檢回報 — ${month}`;
  document.getElementById('comms-monthly-modal-sub').textContent =
    equip ? `${equip.name}　#${equip.serialNumber || '—'}` : '';

  // 載入既有回報（若有）
  const existing = commsMonthlyReports.find(r => r.equipmentId === equipId && r.month === month);
  const savedParts = existing?.parts || [];

  const listEl = document.getElementById('comms-monthly-parts-list');
  listEl.innerHTML = COMMS_PARTS.map(name => {
    const saved = savedParts.find(p => p.name === name);
    const isOk  = saved ? saved.ok : true; // 預設良好
    return `
    <div class="comms-part-row" id="cmp-row-${name.replace(/[^a-zA-Z0-9]/g,'_')}">
      <span class="comms-part-name">${name}</span>
      <div class="comms-part-toggle">
        <button type="button" class="${isOk ? 'ok-active' : ''}" onclick="commsPartToggle('${name.replace(/'/g,"\\'")}', true)">良好</button>
        <button type="button" class="${!isOk ? 'bad-active' : ''}" onclick="commsPartToggle('${name.replace(/'/g,"\\'")}', false)">缺失</button>
      </div>
    </div>`;
  }).join('');

  document.getElementById('cm-notes').value = existing?.notes || '';
  document.getElementById('commsMonthlyModalOverlay').classList.add('open');
};

window.commsPartToggle = function(name, isOk) {
  const rowId = 'cmp-row-' + name.replace(/[^a-zA-Z0-9]/g, '_');
  const row   = document.getElementById(rowId);
  if (!row) return;
  const [okBtn, badBtn] = row.querySelectorAll('.comms-part-toggle button');
  okBtn.className  = isOk  ? 'ok-active'  : '';
  badBtn.className = !isOk ? 'bad-active' : '';
};

function readCommsMonthlyParts() {
  return COMMS_PARTS.map(name => {
    const rowId = 'cmp-row-' + name.replace(/[^a-zA-Z0-9]/g, '_');
    const row   = document.getElementById(rowId);
    const okBtn = row?.querySelector('.comms-part-toggle button:first-child');
    const isOk  = okBtn ? okBtn.classList.contains('ok-active') : true;
    return { name, ok: isOk };
  });
}

document.getElementById('commsMonthlyModalClose')?.addEventListener('click',  () => document.getElementById('commsMonthlyModalOverlay').classList.remove('open'));
document.getElementById('commsMonthlyModalCancel')?.addEventListener('click', () => document.getElementById('commsMonthlyModalOverlay').classList.remove('open'));

document.getElementById('commsMonthlyReportSaveBtn')?.addEventListener('click', async () => {
  const parts = readCommsMonthlyParts();
  const notes = document.getElementById('cm-notes').value.trim();
  const equip = commsEquipment.find(e => e.id === commsMonthlyEquipId);
  const data = {
    equipmentId:   commsMonthlyEquipId,
    equipmentName: equip?.name || '',
    serialNumber:  equip?.serialNumber || '',
    unit:          equip?.unit || '',
    month:         commsMonthlyMonth,
    parts,
    notes,
    submittedAt: serverTimestamp(),
  };

  const btn = document.getElementById('commsMonthlyReportSaveBtn');
  btn.disabled = true;
  try {
    // 找是否已有同月同裝備紀錄
    const existing = commsMonthlyReports.find(r => r.equipmentId === commsMonthlyEquipId && r.month === commsMonthlyMonth);
    if (existing) {
      await updateDoc(doc(db, 'commsMonthlyReports', existing.id), data);
    } else {
      await addDoc(COL_COMMS_MONTHLY, { ...data, createdAt: serverTimestamp() });
    }
    document.getElementById('commsMonthlyModalOverlay').classList.remove('open');
    showToast('✓ 回報成功');
  } catch(e) { showToast('儲存失敗：' + e.message); }
  finally { btn.disabled = false; }
});

document.getElementById('comms-monthly-picker')?.addEventListener('change', renderCommsMonthly);

// ── 下拉選單填充 ──────────────────────────────────────
function populateCommsEquipSelects() {
  ['cs-equip-sel', 'cl-equip-sel', 'comms-log-equip-filter'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const isFilter = id === 'comms-log-equip-filter';
    const prev = sel.value;
    sel.innerHTML = (isFilter ? '<option value="">全部裝備</option>' : '<option value="">— 請選擇裝備 —</option>') +
      commsEquipment.map(e => `<option value="${e.id}"${e.id===prev?' selected':''}>${e.name ? e.name + '　' : ''}#${e.serialNumber || '—'}</option>`).join('');
  });
}

function populateCommsUnitSel(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const units = adminSettings.medUnits || [];
  sel.innerHTML = '<option value="">— 請選擇單位 —</option>' +
    units.map(u => `<option value="${u}">${u}</option>`).join('');
}

function populateCommsNameSel() {
  const sel = document.getElementById('ce-name');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— 請選擇品名 —</option>' +
    commsEquipNames.map(n => `<option value="${n.name}">${n.name}</option>`).join('');
  if (cur) sel.value = cur;
}

function renderCommsNames() {
  const listEl = document.getElementById('commsNameList');
  const empty  = document.getElementById('commsNameEmpty');
  if (!listEl) return;
  if (!commsEquipNames.length) {
    listEl.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  listEl.innerHTML = commsEquipNames.map(n => `
    <div class="me-type-item">
      <span class="me-type-name">${n.name}</span>
      <button class="btn-icon danger" onclick="deleteCommsName('${n.id}','${(n.name||'').replace(/'/g,"\\'")}')">🗑</button>
    </div>`).join('');
}

window.deleteCommsName = async function(id, name) {
  showConfirm(`確定刪除品名「${name}」？`, async () => {
    try { await deleteDoc(doc(db, 'commsEquipNames', id)); showToast('已刪除'); }
    catch(e) { showToast('刪除失敗：' + e.message); }
  });
};

// ── 裝備 Modal ────────────────────────────────────────
window.openCommsEquipModal = function(id = null) {
  editingCommsEquipId = id;
  const e = id ? commsEquipment.find(x => x.id === id) : null;
  document.getElementById('comms-equip-modal-title').textContent = e ? '編輯裝備' : '新增裝備';
  populateCommsUnitSel('ce-unit');
  if (e?.unit) document.getElementById('ce-unit').value = e.unit;
  populateCommsNameSel();
  if (e?.name) document.getElementById('ce-name').value = e.name;
  document.getElementById('ce-serial').value  = e?.serialNumber || '';
  document.getElementById('ce-status').value  = e?.status       || '堪用';
  document.getElementById('ce-notes').value   = e?.notes        || '';
  document.getElementById('commsEquipDeleteBtn').style.display = e ? '' : 'none';
  document.getElementById('commsEquipModalOverlay').classList.add('open');
};

document.getElementById('commsEquipModalClose')?.addEventListener('click',  () => document.getElementById('commsEquipModalOverlay').classList.remove('open'));
document.getElementById('commsEquipModalCancel')?.addEventListener('click', () => document.getElementById('commsEquipModalOverlay').classList.remove('open'));

// 品名管理面板 toggle
let commsNamePanelOpen = false;
document.getElementById('commsNameTabBtn')?.addEventListener('click', () => {
  commsNamePanelOpen = !commsNamePanelOpen;
  const panel    = document.getElementById('commsNamePanel');
  const tabsBar  = document.querySelector('#page-comms-equipment .tabs');
  const addBtn   = document.getElementById('addCommsEquipBtn');
  const panes    = ['comms-pane-list','comms-pane-schedule','comms-pane-logs','comms-pane-monthly'];
  const tabBtn   = document.getElementById('commsNameTabBtn');
  if (commsNamePanelOpen) {
    if (panel)   panel.style.display = '';
    if (tabsBar) tabsBar.style.display = 'none';
    if (addBtn)  addBtn.style.display = 'none';
    panes.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    tabBtn.textContent = '← 裝備清單';
    renderCommsNames();
  } else {
    if (panel)   panel.style.display = 'none';
    if (tabsBar) tabsBar.style.display = '';
    if (addBtn)  addBtn.style.display = '';
    tabBtn.textContent = '📋 品名管理';
    switchCommsTab(commsTab);
  }
});

document.getElementById('addCommsNameBtn')?.addEventListener('click', async () => {
  const inp  = document.getElementById('commsNameInput');
  const name = inp?.value.trim();
  if (!name) { showToast('請輸入品名'); return; }
  if (commsEquipNames.some(n => n.name === name)) { showToast('品名已存在'); return; }
  try {
    await addDoc(COL_COMMS_NAMES, { name, createdAt: serverTimestamp() });
    inp.value = '';
    showToast('✓ 已新增');
  } catch(e) { showToast('新增失敗：' + e.message); }
});

document.getElementById('commsNameInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('addCommsNameBtn')?.click();
});

document.getElementById('commsEquipDeleteBtn')?.addEventListener('click', () => {
  showConfirm('確定刪除此裝備？相關排程與紀錄不會自動刪除。', async () => {
    try {
      await deleteDoc(doc(db, 'commsEquipment', editingCommsEquipId));
      document.getElementById('commsEquipModalOverlay').classList.remove('open');
      showToast('已刪除');
    } catch(e) { showToast('刪除失敗：' + e.message); }
  });
});

document.getElementById('commsEquipSaveBtn')?.addEventListener('click', async () => {
  const name   = document.getElementById('ce-name').value;
  const serial = document.getElementById('ce-serial').value.trim();
  if (!name)   { showToast('請選擇裝備品名'); return; }
  if (!serial) { showToast('請填寫裝備序號'); return; }
  const data = {
    name,
    serialNumber: serial,
    unit:   document.getElementById('ce-unit').value,
    status: document.getElementById('ce-status').value,
    notes:  document.getElementById('ce-notes').value.trim(),
    updatedAt: serverTimestamp(),
  };
  const btn = document.getElementById('commsEquipSaveBtn');
  btn.disabled = true;
  try {
    if (editingCommsEquipId) {
      await updateDoc(doc(db, 'commsEquipment', editingCommsEquipId), data);
    } else {
      await addDoc(COL_COMMS_EQUIP, { ...data, createdAt: serverTimestamp() });
    }
    document.getElementById('commsEquipModalOverlay').classList.remove('open');
    showToast('✓ 已儲存');
  } catch(e) { showToast('儲存失敗：' + e.message); }
  finally { btn.disabled = false; }
});

// ── 進廠排程 Modal ────────────────────────────────────
window.openCommsSchedModal = function(id = null, preEquipId = null) {
  editingCommsSchedId = id;
  const s = id ? commsMaintSched.find(x => x.id === id) : null;
  document.getElementById('comms-sched-modal-title').textContent = s ? '編輯進廠排程' : '新增進廠排程';
  populateCommsEquipSelects();
  document.getElementById('cs-equip-sel').value   = s?.equipmentId   || preEquipId || '';
  document.getElementById('cs-date').value         = s?.scheduledDate  || '';
  document.getElementById('cs-level').value        = s?.maintenanceLevel || '一級保養（使用級）';
  document.getElementById('cs-type').value         = s?.maintenanceType  || '定期';
  document.getElementById('cs-status').value       = s?.status           || '待保養';
  document.getElementById('cs-notes').value        = s?.notes            || '';
  document.getElementById('commsSchedDeleteBtn').style.display = s ? '' : 'none';
  document.getElementById('commsSchedModalOverlay').classList.add('open');
};

document.getElementById('commsSchedModalClose')?.addEventListener('click',  () => document.getElementById('commsSchedModalOverlay').classList.remove('open'));
document.getElementById('commsSchedModalCancel')?.addEventListener('click', () => document.getElementById('commsSchedModalOverlay').classList.remove('open'));

document.getElementById('commsSchedDeleteBtn')?.addEventListener('click', () => {
  showConfirm('確定刪除此排程？', async () => {
    try {
      await deleteDoc(doc(db, 'commsMaintSched', editingCommsSchedId));
      document.getElementById('commsSchedModalOverlay').classList.remove('open');
      showToast('已刪除');
    } catch(e) { showToast('刪除失敗：' + e.message); }
  });
});

document.getElementById('commsSchedSaveBtn')?.addEventListener('click', async () => {
  const equipId = document.getElementById('cs-equip-sel').value;
  const date    = document.getElementById('cs-date').value;
  if (!equipId) { showToast('請選擇裝備'); return; }
  if (!date)    { showToast('請選擇進廠日期'); return; }
  const equip = commsEquipment.find(e => e.id === equipId);
  const data = {
    equipmentId:      equipId,
    serialNumber:     equip?.serialNumber || '',
    scheduledDate:    date,
    maintenanceLevel: document.getElementById('cs-level').value,
    maintenanceType:  document.getElementById('cs-type').value,
    status:           document.getElementById('cs-status').value,
    notes:            document.getElementById('cs-notes').value.trim(),
    updatedAt:        serverTimestamp(),
  };
  const btn = document.getElementById('commsSchedSaveBtn');
  btn.disabled = true;
  try {
    if (editingCommsSchedId) {
      await updateDoc(doc(db, 'commsMaintSched', editingCommsSchedId), data);
    } else {
      await addDoc(COL_COMMS_SCHED, { ...data, createdAt: serverTimestamp() });
    }
    document.getElementById('commsSchedModalOverlay').classList.remove('open');
    showToast('✓ 已儲存');
  } catch(e) { showToast('儲存失敗：' + e.message); }
  finally { btn.disabled = false; }
});

// ── 保養紀錄 Modal ────────────────────────────────────
function buildCommsPartsForm(savedParts = []) {
  const el = document.getElementById('cl-parts-list');
  if (!el) return;
  el.innerHTML = COMMS_PARTS.map(name => {
    const saved = savedParts.find(p => p.name === name);
    const good  = saved ? saved.condition === '良好' : true;
    const bad   = saved ? saved.condition === '缺失' : false;
    const pnotes = saved?.notes || '';
    return `
    <div class="comms-part-row" data-part="${name}" style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span style="font-size:13px;font-weight:500;flex:1">${name}</span>
        <div style="display:flex;gap:6px">
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px">
            <input type="radio" name="part-${name.replace(/[^\w]/g,'_')}" value="良好" ${good?'checked':''}
              onchange="commsPartChange('${name}')"> 良好
          </label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px">
            <input type="radio" name="part-${name.replace(/[^\w]/g,'_')}" value="缺失" ${bad?'checked':''}
              onchange="commsPartChange('${name}')"> 缺失
          </label>
        </div>
      </div>
      <div class="part-deficiency-note" style="display:${bad?'':'none'};margin-top:4px">
        <input type="text" placeholder="缺失說明（選填）" value="${pnotes}"
          style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px"
          data-part-note="${name}">
      </div>
    </div>`;
  }).join('');
}

window.commsPartChange = function(name) {
  const row    = document.querySelector(`.comms-part-row[data-part="${name}"]`);
  if (!row) return;
  const isBad  = row.querySelector('input[value="缺失"]')?.checked;
  const noteEl = row.querySelector('.part-deficiency-note');
  if (noteEl) noteEl.style.display = isBad ? '' : 'none';
  // Show/hide deficiency section
  const anyBad = COMMS_PARTS.some(p => {
    const r = document.querySelector(`.comms-part-row[data-part="${p}"]`);
    return r?.querySelector('input[value="缺失"]')?.checked;
  });
  const defSec = document.getElementById('cl-deficiency-section');
  if (defSec) defSec.style.display = anyBad ? '' : 'none';
};

function readCommsPartsList() {
  return COMMS_PARTS.map(name => {
    const row   = document.querySelector(`.comms-part-row[data-part="${name}"]`);
    const isBad = row?.querySelector('input[value="缺失"]')?.checked;
    const notes = row?.querySelector(`[data-part-note="${name}"]`)?.value?.trim() || '';
    return { name, condition: isBad ? '缺失' : '良好', notes };
  });
}

window.openCommsLogModal = function(id = null, preEquipId = null) {
  editingCommsLogId = id;
  const l = id ? commsMaintLog.find(x => x.id === id) : null;
  document.getElementById('comms-log-modal-title').textContent = l ? '編輯保養紀錄' : '新增保養紀錄';
  populateCommsEquipSelects();
  document.getElementById('cl-equip-sel').value    = l?.equipmentId   || preEquipId || '';
  document.getElementById('cl-date').value          = l?.logDate        || new Date().toISOString().slice(0, 10);
  document.getElementById('cl-level').value         = l?.maintenanceLevel || '一級保養（使用級）';
  document.getElementById('cl-type').value          = l?.maintenanceType  || '定期';
  document.getElementById('cl-technician').value    = l?.technician       || '';
  document.getElementById('cl-deficiency-process').value = l?.deficiencyProcess || '自行修復';
  document.getElementById('cl-deficiency-notes').value   = l?.deficiencyNotes   || '';
  document.getElementById('cl-notes').value               = l?.notes             || '';
  buildCommsPartsForm(l?.parts || []);
  const anyBad = (l?.parts || []).some(p => p.condition === '缺失');
  document.getElementById('cl-deficiency-section').style.display = anyBad ? '' : 'none';
  document.getElementById('commsLogDeleteBtn').style.display = l ? '' : 'none';
  document.getElementById('commsLogModalOverlay').classList.add('open');
};

document.getElementById('commsLogModalClose')?.addEventListener('click',  () => document.getElementById('commsLogModalOverlay').classList.remove('open'));
document.getElementById('commsLogModalCancel')?.addEventListener('click', () => document.getElementById('commsLogModalOverlay').classList.remove('open'));

document.getElementById('commsLogDeleteBtn')?.addEventListener('click', () => {
  showConfirm('確定刪除此保養紀錄？', async () => {
    try {
      await deleteDoc(doc(db, 'commsMaintLog', editingCommsLogId));
      document.getElementById('commsLogModalOverlay').classList.remove('open');
      showToast('已刪除');
    } catch(e) { showToast('刪除失敗：' + e.message); }
  });
});

document.getElementById('commsLogSaveBtn')?.addEventListener('click', async () => {
  const equipId = document.getElementById('cl-equip-sel').value;
  const date    = document.getElementById('cl-date').value;
  if (!equipId) { showToast('請選擇裝備'); return; }
  if (!date)    { showToast('請選擇保養日期'); return; }
  const parts   = readCommsPartsList();
  const anyBad  = parts.some(p => p.condition === '缺失');
  const equip   = commsEquipment.find(e => e.id === equipId);
  const data = {
    equipmentId:      equipId,
    serialNumber:     equip?.serialNumber || '',
    logDate:          date,
    maintenanceLevel: document.getElementById('cl-level').value,
    maintenanceType:  document.getElementById('cl-type').value,
    technician:       document.getElementById('cl-technician').value.trim(),
    parts,
    overallResult:       anyBad ? '有缺失' : '良好',
    deficiencyProcess:   anyBad ? document.getElementById('cl-deficiency-process').value : '',
    deficiencyNotes:     anyBad ? document.getElementById('cl-deficiency-notes').value.trim() : '',
    notes:               document.getElementById('cl-notes').value.trim(),
    updatedAt:           serverTimestamp(),
  };
  const btn = document.getElementById('commsLogSaveBtn');
  btn.disabled = true;
  try {
    if (editingCommsLogId) {
      await updateDoc(doc(db, 'commsMaintLog', editingCommsLogId), data);
    } else {
      await addDoc(COL_COMMS_LOG, { ...data, createdAt: serverTimestamp() });
    }
    document.getElementById('commsLogModalOverlay').classList.remove('open');
    showToast('✓ 已儲存');
  } catch(e) { showToast('儲存失敗：' + e.message); }
  finally { btn.disabled = false; }
});

// ── Tab / Filter 事件 ─────────────────────────────────
document.getElementById('page-comms-equipment')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-comms-tab]');
  if (btn) switchCommsTab(btn.dataset.commsTab);
});

document.getElementById('addCommsEquipBtn')?.addEventListener('click', () => openCommsEquipModal(null));
document.getElementById('addCommsSchedBtn')?.addEventListener('click', () => openCommsSchedModal(null));

document.getElementById('comms-search')?.addEventListener('input', renderCommsEquipList);
document.getElementById('comms-status-filter')?.addEventListener('change', renderCommsEquipList);
document.getElementById('comms-log-equip-filter')?.addEventListener('change', renderCommsLogList);
