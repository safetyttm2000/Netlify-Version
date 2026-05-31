// ============================================================
// TTM Training System — Code_API.gs
// ใช้สำหรับ Netlify / Static Host version
// GAS ทำหน้าที่เป็น REST API รับ-ส่ง JSON
// ============================================================

// ──────────────────────────────────────────────────────────────
//  ✅ CONFIG
// ──────────────────────────────────────────────────────────────
const SPREADSHEET_ID    = '10OowmbWa8bROB-tSqx5vianA_TRAJWvWXd0BHR0vtIM';
const SLIDE_TEMPLATE_ID = '1vmlxOgrjx4ytTBosXt8-CIDxbYlYHUVOR4NYLbsR70g';
const PDF_FOLDER_NAME   = 'TTM_AnswerSheets';
const TOKEN_EXPIRE_MIN  = 120;
const ALLOWED_ORIGIN    = 'https://ttm-training.netlify.app';  // หรือใส่ domain Netlify เช่น 'https://your-site.netlify.app'
// ──────────────────────────────────────────────────────────────

const SHEET_USERS     = 'Users';
const SHEET_QUESTIONS = 'Questions';
const SHEET_RESULTS   = 'Results';
const SHEET_SETTINGS  = 'Settings';
const SHEET_VIDEOS    = 'Videos';
const SHEET_TOKENS    = 'Tokens';

// ============================================================
//  CORS Helper
// ============================================================
function _cors(data) {
  const out = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return out;
}

// ============================================================
//  doGet — REST API endpoint (GET)
//  ใช้สำหรับ Netlify: Netlify fetch → GAS URL?action=xxx
// ============================================================
function doGet(e) {
  const p      = (e && e.parameter) ? e.parameter : {};
  const action = p.action || '';
  const token  = p.token  || '';

  // Helper: parse JSON string หรือ return as-is
  function jp(v) { try { return typeof v==='string' ? JSON.parse(v) : v; } catch(_){ return v||{}; } }

  try {
    // ---- Public (ไม่ต้อง token) ----
    if (action === 'ping')         return _cors({ ok: true });
    if (action === 'getSettings')  return _cors(getSettings());
    if (action === 'getVideos')    return _cors(getVideos());
    if (action === 'getQuestions') return _cors(getQuestions());

    // ---- Login / Logout ----
    if (action === 'login')  return _cors(login(p.username, p.password));
    if (action === 'logout') { revokeToken(p.token||''); return _cors({success:true}); }

    // ---- Submit Quiz (public — user ไม่มี admin token) ----
    if (action === 'submitQuiz') {
      const ud  = jp(p.userData);
      const ans = jp(p.answers);
      return _cors(submitQuiz(ud, ans, Number(p.score), Number(p.total), p.lang));
    }
    if (action === 'sendEmail') {
      return _cors(sendPdfByEmail(p.email, p.pdfBase64||'', p.filename||'AnswerSheet.pdf', p.name, Number(p.score), p.lang));
    }
    if (action === 'sendEmailBase64') {
      // fallback: รับ base64 PDF จาก browser แล้วส่งอีเมลแนบไฟล์
      return _cors(sendPdfByEmail(p.email, p.pdfBase64||'', p.filename||'AnswerSheet.pdf', p.name, Number(p.score), p.lang));
    }

    // ---- Protected (ต้อง token) ----
    const chk = validateToken(token);
    if (!chk.valid) return _cors({ error: 'unauthorized', message: 'Invalid or expired token' });

    if (action === 'getUsers')     return _cors(getUsers());
    if (action === 'getResults')   return _cors(getResults(parseInt(p.limit)||200));
    if (action === 'getDashboard') return _cors(getDashboardStats());

    // ---- Admin only ----
    if (chk.role !== 'admin') return _cors({ error: 'forbidden' });

    if (action === 'addQuestion')    return _cors(addQuestion(jp(p.q)));
    if (action === 'updateQuestion') return _cors(updateQuestion(parseInt(p.rowIndex), jp(p.q)));
    if (action === 'deleteQuestion') return _cors(deleteQuestion(parseInt(p.rowIndex)));

    if (action === 'addVideo')    return _cors(addVideo(p.title, p.url, p.order));
    if (action === 'updateVideo') return _cors(updateVideo(parseInt(p.rowIndex), p.title, p.url, p.order));
    if (action === 'deleteVideo') return _cors(deleteVideo(parseInt(p.rowIndex)));

    if (action === 'addUser')    return _cors(addUser(p.username, p.password, p.role, p.displayName));
    if (action === 'updateUser') return _cors(updateUser(parseInt(p.rowIndex), p.username, p.password, p.role, p.status, p.displayName));
    if (action === 'deleteUser') return _cors(deleteUser(parseInt(p.rowIndex)));

    if (action === 'saveSetting') return _cors(saveSetting(p.key, p.value));

    return _cors({ error: 'unknown_action' });
  } catch(err) {
    return _cors({ error: err.message });
  }
}

