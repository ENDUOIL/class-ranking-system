// ============================================================
// 25.1班操行排位赛 - 本地服务器
// 双击 start.bat 即可运行
// ============================================================
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = 3000;
const PUBLIC = path.join(__dirname, "public");
const DATA_FILE = path.join(__dirname, "data.json");

function hp(p) { return crypto.createHash("sha256").update(p).digest("hex"); }

var DS = ["\u5305\u987a\u901a", "\u90d1\u6e05\u98a2", "\u90b9\u4ec1\u6cfd", "\u79e6\u97f5\u8d3a", "\u8d75\u5dcd\u9716", "\u738b\u6668\u65ed", "\u5f20\u5e7f\u6d9b", "\u7a0b\u6cd3\u535a", "\u59dc\u4e59\u4e30", "\u5510\u4f73\u5947", "\u8d75\u6893\u6e24", "\u5434\u4fca\u9716", "\u738b\u8bd1\u5e7f"];

function gd() {
  var sc = {}; DS.forEach(function(n){ sc[n]=15; });
  return {
    students: DS, scores: sc,
    users: { super: { password: "4779bda25d3be481c5b2697878d343e1120f3b4fb96e9fc2cc2746afdbd2a4cb", role: "super_admin", name: "\u8d85\u7ea7\u7ba1\u7406\u5458" }, admin: { password: "c75d3f1f5bcd6914d0331ce5ec17c0db8f2070a2d4285f8e3ff11c6ca19168ff", role: "admin", name: "\u7ba1\u7406\u5458" } },
    logs: [], calendar: { excludedWeekdays:[5,6,7], periods:[{start:"12-28",end:"03-03",label:"\u5bd2\u5047",skipYearBoundary:true},{start:"07-05",end:"09-03",label:"\u66ae\u5047",skipYearBoundary:false}], customExclusions:[], customInclusions:[] },
    phoneOptOuts: {}, todayDeductions: {}, punishData: { punishRecords:{}, maxDoneLevel:{} }, tokens: {}
  };
}

function ld() { try { return JSON.parse(fs.readFileSync(DATA_FILE,"utf-8")); } catch(e) { var d=gd(); sd(d); return d; } }
function sd(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d,null,2), "utf-8"); }

var MIME = { ".html":"text/html;charset=utf-8", ".css":"text/css;charset=utf-8", ".js":"application/javascript;charset=utf-8", ".json":"application/json;charset=utf-8" };

function sf(res, fp) {
  var ext = path.extname(fp);
  fs.readFile(fp, function(err, data) {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[ext]||"application/octet-stream" });
    res.end(data);
  });
}

function jr(res, data, st) { res.writeHead(st||200, {"Content-Type":"application/json;charset=utf-8","Access-Control-Allow-Origin":"*"}); res.end(JSON.stringify(data)); }
function er(res, msg, st) { jr(res, {error:msg}, st||400); }

function al(d, u, ac, dt) {
  d.logs.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),timestamp:new Date().toISOString(),user:(u?u.name||u.username||"\u7ba1\u7406\u5458":"\u7ba1\u7406\u5458"),role:(u?u.role:"admin"),action:ac,detail:dt});
  if (d.logs.length>500) d.logs.length=500;
}

function pb(r) { return new Promise(function(rs) { var c=[]; r.on("data",function(x){c.push(x);}); r.on("end",function(){try{rs(JSON.parse(Buffer.concat(c).toString()));}catch(e){rs({});}}); }); }

function gd2(d) { return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }

var sv = http.createServer(async function(req, res) {
  var url = req.url.split("?")[0];
  var m = req.method;

  if (url.indexOf("/api/") === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (m === "OPTIONS") { res.writeHead(204); return res.end(); }
  }

  if (url.indexOf("/api/") !== 0) {
    if (url === "/" || url === "/standalone.html") url = "/index.html";
    if (url.indexOf(".html") >= 0) {
      var d2 = ld();
      var initScript = "<script>window.__INIT__=" + JSON.stringify({students:d2.students,scores:d2.scores,punishData:d2.punishData,phoneOptOuts:d2.phoneOptOuts,todayDeductions:d2.todayDeductions,logs:d2.logs,calendar:d2.calendar}) + ";<\/script>";
      var html = fs.readFileSync(path.join(PUBLIC, url), "utf-8");
      // SSR: render rankings and student grid directly in HTML
      var srStu = d2.students || [];
      var srSco = d2.scores || {};
      var srSorted = srStu.map(function(n){return {name:n,score:srSco[n]||15};}).sort(function(a,b){return b.score-a.score;});
      var srRankHtml = srSorted.map(function(s,i){return '<div class="rank-item"><span class="rank-num">'+(i+1)+'</span><span class="rank-name">'+s.name+'</span><span class="rank-score">'+s.score+'\u5206</span></div>';}).join("");
      var srGridHtml = srStu.map(function(n){return '<div class="stu-item"><span class="score-val">'+(srSco[n]||15)+'</span><span class="name-val">'+n+'</span></div>';}).join("");
      html = html.replace('<div id="rankList" class="rank-list"></div>', '<div id="rankList" class="rank-list">'+srRankHtml+'</div>');
      html = html.replace('<div id="stuGrid" class="stu-grid"></div>', '<div id="stuGrid" class="stu-grid">'+srGridHtml+'</div>');
      html = html.replace("<script src=", initScript + "<script src=");
      res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"});
      return res.end(html);
    }
    return sf(res, path.join(PUBLIC, url));
  }

  var data = ld();
  var body = m === "POST" ? await pb(req) : {};
  var now = new Date();
  var today = gd2(now);
  var user = null;
  var auth = req.headers["authorization"] || "";
  var token = auth.replace("Bearer ", "");
  if (token && data.tokens[token]) user = data.tokens[token];
  function isAdmin() { return user&&(user.role==="super_admin"||user.role==="admin"); }
  function isSuper() { return user&&user.role==="super_admin"; }
  function al2(ac,dt) { al(data,user,ac,dt); sd(data); }

  try {
    if (url==="/api/login") {
      var hp2 = hp(body.password||"");
      for (var un in data.users) {
        if (data.users[un].password===hp2) {
          var tok = crypto.randomUUID();
          data.tokens[tok] = {username:un,role:data.users[un].role,name:data.users[un].name||un,loginTime:Date.now()};
          al2("\u767b\u5f55\u7cfb\u7edf","\u6210\u529f\u767b\u5f55");
          return jr(res,{token:tok,user:{username:un,role:data.users[un].role,name:data.users[un].name||un}});
        }
      }
      return er(res,"\u5bc6\u7801\u9519\u8bef",401);
    }

    if (url==="/api/me") return jr(res,{user:user});
    if (url==="/api/logout") { if(token&&data.tokens[token])delete data.tokens[token]; sd(data); return jr(res,{ok:true}); }
    if (url==="/api/scores") return jr(res,{scores:data.scores,students:data.students});

    if (url==="/api/scores/adjust") {
      if(!isAdmin()) return er(res,"\u9700\u8981\u7ba1\u7406\u5458\u6743\u9650",403);
      var nn=(body.names||[]); var vv=parseInt(body.value);
      if(!nn.length) return er(res,"\u8bf7\u9009\u62e9\u5b66\u751f");
      nn.forEach(function(x){data.scores[x]=(data.scores[x]||15)+vv;});
      al2("\u79ef\u5206\u8c03\u6574",(body.reason||body.rule||"\u624b\u52a8\u8c03\u6574")+"\uff1a"+nn.join("\u3001")+"\uff0c\u5206\u503c\uff1a"+(vv>0?"+":"")+vv);
      return jr(res,{scores:data.scores,success:nn,ok:true});
    }

    if (url==="/api/scores/reset") {
      if(!isSuper()) return er(res,"\u9700\u8981\u8d85\u7ea7\u7ba1\u7406\u5458\u6743\u9650",403);
      if(body.code!=="25.1") return er(res,"\u9a8c\u8bc1\u7801\u9519\u8bef");
      data.scores={}; data.students.forEach(function(s){data.scores[s]=15;});
      al2("\u8d5b\u5b63\u91cd\u7f6e","\u5168\u5458\u79ef\u5206\u590d\u4f4d\u4e3a15\u5206");
      return jr(res,{scores:data.scores,ok:true});
    }

    if (url==="/api/punish") return jr(res,data.punishData);

    if (url==="/api/punish/confirm") {
      if(!isAdmin()) return er(res,"\u9700\u8981\u7ba1\u7406\u5458\u6743\u9650",403);
      (body.names||[]).forEach(function(n){var s=data.scores[n]||15;var lv=s<=-15?15:(s<=-10?10:(s<=-5?5:0));if(lv>0){data.punishData.punishRecords[n+"_"+lv]=true;data.punishData.maxDoneLevel[n]=Math.max(data.punishData.maxDoneLevel[n]||0,lv);}});
      al2("\u624b\u673a\u7eb3\u6536\u786e\u8ba4","\u786e\u8ba4\u4e86 "+(body.names||[]).join("\u3001")+" \u7684\u624b\u673a\u7eb3\u6536");
      return jr(res,{ok:true,punishData:data.punishData});
    }
    if (url==="/api/punish/reset") { if(!isAdmin())return er(res,"\u9700\u8981\u7ba1\u7406\u5458\u6743\u9650",403); data.punishData={punishRecords:{},maxDoneLevel:{}}; al2("\u91cd\u7f6e\u60e9\u7f5a\u72b6\u6001","\u6e05\u9664\u4e86\u6240\u6709\u624b\u673a\u7eb3\u6536\u8bb0\u5f55"); return jr(res,{ok:true}); }

    if (url==="/api/calendar") {
      if(m==="GET")return jr(res,{calendar:data.calendar});
      if(!isAdmin())return er(res,"\u9700\u8981\u7ba1\u7406\u5458\u6743\u9650",403);
      data.calendar=body; al2("\u4fee\u6539\u65e5\u5386","\u4fee\u6539\u4e86\u81ea\u52a8\u6263\u5206\u65e5\u5386\u914d\u7f6e"); return jr(res,{ok:true});
    }

    if (url==="/api/deductions/today") return jr(res,{date:today,deductions:data.todayDeductions[today]||{noon:false,evening:false}});

    if (url==="/api/phone-opt-out") {
      if(m==="GET")return jr(res,{date:today,optOuts:data.phoneOptOuts[today]||{noon:[],evening:[]}});
      if(!isAdmin())return er(res,"\u9700\u8981\u7ba1\u7406\u5458\u6743\u9650",403);
      var dt=body.date||today; if(!data.phoneOptOuts[dt])data.phoneOptOuts[dt]={noon:[],evening:[]};
      data.phoneOptOuts[dt][body.slot]=body.names||[]; sd(data); return jr(res,{ok:true});
    }

    if (url==="/api/logs") {
      if(m==="DELETE"){if(!isSuper())return er(res,"\u9700\u8981\u8d85\u7ea7\u7ba1\u7406\u5458\u6743\u9650",403);data.logs=[];al2("\u6e05\u7a7a\u65e5\u5fd7","\u6e05\u7a7a\u4e86\u6240\u6709\u64cd\u4f5c\u65e5\u5fd7");return jr(res,{ok:true});}
      return jr(res,{logs:data.logs});
    }

    if (url==="/api/admins") {
      if(!isSuper())return er(res,"\u9700\u8981\u8d85\u7ea7\u7ba1\u7406\u5458\u6743\u9650",403);
      if(m==="GET"){var aa=[];for(var ux in data.users){if(data.users[ux].role==="admin")aa.push({username:ux,name:data.users[ux].name});}return jr(res,{admins:aa});}
      if(m==="POST"){if(data.users[body.username])return er(res,"\u7528\u6237\u5df2\u5b58\u5728");data.users[body.username]={password:hp(body.password||""),role:"admin",name:body.name||body.username};al2("\u65b0\u589e\u7ba1\u7406\u5458","\u65b0\u589e\u7ba1\u7406\u5458"+body.username);return jr(res,{ok:true});}
    }

    var m2=null;
    if(m==="DELETE"&&(m2=url.match(/^\/api\/admins\/(.+)$/))){
      if(!isSuper())return er(res,"\u9700\u8981\u8d85\u7ea7\u7ba1\u7406\u5458\u6743\u9650",403);
      var ux2=decodeURIComponent(m2[1]);if(!data.users[ux2]||data.users[ux2].role!=="admin")return er(res,"\u7ba1\u7406\u5458\u4e0d\u5b58\u5728");delete data.users[ux2];return jr(res,{ok:true});
    }

    if (url==="/api/admins/password") {
      if(!isSuper())return er(res,"\u9700\u8981\u8d85\u7ea7\u7ba1\u7406\u5458\u6743\u9650",403);
      if(!data.users[body.username])return er(res,"\u7528\u6237\u4e0d\u5b58\u5728");
      data.users[body.username].password=hp(body.newPassword||""); return jr(res,{ok:true});
    }

    if (url==="/api/students") {
      if(m==="POST"){if(!isSuper())return er(res,"\u9700\u8981\u8d85\u7ea7\u7ba1\u7406\u5458\u6743\u9650",403);var n3=(body.name||"").trim();if(!n3)return er(res,"\u8bf7\u8f93\u5165\u59d3\u540d");if(data.students.indexOf(n3)>=0)return er(res,"\u8be5\u5b66\u751f\u5df2\u5b58\u5728");data.students.push(n3);data.scores[n3]=15;al2("\u65b0\u589e\u5b66\u751f","\u65b0\u589e\u5b66\u751f"+n3);return jr(res,{students:data.students,ok:true});}
    }

    if(m==="DELETE"&&(m2=url.match(/^\/api\/students\/(.+)$/))){
      if(!isSuper())return er(res,"\u9700\u8981\u8d85\u7ea7\u7ba1\u7406\u5458\u6743\u9650",403);
      var n4=decodeURIComponent(m2[1]);var idx=data.students.indexOf(n4);if(idx<0)return er(res,"\u5b66\u751f\u4e0d\u5b58\u5728");data.students.splice(idx,1);delete data.scores[n4];return jr(res,{students:data.students,ok:true});
    }

    if(url==="/api/init") return jr(res,{students:data.students,scores:data.scores,punishData:data.punishData,phoneOptOuts:data.phoneOptOuts,todayDeductions:data.todayDeductions,logs:data.logs,calendar:data.calendar});
    return er(res,"Unknown: "+url,404);
  } catch(e) { return er(res, e.message, 500); }
  finally { sd(data); }
});

sv.listen(PORT, function() {
  console.log("");
  console.log("  ===================================");
  console.log("   25.1\u73ed\u64cd\u884c\u6392\u4f4d\u8d5b \u5df2\u542f\u52a8");
  console.log("   \u6253\u5f00\u6d4f\u89c8\u5668\u8bbf\u95ee:");
  console.log("   http://localhost:" + PORT);
  console.log("  ===================================");
  console.log("");
  console.log("   \u8d85\u7ea7\u7ba1\u7406\u5458\u5bc6\u7801: yangjian1");
  console.log("   \u7ba1\u7406\u5458\u5bc6\u7801: 251");
  console.log("");
});
