// ============================================================
// 25.1班操行排位赛 - 前端逻辑
// ============================================================
const API = "";
let state = { token: null, user: null, students: [], scores: {}, punishData: { punishRecords: {}, maxDoneLevel: {} }, selected: new Set(), phoneOptOuts: { noon: [], evening: [] } };

async function _hp(pwd) {
  var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pwd));
  return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,"0"); }).join("");
}


// ============================================================
// HTTP 请求
// ============================================================
async function api(path, opts) {
  if (!window.__CLS) {
    try { var r = localStorage.getItem('cls_rank'); if (r) window.__CLS = JSON.parse(r); } catch(e){}
    if (!window.__CLS) {
      var lst = ['包顺通','郑清颢','邹仁泽','秦韵贺','赵巍霖','王晨旭','张广涛','程泓博','姜乙丰','唐佳奇','赵梓渤','吴俊霖','王译广'];
      var sc = {}; lst.forEach(function(n){ sc[n]=15; });
      window.__CLS = {students:lst, scores:sc, users:{}, logs:[], calendar:{excludedWeekdays:[5,6,7],periods:[{start:'12-28',end:'03-03',label:'寒假',skipYearBoundary:true},{start:'07-05',end:'09-03',label:'暑假',skipYearBoundary:false}],customExclusions:[],customInclusions:[]}, phoneOptOuts:{}, todayDeductions:{}, punishData:{punishRecords:{},maxDoneLevel:{}}, tokens:{}};
    }
    if (!window.__CLS.users || !window.__CLS.users.super) {
      window.__CLS.users = {super:{password:'4779bda25d3be481c5b2697878d343e1120f3b4fb96e9fc2cc2746afdbd2a4cb',role:'super_admin',name:'超级管理员'},admin:{password:'c75d3f1f5bcd6914d0331ce5ec17c0db8f2070a2d4285f8e3ff11c6ca19168ff',role:'admin',name:'管理员'}};
    }
    try { localStorage.setItem('cls_rank', JSON.stringify(window.__CLS)); } catch(e){}
  }
  var D = window.__CLS;
  var m = (opts&&opts.method)||'GET';
  var b = opts&&opts.body ? JSON.parse(opts.body) : {};
  var nw = new Date();
  function p2(n){ return String(n).padStart(2,'0'); }
  var td = nw.getFullYear()+'-'+p2(nw.getMonth()+1)+'-'+p2(nw.getDate());
  function _sv(){ try{localStorage.setItem('cls_rank',JSON.stringify(D));}catch(e){} }
  function _u(){ return state&&state.user?state.user:null; }
  function _isA(){ var u=_u(); return u&&(u.role==='super_admin'||u.role==='admin'); }
  function _isS(){ var u=_u(); return u&&u.role==='super_admin'; }
  function _lg(ac,dt){ D.logs.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),timestamp:nw.toISOString(),user:(state&&state.user?state.user.name:'管理员'),role:(state&&state.user?state.user.role:'admin'),action:ac,detail:dt}); if(D.logs.length>500)D.logs.length=500; _sv(); }
  if (path==='/api/login'){ var us=D.users||{}; return _hp(b.password||'').then(function(hp){ for(var u in us){if(us[u].password===hp){var tok=crypto.randomUUID();D.tokens[tok]={username:u,role:us[u].role,name:us[u].name||u,loginTime:Date.now()};_sv();_lg('登录系统','成功登录');return{token:tok,user:{username:u,role:us[u].role,name:us[u].name||u}};} throw new Error('密码错误');}});}
  if (path==='/api/me') return {user:_u()};
  if (path==='/api/logout'){ if(state.token&&D.tokens[state.token])delete D.tokens[state.token]; _sv(); return {ok:true}; }
  if (path==='/api/scores') return{scores:D.scores||{},students:D.students||[]};
  if (path==='/api/scores/adjust'){ if(!_isA())return Promise.reject(new Error('需要管理员权限')); var nn=(b.names||[]); var vv=parseInt(b.value); if(!nn.length)return Promise.reject(new Error('请选择学生')); nn.forEach(function(x){D.scores[x]=(D.scores[x]||15)+vv;}); _lg('积分调整',(b.reason||b.rule||'手动调整')+'：'+nn.join('、')+'，分值：'+(vv>0?'+':'')+vv); _sv(); return{scores:D.scores,success:nn,ok:true};}
  if (path==='/api/scores/reset'){ if(!_isS())return Promise.reject(new Error('需要超级管理员权限')); if(b.code!=='25.1')return Promise.reject(new Error('验证码错误')); D.scores={}; D.students.forEach(function(s){D.scores[s]=15;}); _lg('赛季重置','全员积分复位为15分'); _sv(); return{scores:D.scores,ok:true};}
  if (path==='/api/punish') return D.punishData||{punishRecords:{},maxDoneLevel:{}};
  if (path==='/api/punish/confirm'){ if(!_isA())return Promise.reject(new Error('需要管理员权限')); (b.names||[]).forEach(function(n){var s=D.scores[n]||15;var lv=s<=-15?15:(s<=-10?10:(s<=-5?5:0));if(lv>0){D.punishData.punishRecords[n+'_'+lv]=true;D.punishData.maxDoneLevel[n]=Math.max(D.punishData.maxDoneLevel[n]||0,lv);}}); _lg('手机收纳确认','确认了 '+(b.names||[]).join('、')+' 的手机收纳'); _sv(); return{ok:true,punishData:D.punishData};}
  if (path==='/api/punish/reset'){ D.punishData={punishRecords:{},maxDoneLevel:{}}; _sv(); return{ok:true};}
  if (path==='/api/calendar'){ if(m==='GET')return{calendar:D.calendar||{}}; if(!_isA())return Promise.reject(new Error('需要管理员权限')); D.calendar=b; _lg('修改日历','修改了自动扣分日历配置'); _sv(); return{ok:true};}
  if (path==='/api/deductions/today') return{date:td,deductions:(D.todayDeductions||{})[td]||{noon:false,evening:false}};
  if (path==='/api/phone-opt-out'){ if(m==='GET')return{date:td,optOuts:(D.phoneOptOuts||{})[td]||{noon:[],evening:[]}}; if(!_isA())return Promise.reject(new Error('需要管理员权限')); var dt=b.date||td; if(!D.phoneOptOuts[dt])D.phoneOptOuts[dt]={noon:[],evening:[]}; D.phoneOptOuts[dt][b.slot]=b.names||[]; _sv(); return{ok:true};}
  if (path==='/api/logs'){ if(m==='DELETE'){if(!_isS())return Promise.reject(new Error('需要超级管理员权限'));D.logs=[];_sv();return{ok:true};} return{logs:D.logs||[]};}
  if (path==='/api/students'&&m==='POST'){if(!_isS())return Promise.reject(new Error('需要超级管理员权限'));var n3=(b.name||'').trim();if(!n3)return Promise.reject(new Error('请输入姓名'));if(D.students.indexOf(n3)>=0)return Promise.reject(new Error('该学生已存在'));D.students.push(n3);D.scores[n3]=15;_lg('新增学生','新增学生'+n3);_sv();return{students:D.students,ok:true};}
  if (m==='DELETE'&&path.indexOf('/api/students/')===0){if(!_isS())return Promise.reject(new Error('需要超级管理员权限'));var n4=decodeURIComponent(path.replace('/api/students/',''));var idx=D.students.indexOf(n4);if(idx<0)return Promise.reject(new Error('学生不存在'));D.students.splice(idx,1);delete D.scores[n4];_sv();return{students:D.students,ok:true};}
  throw new Error('未知 API: '+path);
}