// ============================================================
//  doPost — REST API endpoint (POST)
// ============================================================
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch(_) {
    return _cors({ error: 'invalid_json' });
  }

  const action = body.action || '';
  const token  = body.token  || '';

  try {
    // ---- Public ----
    if (action === 'login') {
      return _cors(login(body.username, body.password));
    }
    if (action === 'logout') {
      return _cors(logout(token));
    }
    if (action === 'submitQuiz') {
      return _cors(submitQuiz(body.userData, body.answers, body.score, body.total, body.lang));
    }
    if (action === 'sendEmail') {
      return _cors(sendPdfByEmail(body.email, body.driveUrl, body.name, body.score, body.lang));
    }

    // ---- Admin only (token required) ----
    const chk = validateToken(token);
    if (!chk.valid) return _cors({ error: 'unauthorized' });
    if (chk.role !== 'admin') return _cors({ error: 'forbidden' });

    if (action === 'addQuestion')    return _cors(addQuestion(body.q));
    if (action === 'updateQuestion') return _cors(updateQuestion(body.rowIndex, body.q));
    if (action === 'deleteQuestion') return _cors(deleteQuestion(body.rowIndex));
    if (action === 'addVideo')       return _cors(addVideo(body.title, body.url, body.order));
    if (action === 'updateVideo')    return _cors(updateVideo(body.rowIndex, body.title, body.url, body.order));
    if (action === 'deleteVideo')    return _cors(deleteVideo(body.rowIndex));
    if (action === 'addUser')        return _cors(addUser(body.username, body.password, body.role, body.displayName));
    if (action === 'updateUser')     return _cors(updateUser(body.rowIndex, body.username, body.password, body.role, body.status, body.displayName));
    if (action === 'deleteUser')     return _cors(deleteUser(body.rowIndex));
    if (action === 'saveSetting')    return _cors(saveSetting(body.key, body.value));

    return _cors({ error: 'unknown_action' });
  } catch(e) {
    return _cors({ error: e.message });
  }
}

// ============================================================
//  TOKEN (milliseconds — ไม่มี parse bug)
// ============================================================
function _getTokenSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh   = ss.getSheetByName(SHEET_TOKENS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_TOKENS);
    sh.appendRow(['Token','Username','Role','CreatedMs','ExpiresMs']);
    sh.hideSheet();
  }
  return sh;
}

function createToken(username, role) {
  const token    = Utilities.getUuid();
  const nowMs    = Date.now();
  const expireMs = nowMs + TOKEN_EXPIRE_MIN * 60 * 1000;
  _getTokenSheet().appendRow([token, username, role, nowMs, expireMs]);
  _cleanTokens(username, token);
  return token;
}

function validateToken(token) {
  if (!token) return { valid: false };
  try {
    const data = _getTokenSheet().getDataRange().getValues();
    const now  = Date.now();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(token)) {
        const exp = Number(data[i][4]);
        if (!isNaN(exp) && exp > now)
          return { valid: true, username: String(data[i][1]), role: String(data[i][2]) };
        return { valid: false, reason: 'expired' };
      }
    }
  } catch(e) {}
  return { valid: false };
}

function revokeToken(token) {
  try {
    const sh   = _getTokenSheet();
    const data = sh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) === String(token)) { sh.deleteRow(i+1); break; }
    }
  } catch(e) {}
  return { success: true };
}

function _cleanTokens(keepUser, keepToken) {
  try {
    const sh   = _getTokenSheet();
    const data = sh.getDataRange().getValues();
    const now  = Date.now();
    const del  = [];
    for (let i = 1; i < data.length; i++) {
      const same    = String(data[i][1]) === keepUser && String(data[i][0]) !== keepToken;
      const expired = !isNaN(Number(data[i][4])) && Number(data[i][4]) <= now;
      if (same || expired) del.push(i+1);
    }
    del.reverse().forEach(r => sh.deleteRow(r));
  } catch(e) {}
}

// ============================================================
//  AUTH
// ============================================================
function login(username, password) {
  try {
    username = sanitize(username);
    const data = SpreadsheetApp.openById(SPREADSHEET_ID)
      .getSheetByName(SHEET_USERS).getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === username &&
          String(data[i][1]).trim() === String(password).trim() &&
          String(data[i][3]).trim() !== 'inactive') {
        const role  = String(data[i][2]).trim();
        const token = createToken(username, role);
        return { success:true, role, username,
                 displayName: String(data[i][4]||username), token };
      }
    }
    return { success:false, message:'Invalid username or password' };
  } catch(e) { return { success:false, message:e.message }; }
}

