// ================================================================
// TTM Training System — ttm-api.js
// ✅ แก้เพียง 2 บรรทัด:
//    GAS_URL   = URL ของ Code_API.gs  (บันทึก Sheets / Login)
//    PDF_URL   = URL ของ Code_PDF_Worker.gs (สร้าง PDF จาก Template)
// ================================================================

var GAS_URL = 'https://script.google.com/macros/s/AKfycbyhwN-7ZnSXJgBONO1NJM-obrpp4ExG006BhY8xL0_YovhJMXQWksAgzHKfRB677z5zhg/exec';
//                                                    ↑↑↑↑↑↑↑↑
//  URL จาก Code_API.gs deployment

var PDF_URL = 'https://script.google.com/macros/s/AKfycbyi-ytuiJzUPLDtBpBPIB0KAYbD80AT3xWGa9_wXK-SwMb0mRQiMBIqu4XokDEsWkhQwQ/exec';
//                                                    ↑↑↑↑↑↑↑↑
//  URL จาก Code_PDF_Worker.gs deployment (Project ใหม่แยกต่างหาก)

var PDF_SECRET = 'TTM2025';
// ✅ ต้องตรงกับ WORKER_SECRET ใน Code_PDF_Worker.gs

// ================================================================
//  SESSION
// ================================================================
function getSession() {
  try { return JSON.parse(sessionStorage.getItem('ttm_s') || '{}'); }
  catch(_) { return {}; }
}
function saveSession(d) { sessionStorage.setItem('ttm_s', JSON.stringify(d)); }
function clearSession() { sessionStorage.removeItem('ttm_s'); }

// ================================================================
//  CORE FETCH — GET + query string
// ================================================================
async function gasCall(baseUrl, params, timeoutSec) {
  timeoutSec = timeoutSec || 30;
  var qs = Object.keys(params)
    .filter(function(k) { return params[k] !== null && params[k] !== undefined; })
    .map(function(k) {
      var v = params[k];
      return encodeURIComponent(k) + '=' + encodeURIComponent(
        typeof v === 'object' ? JSON.stringify(v) : String(v)
      );
    }).join('&');

  var ctrl = new AbortController();
  var tid  = setTimeout(function() { ctrl.abort(); }, timeoutSec * 1000);
  try {
    var res = await fetch(baseUrl + '?' + qs, { redirect: 'follow', signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch(e) {
    clearTimeout(tid);
    if (e.name === 'AbortError') throw new Error('Timeout (' + timeoutSec + 's)');
    throw e;
  }
}

function call(action, params, timeout) {
  var s   = getSession();
  var all = Object.assign({ action: action, token: s.token || '' }, params || {});
  return gasCall(GAS_URL, all, timeout || 30);
}

// ================================================================
//  PUBLIC API
// ================================================================
function apiLogin(u, p)    { return call('login', { username: u, password: p }); }
function apiLogout()       {
  var s = getSession();
  return call('logout', { token: s.token || '' }).finally(function() { clearSession(); });
}
function apiGetSettings()  { return call('getSettings'); }
function apiGetVideos()    { return call('getVideos'); }
function apiGetQuestions() { return call('getQuestions'); }

// บันทึกผลสอบ (ไม่สร้าง PDF — แยกออก)
function apiSubmitQuiz(ud, ans, score, total, lang) {
  return call('submitQuiz', {
    userData: JSON.stringify(ud),
    answers:  JSON.stringify(ans),
    score: score, total: total, lang: lang
  }, 60);
}

// ✅ สร้าง PDF จาก Slides Template — เรียก PDF Worker โดยตรง
// PDF Worker รัน as owner → DriveApp มีสิทธิ์เต็ม
// ใช้เวลาประมาณ 15-30 วินาที
async function apiGeneratePdf(uObj, answers, score, lang, day, month, year) {
  return gasCall(PDF_URL, {
    secret:   PDF_SECRET,
    userData: JSON.stringify(uObj),
    answers:  JSON.stringify(answers),
    score:    score,
    lang:     lang,
    day:      day,
    month:    month,
    year:     year
  }, 90); // 90 วินาที
}

// ================================================================
//  ADMIN API
// ================================================================
function apiGetUsers()            { return call('getUsers'); }
function apiGetResults(n)         { return call('getResults', { limit: n || 200 }); }
function apiGetDashboard()        { return call('getDashboard'); }
function apiAddQuestion(q)        { return call('addQuestion',    { q: JSON.stringify(q) }); }
function apiUpdateQuestion(ri, q) { return call('updateQuestion', { rowIndex: ri, q: JSON.stringify(q) }); }
function apiDeleteQuestion(ri)    { return call('deleteQuestion', { rowIndex: ri }); }
function apiAddVideo(t, u, o)     { return call('addVideo',    { title: t, url: u, order: o }); }
function apiUpdateVideo(ri,t,u,o) { return call('updateVideo', { rowIndex: ri, title: t, url: u, order: o }); }
function apiDeleteVideo(ri)       { return call('deleteVideo', { rowIndex: ri }); }
function apiAddUser(u,p,r,d)      { return call('addUser',    { username:u, password:p, role:r, displayName:d }); }
function apiUpdateUser(ri,u,p,r,s,d) { return call('updateUser', { rowIndex:ri, username:u, password:p, role:r, status:s, displayName:d }); }
function apiDeleteUser(ri)        { return call('deleteUser', { rowIndex: ri }); }
function apiSaveSetting(k, v)     { return call('saveSetting', { key: k, value: v }); }