// ============================================================
// 初始化：默认游客模式
// ============================================================
document.addEventListener("DOMContentLoaded", async function() {
  state.token = null;
  state.user = { username: "guest", role: "guest", name: "访客" };
  try {
    await loadApp();
  } catch(e) {
    console.error("加载失败", e);
  }
});

// ============================================================
// 登录弹窗
// ============================================================
function showLoginModal() {
  document.getElementById("loginModal").style.display = "flex";
  const inp = document.getElementById("loginPassInput");
  inp.value = "";
  inp.focus();
  document.getElementById("loginModalError").textContent = "";
}

function closeLoginModal() {
  document.getElementById("loginModal").style.display = "none";
}

// 回车登录
document.addEventListener("DOMContentLoaded", () => {
  const inp = document.getElementById("loginPassInput");
  if (inp) inp.addEventListener("keydown", e => { if (e.key === "Enter") doPasswordLogin(); });
});

async function doPasswordLogin() {
  const password = document.getElementById("loginPassInput").value;
  if (!password) return (document.getElementById("loginModalError").textContent = "请输入密码");
  try {
    const data = await api("/api/login", { method: "POST", body: JSON.stringify({ password }) });
    state.token = data.token;
    state.user = data.user;
    document.getElementById("loginModalError").textContent = "";
    closeLoginModal();
    await loadApp();
  } catch (e) {
    document.getElementById("loginModalError").textContent = e.message;
  }
}

async function doLogout() {
  if (state.token) {
    try { await api("/api/logout", { method: "POST" }); } catch {}
  }
  state.token = null;
  state.user = { username: "guest", role: "guest", name: "访客" };
  state.selected.clear();
  document.getElementById("loginPassInput").value = "";
  await loadApp();
}

