const express = require('express');
const router  = express.Router();
const { getConfig, saveConfig, getStats, getAllUsers, getEvents, getUser } = require('../database');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'apostadez2026';

function auth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, error: 'nao autorizado' });
  next();
}

router.get('/panel', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(buildPanel(req.query.token || ''));
});

router.get('/config', auth, (_req, res) => res.json({ ok: true, config: getConfig() }));

router.post('/config', auth, (req, res) => {
  const allowed = ['active','windowStart','windowEnd','points','spinCost','spinValue','frequency','expiryDays','defaultTz','useUserTz'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (['active','useUserTz'].includes(key)) updates[key] = req.body[key] === true || req.body[key] === 'true';
      else if (['points','spinCost','expiryDays'].includes(key)) updates[key] = parseInt(req.body[key], 10);
      else if (key === 'spinValue') updates[key] = parseFloat(req.body[key]);
      else updates[key] = req.body[key];
    }
  }
  const config = saveConfig(updates);
  console.log('[ADMIN] Config atualizada:', updates);
  res.json({ ok: true, config });
});

router.get('/stats', auth, (_req, res) => res.json({ ok: true, stats: getStats(), config: getConfig() }));
router.get('/users', auth, (_req, res) => res.json({ ok: true, users: getAllUsers() }));
router.get('/users/:userId', auth, (req, res) => {
  const user = getUser(req.params.userId);
  if (!user) return res.status(404).json({ ok: false, error: 'nao encontrado' });
  res.json({ ok: true, user });
});
router.get('/events', auth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit)||100, 500);
  res.json({ ok: true, events: getEvents(limit) });
});

