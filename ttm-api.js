// ============================================================
// TTM Training System — ttm-api.js  (Netlify version)
// ✅ แก้เพียงบรรทัดเดียวคือ GAS_API_URL แล้วใช้งานได้เลย
// ============================================================

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwJKRKpWFVloXZ1n3CdTulylLOddD5syJZZiI9HdMT6kfMLMaWiOVsZPPyVA4QB5rwW0A/exec';
//                                                        ↑↑↑↑↑↑↑↑
//  วาง Deployment ID ของ Code_API.gs ที่นี่

const PDF_GAS_URL = 'https://script.google.com/macros/s/AKfycbzpZ59V8MLs99upar6nVa7c7BhPIsFSHixFZ_RyFZ16wZG9bTAaNL4AGX5twz9sb4_2/exec';
//                                                        ↑↑↑↑↑↑↑↑
//  วาง Deployment ID ของ Code_PDF.gs (Project แยก) ที่นี่

const PDF_SECRET  = 'ttmv01';
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
  // ✅ timeout 90 วินาที — Slides + Drive ใช้เวลานาน
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(PDF_GAS_URL + '?' + qs.toString(),
      { redirect: 'follow', signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  } catch(e) {
    clearTimeout(tid);
    if (e.name === 'AbortError') throw new Error('Timeout: GAS ใช้เวลานานเกิน 90 วินาที');
    throw e;
  }
}

// ✅ ส่งอีเมล — GAS ดึง PDF จาก Drive fileId แนบให้เอง (ไม่ต้องส่ง base64 ผ่าน URL)
async function apiSendEmail(email, fileId, name, score, lang) {
  const qs = new URLSearchParams({
    secret: PDF_SECRET,
    action: 'sendEmail',
    email, fileId, name, score, lang
  });
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(PDF_GAS_URL + '?' + qs.toString(),
      { redirect: 'follow', signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  } catch(e) {
    clearTimeout(tid);
    if (e.name === 'AbortError') throw new Error('Timeout: ส่งอีเมลนานเกินไป');
    throw e;
  }
}

// ✅ ส่งอีเมลด้วย base64 (fallback เมื่อไม่มี fileId — ผ่าน Code_API.gs)
async function apiSendEmailBase64(email, pdfBase64, filename, name, score, lang) {
  // แบ่ง base64 เป็นก้อนๆ เพื่อหลีกเลี่ยง URL ยาวเกิน
  // ส่งผ่าน Code_API.gs ซึ่งรับ JSON POST
  const url  = GAS_API_URL;
  const body = JSON.stringify({
    action: 'sendEmailBase64',
    email, pdfBase64, filename, name, score, lang,
    token: (function(){ try{ return JSON.parse(sessionStorage.getItem('ttm_session')||'{}').token||''; }catch(_){ return ''; } })()
  });
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body, redirect: 'follow', signal: ctrl.signal
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  } catch(e) {
    clearTimeout(tid);
    if (e.name === 'AbortError') throw new Error('Timeout');
    throw e;
  }
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