// ============================================================
// 加载应用数据
// ============================================================
async function loadApp() {
  try {
    const role = state.user.role;

    // 更新 UI 状态
    document.getElementById("userBadge").textContent = state.user.name || "访客";
    const badge = document.getElementById("roleBadge");
    if (role === "super_admin") { badge.textContent = "👑 超级管理员"; badge.className = "role-badge super_admin"; }
    else if (role === "admin") { badge.textContent = "🔧 管理员"; badge.className = "role-badge admin"; }
    else { badge.textContent = "👤 访客"; badge.className = "role-badge guest"; }

    // 登录/登出按钮切换
    document.getElementById("loginBtn").style.display = (role === "guest") ? "inline-block" : "none";
    document.getElementById("logoutBtn").style.display = (role !== "guest") ? "inline-block" : "none";

    // 管理员工具可见性
    const isAdmin = role === "super_admin" || role === "admin";
    document.getElementById("adminTools").style.display = isAdmin ? "block" : "none";
    document.getElementById("superAdminSection").style.display = role === "super_admin" ? "block" : "none";
    document.getElementById("resetSection").style.display = role === "super_admin" ? "block" : "none";
    document.getElementById("clearLogBtn").style.display = role === "super_admin" ? "inline-block" : "none";

    // 访客模式禁用操作按钮
    document.querySelectorAll("#applyRuleBtn, #applyFlexBtn, .phone-opt-btn, #confirmPunishBtn, button[onclick*=\'showCalendarModal\'], button[onclick*=\'showLogModal\'], button[onclick*=\'showDeductionStatus\']").forEach(el => {
      el.disabled = !isAdmin;
      el.style.opacity = isAdmin ? "1" : "0.5";
      el.style.cursor = isAdmin ? "pointer" : "not-allowed";
    });

    // 加载数据
    const data = await api("/api/scores");
    state.students = data.students;
    state.scores = data.scores;
    try { var pd = await api("/api/punish"); state.punishData = pd; } catch {}

    // 加载手机豁免
    try { await refreshPhoneOptOut(); } catch {}

    // 渲染
    updateDateTime();
    renderRankings();
    renderStudentGrid();
    updateDeleteSelect();
    if (role === "super_admin") {
    }
    setInterval(updateDateTime, 10000);
  } catch (e) {
    console.error("加载失败", e);
  }
}

// ============================================================
// 日期时间
// ============================================================
// Temporary fix: fallback if loadApp fails
var fallbackRender = function() {
  var grid = document.getElementById("stuGrid");
  if (grid && state.students && state.students.length > 0) {
    grid.innerHTML = state.students.map(function(n) {
      var s = state.scores[n] ?? 15;
      return "<div class='stu-item'><span class='score-val'>" + s + "</span><span class='name-val'>" + n + "</span></div>";
    }).join("");
  }
};

function updateDateTime() {
  const now = new Date();
  const weeks = ["日","一","二","三","四","五","六"];
  const y = now.getFullYear(), m = now.getMonth()+1, d = now.getDate();
  document.getElementById("dateDisplay").textContent = `${y}年${m}月${d}日 星期${weeks[now.getDay()]}`;
  const day = now.getDay() || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day-1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  document.getElementById("weekDisplay").textContent = `第${Math.ceil((now - new Date(y,0,1)) / 86400000 / 7)}周 | ${mon.getMonth()+1}.${mon.getDate()} - ${sun.getMonth()+1}.${sun.getDate()}`;
}

// ============================================================
// 排行榜
// ============================================================
function getRankLabel(score) {
  if (score > 30) return `荣耀王者 ${score-30}🌟`;
  if (score >= 26) return "最强王者👑";
  if (score >= 21) return `至尊星耀 ${5-(25-score)}`;
  if (score >= 16) return `永恒钻石 ${5-(20-score)}`;
  if (score >= 11) return `尊贵铂金 ${5-(15-score)}`;
  if (score >= 6) return `不屈黄金 ${5-(10-score)}`;
  if (score >= 1) return `秩序青铜 ${5-(5-score)}`;
  return `堕落废铁 ${score}`;
}

function renderRankings() {
  const data = state.students.map(n => ({ name: n, score: state.scores[n] ?? 15 }))
    .sort((a, b) => b.score - a.score);
  document.getElementById("rankList").innerHTML = data.map((item, idx) =>
    `<div class="rank-item">
      <span class="rank-num">${idx + 1}</span>
      <span class="rank-name">${item.name}</span>
      <span class="rank-score">${item.score}分</span>
      <span class="rank-tag">${getRankLabel(item.score)}</span>
    </div>`
  ).join("");
}