function buildPanel(token) {
  const show = token ? 'flex' : 'none';
  const hide = token ? 'none' : 'flex';

  return '<!DOCTYPE html>' +
  '<html lang="pt-BR"><head>' +
  '<meta charset="UTF-8"/>' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
  '<title>ApostaDez Admin</title>' +
  '<style>' +
  '*{box-sizing:border-box;margin:0;padding:0}' +
  'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f1117;color:#e2e8f0;min-height:100vh}' +
  '.sidebar{position:fixed;left:0;top:0;bottom:0;width:220px;background:#161b2e;border-right:1px solid #2d3348;padding:1.5rem 1rem;display:flex;flex-direction:column;gap:4px}' +
  '.logo{font-size:16px;font-weight:600;margin-bottom:1.5rem;padding:0 8px;color:#a5b4fc}' +
  '.nav-btn{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;font-size:14px;cursor:pointer;border:none;background:none;color:#94a3b8;width:100%;text-align:left;transition:all .15s}' +
  '.nav-btn:hover{background:#1e2130;color:#e2e8f0}' +
  '.nav-btn.active{background:#312e81;color:#a5b4fc;font-weight:500}' +
  '.main{margin-left:220px;padding:2rem}' +
  '.page{display:none}.page.active{display:block}' +
  'h2{font-size:20px;font-weight:600;margin-bottom:4px}' +
  '.sub{font-size:13px;color:#64748b;margin-bottom:1.5rem}' +
  '.card{background:#1e2130;border:1px solid #2d3348;border-radius:12px;padding:1.25rem;margin-bottom:1rem}' +
  '.card-title{font-size:12px;font-weight:600;color:#64748b;letter-spacing:.06em;text-transform:uppercase;margin-bottom:1rem}' +
  '.metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:1rem}' +
  '.metric{background:#0f1117;border-radius:10px;padding:14px;text-align:center;border:1px solid #2d3348}' +
  '.metric-val{font-size:26px;font-weight:600;color:#818cf8}' +
  '.metric-label{font-size:11px;color:#64748b;margin-top:3px}' +
  '.cfg-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid #2d3348;gap:12px}' +
  '.cfg-row:last-child{border-bottom:none}' +
  '.cfg-label{font-size:14px;flex:1}.cfg-sub{font-size:12px;color:#64748b;margin-top:2px}' +
  'input[type=time],input[type=number],input[type=text],select{background:#0f1117;border:1px solid #2d3348;border-radius:8px;padding:6px 10px;font-size:13px;color:#e2e8f0;width:130px;text-align:right}' +
  'select{text-align:left;width:160px}' +
  'input:focus,select:focus{outline:none;border-color:#6366f1}' +
  '.toggle{position:relative;display:inline-block;width:36px;height:20px}' +
  '.toggle input{opacity:0;width:0;height:0}' +
  '.tsl{position:absolute;cursor:pointer;inset:0;background:#374151;border-radius:20px;transition:.2s}' +
  '.tsl:before{content:"";position:absolute;width:14px;height:14px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}' +
  'input:checked+.tsl{background:#6366f1}' +
  'input:checked+.tsl:before{transform:translateX(16px)}' +
  '.btn{background:#6366f1;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:500;cursor:pointer;transition:background .2s}' +
  '.btn:hover{background:#4f46e5}.btn-full{width:100%;margin-top:12px}' +
  '.alert{border-radius:8px;padding:10px 14px;font-size:13px;margin-top:10px;display:none}' +
  '.alert-ok{background:#064e3b;color:#6ee7b7;border:1px solid #065f46}' +
  '.alert-err{background:#450a0a;color:#fca5a5;border:1px solid #7f1d1d}' +
  '.preview{background:#0f1117;border-radius:8px;padding:10px 14px;margin-top:12px;font-size:13px;color:#94a3b8}' +
  '.preview strong{color:#6ee7b7}' +
  'table{width:100%;border-collapse:collapse;font-size:13px}' +
  'th{font-size:11px;font-weight:500;color:#64748b;letter-spacing:.05em;padding:8px 12px;border-bottom:1px solid #2d3348;text-align:left}' +
  'td{padding:10px 12px;border-bottom:1px solid #1e2130;vertical-align:top}' +
  'tr:hover td{background:#1e2130}' +
  '.pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}' +
  '.pill-g{background:#064e3b;color:#6ee7b7}.pill-a{background:#451a03;color:#fed7aa}.pill-b{background:#1e3a5f;color:#93c5fd}.pill-r{background:#450a0a;color:#fca5a5}' +
  '.search{background:#0f1117;border:1px solid #2d3348;border-radius:8px;padding:8px 12px;font-size:13px;color:#e2e8f0;width:100%;margin-bottom:12px}' +
  '.search:focus{outline:none;border-color:#6366f1}' +
  '.login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh}' +
  '.login-card{background:#1e2130;border:1px solid #2d3348;border-radius:12px;padding:2rem;width:320px}' +
  '.login-card h2{margin-bottom:1rem}' +
  '.login-card input{width:100%;margin-bottom:12px;text-align:left}' +
  '#login-err{color:#fca5a5;font-size:13px;margin-top:8px;display:none}' +
  '.bonus-date{font-size:11px;color:#64748b;background:#0f1117;padding:1px 6px;border-radius:4px;display:inline-block;margin:2px}' +
  '.empty{text-align:center;padding:2rem;color:#475569;font-size:13px}' +
  '</style></head><body>' +

  '<div id="login-wrap" class="login-wrap" style="display:' + hide + '">' +
  '<div class="login-card">' +
  '<h2>ApostaDez Admin</h2>' +
  '<p style="font-size:13px;color:#64748b;margin-bottom:1rem">Painel de controle da gamificacao</p>' +
  '<input type="password" id="pwd" placeholder="Senha de acesso" onkeydown="if(event.key===\'Enter\')doLogin()"/>' +
  '<button class="btn btn-full" onclick="doLogin()">Entrar</button>' +
  '<div id="login-err">Senha incorreta</div>' +
  '</div></div>' +

  '<div id="app" style="display:' + show + ';min-height:100vh">' +
  '<div class="sidebar">' +
  '<div class="logo">ApostaDez</div>' +
  '<button class="nav-btn active" onclick="showPage(\'dashboard\',this)">Dashboard</button>' +
  '<button class="nav-btn" onclick="showPage(\'usuarios\',this)">Usuarios</button>' +
  '<button class="nav-btn" onclick="showPage(\'eventos\',this)">Eventos</button>' +
  '<button class="nav-btn" onclick="showPage(\'config\',this)">Configuracoes</button>' +
  '</div>' +

  '<div class="main">' +

  '<div class="page active" id="page-dashboard">' +
  '<h2>Dashboard</h2><div class="sub">Visao geral da gamificacao</div>' +
  '<div class="metric-grid">' +
  '<div class="metric"><div class="metric-val" id="s-users">-</div><div class="metric-label">Usuarios</div></div>' +
  '<div class="metric"><div class="metric-val" id="s-webhooks">-</div><div class="metric-label">Webhooks</div></div>' +
  '<div class="metric"><div class="metric-val" id="s-bonused">-</div><div class="metric-label">Bonificados</div></div>' +
  '<div class="metric"><div class="metric-val" id="s-skipped">-</div><div class="metric-label">Fora da janela</div></div>' +
  '<div class="metric"><div class="metric-val" id="s-pts">-</div><div class="metric-label">Pontos emitidos</div></div>' +
  '<div class="metric"><div class="metric-val" id="s-fs">-</div><div class="metric-label">Free spins</div></div>' +
  '</div>' +
  '<div class="card"><div class="card-title">Ultimos 10 eventos</div>' +
  '<table><thead><tr><th>Usuario</th><th>Hora local</th><th>Resultado</th><th>Pontos</th><th>Quando</th></tr></thead>' +
  '<tbody id="recent-events"><tr><td colspan="5" class="empty">Carregando...</td></tr></tbody></table>' +
  '</div></div>' +

  '<div class="page" id="page-usuarios">' +
  '<h2>Usuarios</h2><div class="sub">Controle de pontos e free spins por usuario</div>' +
  '<input type="text" class="search" id="user-search" placeholder="Buscar por nome, email ou userId..." oninput="filterUsers()"/>' +
  '<div class="card" style="padding:0;overflow:hidden"><table>' +
  '<thead><tr><th>#</th><th>Usuario</th><th>Email</th><th>Pontos</th><th>Free Spins</th><th>Ultimo bonus</th><th>Dias bonificados</th></tr></thead>' +
  '<tbody id="users-tbody"><tr><td colspan="7" class="empty">Carregando...</td></tr></tbody>' +
  '</table></div></div>' +

  '<div class="page" id="page-eventos">' +
  '<h2>Log de eventos</h2><div class="sub">Todos os webhooks recebidos</div>' +
  '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
  '<button class="btn" style="padding:6px 14px;font-size:12px" onclick="filterEvents(\'all\')">Todos</button>' +
  '<button class="btn" style="padding:6px 14px;font-size:12px;background:#064e3b" onclick="filterEvents(\'bonus\')">Bonificados</button>' +
  '<button class="btn" style="padding:6px 14px;font-size:12px;background:#374151" onclick="filterEvents(\'skip\')">Fora da janela</button>' +
  '</div>' +
  '<div class="card" style="padding:0;overflow:hidden"><table>' +
  '<thead><tr><th>Usuario</th><th>Email</th><th>Hora local</th><th>Fuso</th><th>Resultado</th><th>Pontos</th><th>Data</th></tr></thead>' +
  '<tbody id="events-tbody"><tr><td colspan="7" class="empty">Carregando...</td></tr></tbody>' +
  '</table></div></div>' +

  '<div class="page" id="page-config">' +
  '<h2>Configuracoes</h2><div class="sub">Altere as regras sem mexer no codigo</div>' +
  '<div class="card"><div class="card-title">Regra - login no horario dourado</div>' +
  '<div class="cfg-row"><div><div class="cfg-label">Regra ativa</div></div><label class="toggle"><input type="checkbox" id="cfg-active"><span class="tsl"></span></label></div>' +
  '<div class="cfg-row"><div><div class="cfg-label">Hora de inicio</div><div class="cfg-sub">Janela comeca as</div></div><input type="time" id="cfg-start" oninput="updatePreview()"/></div>' +
  '<div class="cfg-row"><div><div class="cfg-label">Hora de fim</div><div class="cfg-sub">Pode cruzar meia-noite</div></div><input type="time" id="cfg-end" oninput="updatePreview()"/></div>' +
  '<div class="cfg-row"><div><div class="cfg-label">Pontos por login</div></div><input type="number" id="cfg-points" min="1" oninput="updatePreview()"/></div>' +
  '<div class="cfg-row"><div><div class="cfg-label">Custo de cada free spin</div><div class="cfg-sub">Pontos necessarios por spin</div></div><input type="number" id="cfg-spincost" min="1" oninput="updatePreview()"/></div>' +
  '<div class="cfg-row"><div><div class="cfg-label">Valor do spin (R$)</div></div><input type="number" id="cfg-spinvalue" min="0.01" step="0.01" oninput="updatePreview()"/></div>' +
  '<div class="cfg-row"><div><div class="cfg-label">Frequencia por usuario</div></div><select id="cfg-freq" onchange="updatePreview()"><option value="daily">1x por dia</option><option value="weekly">1x por semana</option><option value="unlimited">Ilimitado</option></select></div>' +
  '<div class="cfg-row"><div><div class="cfg-label">Validade dos pontos (dias)</div></div><input type="number" id="cfg-expiry" min="1"/></div>' +
  '<div class="cfg-row"><div><div class="cfg-label">Fuso padrao</div><div class="cfg-sub">Fallback quando nao informado</div></div><select id="cfg-tz"><option value="America/Sao_Paulo">Sao Paulo (UTC-3)</option><option value="America/Fortaleza">Fortaleza (UTC-3)</option><option value="America/Manaus">Manaus (UTC-4)</option><option value="UTC">UTC</option></select></div>' +
  '<div class="cfg-row"><div><div class="cfg-label">Usar fuso do usuario</div><div class="cfg-sub">Prioriza timezone do payload</div></div><label class="toggle"><input type="checkbox" id="cfg-usertz"><span class="tsl"></span></label></div>' +
  '<div class="preview" id="preview-box">-</div>' +
  '<button class="btn btn-full" onclick="saveConfig()">Salvar configuracoes</button>' +
  '<div class="alert alert-ok" id="alert-ok">Configuracoes salvas!</div>' +
  '<div class="alert alert-err" id="alert-err">Erro ao salvar.</div>' +
  '</div></div>' +

  '</div></div>' +

  '<script>' +
  'var TOKEN="' + token + '";' +
  'var ALL_USERS=[];' +
  'var ALL_EVENTS=[];' +
  'function doLogin(){' +
  '  var pwd=document.getElementById("pwd").value;' +
  '  fetch("/admin/config?token="+encodeURIComponent(pwd)).then(function(r){return r.json();}).then(function(d){' +
  '    if(d.ok){TOKEN=pwd;document.getElementById("login-wrap").style.display="none";document.getElementById("app").style.display="flex";init();}' +
  '    else{document.getElementById("login-err").style.display="block";}' +
  '  }).catch(function(){document.getElementById("login-err").style.display="block";});' +
  '}' +
  'function showPage(id,btn){' +
  '  document.querySelectorAll(".page").forEach(function(p){p.classList.remove("active");});' +
  '  document.querySelectorAll(".nav-btn").forEach(function(b){b.classList.remove("active");});' +
  '  document.getElementById("page-"+id).classList.add("active");' +
  '  btn.classList.add("active");' +
  '  if(id==="usuarios")loadUsers();' +
  '  if(id==="eventos")loadEvents("all");' +
  '  if(id==="config")loadConfig();' +
  '}' +
  'function init(){loadStats();loadRecentEvents();}' +
  'function api(path){return fetch("/admin"+path+"?token="+TOKEN).then(function(r){return r.json();});}' +
  'function loadStats(){' +
  '  api("/stats").then(function(d){' +
  '    if(!d.ok)return;var s=d.stats;' +
  '    document.getElementById("s-users").textContent=s.totalUsers;' +
  '    document.getElementById("s-webhooks").textContent=s.totalWebhooks;' +
  '    document.getElementById("s-bonused").textContent=s.totalBonused;' +
  '    document.getElementById("s-skipped").textContent=s.totalSkipped;' +
  '    document.getElementById("s-pts").textContent=s.totalPointsGiven;' +
  '    document.getElementById("s-fs").textContent=s.totalFreeSpins;' +
  '  });' +
  '}' +
  'function fmtDate(iso){' +
  '  if(!iso)return "-";' +
  '  try{return new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}' +
  '  catch(e){return iso;}' +
  '}' +
  'function loadRecentEvents(){' +
  '  api("/events").then(function(d){' +
  '    if(!d.ok)return;' +
  '    var tbody=document.getElementById("recent-events");' +
  '    var recent=d.events.slice(0,10);' +
  '    if(!recent.length){tbody.innerHTML="<tr><td colspan=5 class=empty>Nenhum evento ainda</td></tr>";return;}' +
  '    var html="";' +
  '    recent.forEach(function(e){' +
  '      var res=e.result==="bonus"?"<span class=\'pill pill-g\'>bonificado</span>":"<span class=\'pill pill-r\'>sem bonus</span>";' +
  '      var pts=e.result==="bonus"?"+"+e.points+" pts":"-";' +
  '      html+="<tr><td>"+(e.fullName||e.userId||"-")+"</td><td>"+(e.localHour!=null?e.localHour+"h":"-")+"</td><td>"+res+"</td><td>"+pts+"</td><td>"+fmtDate(e.loggedAt)+"</td></tr>";' +
  '    });' +
  '    tbody.innerHTML=html;' +
  '  });' +
  '}' +
  'function loadUsers(){' +
  '  api("/users").then(function(d){' +
  '    if(!d.ok)return;ALL_USERS=d.users;renderUsers(ALL_USERS);' +
  '  });' +
  '}' +
  'function renderUsers(users){' +
  '  var tbody=document.getElementById("users-tbody");' +
  '  if(!users.length){tbody.innerHTML="<tr><td colspan=7 class=empty>Nenhum usuario ainda</td></tr>";return;}' +
  '  var html="";' +
  '  users.forEach(function(u,i){' +
  '    var dates=(u.loginBonuses||[]).map(function(d){return "<span class=bonus-date>"+d+"</span>";}).join("")||"-";' +
  '    html+="<tr><td>"+(i+1)+"</td><td>"+(u.fullName||"-")+"<br><small style=color:#64748b>"+u.userId.substring(0,18)+"...</small></td><td style=font-size:12px>"+(u.email||"-")+"</td><td><span class=\'pill pill-a\'>"+u.points+" pts</span></td><td><span class=\'pill pill-g\'>"+u.freeSpins+" FS</span></td><td style=font-size:12px>"+fmtDate(u.lastBonus)+"</td><td>"+dates+"</td></tr>";' +
  '  });' +
  '  tbody.innerHTML=html;' +
  '}' +
  'function filterUsers(){' +
  '  var q=document.getElementById("user-search").value.toLowerCase();' +
  '  renderUsers(ALL_USERS.filter(function(u){return (u.fullName||"").toLowerCase().indexOf(q)>=0||(u.email||"").toLowerCase().indexOf(q)>=0||(u.userId||"").toLowerCase().indexOf(q)>=0;}));' +
  '}' +
  'var ALL_EVENTS=[];' +
  'function loadEvents(filter){' +
  '  api("/events?limit=200").then(function(d){' +
  '    if(!d.ok)return;ALL_EVENTS=d.events;renderEvents(filter);' +
  '  });' +
  '}' +
  'function filterEvents(filter){renderEvents(filter);}' +
  'function renderEvents(filter){' +
  '  var tbody=document.getElementById("events-tbody");' +
  '  var events=filter==="all"?ALL_EVENTS:ALL_EVENTS.filter(function(e){return e.result===filter;});' +
  '  if(!events.length){tbody.innerHTML="<tr><td colspan=7 class=empty>Nenhum evento</td></tr>";return;}' +
  '  var html="";' +
  '  events.forEach(function(e){' +
  '    var res=e.result==="bonus"?"<span class=\'pill pill-g\'>bonificado</span>":e.result==="skip"?"<span class=\'pill pill-r\'>fora janela</span>":"<span class=\'pill pill-b\'>"+e.result+"</span>";' +
  '    var pts=e.result==="bonus"?"+"+e.points+" pts":"-";' +
  '    html+="<tr><td>"+(e.fullName||"-")+"<br><small style=color:#64748b>"+(e.userId||"").substring(0,16)+"</small></td><td style=font-size:12px>"+(e.email||"-")+"</td><td>"+(e.localHour!=null?e.localHour+"h":"-")+"</td><td style=font-size:12px>"+(e.timezone||"-")+"</td><td>"+res+"</td><td>"+pts+"</td><td style=font-size:11px>"+fmtDate(e.loggedAt)+"</td></tr>";' +
  '  });' +
  '  tbody.innerHTML=html;' +
  '}' +
  'function loadConfig(){' +
  '  api("/config").then(function(d){' +
  '    if(!d.ok)return;var c=d.config;' +
  '    document.getElementById("cfg-active").checked=c.active;' +
  '    document.getElementById("cfg-start").value=c.windowStart;' +
  '    document.getElementById("cfg-end").value=c.windowEnd;' +
  '    document.getElementById("cfg-points").value=c.points;' +
  '    document.getElementById("cfg-spincost").value=c.spinCost;' +
  '    document.getElementById("cfg-spinvalue").value=c.spinValue;' +
  '    document.getElementById("cfg-freq").value=c.frequency;' +
  '    document.getElementById("cfg-expiry").value=c.expiryDays;' +
  '    document.getElementById("cfg-tz").value=c.defaultTz;' +
  '    document.getElementById("cfg-usertz").checked=c.useUserTz;' +
  '    updatePreview();' +
  '  });' +
  '}' +
  'function updatePreview(){' +
  '  var pts=parseInt(document.getElementById("cfg-points").value)||100;' +
  '  var cost=parseInt(document.getElementById("cfg-spincost").value)||1;' +
  '  var val=parseFloat(document.getElementById("cfg-spinvalue").value)||0.20;' +
  '  var start=document.getElementById("cfg-start").value;' +
  '  var end=document.getElementById("cfg-end").value;' +
  '  var freq=document.getElementById("cfg-freq").value;' +
  '  var spins=Math.floor(pts/cost);' +
  '  var money=(spins*val).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});' +
  '  var freqs={daily:"1x por dia",weekly:"1x por semana",unlimited:"ilimitado"};' +
  '  document.getElementById("preview-box").innerHTML="Login entre "+start+"-"+end+" -> "+pts+" pts -> "+spins+" free spins ("+money+") - "+freqs[freq];' +
  '}' +
  'function saveConfig(){' +
  '  var body={' +
  '    active:document.getElementById("cfg-active").checked,' +
  '    windowStart:document.getElementById("cfg-start").value,' +
  '    windowEnd:document.getElementById("cfg-end").value,' +
  '    points:parseInt(document.getElementById("cfg-points").value),' +
  '    spinCost:parseInt(document.getElementById("cfg-spincost").value),' +
  '    spinValue:parseFloat(document.getElementById("cfg-spinvalue").value),' +
  '    frequency:document.getElementById("cfg-freq").value,' +
  '    expiryDays:parseInt(document.getElementById("cfg-expiry").value),' +
  '    defaultTz:document.getElementById("cfg-tz").value,' +
  '    useUserTz:document.getElementById("cfg-usertz").checked' +
  '  };' +
  '  fetch("/admin/config?token="+TOKEN,{method:"POST",headers:{"Content-Type":"application/json","x-admin-token":TOKEN},body:JSON.stringify(body)})' +
  '  .then(function(r){return r.json();}).then(function(d){' +
  '    var ok=document.getElementById("alert-ok"),err=document.getElementById("alert-err");' +
  '    if(d.ok){ok.style.display="block";setTimeout(function(){ok.style.display="none";},3000);}' +
  '    else{err.style.display="block";setTimeout(function(){err.style.display="none";},3000);}' +
  '  });' +
  '}' +
  'if(TOKEN)init();' +
  '</script></body></html>';
}

module.exports = router;
