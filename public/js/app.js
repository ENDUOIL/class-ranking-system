// ============================================================
// 25.1班操行排位赛 - 前端逻辑
// ============================================================
const API = "";
let state = { token: null, user: null, students: [], scores: {}, selected: new Set(), phoneOptOuts: { noon: [], evening: [] } };

// ============================================================
// HTTP 请求
// ============================================================
async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  try {
    const res = await fetch(API + path, { ...opts, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "请求失败");
    return data;
  } catch (e) {
    if (e.message.includes("Failed to fetch")) throw new Error("无法连接到服务器");
    throw e;
  }
}

// ============================================================
// 登录
// ============================================================
function switchLoginTab(role) {
  document.querySelectorAll(".login-tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`.login-tab[data-role="${role}"]`).classList.add("active");
  document.getElementById("adminLoginForm").style.display = role === "admin" ? "block" : "none";
  document.getElementById("guestLoginForm").style.display = role === "guest" ? "block" : "none";
  document.getElementById("loginError").textContent = "";
}

async function doLogin() {
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;
  if (!username || !password) return showLoginError("请输入用户名和密码");
  try {
    const data = await api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
    state.token = data.token;
    state.user = data.user;
    document.getElementById("loginError").textContent = "";
    enterApp();
  } catch (e) {
    showLoginError(e.message);
  }
}

function showLoginError(msg) {
  document.getElementById("loginError").textContent = msg;
}

async function enterGuestMode() {
  state.token = null;
  state.user = { username: "guest", role: "guest", name: "访客" };
  enterApp();
}

async function enterApp() {
  document.getElementById("loginPage").classList.remove("active");
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("appPage").style.display = "flex";
  await loadApp();
}

async function doLogout() {
  if (state.token) {
    try { await api("/api/logout", { method: "POST" }); } catch {}
  }
  state = { token: null, user: null, students: [], scores: {}, selected: new Set(), phoneOptOuts: { noon: [], evening: [] } };
  document.getElementById("appPage").style.display = "none";
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("loginPage").classList.add("active");
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
}

// ============================================================
// 加载应用数据
// ============================================================
async function loadApp() {
  try {
    const role = state.user.role;
    // 用户标识
    document.getElementById("userBadge").textContent = state.user.name || state.user.username;
    const badge = document.getElementById("roleBadge");
    badge.textContent = role === "super_admin" ? "👑 超级管理员" : role === "admin" ? "🔧 管理员" : "👤 访客";
    badge.className = "role-badge " + role;

    // 管理员工具可见性
    document.getElementById("adminTools").style.display = (role === "super_admin" || role === "admin") ? "block" : "none";
    document.getElementById("superAdminSection").style.display = role === "super_admin" ? "block" : "none";
    document.getElementById("adminMgmtSection").style.display = role === "super_admin" ? "block" : "none";
    document.getElementById("resetSection").style.display = role === "super_admin" ? "block" : "none";
    document.getElementById("clearLogBtn").style.display = role === "super_admin" ? "inline-block" : "none";

    // 加载数据
    const data = await api("/api/scores");
    state.students = data.students;
    state.scores = data.scores;

    // 加载手机豁免
    await refreshPhoneOptOut();

    // 渲染
    updateDateTime();
    renderRankings();
    renderStudentGrid();
    updateDeleteSelect();
    updateAdminList();
    updatePasswordSelect();
    setInterval(updateDateTime, 10000);
  } catch (e) {
    alert("加载失败：" + e.message);
  }
}

// ============================================================
// 日期时间
// ============================================================
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
  const grid = document.getElementById("stuGrid");
  const optOuts = state.phoneOptOuts || { noon: [], evening: [] };
  const allOpted = new Set([...optOuts.noon, ...optOuts.evening]);
  const noonSet = new Set(optOuts.noon);
  const eveningSet = new Set(optOuts.evening);

  grid.innerHTML = state.students.map(name => {
    const score = state.scores[name] ?? 15;
    const sel = state.selected.has(name) ? "selected" : "";
    let tag = "";
    if (noonSet.has(name) && eveningSet.has(name)) tag = "both";
    else if (noonSet.has(name)) tag = "noon";
    else if (eveningSet.has(name)) tag = "evening";
    const tagLabel = tag === "both" ? "全免" : tag === "noon" ? "午免" : tag === "evening" ? "晚免" : "";
    const tagClass = tag ? `opt-out-tag ${tag}` : "";
    return `<div class="stu-item ${sel}" onclick="toggleSelect('${name}')">
      <span class="score-val">${score}</span>
      <span class="name-val">${name}</span>
      ${tagLabel ? `<span class="${tagClass}">${tagLabel}</span>` : ""}
    </div>`;
  }).join("");
  updateSelectedCount();
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
        method: "POST",
        body: JSON.stringify({ slot, names: newList })
      });
    } else {
      const filtered = optOuts[slot].filter(n => !names.includes(n));
      await api("/api/phone-opt-out", {
        method: "POST",
        body: JSON.stringify({ slot, names: filtered })
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
    await api("/api/phone-opt-out", {
      method: "POST",
      body: JSON.stringify({ slot, names: current })
    });
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
    const data = await api("/api/scores/reset", {
      method: "POST",
      body: JSON.stringify({ code })
    });
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
  sel.innerHTML = '<option value="">选择要删除的学生</option>' +
    state.students.map(s => `<option value="${s}">${s}</option>`).join("");
}

// ============================================================
// 管理员管理（超级管理员）
// ============================================================
async function updateAdminList() {
  if (state.user.role !== "super_admin") return;
  try {
    const data = await api("/api/admins");
    const list = document.getElementById("adminList");
    if (data.admins.length === 0) {
      list.innerHTML = '<div style="color:var(--text-dim);font-size:12px;">暂无其他管理员</div>';
    } else {
      list.innerHTML = data.admins.map(a =>
        `<div class="admin-item">
          <span>${a.name || a.username} (@${a.username})</span>
          <button class="btn btn-small btn-danger" onclick="deleteAdmin('${a.username}')">删除</button>
        </div>`
      ).join("");
    }
  } catch {}
}

async function addAdmin() {
  const username = document.getElementById("newAdminUser").value.trim();
  const password = document.getElementById("newAdminPass").value;
  const name = document.getElementById("newAdminName").value.trim() || username;
  if (!username || !password) return alert("请输入用户名和密码");
  try {
    await api("/api/admins", { method: "POST", body: JSON.stringify({ username, password, name }) });
    document.getElementById("newAdminUser").value = "";
    document.getElementById("newAdminPass").value = "";
    document.getElementById("newAdminName").value = "";
    await updateAdminList();
    updatePasswordSelect();
    alert("✅ 管理员已添加");
  } catch (e) { alert(e.message); }
}

async function deleteAdmin(username) {
  if (!confirm(`确定删除管理员「${username}」？`)) return;
  try {
    await api(`/api/admins/${encodeURIComponent(username)}`, { method: "DELETE" });
    await updateAdminList();
    updatePasswordSelect();
    alert("✅ 已删除");
  } catch (e) { alert(e.message); }
}

async function changeAdminPassword() {
  const username = document.getElementById("changePassUser").value;
  const newPassword = document.getElementById("newPassword").value;
  if (!username || !newPassword) return alert("请选择用户并输入新密码");
  try {
    await api("/api/admins/password", {
      method: "POST",
      body: JSON.stringify({ username, newPassword })
    });
    document.getElementById("newPassword").value = "";
    alert("✅ 密码已修改");
  } catch (e) { alert(e.message); }
}

async function updatePasswordSelect() {
  try {
    const data = await api("/api/admins");
    const sel = document.getElementById("changePassUser");
    sel.innerHTML = '<option value="">选择用户</option>';
    // 添加超级管理员自身
    sel.innerHTML += '<option value="super">👑 超级管理员</option>';
    data.admins.forEach(a => {
      sel.innerHTML += `<option value="${a.username}">🔧 ${a.name || a.username}</option>`;
    });
  } catch {}
}

// ============================================================
// 日历管理
// ============================================================
let calendarData = null;

async function showCalendarModal() {
  try {
    const data = await api("/api/calendar");
    calendarData = data.calendar;
    // 周末排除
    document.getElementById("excludeFri").checked = calendarData.excludedWeekdays.includes(5);
    document.getElementById("excludeSat").checked = calendarData.excludedWeekdays.includes(6);
    document.getElementById("excludeSun").checked = calendarData.excludedWeekdays.includes(7);
    // 假期时段
    renderPeriodList();
    // 自定义排除
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
  // 绑定输入事件
  el.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("change", () => {
      const idx = parseInt(inp.dataset.idx);
      const field = inp.dataset.field;
      calendarData.periods[idx][field] = inp.value;
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
  const now = new Date();
  const weekdayHeaders = ["一","二","三","四","五","六","日"];
  let html = weekdayHeaders.map(w => `<div style="text-align:center;font-size:9px;color:var(--text-dim);padding:2px;">${w}</div>`).join("");
  // 从今天往前推到最近周一
  const firstDay = new Date(now);
  firstDay.setDate(firstDay.getDate() - 3);
  const firstDow = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
  // 补齐前面的空白
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
    // 判断类型
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
  try {
    const data = await api("/api/deductions/today");
    const ded = data.deductions || {};
    const optOuts = state.phoneOptOuts || { noon: [], evening: [] };
    const now = new Date();
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

// 日志实时搜索
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
// 键盘快捷键（回车登录）
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginPass").addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });
  document.getElementById("loginUser").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("loginPass").focus();
  });
});

// ============================================================
// 模态框点击外部关闭
// ============================================================
document.addEventListener("click", e => {
  if (e.target.classList.contains("modal")) {
    e.target.style.display = "none";
  }
});