// ============================================================
// 学生网格
// ============================================================
function renderStudentGrid() {
  var grid = document.getElementById("stuGrid");
  if (!grid) { console.error("stuGrid not found"); return; }
  try {
    var optOuts = state.phoneOptOuts || { noon: [], evening: [] };
    var noonSet = new Set(optOuts.noon);
    var eveningSet = new Set(optOuts.evening);
    var pd = state.punishData || {};
    var records = pd.punishRecords || {};
    var maxDone = pd.maxDoneLevel || {};
    var html = "";
    var pendingCount = 0;
    
    for (var i = 0; i < state.students.length; i++) {
      var name = state.students[i];
      var score = state.scores[name] ?? 15;
      var sel = state.selected.has(name) ? "selected" : "";
      
      // Phone tag
      var hasNoon = noonSet.has(name);
      var hasEve = eveningSet.has(name);
      var tagLabel = "";
      var tagClass = "";
      if (hasNoon && hasEve) { tagLabel = "全免"; tagClass = "opt-out-tag both"; }
      else if (hasNoon) { tagLabel = "午免"; tagClass = "opt-out-tag noon"; }
      else if (hasEve) { tagLabel = "晚免"; tagClass = "opt-out-tag evening"; }
      
      // Punishment tag
      var lv = score <= -15 ? 15 : score <= -10 ? 10 : score <= -5 ? 5 : 0;
      var pTag = "";
      if (lv > 0) {
        if (records[name + "_" + lv]) { pTag = "<span class='punish-tag tag-green'>已收" + (lv/5) + "晚</span>"; }
        else if ((maxDone[name] || 0) > lv) { pTag = "<span class='punish-tag tag-gray'>豁免</span>"; }
        else { pTag = "<span class='punish-tag tag-red'>待收" + (lv/5) + "晚</span>"; if (state.selected.has(name)) pendingCount++; }
      }
      
      // Standing penalty
      var standTag = "";
      if (score < 0) { standTag = "<span class='punish-tag tag-standing'>站立" + Math.abs(score) + "天</span>"; }
      
      var tag = "";
      if (tagLabel) tag = "<span class='" + tagClass + "'>" + tagLabel + "</span>";
      
      html += "<div class='stu-item " + sel + "' onclick=\"toggleSelect('" + name + "')\">" +
        "<span class='score-val'>" + score + "</span>" +
        "<span class='name-val'>" + name + "</span>" +
        tag + pTag + standTag + "</div>";
    }
    
    grid.innerHTML = html;
    var pBtn = document.getElementById("confirmPunishBtn");
    if (pBtn) {
      pBtn.textContent = pendingCount > 0 ? "确认收纳(" + pendingCount + "人)" : "无待扣项";
      pBtn.disabled = pendingCount === 0;
    }
    updateSelectedCount();
  } catch(e) { console.error("renderStudentGrid error:", e); }
}
function toggleSelect(name) {
  if (state.user.role === "guest") return;
  if (state.selected.has(name)) state.selected.delete(name);
  else state.selected.add(name);
  renderStudentGrid();
  updateSelectedCount();
}

function selectAll(b) {
  if (state.user.role === "guest") return;
  if (b) state.students.forEach(n => state.selected.add(n));
  else state.selected.clear();
  renderStudentGrid();
}

function updateSelectedCount() {
  document.getElementById("selectedCount").textContent = `已选 ${state.selected.size} 人`;
}

// ============================================================
// 积分调整
// ============================================================
async function applyRule() {
  if (state.user.role === "guest") return alert("访客模式无法操作");
  const sel = document.getElementById("ruleSelect");
  const val = sel.value;
  if (val === "PHONE_NOON" || val === "PHONE_EVENING") {
    const slot = val === "PHONE_NOON" ? "noon" : "evening";
    return handlePhoneOptOut(slot);
  }
  if (state.selected.size === 0) return alert("请先选择学生");
  const value = parseInt(val);
  const reason = sel.options[sel.selectedIndex].text.split("|")[1]?.trim() || sel.options[sel.selectedIndex].text;
  try {
    const data = await api("/api/scores/adjust", {
      method: "POST",
      body: JSON.stringify({ names: [...state.selected], value, reason, rule: reason })
    });
    state.scores = data.scores;
    state.selected.clear();
    renderAll();
    try { var pd = await api("/api/punish"); state.punishData = pd; } catch {}
    alert("✅ 操作成功！");
  } catch (e) { alert("操作失败：" + e.message); }
}

async function applyFlex() {
  if (state.user.role === "guest") return alert("访客模式无法操作");
  const val = parseInt(document.getElementById("flexVal").value);
  const reason = document.getElementById("flexReason").value || "自定义调整";
  if (!val || val === 0) return alert("请输入有效分值");
  if (state.selected.size === 0) return alert("请先选择学生");
  try {
    const data = await api("/api/scores/adjust", {
      method: "POST",
      body: JSON.stringify({ names: [...state.selected], value: val, reason })
    });
    state.scores = data.scores;
    state.selected.clear();
    renderAll();
    try { var pd = await api("/api/punish"); state.punishData = pd; } catch {}
    document.getElementById("flexVal").value = "";
    document.getElementById("flexReason").value = "";
    alert("✅ 调整成功！");
  } catch (e) { alert("操作失败：" + e.message); }
}