function logout(token) {
  revokeToken(token);
  return { success: true };
}

function sanitize(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[<>"'%;()&+]/g,'').trim().substring(0,200);
}

// ============================================================
//  DATA FUNCTIONS (เหมือนกับ Code.gs ทุกอย่าง)
// ============================================================
function getQuestions() {
  const data = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_QUESTIONS).getDataRange().getValues();
  const out  = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    out.push({ id:i, rowIndex:i+1,
      questionTH:String(data[i][0]||''), questionEN:String(data[i][1]||''),
      opt1TH:String(data[i][2]||''), opt1EN:String(data[i][3]||''),
      opt2TH:String(data[i][4]||''), opt2EN:String(data[i][5]||''),
      opt3TH:String(data[i][6]||''), opt3EN:String(data[i][7]||''),
      opt4TH:String(data[i][8]||''), opt4EN:String(data[i][9]||''),
      answer:String(data[i][10]||'1') });
  }
  return out;
}
function addQuestion(q) { try{ SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_QUESTIONS).appendRow([sanitize(q.questionTH),sanitize(q.questionEN),sanitize(q.opt1TH),sanitize(q.opt1EN),sanitize(q.opt2TH),sanitize(q.opt2EN),sanitize(q.opt3TH),sanitize(q.opt3EN),sanitize(q.opt4TH),sanitize(q.opt4EN),parseInt(q.answer)]);return{success:true};}catch(e){return{success:false,message:e.message};} }
function updateQuestion(ri,q){ try{SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_QUESTIONS).getRange(ri,1,1,11).setValues([[sanitize(q.questionTH),sanitize(q.questionEN),sanitize(q.opt1TH),sanitize(q.opt1EN),sanitize(q.opt2TH),sanitize(q.opt2EN),sanitize(q.opt3TH),sanitize(q.opt3EN),sanitize(q.opt4TH),sanitize(q.opt4EN),parseInt(q.answer)]]);return{success:true};}catch(e){return{success:false,message:e.message};} }
function deleteQuestion(ri)  { try{SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_QUESTIONS).deleteRow(ri);return{success:true};}catch(e){return{success:false,message:e.message};} }

function getSettings() {
  const data=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_SETTINGS).getDataRange().getValues();
  const out={};
  for(let i=1;i<data.length;i++) if(data[i][0]) out[String(data[i][0])]=data[i][1];
  return out;
}
function saveSetting(k,v){ try{const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_SETTINGS);const d=sh.getDataRange().getValues();for(let i=1;i<d.length;i++){if(String(d[i][0])===k){sh.getRange(i+1,2).setValue(v);return{success:true};}}sh.appendRow([k,v]);return{success:true};}catch(e){return{success:false,message:e.message};} }

function getVideos() {
  const data=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_VIDEOS).getDataRange().getValues();
  const out=[];
  for(let i=1;i<data.length;i++) if(data[i][0]) out.push({id:i,rowIndex:i+1,title:String(data[i][0]),url:String(data[i][1]),order:Number(data[i][2])||1});
  return out;
}
function addVideo(t,u,o)    { try{SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_VIDEOS).appendRow([sanitize(t),sanitize(u),parseInt(o)||1]);return{success:true};}catch(e){return{success:false,message:e.message};} }
function updateVideo(ri,t,u,o){try{SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_VIDEOS).getRange(ri,1,1,3).setValues([[sanitize(t),sanitize(u),parseInt(o)||1]]);return{success:true};}catch(e){return{success:false,message:e.message};} }
function deleteVideo(ri)    { try{SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_VIDEOS).deleteRow(ri);return{success:true};}catch(e){return{success:false,message:e.message};} }

function getUsers() {
  const data=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_USERS).getDataRange().getValues();
  const out=[];
  for(let i=1;i<data.length;i++) if(data[i][0]) out.push({rowIndex:i+1,username:String(data[i][0]),password:String(data[i][1]),role:String(data[i][2]),status:String(data[i][3]),displayName:String(data[i][4]||'')});
  return out;
}
function addUser(u,p,r,d)         {try{SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_USERS).appendRow([sanitize(u),p,sanitize(r),'active',sanitize(d)]);return{success:true};}catch(e){return{success:false,message:e.message};}}
function updateUser(ri,u,p,r,s,d) {try{SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_USERS).getRange(ri,1,1,5).setValues([[sanitize(u),p,sanitize(r),sanitize(s),sanitize(d)]]);return{success:true};}catch(e){return{success:false,message:e.message};}}
function deleteUser(ri)           {try{SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_USERS).deleteRow(ri);return{success:true};}catch(e){return{success:false,message:e.message};}}

