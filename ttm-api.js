// ============================================================
// TTM Training System — ttm-api.js
// ✅ แก้เพียงบรรทัดเดียวคือ GAS_API_URL แล้วใช้งานได้เลย
// ============================================================

const GAS_API_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
//                                                        ↑↑↑↑↑↑↑↑
//  วาง Deployment ID ของคุณที่นี่  (ได้จาก GAS → Deploy → Web App URL)

// ============================================================
//  SESSION HELPERS
// ============================================================
function getSession() {
  try { return JSON.parse(sessionStorage.getItem('ttm_session') || '{}'); }
  catch (_) { return {}; }
}
function saveSession(data) {
  sessionStorage.setItem('ttm_session', JSON.stringify(data));
}
function clearSession() {
  sessionStorage.removeItem('ttm_session');
}

// ============================================================
//  CORE FETCH  — ใช้ no-cors workaround สำหรับ GAS
//  GAS Web App ไม่รองรับ CORS preflight → ใช้ GET + query string แทน POST
// ============================================================
async function gasGet(action, params = {}) {
  const s   = getSession();
  const all = { action, token: s.token || '', ...params };
  const qs  = Object.entries(all)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(
      typeof v === 'object' ? JSON.stringify(v) : String(v)
    )}`).join('&');
  const url  = GAS_API_URL + '?' + qs;
  const res  = await fetch(url, { redirect: 'follow' });
  return res.json();
}

// ============================================================
//  PUBLIC API FUNCTIONS (เรียกใช้ใน index/user/admin.html)
// ============================================================

/** Login — ไม่ต้องมี session ก่อน */
async function apiLogin(username, password) {
  return gasGet('login', { username, password });
}

/** Logout */
async function apiLogout() {
  const s = getSession();
  await gasGet('logout', { token: s.token || '' });
  clearSession();
}

/** โหลดวิดีโอ */
async function apiGetVideos() { return gasGet('getVideos'); }

/** โหลด settings */
async function apiGetSettings() { return gasGet('getSettings'); }

/** โหลดข้อสอบ */
async function apiGetQuestions() { return gasGet('getQuestions'); }

/** ส่งผลสอบ */
async function apiSubmitQuiz(userData, answers, score, total, lang) {
  return gasGet('submitQuiz', {
    userData: JSON.stringify(userData),
    answers:  JSON.stringify(answers),
    score, total, lang
  });
}

/** ส่ง PDF ทางอีเมล */
async function apiSendEmail(email, driveUrl, name, score, lang) {
  return gasGet('sendEmail', { email, driveUrl, name, score, lang });
}

// ---- Admin only ----
async function apiGetUsers()    { return gasGet('getUsers'); }
async function apiGetResults(limit) { return gasGet('getResults', { limit: limit||200 }); }
async function apiGetDashboard() { return gasGet('getDashboard'); }

async function apiAddQuestion(q)          { return gasGet('addQuestion',    { q: JSON.stringify(q) }); }
async function apiUpdateQuestion(ri, q)   { return gasGet('updateQuestion', { rowIndex: ri, q: JSON.stringify(q) }); }
async function apiDeleteQuestion(ri)      { return gasGet('deleteQuestion', { rowIndex: ri }); }

async function apiAddVideo(title,url,order)         { return gasGet('addVideo',    { title,url,order }); }
async function apiUpdateVideo(ri,title,url,order)   { return gasGet('updateVideo', { rowIndex:ri,title,url,order }); }
async function apiDeleteVideo(ri)                   { return gasGet('deleteVideo', { rowIndex:ri }); }

async function apiAddUser(un,pw,role,dn)            { return gasGet('addUser',    { username:un,password:pw,role,displayName:dn }); }
async function apiUpdateUser(ri,un,pw,role,st,dn)   { return gasGet('updateUser', { rowIndex:ri,username:un,password:pw,role,status:st,displayName:dn }); }
async function apiDeleteUser(ri)                    { return gasGet('deleteUser', { rowIndex:ri }); }

async function apiSaveSetting(key, value) { return gasGet('saveSetting', { key, value }); }