// ============================================================
// 手机豁免管理
// ============================================================
async function handlePhoneOptOut(slot) {
  const names = [...state.selected];
  if (names.length === 0) return alert("请先选择学生");
  const optOuts = state.phoneOptOuts || { noon: [], evening: [] };
  const currentSet = new Set(optOuts[slot]);
  const slotName = slot === "noon" ? "中午" : "晚上";
  const action = names.every(n => currentSet.has(n)) ? "移除" : "添加";
  if (!confirm(`确认${action}${slotName}手机豁免？\n${names.join("、")}`)) return;
  try {
    if (action === "添加") {
      const newList = [...new Set([...optOuts[slot], ...names])];
      await api("/api/phone-opt-out", {
        method: "POST", body: JSON.stringify({ slot, names: newList })
      });
    } else {
      const filtered = optOuts[slot].filter(n => !names.includes(n));
      await api("/api/phone-opt-out", {
        method: "POST", body: JSON.stringify({ slot, names: filtered })
      });
    }
    await refreshPhoneOptOut();
    renderStudentGrid();
    state.selected.clear();
    renderStudentGrid();
    alert("✅ 豁免设置已保存");
  } catch (e) { alert("操作失败：" + e.message); }
}

async function refreshPhoneOptOut() {
  try {
    const data = await api("/api/phone-opt-out");
    state.phoneOptOuts = data.optOuts || { noon: [], evening: [] };
    renderPhoneOptOutGrid();
    renderStudentGrid();
  } catch {}
}

function renderPhoneOptOutGrid() {
  const grid = document.getElementById("phoneOptOutGrid");
  const slot = document.getElementById("phoneSlotSelect").value;
  const optOuts = state.phoneOptOuts || { noon: [], evening: [] };
  const currentSet = new Set(optOuts[slot] || []);
  grid.innerHTML = state.students.map(name => {
    const active = currentSet.has(name);
    const cls = active ? "phone-opt-btn active" + (slot === "noon" ? " noon" : " evening") : "phone-opt-btn";
    return `<button class="${cls}" onclick="togglePhoneOptOut('${name}')">${name}</button>`;
  }).join("");
}

async function togglePhoneOptOut(name) {
  if (state.user.role === "guest") return;
  const slot = document.getElementById("phoneSlotSelect").value;
  const optOuts = state.phoneOptOuts || { noon: [], evening: [] };
  const current = [...(optOuts[slot] || [])];
  const idx = current.indexOf(name);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(name);
  try {
    await api("/api/phone-opt-out", { method: "POST", body: JSON.stringify({ slot, names: current }) });
    await refreshPhoneOptOut();
  } catch (e) { alert("操作失败：" + e.message); }
}

async function savePhoneOptOuts() {
  await refreshPhoneOptOut();
  alert("✅ 豁免名单已刷新");
}

document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("phoneSlotSelect");
  if (sel) sel.addEventListener("change", renderPhoneOptOutGrid);
});

// ============================================================
// 分享战报
// ============================================================
function shareRanks() {
  const data = state.students.map(n => ({ name: n, score: state.scores[n] ?? 15 }))
    .sort((a, b) => b.score - a.score);
  const now = new Date();
  let text = `🏆 25.1班操行排行榜 🏆\n📅 ${now.toLocaleDateString("zh-CN")}\n${"─".repeat(18)}\n`;
  data.forEach((s, i) => {
    text += `${i+1}. ${s.name} | ${getRankLabel(s.score)} (${s.score}分)\n`;
  });
  navigator.clipboard.writeText(text).then(() => alert("📋 战报已复制到剪贴板！")).catch(() => {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    alert("📋 战报已复制！");
  });
}

// ============================================================
// 赛季重置
// ============================================================
async function resetSeason() {
  if (!confirm("❗ 确定要开启新赛季？全员积分复位为15分！")) return;
  const code = prompt("请输入验证码 [25.1]：");
  if (code !== "25.1") return alert("验证码错误");
  try {
    const data = await api("/api/scores/reset", { method: "POST", body: JSON.stringify({ code }) });
    state.scores = data.scores;
    state.selected.clear();
    renderAll();
    alert("🚀 赛季重开成功！");
  } catch (e) { alert("重置失败：" + e.message); }
}

// ============================================================
// 学生管理（超级管理员）
// ============================================================
async function addStudent() {
  const name = document.getElementById("newStudentName").value.trim();
  if (!name) return alert("请输入学生姓名");
  try {
    const data = await api("/api/students", { method: "POST", body: JSON.stringify({ name }) });
    state.students = data.students;
    document.getElementById("newStudentName").value = "";
    renderAll();
    updateDeleteSelect();
    alert("✅ 已添加：" + name);
  } catch (e) { alert(e.message); }
}

async function deleteStudent() {
  const sel = document.getElementById("delStudentSelect");
  const name = sel.value;
  if (!name) return alert("请选择要删除的学生");
  if (!confirm(`确定删除学生「${name}」？此操作不可撤销！`)) return;
  try {
    const data = await api(`/api/students/${encodeURIComponent(name)}`, { method: "DELETE" });
    state.students = data.students;
    renderAll();
    updateDeleteSelect();
    alert("✅ 已删除：" + name);
  } catch (e) { alert(e.message); }
}

