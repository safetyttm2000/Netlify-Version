// ============================================================
// TTM Training System — ttm-api.js  (Netlify version)
// ✅ แก้เพียงบรรทัดเดียวคือ GAS_API_URL แล้วใช้งานได้เลย
// ============================================================

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbz4RL-uUpF1M7eZfEM9lfUdHb0JqdScfcHlsbKVMm9xr2xrllYezi55jkmTEA2EZIfQfw/exec';
//                                                        ↑↑↑↑↑↑↑↑
//  วาง Deployment ID ของ Code_API.gs ที่นี่

const PDF_GAS_URL = 'https://script.google.com/macros/s/AKfycbxhe9WQmVZaqQMXNQvxeeJ6njTj-BDlFJdh0yQfxB4moOnkGSy810LIHdp3m5S7N52F/exec';
//                                                        ↑↑↑↑↑↑↑↑
//  วาง Deployment ID ของ Code_PDF.gs (Project แยก) ที่นี่

const PDF_SECRET  = 'ttm@2026';
//  ✅ ต้องตรงกับ PDF_SECRET ใน Code_PDF.gs

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
//  CORE FETCH — ใช้ GET เพื่อหลีกเลี่ยง CORS preflight ของ GAS
// ============================================================
async function gasGet(action, params = {}) {
  const s   = getSession();
  const all = { action, token: s.token || '', ...params };
  const qs  = Object.entries(all)
    .filter(([,v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(
      typeof v === 'object' ? JSON.stringify(v) : String(v)
    )}`).join('&');
  const res = await fetch(GAS_API_URL + '?' + qs, { redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ============================================================
//  API FUNCTIONS
// ============================================================
async function apiLogin(username, password) {
  return gasGet('login', { username, password });
}
async function apiLogout() {
  const s = getSession();
  try { await gasGet('logout', { token: s.token || '' }); } catch(_) {}
  clearSession();
}
async function apiGetVideos()       { return gasGet('getVideos'); }
async function apiGetSettings()     { return gasGet('getSettings'); }
async function apiGetQuestions()    { return gasGet('getQuestions'); }

async function apiSubmitQuiz(userData, answers, score, total, lang) {
  return gasGet('submitQuiz', {
    userData: JSON.stringify(userData),
    answers:  JSON.stringify(answers),
    score, total, lang
  });
}

// ✅ สร้าง PDF จาก Google Slides Template (เรียก GAS Project แยก)
async function apiGeneratePdf(userData, answers, score, day, month, year, lang) {
  const qs = new URLSearchParams({
    secret:   PDF_SECRET,
    userData: JSON.stringify(userData),
    answers:  JSON.stringify(answers),
    score, day, month, year, lang
  });
  const res = await fetch(PDF_GAS_URL + '?' + qs.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ✅ ส่ง base64 PDF ไปกับอีเมล (GAS แนบไฟล์ให้)
async function apiSendEmail(email, pdfBase64, filename, name, score, lang) {
  return gasGet('sendEmail', { email, pdfBase64, filename, name, score, lang });
}

// Admin
async function apiGetUsers()           { return gasGet('getUsers'); }
async function apiGetResults(limit)    { return gasGet('getResults', { limit: limit||200 }); }
async function apiGetDashboard()       { return gasGet('getDashboard'); }
async function apiAddQuestion(q)       { return gasGet('addQuestion',    { q: JSON.stringify(q) }); }
async function apiUpdateQuestion(ri,q) { return gasGet('updateQuestion', { rowIndex:ri, q: JSON.stringify(q) }); }
async function apiDeleteQuestion(ri)   { return gasGet('deleteQuestion', { rowIndex:ri }); }
async function apiAddVideo(t,u,o)      { return gasGet('addVideo',    { title:t, url:u, order:o }); }
async function apiUpdateVideo(ri,t,u,o){ return gasGet('updateVideo', { rowIndex:ri, title:t, url:u, order:o }); }
async function apiDeleteVideo(ri)      { return gasGet('deleteVideo', { rowIndex:ri }); }
async function apiAddUser(un,pw,r,d)   { return gasGet('addUser',    { username:un, password:pw, role:r, displayName:d }); }
async function apiUpdateUser(ri,un,pw,r,s,d){ return gasGet('updateUser',{ rowIndex:ri, username:un, password:pw, role:r, status:s, displayName:d }); }
async function apiDeleteUser(ri)       { return gasGet('deleteUser', { rowIndex:ri }); }
async function apiSaveSetting(k,v)     { return gasGet('saveSetting',{ key:k, value:v }); }
