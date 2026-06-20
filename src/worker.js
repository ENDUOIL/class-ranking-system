// ============================================================
// 25.1班操行排位赛 - Cloudflare Worker 后端
// ============================================================
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("/api/*", cors());
app.onError((err, c) => { console.error(err.message); return c.json({error:err.message}, 500); });

// ============================================================
// KV 工具函数
// ============================================================
async function getKV(env, key, def = null) {
  try {
    const val = await env.RANKING_KV.get(key, "json");
    return val !== null ? val : def;
  } catch { return def; }
}
async function setKV(env, key, val) {
  await env.RANKING_KV.put(key, JSON.stringify(val));
}

// ============================================================
// 密码工具
// ============================================================
async function hashPassword(pwd) {
  const enc = new TextEncoder().encode(pwd);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function generateToken() {
  return crypto.randomUUID() + "-" + Date.now().toString(36);
}

// ============================================================
// 默认数据
// ============================================================
const DEFAULT_STUDENTS = ["包顺通","郑清颢","邹仁泽","秦韵贺","赵巍霖","王晨旭","张广涛","程泓博","姜乙丰","唐佳奇","赵梓渤","吴俊霖","王译广"];

const DEFAULT_CALENDAR = {
  excludedWeekdays: [5,6,7],
  periods: [
    { start: "12-28", end: "03-03", label: "寒假", skipYearBoundary: true },
    { start: "07-05", end: "09-03", label: "暑假", skipYearBoundary: false }
  ],
  customExclusions: [],
  customInclusions: []
};

// ============================================================
// 初始化 KV（首次部署时写入默认数据）
// ============================================================
async function ensureInitialized(env) {
  const existingStudents = await getKV(env, "students");
  if (existingStudents && existingStudents.length > 0) return;
  const superHash = await hashPassword("yangjian1");
  const adminHash2 = await hashPassword("251");
const users = {
  super: { password: superHash, role: "super_admin", name: "超级管理员" },
  admin: { password: adminHash2, role: "admin", name: "管理员" }
};
  await setKV(env, "users", users);
  await setKV(env, "students", DEFAULT_STUDENTS);
  const scores = {};
  DEFAULT_STUDENTS.forEach(s => scores[s] = 15);
  await setKV(env, "scores", scores);
  await setKV(env, "logs", []);
  await setKV(env, "calendar", DEFAULT_CALENDAR);
  await setKV(env, "phoneOptOuts", {});
  await setKV(env, "todayDeductions", {});
  await setKV(env, "punishData", { punishRecords: {}, maxDoneLevel: {} });
  await setKV(env, "_initialized", "yes");
}

// ============================================================
// Auth 中间件
// ============================================================
async function authMiddleware(c, next) {
  const auth = c.req.header("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return c.json({ error: "未登录" }, 401);
  const tokens = await getKV(c.env, "tokens", {});
  const session = tokens[token];
  if (!session) return c.json({ error: "登录已过期" }, 401);
  c.set("user", session);
  await next();
}

async function superAdminOnly(c, next) {
  const user = c.get("user");
  if (user.role !== "super_admin") return c.json({ error: "需要超级管理员权限" }, 403);
  await next();
}

async function adminOnly(c, next) {
  const user = c.get("user");
  if (user.role !== "super_admin" && user.role !== "admin") return c.json({ error: "需要管理员权限" }, 403);
  await next();
}

// ============================================================
// 日志工具
// ============================================================
async function addLog(env, user, action, detail) {
  const logs = await getKV(env, "logs", []);
  logs.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    user: user.name || user.username,
    role: user.role,
    action,
    detail
  });
  if (logs.length > 500) logs.length = 500;
  await setKV(env, "logs", logs);
}