function updateDeleteSelect() {
  const sel = document.getElementById("delStudentSelect");
  if (!sel) return;
  sel.innerHTML = '<option value="">选择要删除的学生</option>' +
    state.students.map(s => `<option value="${s}">${s}</option>`).join("");
}

// ============================================================
// 管理员管理（超级管理员）
// ============================================================
// ============================================================
// 日历管理
// ============================================================
let calendarData = null;

async function showCalendarModal() {
  if (state.user && state.user.role === 'guest') return alert('请先登录管理员账号');
  var _isAdm = state.user && (state.user.role === 'super_admin' || state.user.role === 'admin');
  var _sb = document.getElementById('calendarSaveBtn');
  if (_sb) _sb.style.display = _isAdm ? '' : 'none';

  try {
    const data = await api("/api/calendar");
    calendarData = data.calendar;
    document.getElementById("excludeFri").checked = calendarData.excludedWeekdays.includes(5);
    document.getElementById("excludeSat").checked = calendarData.excludedWeekdays.includes(6);
    document.getElementById("excludeSun").checked = calendarData.excludedWeekdays.includes(7);
    renderPeriodList();
    renderCustomExclusions();
    renderCustomInclusions();
    renderCalendarPreview();
    document.getElementById("calendarModal").style.display = "flex";
  } catch (e) { alert("加载日历失败：" + e.message); }
}

function closeCalendarModal() {
  document.getElementById("calendarModal").style.display = "none";
}

function renderPeriodList() {
  const el = document.getElementById("periodList");
  if (!el) return;
  el.innerHTML = (calendarData.periods || []).map((p, i) =>
    `<div class="flex-row" style="margin-bottom:4px;">
      <span style="font-size:12px;color:var(--orange);min-width:40px;">${p.label}</span>
      <input type="text" class="input" style="width:70px;" value="${p.start}" data-idx="${i}" data-field="start">
      <span style="color:var(--text-dim);">至</span>
      <input type="text" class="input" style="width:70px;" value="${p.end}" data-idx="${i}" data-field="end">
      <span style="font-size:10px;color:var(--text-dim);">${p.skipYearBoundary ? "跨年" : "同年"}</span>
      <button class="btn btn-small btn-danger" onclick="removePeriod(${i})">✕</button>
    </div>`
  ).join("");
  el.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("change", () => {
      const idx = parseInt(inp.dataset.idx);
      calendarData.periods[idx][inp.dataset.field] = inp.value;
      renderCalendarPreview();
    });
  });
}

function addPeriod() {
  if (!calendarData.periods) calendarData.periods = [];
  calendarData.periods.push({ start: "01-01", end: "01-07", label: "自定义", skipYearBoundary: false });
  renderPeriodList();
  renderCalendarPreview();
}

function removePeriod(idx) {
  calendarData.periods.splice(idx, 1);
  renderPeriodList();
  renderCalendarPreview();
}

function renderCustomExclusions() {
  const el = document.getElementById("customExclusionList");
  if (!el) return;
  el.innerHTML = (calendarData.customExclusions || []).map(d =>
    `<span class="tag-item">${d} <span class="tag-del" onclick="removeCustomExclusion('${d}')">✕</span></span>`
  ).join("");
}

function addCustomExclusion() {
  const date = document.getElementById("customExcludeDate").value;
  if (!date) return alert("请选择日期");
  if (!calendarData.customExclusions) calendarData.customExclusions = [];
  if (calendarData.customExclusions.includes(date)) return alert("该日期已在排除列表中");
  calendarData.customExclusions.push(date);
  renderCustomExclusions();
  renderCalendarPreview();
}

function removeCustomExclusion(date) {
  calendarData.customExclusions = (calendarData.customExclusions || []).filter(d => d !== date);
  renderCustomExclusions();
  renderCalendarPreview();
}

function renderCustomInclusions() {
  const el = document.getElementById("customInclusionList");
  if (!el) return;
  el.innerHTML = (calendarData.customInclusions || []).map(d =>
    `<span class="tag-item">${d} <span class="tag-del" onclick="removeCustomInclusion('${d}')">✕</span></span>`
  ).join("");
}

function addCustomInclusion() {
  const date = document.getElementById("customIncludeDate").value;
  if (!date) return alert("请选择日期");
  if (!calendarData.customInclusions) calendarData.customInclusions = [];
  if (calendarData.customInclusions.includes(date)) return alert("该日期已在强制列表中");
  calendarData.customInclusions.push(date);
  renderCustomInclusions();
  renderCalendarPreview();
}

function removeCustomInclusion(date) {
  calendarData.customInclusions = (calendarData.customInclusions || []).filter(d => d !== date);
  renderCustomInclusions();
  renderCalendarPreview();
}

