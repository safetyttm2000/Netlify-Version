// ================================================================
// TTM Training System v3 — ttm-api.js
// ✅ แก้เพียง GAS_URL บรรทัดเดียว
// ================================================================

var GAS_URL = 'https://script.google.com/macros/s/AKfycbyhwN-7ZnSXJgBONO1NJM-obrpp4ExG006BhY8xL0_YovhJMXQWksAgzHKfRB677z5zhg/exec';
//                                                    ↑↑↑↑↑↑↑↑
//  วาง Web App URL จาก Code_API.gs ที่นี่

// Session
function getSession(){try{return JSON.parse(sessionStorage.getItem('ttm_s')||'{}');}catch(_){return{};}}
function saveSession(d){sessionStorage.setItem('ttm_s',JSON.stringify(d));}
function clearSession(){sessionStorage.removeItem('ttm_s');}

// Core fetch
async function call(action, params, timeoutSec) {
  timeoutSec = timeoutSec || 30;
  var s   = getSession();
  var all = Object.assign({action:action, token:s.token||''}, params||{});
  var qs  = Object.keys(all).map(function(k) {
    var v=all[k];
    if(v===null||v===undefined) return null;
    return encodeURIComponent(k)+'='+encodeURIComponent(typeof v==='object'?JSON.stringify(v):String(v));
  }).filter(Boolean).join('&');
  var ctrl=new AbortController(), tid=setTimeout(function(){ctrl.abort();},timeoutSec*1000);
  try {
    var res=await fetch(GAS_URL+'?'+qs,{redirect:'follow',signal:ctrl.signal});
    clearTimeout(tid);
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  } catch(e) {
    clearTimeout(tid);
    if(e.name==='AbortError') throw new Error('Timeout ('+timeoutSec+'s)');
    throw e;
  }
}

// API functions
function apiLogin(u,p)    { return call('login',{username:u,password:p}); }
function apiLogout()      { var s=getSession(); return call('logout',{token:s.token||''}).finally(clearSession); }
function apiGetSettings() { return call('getSettings'); }
function apiGetVideos()   { return call('getVideos'); }
function apiGetQuestions(){ return call('getQuestions'); }
function apiSubmitQuiz(ud,ans,score,total,lang){
  return call('submitQuiz',{
    userData:JSON.stringify(ud),answers:JSON.stringify(ans),
    score:score,total:total,lang:lang
  },60); // 60 วินาที — แค่บันทึก Sheets ไม่ต้องรอ PDF
}
function apiGetPdf(queueId){ return call('getPdf',{queueId:queueId},30); }

// Admin
function apiGetUsers()           { return call('getUsers'); }
function apiGetResults(n)        { return call('getResults',{limit:n||200}); }
function apiGetDashboard()       { return call('getDashboard'); }
function apiAddQuestion(q)       { return call('addQuestion',{q:JSON.stringify(q)}); }
function apiUpdateQuestion(ri,q) { return call('updateQuestion',{rowIndex:ri,q:JSON.stringify(q)}); }
function apiDeleteQuestion(ri)   { return call('deleteQuestion',{rowIndex:ri}); }
function apiAddVideo(t,u,o)      { return call('addVideo',{title:t,url:u,order:o}); }
function apiUpdateVideo(ri,t,u,o){ return call('updateVideo',{rowIndex:ri,title:t,url:u,order:o}); }
function apiDeleteVideo(ri)      { return call('deleteVideo',{rowIndex:ri}); }
function apiAddUser(u,p,r,d)     { return call('addUser',{username:u,password:p,role:r,displayName:d}); }
function apiUpdateUser(ri,u,p,r,s,d){ return call('updateUser',{rowIndex:ri,username:u,password:p,role:r,status:s,displayName:d}); }
function apiDeleteUser(ri)       { return call('deleteUser',{rowIndex:ri}); }
function apiSaveSetting(k,v)     { return call('saveSetting',{key:k,value:v}); }