function submitQuiz(uObj,answers,score,total,lang) {
  try {
    const settings  = getSettings();
    const passScore = parseInt(settings['passing_score']) || 27;
    const now       = new Date();
    const dateStr   = Utilities.formatDate(now,'Asia/Bangkok','dd/MM/yyyy HH:mm:ss');
    const day       = Utilities.formatDate(now,'Asia/Bangkok','dd');
    const month     = Utilities.formatDate(now,'Asia/Bangkok','MM');
    const year      = Utilities.formatDate(now,'Asia/Bangkok','yyyy');

    // บันทึกลง Google Sheets
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_RESULTS);
    if (sh.getLastRow() === 0) {
      const h = ['วันที่','Username','ชื่อ','อายุ','กรุ๊ปเลือด','บ้านเลขที่','หมู่','ถนน',
        'แขวง/ตำบล','เขต/อำเภอ','จังหวัด','รหัสไปรษณีย์','เบอร์โทร','บริษัท','คะแนน','รวม','ผล','ภาษา'];
      for (let i=1;i<=30;i++) h.push('ข้อ'+i);
      sh.appendRow(h);
    }
    const row = [dateStr,uObj.username||'',uObj.name||'',uObj.age||'',uObj.blood||'',
      uObj.noAddress||'',uObj.moo||'',uObj.road||'',uObj.subdistrict||'',
      uObj.district||'',uObj.city||'',uObj.postCode||'',uObj.tel||'',uObj.company||'',
      score,total,score>=passScore?'PASS':'FAIL',lang];
    for (let i=1;i<=30;i++) row.push(answers['ans'+i]||'-');
    sh.appendRow(row);

    // ✅ คืนข้อมูลกลับ — PDF จะสร้างฝั่ง browser แทน ไม่ต้องใช้ DriveApp/SlidesApp
    return {
      success:      true,
      passed:       score >= passScore,
      score:        score,
      passingScore: passScore,
      day, month, year,
      // ส่งข้อมูลทั้งหมดกลับให้ browser สร้าง PDF เอง
      userData:     uObj,
      answers:      answers,
      lang:         lang
    };
  } catch(e) { return { success:false, message:e.message }; }
}

function sendPdfByEmail(email, pdfBase64, filename, name, score, lang) {
  try {
    if (!email || !email.includes('@')) return { success:false, message:'Invalid email' };
    const subTH = 'กระดาษคำตอบการอบรม TTM — ' + name;
    const subEN = 'TTM Training Answer Sheet — ' + name;
    const bodyTH = 'เรียนคุณ ' + name + '\n\nคะแนน: ' + score + '/30 — ผ่านการอบรม ✓\n\nกระดาษคำตอบแนบมากับอีเมลนี้\n\nขอบคุณ\nทีม TTM Safety Training';
    const bodyEN = 'Dear ' + name + ',\n\nScore: ' + score + '/30 — PASSED ✓\n\nYour answer sheet is attached.\n\nRegards,\nTTM Safety Training Team';
    // แนบ PDF จาก base64
    const pdfBlob = Utilities.newBlob(
      Utilities.base64Decode(pdfBase64), 'application/pdf', filename || 'AnswerSheet.pdf'
    );
    MailApp.sendEmail({
      to: email,
      subject: lang==='en' ? subEN : subTH,
      body:    lang==='en' ? bodyEN : bodyTH,
      attachments: [pdfBlob]
    });
    return { success: true };
  } catch(e) { return { success:false, message:e.message }; }
}

// generateAnswerSheetPDF ถูกย้ายไปสร้างฝั่ง browser แทน (ดู user.html)
// ไม่ต้องใช้ DriveApp/SlidesApp อีกต่อไป → ไม่มีปัญหาสิทธิ์เมื่อเรียกผ่าน fetch()

function getResults(limit){
  try{
    const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_RESULTS);
    if(!sh||sh.getLastRow()<2) return[];
    const out=sh.getDataRange().getValues().slice(1).map(r=>({date:String(r[0]||''),username:String(r[1]||''),name:String(r[2]||''),age:String(r[3]||''),blood:String(r[4]||''),company:String(r[13]||''),score:String(r[14]||''),total:String(r[15]||'30'),result:String(r[16]||''),lang:String(r[17]||'')}));
    out.reverse();
    return limit?out.slice(0,limit):out;
  }catch(e){return[];}
}

function getDashboardStats(){
  try{const rs=getResults(0);const pass=rs.filter(r=>r.result==='PASS').length;return{questions:getQuestions().length,users:getUsers().length,videos:getVideos().length,results:rs.length,pass,fail:rs.length-pass};}
  catch(e){return{questions:0,users:0,videos:0,results:0,pass:0,fail:0};}
}