function renderCalendarPreview() {
  const el = document.getElementById("calendarPreview");
  if (!el) return;
  const now = new Date();
  const weekdayHeaders = ["一","二","三","四","五","六","日"];
  let html = weekdayHeaders.map(w => `<div style="text-align:center;font-size:9px;color:var(--text-dim);padding:2px;">${w}</div>`).join("");
  const firstDay = new Date(now);
  firstDay.setDate(firstDay.getDate() - 3);
  const firstDow = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
  for (let i = 0; i < firstDow - 1; i++) html += '<div></div>';
  for (let i = 0; i < 60; i++) {
    const d = new Date(firstDay);
    d.setDate(firstDay.getDate() + i);
    const ds = getDateStr(d);
    const wd = d.getDay() === 0 ? 7 : d.getDay();
    const isDeduction = isDeductionDayClient(ds, calendarData);
    const isToday = isSameDayClient(d, now);
    let cls = "cal-preview-day";
    if (isToday) cls += " today";
    const holidayLabel = getHolidayLabel(ds, calendarData);
    if (isDeduction) cls += " deduct";
    else if (holidayLabel) cls += " holiday";
    else if ([5,6,7].includes(wd) && !(calendarData.customInclusions || []).includes(ds)) cls += " weekend";
    else if ((calendarData.customExclusions || []).includes(ds)) cls += " excluded";
    else cls += " excluded";
    html += `<div class="${cls}">${d.getDate()}</div>`;
  }
  el.innerHTML = html;
}