// ============================================================
// 日期工具
// ============================================================
function getDateStr(d) {
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,"0")}-${d.getDate().toString().padStart(2,"0")}`;
}
function getWeekday(d) {
  const day = d.getDay();
  return day === 0 ? 7 : day;
}
function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

// ============================================================
// 判断某天是否需要扣分
// ============================================================
function isDeductionDay(dateStr, calendar) {
  const d = new Date(dateStr + "T12:00:00");
  const wd = getWeekday(d);
  if (calendar.excludedWeekdays.includes(wd) && !calendar.customInclusions.includes(dateStr)) return false;
  if (calendar.customExclusions.includes(dateStr)) return false;
  for (const p of calendar.periods) {
    const y = d.getFullYear();
    const s = new Date(p.skipYearBoundary ? `${y-1}-${p.start}T12:00:00` : `${y}-${p.start}T12:00:00`);
    const e = new Date(`${y}-${p.end}T12:00:00`);
    if (p.skipYearBoundary && d.getMonth() + 1 < 6) {
      const s2 = new Date(`${y-1}-${p.start}T12:00:00`);
      const e2 = new Date(`${y}-${p.end}T12:00:00`);
      if (d >= s2 && d <= e2) return false;
    } else {
      if (d >= s && d <= e) return false;
    }
  }
  return true;
}

// ============================================================
// API - 登录
// ============================================================
app.post("/api/login", async (c) => {
  await ensureInitialized(c.env);
  const { password } = await c.req.json();
  if (!password) return c.json({ error: "请输入密码" }, 400);
  const users = await getKV(c.env, "users", {});
  const hashed = await hashPassword(password);
  let matchedUser = null, matchedUsername = null;
  for (const [uname, udata] of Object.entries(users)) {
    if (udata.password === hashed) { matchedUser = udata; matchedUsername = uname; break; }
  }
  if (!matchedUser) return c.json({ error: "密码错误" }, 401);
  const token = generateToken();
  const tokens = await getKV(c.env, "tokens", {});
  tokens[token] = { username: matchedUsername, role: matchedUser.role, name: matchedUser.name || matchedUsername, loginTime: Date.now() };
  await setKV(c.env, "tokens", tokens);
  await addLog(c.env, matchedUser, "登录系统", "成功登录");
  return c.json({ token, user: { username: matchedUsername, role: matchedUser.role, name: matchedUser.name || matchedUsername } });
});

// ============================================================
// API - 获取当前用户信息
// ============================================================
app.get("/api/me", authMiddleware, async (c) => {
  return c.json({ user: c.get("user") });
});

// ============================================================
// API - 退出登录
// ============================================================
app.post("/api/logout", authMiddleware, async (c) => {
  const token = (c.req.header("Authorization") || "").replace("Bearer ", "");
  const tokens = await getKV(c.env, "tokens", {});
  delete tokens[token];
  await setKV(c.env, "tokens", tokens);
  return c.json({ ok: true });
});

// ============================================================
// API - 获取学生列表
// ============================================================
app.get("/api/students", async (c) => {
  const students = await getKV(c.env, "students", DEFAULT_STUDENTS);
  return c.json({ students });
});

// ============================================================
// API - 新增学生（超级管理员专属）
// ============================================================
app.post("/api/students", authMiddleware, superAdminOnly, async (c) => {
  const { name } = await c.req.json();
  if (!name || name.trim() === "") return c.json({ error: "请输入姓名" }, 400);
  const students = await getKV(c.env, "students", []);
  if (students.includes(name.trim())) return c.json({ error: "该学生已存在" }, 400);
  students.push(name.trim());
  await setKV(c.env, "students", students);
  const scores = await getKV(c.env, "scores", {});
  scores[name.trim()] = 15;
  await setKV(c.env, "scores", scores);
  await addLog(c.env, c.get("user"), "新增学生", `新增学生：${name.trim()}`);
  return c.json({ students, ok: true });
});

// ============================================================
// API - 删除学生（超级管理员专属）
// ============================================================
app.delete("/api/students/:name", authMiddleware, superAdminOnly, async (c) => {
  const name = decodeURIComponent(c.req.param("name"));
  const students = await getKV(c.env, "students", []);
  if (!students.includes(name)) return c.json({ error: "学生不存在" }, 404);
  const newList = students.filter(s => s !== name);
  await setKV(c.env, "students", newList);
  const scores = await getKV(c.env, "scores", {});
  delete scores[name];
  await setKV(c.env, "scores", scores);
  await addLog(c.env, c.get("user"), "删除学生", `删除学生：${name}`);
  return c.json({ students: newList, ok: true });
});

// ============================================================
// API - 获取积分
// ============================================================
app.get("/api/scores", async (c) => {
  const scores = await getKV(c.env, "scores", {});
  const students = await getKV(c.env, "students", []);
  return c.json({ scores, students });
});

// ============================================================
// API - 调整积分（管理员）
// ============================================================
app.post("/api/scores/adjust", authMiddleware, adminOnly, async (c) => {
  const { names, value, reason, rule } = await c.req.json();
  if (!names || names.length === 0) return c.json({ error: "请选择学生" }, 400);
  const scores = await getKV(c.env, "scores", {});
  const studentsList = await getKV(c.env, "students", []);
  const val = parseInt(value);
  const success = [];
  names.forEach(n => {
    if (studentsList.includes(n)) {
      scores[n] = (scores[n] || 15) + val;
      success.push(n);
    }
  });
  await setKV(c.env, "scores", scores);
  await addLog(c.env, c.get("user"), "积分调整",
    `${reason || rule || "手动调整"}：${success.join("、")}，分值：${val > 0 ? "+" : ""}${val}`);
  return c.json({ scores, success, ok: true });
});

// ============================================================
// API - 重置全员积分（超级管理员）
// ============================================================
app.post("/api/scores/reset", authMiddleware, superAdminOnly, async (c) => {
  const { code } = await c.req.json();
  if (code !== "25.1") return c.json({ error: "验证码错误" }, 400);
  const students = await getKV(c.env, "students", []);
  const scores = {};
  students.forEach(s => scores[s] = 15);
  await setKV(c.env, "scores", scores);
  await addLog(c.env, c.get("user"), "赛季重置", "全员积分复位为15分");
  return c.json({ scores, ok: true });
});

// ============================================================
// API - 获取操作日志
// ============================================================
app.get("/api/logs", async (c) => {
  const logs = await getKV(c.env, "logs", []);
  return c.json({ logs });
});


// ============================================================
// API - 获取惩罚数据（公开）
// ============================================================
app.get("/api/punish", async (c) => {
  const punishData = await getKV(c.env, "punishData", { punishRecords: {}, maxDoneLevel: {} });
  return c.json(punishData);
});

// ============================================================
// API - 确认手机收纳（管理员）
// ============================================================
app.post("/api/punish/confirm", authMiddleware, adminOnly, async (c) => {
  const { names } = await c.req.json();
  if (!names || names.length === 0) return c.json({ error: "请选择学生" }, 400);
  const punishData = await getKV(c.env, "punishData", { punishRecords: {}, maxDoneLevel: {} });
  const scores = await getKV(c.env, "scores", {});
  names.forEach(name => {
    const s = scores[name] || 15;
    let lv = s <= -15 ? 15 : s <= -10 ? 10 : s <= -5 ? 5 : 0;
    if (lv > 0) {
      punishData.punishRecords[name + "_" + lv] = true;
      punishData.maxDoneLevel[name] = Math.max(punishData.maxDoneLevel[name] || 0, lv);
    }
  });
  await setKV(c.env, "punishData", punishData);
  await addLog(c.env, c.get("user"), "手机收纳确认", "确认了 " + names.join("、") + " 的手机收纳");
  return c.json({ ok: true, punishData });
});

// ============================================================
// API - 重置惩罚状态（管理员）
// ============================================================
app.post("/api/punish/reset", authMiddleware, adminOnly, async (c) => {
  await setKV(c.env, "punishData", { punishRecords: {}, maxDoneLevel: {} });
  await addLog(c.env, c.get("user"), "重置惩罚状态", "清除了所有手机收纳记录");
  return c.json({ ok: true });
});

// ============================================================
// API - 获取日历配置
// ============================================================
app.get("/api/calendar", async (c) => {
  const calendar = await getKV(c.env, "calendar", DEFAULT_CALENDAR);
  return c.json({ calendar });
});

// ============================================================
// API - 更新日历配置（管理员）
// ============================================================
app.post("/api/calendar", authMiddleware, adminOnly, async (c) => {
  const data = await c.req.json();
  await setKV(c.env, "calendar", data);
  await addLog(c.env, c.get("user"), "修改日历", "修改了自动扣分日历配置");
  return c.json({ ok: true });
});

// ============================================================
// API - 获取当天扣分状态
// ============================================================
app.get("/api/deductions/today", async (c) => {
  const today = getDateStr(new Date());
  const todayDeductions = await getKV(c.env, "todayDeductions", {});
  const deductions = todayDeductions[today] || { noon: false, evening: false };
  return c.json({ date: today, deductions });
});

// ============================================================
// API - 获取今日扣分日历视图（近30天）
// ============================================================
app.get("/api/deductions/calendar-view", async (c) => {
  const calendar = await getKV(c.env, "calendar", DEFAULT_CALENDAR);
  const now = new Date();
  const days = [];
  for (let i = -3; i < 60; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const ds = getDateStr(d);
    const wd = getWeekday(d);
    const isDeduction = isDeductionDay(ds, calendar);
    const isExcluded = !isDeduction && (!calendar.excludedWeekdays.includes(wd) && checkPeriodExclusion(ds, calendar) === null);
    days.push({
      date: ds,
      weekday: wd,
      isDeduction,
      label: wd >= 6 ? "周末" : (isDeduction ? "" : (checkPeriodExclusion(ds, calendar) || "休息"))
    });
  }
  return c.json({ days });
});

function checkPeriodExclusion(dateStr, calendar) {
  const d = new Date(dateStr + "T12:00:00");
  for (const p of calendar.periods) {
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

// ============================================================
// API - 获取手机扣分豁免名单
// ============================================================
app.get("/api/phone-opt-out", async (c) => {
  const today = getDateStr(new Date());
  const phoneOptOuts = await getKV(c.env, "phoneOptOuts", {});
  const todayData = phoneOptOuts[today] || { noon: [], evening: [] };
  return c.json({ date: today, optOuts: todayData });
});

// ============================================================
// API - 设置手机扣分豁免（管理员）
// ============================================================
app.post("/api/phone-opt-out", authMiddleware, adminOnly, async (c) => {
  const { date, slot, names } = await c.req.json();
  if (!["noon", "evening"].includes(slot)) return c.json({ error: "无效时段" }, 400);
  const targetDate = date || getDateStr(new Date());
  // 检查是否已过扣分时间
  // 中午12点前可修改中午的，下午4:45前可修改下午的
  const now = new Date();
  if (targetDate === getDateStr(now)) {
    const hour = now.getHours(), min = now.getMinutes();
    if (slot === "noon" && (hour > 12 || (hour === 12 && min > 0))) {
      return c.json({ error: "已过中午12点，不可修改" }, 400);
    }
    if (slot === "evening" && (hour > 16 || (hour === 16 && min > 45))) {
      return c.json({ error: "已过下午16:45，不可修改" }, 400);
    }
  }
  const phoneOptOuts = await getKV(c.env, "phoneOptOuts", {});
  if (!phoneOptOuts[targetDate]) phoneOptOuts[targetDate] = { noon: [], evening: [] };
  phoneOptOuts[targetDate][slot] = names || [];
  await setKV(c.env, "phoneOptOuts", phoneOptOuts);
  const slotName = slot === "noon" ? "中午" : "晚上";
  const listStr = (names || []).join("、") || "无";
  await addLog(c.env, c.get("user"), "手机豁免", `设置${targetDate}${slotName}不玩手机名单：${listStr}`);
  return c.json({ ok: true });
});

// ============================================================
// API - 获取所有管理员
// ============================================================
app.get("/api/admins", authMiddleware, superAdminOnly, async (c) => {
  const users = await getKV(c.env, "users", {});
  const admins = Object.entries(users)
    .filter(([_, u]) => u.role === "admin")
    .map(([username, u]) => ({ username, name: u.name }));
  return c.json({ admins });
});

// ============================================================
// API - 新增管理员（超级管理员专属）
// ============================================================
app.post("/api/admins", authMiddleware, superAdminOnly, async (c) => {
  const { username, password, name } = await c.req.json();
  if (!username || !password) return c.json({ error: "请输入用户名和密码" }, 400);
  const users = await getKV(c.env, "users", {});
  if (users[username]) return c.json({ error: "用户已存在" }, 400);
  const hashed = await hashPassword(password);
  users[username] = { password: hashed, role: "admin", name: name || username };
  await setKV(c.env, "users", users);
  await addLog(c.env, c.get("user"), "新增管理员", `新增管理员：${username} (${name || username})`);
  return c.json({ ok: true });
});

// ============================================================
// API - 删除管理员（超级管理员专属）
// ============================================================
app.delete("/api/admins/:username", authMiddleware, superAdminOnly, async (c) => {
  const username = c.req.param("username");
  const users = await getKV(c.env, "users", {});
  if (!users[username] || users[username].role !== "admin") return c.json({ error: "管理员不存在" }, 404);
  delete users[username];
  await setKV(c.env, "users", users);
  await addLog(c.env, c.get("user"), "删除管理员", `删除管理员：${username}`);
  return c.json({ ok: true });
});

// ============================================================
// API - 修改管理员密码（超级管理员专属）
// ============================================================
app.post("/api/admins/password", authMiddleware, superAdminOnly, async (c) => {
  const { username, newPassword } = await c.req.json();
  if (!username || !newPassword) return c.json({ error: "参数不完整" }, 400);
  const users = await getKV(c.env, "users", {});
  if (!users[username]) return c.json({ error: "用户不存在" }, 404);
  const hashed = await hashPassword(newPassword);
  users[username].password = hashed;
  await setKV(c.env, "users", users);
  await addLog(c.env, c.get("user"), "修改密码", `修改了用户 ${username} 的密码`);
  return c.json({ ok: true });
});

// ============================================================
// API - 修改自己的密码（管理员）
// ============================================================
app.post("/api/change-password", authMiddleware, adminOnly, async (c) => {
  const { oldPassword, newPassword } = await c.req.json();
  const user = c.get("user");
  const users = await getKV(c.env, "users", {});
  const userData = users[user.username];
  const hashedOld = await hashPassword(oldPassword);
  if (hashedOld !== userData.password) return c.json({ error: "原密码错误" }, 400);
  userData.password = await hashPassword(newPassword);
  await setKV(c.env, "users", users);
  await addLog(c.env, user, "修改密码", "修改了自己的密码");
  return c.json({ ok: true });
});

// ============================================================
// API - 删除操作日志（超级管理员专属）
// ============================================================
app.delete("/api/logs", authMiddleware, superAdminOnly, async (c) => {
  await setKV(c.env, "logs", []);
  await addLog(c.env, c.get("user"), "清空日志", "清空了所有操作日志");
  return c.json({ ok: true });
});

// ============================================================
// Cron 触发器 - 自动扣分
// ============================================================
async function handleScheduled(event, env, ctx) {
  try { await ensureInitialized(env); } catch(e) { return; }
  const now = new Date();
  const today = getDateStr(now);
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const slot = (currentHour === 12 && currentMin < 1) ? "noon" : 
               (currentHour === 16 && currentMin < 46) ? "evening" : null;
  if (!slot) return;
  const calendar = await getKV(env, "calendar", DEFAULT_CALENDAR);
  if (!isDeductionDay(today, calendar)) return;
  const phoneOptOuts = await getKV(env, "phoneOptOuts", {});
  const todayOptOuts = phoneOptOuts[today] || { noon: [], evening: [] };
  const exempted = todayOptOuts[slot] || [];
  const students = await getKV(env, "students", []);
  const scores = await getKV(env, "scores", {});
  const todayDeductions = await getKV(env, "todayDeductions", {});
  if (!todayDeductions[today]) todayDeductions[today] = { noon: false, evening: false };
  if (todayDeductions[today][slot]) return; // 已扣过
  const deducted = [];
  students.forEach(name => {
    if (!exempted.includes(name)) {
      scores[name] = (scores[name] || 15) - 1;
      deducted.push(name);
    }
  });
  todayDeductions[today][slot] = true;
  await setKV(env, "scores", scores);
  await setKV(env, "todayDeductions", todayDeductions);
  const slotName = slot === "noon" ? "中午12:00" : "下午16:45";
  const logs = await getKV(env, "logs", []);
  logs.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: now.toISOString(),
    user: "【系统自动】",
    role: "system",
    action: "自动扣分",
    detail: `${today} ${slotName} 全员扣1分（兑换手机使用权），豁免人数：${exempted.length}，扣分人数：${deducted.length}`
  });
  if (logs.length > 500) logs.length = 500;
  await setKV(env, "logs", logs);
}

// ============================================================
// Worker 入口
// ============================================================
export default {
  async fetch(request, env, ctx) {
    try { await ensureInitialized(env); } catch(e) { console.error('init error:', e); }
    try { return await app.fetch(request, env, ctx); } catch(e) { return new Response(JSON.stringify({error:e.message}), {status:500,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}}); }
  },
  async scheduled(event, env, ctx) {
    await handleScheduled(event, env, ctx);
  }
};