function getDateStr(d) {
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,"0")}-${d.getDate().toString().padStart(2,"0")}`;
}

function isSameDayClient(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function isDeductionDayClient(dateStr, cal) {
  const d = new Date(dateStr + "T12:00:00");
  const wd = d.getDay() === 0 ? 7 : d.getDay();
  if ((cal.excludedWeekdays || []).includes(wd) && !(cal.customInclusions || []).includes(dateStr)) return false;
  if ((cal.customExclusions || []).includes(dateStr)) return false;
  const label = getHolidayLabel(dateStr, cal);
  if (label) return false;
  return true;
}

function getHolidayLabel(dateStr, cal) {
  const d = new Date(dateStr + "T12:00:00");
  for (const p of (cal.periods || [])) {
    const y = d.getFullYear();
    let s, e;
    if (p.skipYearBoundary && d.getMonth() + 1 < 6) {
      s = new Date(`${y-1}-${p.start}T12:00:00`);
      e = new Date(`${y}-${p.end}T12:00:00`);
    } else {
      s = new Date(`${y}-${p.start}T12:00:00`);
      e = new Date(`${y}-${p.end}T12:00:00`);
    }
    if (d >= s && d <= e) return p.label;
  }
  return null;
}

async function saveCalendar() {
  const excludedWeekdays = [];
  if (document.getElementById("excludeFri").checked) excludedWeekdays.push(5);
  if (document.getElementById("excludeSat").checked) excludedWeekdays.push(6);
  if (document.getElementById("excludeSun").checked) excludedWeekdays.push(7);
  calendarData.excludedWeekdays = excludedWeekdays;
  try {
    await api("/api/calendar", { method: "POST", body: JSON.stringify(calendarData) });
    closeCalendarModal();
    alert("✅ 日历设置已保存");
  } catch (e) { alert("保存失败：" + e.message); }
}

// ============================================================
// 扣分状态弹窗
// ============================================================
async function showDeductionStatus() {
  if (state.user && state.user.role === 'guest') return alert('请先登录管理员账号');
  try {
    const data = await api("/api/deductions/today");
    const ded = data.deductions || {};
    const optOuts = state.phoneOptOuts || { noon: [], evening: [] };
    document.getElementById("deductionContent").innerHTML = `
      <div style="margin-bottom:12px;">
        <div style="font-size:14px;font-weight:bold;text-align:center;margin-bottom:8px;">${data.date} 扣分状态</div>
        <div style="background:var(--bg-card);border-radius:8px;padding:12px;">
          <div style="margin-bottom:8px;">
            <span style="color:var(--orange);font-weight:bold;">🌞 中午 12:00：</span>
            <span style="color:${ded.noon ? 'var(--green)' : 'var(--red)'};">${ded.noon ? '✅ 已扣分' : '⏳ 待扣分'}</span>
            <div style="font-size:11px;color:var(--text-dim);margin-top:2px;">豁免 ${(optOuts.noon || []).length} 人</div>
          </div>
          <div>
            <span style="color:var(--purple);font-weight:bold;">🌙 晚上 16:45：</span>
            <span style="color:${ded.evening ? 'var(--green)' : 'var(--red)'};">${ded.evening ? '✅ 已扣分' : '⏳ 待扣分'}</span>
            <div style="font-size:11px;color:var(--text-dim);margin-top:2px;">豁免 ${(optOuts.evening || []).length} 人</div>
          </div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-dim);text-align:center;">
        自动扣分仅在工作日周一至周四（扣除日）执行<br>
        学生可申请中午/晚上不玩手机免扣分
      </div>
    `;
    document.getElementById("deductionModal").style.display = "flex";
  } catch (e) { alert("加载失败：" + e.message); }
}

function closeDeductionModal() {
  document.getElementById("deductionModal").style.display = "none";
}

// ============================================================
// 日志弹窗
// ============================================================
async function showLogModal() {
  if (state.user && state.user.role === 'guest') return alert('请先登录管理员账号');
  try {
    const data = await api("/api/logs");
    renderLogs(data.logs);
    document.getElementById("logModal").style.display = "flex";
  } catch (e) { alert("加载日志失败：" + e.message); }
}

function closeLogModal() {
  document.getElementById("logModal").style.display = "none";
}

function renderLogs(logs) {
  const el = document.getElementById("logList");
  const filter = (document.getElementById("logFilter").value || "").toLowerCase();
  const filtered = filter ? logs.filter(l =>
    (l.user || "").toLowerCase().includes(filter) ||
    (l.action || "").toLowerCase().includes(filter) ||
    (l.detail || "").toLowerCase().includes(filter)
  ) : logs;
  if (filtered.length === 0) {
    el.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">暂无日志记录</div>';
    return;
  }
  el.innerHTML = filtered.map(l =>
    `<div class="log-item">
      <span class="log-time">${formatTime(l.timestamp)}</span>
      <span class="log-user">${l.user}</span>
      <span class="log-action">${l.action}</span>
      <span class="log-detail">${l.detail}</span>
    </div>`
  ).join("");
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const filter = document.getElementById("logFilter");
  if (filter) {
    filter.addEventListener("input", async () => {
      try {
        const data = await api("/api/logs");
        renderLogs(data.logs);
      } catch {}
    });
  }
});

async function clearLogs() {
  if (!confirm("确定清空所有操作日志？此操作不可撤销！")) return;
  try {
    await api("/api/logs", { method: "DELETE" });
    document.getElementById("logList").innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">日志已清空</div>';
    alert("✅ 日志已清空");
  } catch (e) { alert("清空失败：" + e.message); }
}

// ============================================================
// 渲染所有
// ============================================================
function renderAll() {
  renderRankings();
  renderStudentGrid();
}

// ============================================================
// 模态框点击外部关闭
// ============================================================

// ============================================================
// 手机收纳确认与惩罚
// ============================================================
async function confirmPunish() {
  if (state.user.role === "guest") return;
  var pendingNames = [];
  var punishData = state.punishData || { punishRecords: {}, maxDoneLevel: {} };
  var records = punishData.punishRecords || {};
  var maxDone = punishData.maxDoneLevel || {};
  state.selected.forEach(function(name) {
    var score = state.scores[name] ?? 15;
    var lv = score <= -15 ? 15 : score <= -10 ? 10 : score <= -5 ? 5 : 0;
    if (lv > 0 && !records[name + "_" + lv] && (maxDone[name] || 0) <= lv) {
      pendingNames.push(name);
    }
  });
  if (pendingNames.length === 0) return alert("所选学生中没有待收纳的");
  if (!confirm("确认收纳以下学生的手机？\n" + pendingNames.join("、"))) return;
  try {
    var data = await api("/api/punish/confirm", { method: "POST", body: JSON.stringify({ names: pendingNames }) });
    state.punishData = data.punishData;
    state.selected.clear();
    renderStudentGrid();
    alert("✅ 手机收纳已确认");
  } catch (e) { alert("操作失败：" + e.message); }
}

async function resetPunishStatus() {
  if (state.user.role === "guest") return;
  if (!confirm("确定清除所有红标（手机收纳记录）？")) return;
  try {
    await api("/api/punish/reset", { method: "POST" });
    state.punishData = { punishRecords: {}, maxDoneLevel: {} };
    renderStudentGrid();
    alert("✅ 红标已清除");
  } catch (e) { alert("操作失败：" + e.message); }
}

function getPunishTag(name, score) {
  var pd = state.punishData || { punishRecords: {}, maxDoneLevel: {} };
  var records = pd.punishRecords || {};
  var maxDone = pd.maxDoneLevel || {};
  var lv = score <= -15 ? 15 : score <= -10 ? 10 : score <= -5 ? 5 : 0;
  if (lv > 0) {
    if (records[name + "_" + lv]) return { text: "已收" + (lv/5) + "晚", cls: "green" };
    if ((maxDone[name] || 0) > lv) return { text: "🛡️ 豁免", cls: "gray" };
    return { text: "🚨 待收" + (lv/5) + "晚", cls: "red" };
  }
  return null;
}

document.addEventListener("click", e => {
  if (e.target.classList.contains("modal")) {
    e.target.style.display = "none";
  }
});
