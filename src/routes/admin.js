const express = require('express');
const router  = express.Router();
const { getConfig, saveConfig, getStats, getAllUsers, getEvents, getUser, getPromos, savePromo, deletePromo } = require('../database');

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

router.get('/config',  auth, (_req, res) => res.json({ ok: true, config: getConfig() }));
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
  res.json({ ok: true, config: saveConfig(updates) });
});

router.get('/stats',  auth, (_req, res) => res.json({ ok: true, stats: getStats() }));
router.get('/users',  auth, (_req, res) => res.json({ ok: true, users: getAllUsers() }));
router.get('/users/:userId', auth, (req, res) => {
  const user = getUser(req.params.userId);
  if (!user) return res.status(404).json({ ok: false, error: 'nao encontrado' });
  res.json({ ok: true, user });
});
router.get('/events', auth, (req, res) => {
  res.json({ ok: true, events: getEvents(Math.min(parseInt(req.query.limit)||100, 500)) });
});
router.get('/promos',  auth, (_req, res) => res.json({ ok: true, promos: getPromos() }));
router.post('/promos', auth, (req, res) => {
  const { name, description, active, conditionType, timeStart, timeEnd, loginRequired, period, rewardSpins, startDate, endDate } = req.body;
  if (!name || !conditionType || !rewardSpins) return res.status(400).json({ ok: false, error: 'name, conditionType e rewardSpins obrigatorios' });
  const { v4: uuidv4 } = require('uuid');
  const promo = {
    id: uuidv4(), name, description: description||'', active: active !== false, trigger: 'login',
    conditionType, timeStart: timeStart||'18:00', timeEnd: timeEnd||'19:00',
    loginRequired: parseInt(loginRequired)||3, period: period||'week',
    rewardSpins: parseInt(rewardSpins)||10, startDate: startDate||null, endDate: endDate||null,
    createdAt: new Date().toISOString(),
  };
  savePromo(promo);
  res.json({ ok: true, promo });
});
router.put('/promos/:id', auth, (req, res) => {
  const promos = getPromos();
  const existing = promos.find(p => p.id === req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'nao encontrada' });
  const updated = { ...existing, ...req.body, id: existing.id, updatedAt: new Date().toISOString() };
  savePromo(updated);
  res.json({ ok: true, promo: updated });
});
router.delete('/promos/:id', auth, (req, res) => {
  deletePromo(req.params.id);
  res.json({ ok: true });
});

function buildPanel(token) {
  const show = token ? 'flex' : 'none';
  const hide = token ? 'none' : 'flex';
  return '<!DOCTYPE html>' +
  '<html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>' +
  '<title>ApostaDez Admin</title><style>' +
  '*{box-sizing:border-box;margin:0;padding:0}' +
  'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f1117;color:#e2e8f0;min-height:100vh}' +
  '.sidebar{position:fixed;left:0;top:0;bottom:0;width:220px;background:#161b2e;border-right:1px solid #2d3348;padding:1.5rem 1rem;display:flex;flex-direction:column;gap:4px;z-index:10}' +
  '.logo{font-size:16px;font-weight:600;margin-bottom:1.5rem;padding:0 8px;color:#a5b4fc}' +
  '.nav-btn{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;font-size:14px;cursor:pointer;border:none;background:none;color:#94a3b8;width:100%;text-align:left;transition:all .15s}' +
  '.nav-btn:hover{background:#1e2130;color:#e2e8f0}.nav-btn.active{background:#312e81;color:#a5b4fc;font-weight:500}' +
  '.main{margin-left:220px;padding:2rem}' +
  '.page{display:none}.page.active{display:block}' +
  'h2{font-size:20px;font-weight:600;margin-bottom:4px}.sub{font-size:13px;color:#64748b;margin-bottom:1.5rem}' +
  '.card{background:#1e2130;border:1px solid #2d3348;border-radius:12px;padding:1.25rem;margin-bottom:1rem}' +
  '.card-title{font-size:12px;font-weight:600;color:#64748b;letter-spacing:.06em;text-transform:uppercase;margin-bottom:1rem}' +
  '.metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:1rem}' +
  '.metric{background:#0f1117;border-radius:10px;padding:14px;text-align:center;border:1px solid #2d3348}' +
  '.metric-val{font-size:26px;font-weight:600;color:#818cf8}.metric-label{font-size:11px;color:#64748b;margin-top:3px}' +
  '.cfg-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid #2d3348;gap:12px}' +
  '.cfg-row:last-child{border-bottom:none}.cfg-label{font-size:14px;flex:1}.cfg-sub{font-size:12px;color:#64748b;margin-top:2px}' +
  'input[type=time],input[type=number],input[type=text],input[type=date],select{background:#0f1117;border:1px solid #2d3348;border-radius:8px;padding:6px 10px;font-size:13px;color:#e2e8f0;width:130px;text-align:right}' +
  'select{text-align:left;width:160px}input[type=text]{width:100%;text-align:left}' +
  'input:focus,select:focus,textarea:focus{outline:none;border-color:#6366f1}' +
  'textarea{width:100%;background:#0f1117;border:1px solid #2d3348;border-radius:8px;padding:8px 10px;font-size:13px;color:#e2e8f0;resize:vertical;min-height:60px}' +
  '.toggle{position:relative;display:inline-block;width:36px;height:20px}' +
  '.toggle input{opacity:0;width:0;height:0}' +
  '.tsl{position:absolute;cursor:pointer;inset:0;background:#374151;border-radius:20px;transition:.2s}' +
  '.tsl:before{content:"";position:absolute;width:14px;height:14px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}' +
  'input:checked+.tsl{background:#6366f1}input:checked+.tsl:before{transform:translateX(16px)}' +
  '.btn{background:#6366f1;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:500;cursor:pointer;transition:background .2s}' +
  '.btn:hover{background:#4f46e5}.btn-full{width:100%;margin-top:12px}.btn-sm{padding:6px 14px;font-size:12px}' +
  '.btn-danger{background:#dc2626}.btn-danger:hover{background:#b91c1c}' +
  '.btn-success{background:#059669}.btn-success:hover{background:#047857}' +
  '.alert{border-radius:8px;padding:10px 14px;font-size:13px;margin-top:10px;display:none}' +
  '.alert-ok{background:#064e3b;color:#6ee7b7;border:1px solid #065f46}' +
  '.alert-err{background:#450a0a;color:#fca5a5;border:1px solid #7f1d1d}' +
  '.preview{background:#0f1117;border-radius:8px;padding:10px 14px;margin-top:12px;font-size:13px;color:#94a3b8}' +
  'table{width:100%;border-collapse:collapse;font-size:13px}' +
  'th{font-size:11px;font-weight:500;color:#64748b;letter-spacing:.05em;padding:8px 12px;border-bottom:1px solid #2d3348;text-align:left}' +
  'td{padding:10px 12px;border-bottom:1px solid #1e2130;vertical-align:top}tr:hover td{background:#1e2130}' +
  '.pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}' +
  '.pill-g{background:#064e3b;color:#6ee7b7}.pill-a{background:#451a03;color:#fed7aa}' +
  '.pill-b{background:#1e3a5f;color:#93c5fd}.pill-r{background:#450a0a;color:#fca5a5}' +
  '.pill-p{background:#2e1065;color:#c4b5fd}' +
  '.search{background:#0f1117;border:1px solid #2d3348;border-radius:8px;padding:8px 12px;font-size:13px;color:#e2e8f0;width:100%;margin-bottom:12px}' +
  '.login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh}' +
  '.login-card{background:#1e2130;border:1px solid #2d3348;border-radius:12px;padding:2rem;width:320px}' +
  '.login-card h2{margin-bottom:1rem}.login-card input{width:100%;margin-bottom:12px;text-align:left}' +
  '#login-err{color:#fca5a5;font-size:13px;margin-top:8px;display:none}' +
  '.bonus-date{font-size:11px;color:#64748b;background:#0f1117;padding:1px 6px;border-radius:4px;display:inline-block;margin:2px}' +
  '.empty{text-align:center;padding:2rem;color:#475569;font-size:13px}' +
  '.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:none;align-items:center;justify-content:center}' +
  '.modal-bg.open{display:flex}' +
  '.modal{background:#1e2130;border:1px solid #2d3348;border-radius:16px;padding:1.5rem;width:100%;max-width:520px;max-height:90vh;overflow-y:auto}' +
  '.modal h3{font-size:17px;font-weight:600;margin-bottom:1.25rem}' +
  '.form-row{margin-bottom:14px}.form-row label{display:block;font-size:12px;color:#94a3b8;margin-bottom:5px}' +
  '.form-row input,.form-row select,.form-row textarea{width:100%;text-align:left}' +
  '.form-row input[type=number]{text-align:right;width:100%}' +
  '.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
  '.cond-section{display:none}.cond-section.active{display:block}' +
  '.promo-card{background:#0f1117;border:1px solid #2d3348;border-radius:10px;padding:14px;margin-bottom:10px}' +
  '.promo-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}' +
  '.promo-name{font-size:15px;font-weight:500}' +
  '.promo-meta{font-size:12px;color:#64748b;margin-top:4px;display:flex;gap:10px;flex-wrap:wrap}' +
  '.promo-actions{display:flex;gap:6px}' +
  '.tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:4px;background:#1e3a5f;color:#93c5fd}' +
  '</style></head><body>' +

  '<div id="login-wrap" class="login-wrap" style="display:' + hide + '">' +
  '<div class="login-card"><h2>ApostaDez Admin</h2>' +
  '<p style="font-size:13px;color:#64748b;margin-bottom:1rem">Painel de controle da gamificacao</p>' +
  '<input type="password" id="pwd" placeholder="Senha" onkeydown="if(event.key===\'Enter\')doLogin()"/>' +
  '<button class="btn btn-full" onclick="doLogin()">Entrar</button>' +
  '<div id="login-err">Senha incorreta</div></div></div>' +

  '<div id="app" style="display:' + show + ';min-height:100vh">' +
  '<div class="sidebar"><div class="logo">ApostaDez</div>' +
  '<button class="nav-btn active" onclick="showPage(\'dashboard\',this)">Dashboard</button>' +
  '<button class="nav-btn" onclick="showPage(\'promos\',this)">Promocoes</button>' +
  '<button class="nav-btn" onclick="showPage(\'usuarios\',this)">Usuarios</button>' +
  '<button class="nav-btn" onclick="showPage(\'eventos\',this)">Eventos</button>' +
  '<button class="nav-btn" onclick="showPage(\'config\',this)">Configuracoes</button>' +
  '</div>' +

  '<div class="main">' +

  // DASHBOARD
  '<div class="page active" id="page-dashboard">' +
  '<h2>Dashboard</h2><div class="sub">Visao geral em tempo real</div>' +
  '<div class="metric-grid">' +
  '<div class="metric"><div class="metric-val" id="s-users">-</div><div class="metric-label">Usuarios</div></div>' +
  '<div class="metric"><div class="metric-val" id="s-promos">-</div><div class="metric-label">Promos ativas</div></div>' +
  '<div class="metric"><div class="metric-val" id="s-bonused">-</div><div class="metric-label">Bonificados</div></div>' +
  '<div class="metric"><div class="metric-val" id="s-skipped">-</div><div class="metric-label">Fora da regra</div></div>' +
  '<div class="metric"><div class="metric-val" id="s-webhooks">-</div><div class="metric-label">Webhooks</div></div>' +
  '<div class="metric"><div class="metric-val" id="s-fs">-</div><div class="metric-label">Free spins</div></div>' +
  '</div>' +
  '<div class="card"><div class="card-title">Ultimos eventos</div>' +
  '<table><thead><tr><th>Usuario</th><th>Promo</th><th>Hora</th><th>Resultado</th><th>Spins</th><th>Quando</th></tr></thead>' +
  '<tbody id="recent-events"><tr><td colspan="6" class="empty">Carregando...</td></tr></tbody></table>' +
  '</div></div>' +

  // PROMOS
  '<div class="page" id="page-promos">' +
  '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">' +
  '<div><h2>Promocoes</h2><div class="sub">Crie e gerencie regras de gamificacao</div></div>' +
  '<button class="btn" onclick="openModal()">+ Nova Promocao</button>' +
  '</div>' +
  '<div id="promos-list"><div class="empty">Carregando...</div></div>' +
  '</div>' +

  // USUARIOS
  '<div class="page" id="page-usuarios">' +
  '<h2>Usuarios</h2><div class="sub">Free spins e progresso por usuario</div>' +
  '<input type="text" class="search" id="user-search" placeholder="Buscar por nome, email ou userId..." oninput="filterUsers()"/>' +
  '<div class="card" style="padding:0;overflow:hidden"><table>' +
  '<thead><tr><th>#</th><th>Usuario</th><th>Email</th><th>Free Spins</th><th>Logins</th><th>Consecutivos</th><th>Ultimo bonus</th></tr></thead>' +
  '<tbody id="users-tbody"><tr><td colspan="7" class="empty">Carregando...</td></tr></tbody>' +
  '</table></div></div>' +

  // EVENTOS
  '<div class="page" id="page-eventos">' +
  '<h2>Log de eventos</h2><div class="sub">Todos os webhooks processados</div>' +
  '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
  '<button class="btn btn-sm" onclick="loadEvents(\'all\')">Todos</button>' +
  '<button class="btn btn-sm btn-success" onclick="loadEvents(\'bonus\')">Bonificados</button>' +
  '<button class="btn btn-sm" style="background:#374151" onclick="loadEvents(\'skip\')">Sem bonus</button>' +
  '</div>' +
  '<div class="card" style="padding:0;overflow:hidden"><table>' +
  '<thead><tr><th>Usuario</th><th>Promo</th><th>Hora</th><th>Fuso</th><th>Resultado</th><th>Spins</th><th>Data</th></tr></thead>' +
  '<tbody id="events-tbody"><tr><td colspan="7" class="empty">Carregando...</td></tr></tbody>' +
  '</table></div></div>' +

  // CONFIG
  '<div class="page" id="page-config">' +
  '<h2>Configuracoes</h2><div class="sub">Configuracoes globais do sistema</div>' +
  '<div class="card"><div class="card-title">Configuracoes gerais</div>' +
  '<div class="cfg-row"><div><div class="cfg-label">Fuso padrao</div><div class="cfg-sub">Quando payload nao informa</div></div>' +
  '<select id="cfg-tz"><option value="America/Sao_Paulo">Sao Paulo</option><option value="America/Fortaleza">Fortaleza</option><option value="America/Manaus">Manaus</option><option value="UTC">UTC</option></select></div>' +
  '<div class="cfg-row"><div><div class="cfg-label">Usar fuso do usuario</div><div class="cfg-sub">Prioriza timezone do payload</div></div>' +
  '<label class="toggle"><input type="checkbox" id="cfg-usertz"><span class="tsl"></span></label></div>' +
  '<button class="btn btn-full" onclick="saveConfig()">Salvar</button>' +
  '<div class="alert alert-ok" id="alert-ok">Salvo!</div>' +
  '</div></div>' +

  '</div></div>' +

  // MODAL CRIAR PROMO
  '<div class="modal-bg" id="modal-bg">' +
  '<div class="modal">' +
  '<h3 id="modal-title">Nova Promocao</h3>' +
  '<div class="form-row"><label>Nome da promocao *</label><input type="text" id="p-name" placeholder="Ex: Login Dourado 18h"/></div>' +
  '<div class="form-row"><label>Descricao</label><textarea id="p-desc" placeholder="Descricao opcional"></textarea></div>' +
  '<div class="form-grid">' +
  '<div class="form-row"><label>Data de inicio</label><input type="date" id="p-start" style="width:100%"/></div>' +
  '<div class="form-row"><label>Data de fim</label><input type="date" id="p-end" style="width:100%"/></div>' +
  '</div>' +
  '<div class="form-row"><label>Tipo de condicao *</label>' +
  '<select id="p-cond" onchange="showCondSection(this.value)" style="width:100%">' +
  '<option value="">Selecione...</option>' +
  '<option value="time_window">Login em horario especifico</option>' +
  '<option value="login_count">Quantidade de logins no periodo</option>' +
  '<option value="consecutive">Logins consecutivos</option>' +
  '</select></div>' +

  '<div class="cond-section" id="cond-time_window">' +
  '<div class="form-grid">' +
  '<div class="form-row"><label>Hora inicio</label><input type="time" id="p-tstart" value="18:00" style="width:100%"/></div>' +
  '<div class="form-row"><label>Hora fim</label><input type="time" id="p-tend" value="19:00" style="width:100%"/></div>' +
  '</div></div>' +

  '<div class="cond-section" id="cond-login_count">' +
  '<div class="form-grid">' +
  '<div class="form-row"><label>Quantidade de logins</label><input type="number" id="p-lcount" value="3" min="1" style="width:100%"/></div>' +
  '<div class="form-row"><label>Periodo</label><select id="p-period" style="width:100%"><option value="day">Por dia</option><option value="week" selected>Por semana</option><option value="month">Por mes</option></select></div>' +
  '</div></div>' +

  '<div class="cond-section" id="cond-consecutive">' +
  '<div class="form-row"><label>Dias consecutivos necessarios</label><input type="number" id="p-consec" value="7" min="2" style="width:100%"/></div>' +
  '</div>' +

  '<div class="form-row"><label>Free spins a conceder *</label><input type="number" id="p-spins" value="10" min="1" style="width:100%"/></div>' +
  '<div class="form-row" style="display:flex;align-items:center;justify-content:space-between">' +
  '<label style="margin-bottom:0">Ativa imediatamente</label>' +
  '<label class="toggle"><input type="checkbox" id="p-active" checked><span class="tsl"></span></label>' +
  '</div>' +
  '<div style="display:flex;gap:8px;margin-top:1rem">' +
  '<button class="btn btn-full" onclick="savePromoForm()">Salvar promocao</button>' +
  '<button class="btn btn-full" style="background:#374151" onclick="closeModal()">Cancelar</button>' +
  '</div>' +
  '<div class="alert alert-err" id="promo-err">Preencha todos os campos obrigatorios</div>' +
  '</div></div>' +

  '<script>' +
  'var TOKEN="' + token + '";var ALL_USERS=[];var ALL_EVENTS=[];var EDIT_ID=null;' +
  'function doLogin(){var pwd=document.getElementById("pwd").value;' +
  'fetch("/admin/config?token="+encodeURIComponent(pwd)).then(function(r){return r.json();}).then(function(d){' +
  'if(d.ok){TOKEN=pwd;document.getElementById("login-wrap").style.display="none";document.getElementById("app").style.display="flex";init();}' +
  'else{document.getElementById("login-err").style.display="block";}' +
  '}).catch(function(){document.getElementById("login-err").style.display="block";});}' +

  'function showPage(id,btn){' +
  'document.querySelectorAll(".page").forEach(function(p){p.classList.remove("active");});' +
  'document.querySelectorAll(".nav-btn").forEach(function(b){b.classList.remove("active");});' +
  'document.getElementById("page-"+id).classList.add("active");btn.classList.add("active");' +
  'if(id==="usuarios")loadUsers();if(id==="eventos")loadEvents("all");' +
  'if(id==="config")loadConfig();if(id==="promos")loadPromos();}' +

  'function api(path){return fetch("/admin"+path+"?token="+TOKEN).then(function(r){return r.json();});}' +

  'function init(){loadStats();loadRecentEvents();}' +

  'function loadStats(){api("/stats").then(function(d){if(!d.ok)return;var s=d.stats;' +
  'document.getElementById("s-users").textContent=s.totalUsers;' +
  'document.getElementById("s-promos").textContent=s.activePromos;' +
  'document.getElementById("s-bonused").textContent=s.totalBonused;' +
  'document.getElementById("s-skipped").textContent=s.totalSkipped;' +
  'document.getElementById("s-webhooks").textContent=s.totalWebhooks;' +
  'document.getElementById("s-fs").textContent=s.totalFreeSpins;});}' +

  'function fmtDate(iso){if(!iso)return "-";' +
  'try{return new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}' +
  'catch(e){return iso;}}' +

  'function loadRecentEvents(){api("/events?limit=10").then(function(d){' +
  'if(!d.ok)return;var tbody=document.getElementById("recent-events");' +
  'if(!d.events.length){tbody.innerHTML="<tr><td colspan=6 class=empty>Nenhum evento ainda</td></tr>";return;}' +
  'var html="";d.events.forEach(function(e){' +
  'var res=e.result==="bonus"?"<span class=\'pill pill-g\'>bonificado</span>":"<span class=\'pill pill-r\'>sem bonus</span>";' +
  'html+="<tr><td>"+(e.fullName||e.userId||"-")+"</td><td>"+(e.promoName||"-")+"</td><td>"+(e.localHour!=null?e.localHour+"h":"-")+"</td><td>"+res+"</td><td>"+(e.freeSpins||"-")+"</td><td>"+fmtDate(e.loggedAt)+"</td></tr>";' +
  '});tbody.innerHTML=html;});}' +

  'function loadPromos(){api("/promos").then(function(d){' +
  'if(!d.ok)return;var list=document.getElementById("promos-list");' +
  'if(!d.promos.length){list.innerHTML="<div class=empty>Nenhuma promocao criada. Clique em + Nova Promocao.</div>";return;}' +
  'var html="";' +
  'var periodLabels={day:"por dia",week:"por semana",month:"por mes"};' +
  'd.promos.forEach(function(p){' +
  'var status=p.active?"<span class=\'pill pill-g\'>ativa</span>":"<span class=\'pill pill-r\'>inativa</span>";' +
  'var cond="";' +
  'if(p.conditionType==="time_window")cond="Login entre "+p.timeStart+" e "+p.timeEnd;' +
  'else if(p.conditionType==="login_count")cond=p.loginRequired+"x "+periodLabels[p.period];' +
  'else if(p.conditionType==="consecutive")cond=p.loginRequired+" dias seguidos";' +
  'var period=(p.startDate||p.endDate)?(p.startDate||"inicio")+" ate "+(p.endDate||"sem fim"):"Permanente";' +
  'var activeLabel=p.active?"Pausar":"Ativar";' +
  'var activeVal=p.active?"false":"true";' +
  'html+="<div class=promo-card><div class=promo-header><div>";' +
  'html+="<div class=promo-name>"+p.name+" "+status+"</div>";' +
  'html+="<div class=promo-meta><span>"+cond+"</span>";' +
  'html+="<span class=\'pill pill-p\'>"+p.rewardSpins+" free spins</span>";' +
  'html+="<span>"+period+"</span></div></div>";' +
  'html+="<div class=promo-actions>";' +
  'html+="<button class=\'btn btn-sm\' style=\'background:#374151\' onclick=\'togglePromo(\\\""+p.id+"\\\",\\\""+activeVal+"\\\")\'>"+activeLabel+"</button>";' +
  'html+="<button class=\'btn btn-sm\' onclick=\'editPromo(\\\""+p.id+"\\\")\'>Editar</button>";' +
  'html+="<button class=\'btn btn-sm btn-danger\' onclick=\'delPromo(\\\""+p.id+"\\\")\'>Excluir</button>";' +
  'html+="</div></div></div>";' +
  '});list.innerHTML=html;});}' +

  'function openModal(){ EDIT_ID=null; document.getElementById("modal-title").textContent="Nova Promocao";' +
  'document.getElementById("p-name").value="";document.getElementById("p-desc").value="";' +
  'document.getElementById("p-start").value="";document.getElementById("p-end").value="";' +
  'document.getElementById("p-cond").value="";document.getElementById("p-spins").value="10";' +
  'document.getElementById("p-active").checked=true;' +
  'document.querySelectorAll(".cond-section").forEach(function(s){s.classList.remove("active");});' +
  'document.getElementById("modal-bg").classList.add("open");}' +

  'function closeModal(){document.getElementById("modal-bg").classList.remove("open");}' +

  'function showCondSection(val){' +
  'document.querySelectorAll(".cond-section").forEach(function(s){s.classList.remove("active");});' +
  'if(val){var el=document.getElementById("cond-"+val);if(el)el.classList.add("active");}}' +

  'function editPromo(id){' +
  'api("/promos").then(function(d){' +
  'var p=d.promos.find(function(x){return x.id===id;});if(!p)return;' +
  'EDIT_ID=id;document.getElementById("modal-title").textContent="Editar Promocao";' +
  'document.getElementById("p-name").value=p.name;' +
  'document.getElementById("p-desc").value=p.desc||"";' +
  'document.getElementById("p-start").value=p.startDate?p.startDate.split("T")[0]:"";' +
  'document.getElementById("p-end").value=p.endDate?p.endDate.split("T")[0]:"";' +
  'document.getElementById("p-cond").value=p.conditionType;' +
  'document.getElementById("p-tstart").value=p.timeStart||"18:00";' +
  'document.getElementById("p-tend").value=p.timeEnd||"19:00";' +
  'document.getElementById("p-lcount").value=p.loginRequired||3;' +
  'document.getElementById("p-period").value=p.period||"week";' +
  'document.getElementById("p-consec").value=p.loginRequired||7;' +
  'document.getElementById("p-spins").value=p.rewardSpins||10;' +
  'document.getElementById("p-active").checked=p.active;' +
  'showCondSection(p.conditionType);' +
  'document.getElementById("modal-bg").classList.add("open");' +
  '});}' +

  'function togglePromo(id,active){' +
  'fetch("/admin/promos/"+id+"?token="+TOKEN,{method:"PUT",headers:{"Content-Type":"application/json","x-admin-token":TOKEN},body:JSON.stringify({active:active==="true"})})' +
  '.then(function(r){return r.json();}).then(function(){loadPromos();loadStats();});}' +

  'function delPromo(id){if(!confirm("Excluir esta promocao?"))return;' +
  'fetch("/admin/promos/"+id+"?token="+TOKEN,{method:"DELETE",headers:{"x-admin-token":TOKEN}})' +
  '.then(function(){loadPromos();loadStats();});}' +

  'function savePromoForm(){' +
  'var name=document.getElementById("p-name").value.trim();' +
  'var cond=document.getElementById("p-cond").value;' +
  'var spins=document.getElementById("p-spins").value;' +
  'if(!name||!cond||!spins){document.getElementById("promo-err").style.display="block";setTimeout(function(){document.getElementById("promo-err").style.display="none";},3000);return;}' +
  'var body={name:name,description:document.getElementById("p-desc").value,' +
  'conditionType:cond,rewardSpins:parseInt(spins),active:document.getElementById("p-active").checked,' +
  'startDate:document.getElementById("p-start").value||null,endDate:document.getElementById("p-end").value||null,' +
  'timeStart:document.getElementById("p-tstart").value,timeEnd:document.getElementById("p-tend").value,' +
  'loginRequired:parseInt(document.getElementById("p-lcount").value||document.getElementById("p-consec").value)||3,' +
  'period:document.getElementById("p-period").value};' +
  'var url=EDIT_ID?"/admin/promos/"+EDIT_ID:"/admin/promos";' +
  'var method=EDIT_ID?"PUT":"POST";' +
  'fetch(url+"?token="+TOKEN,{method:method,headers:{"Content-Type":"application/json","x-admin-token":TOKEN},body:JSON.stringify(body)})' +
  '.then(function(r){return r.json();}).then(function(d){' +
  'if(d.ok){closeModal();loadPromos();loadStats();}' +
  'else{document.getElementById("promo-err").style.display="block";setTimeout(function(){document.getElementById("promo-err").style.display="none";},3000);}' +
  '});}' +

  'function loadUsers(){api("/users").then(function(d){' +
  'if(!d.ok)return;ALL_USERS=d.users;renderUsers(ALL_USERS);});}' +

  'function renderUsers(users){var tbody=document.getElementById("users-tbody");' +
  'if(!users.length){tbody.innerHTML="<tr><td colspan=7 class=empty>Nenhum usuario</td></tr>";return;}' +
  'var html="";users.forEach(function(u,i){' +
  'html+="<tr><td>"+(i+1)+"</td><td>"+(u.fullName||"-")+"<br><small style=color:#64748b>"+u.userId.substring(0,18)+"...</small></td>" +' +
  '"<td style=font-size:12px>"+(u.email||"-")+"</td>" +' +
  '"<td><span class=\'pill pill-g\'>"+(u.freeSpins||0)+" FS</span></td>" +' +
  '"<td style=font-size:12px>"+((u.loginDates||[]).length)+" logins</td>" +' +
  '"<td style=font-size:12px>"+(u.consecutiveLogins||0)+" dias</td>" +' +
  '"<td style=font-size:12px>"+fmtDate(u.lastBonus)+"</td></tr>";' +
  '});tbody.innerHTML=html;}' +

  'function filterUsers(){var q=document.getElementById("user-search").value.toLowerCase();' +
  'renderUsers(ALL_USERS.filter(function(u){return (u.fullName||"").toLowerCase().indexOf(q)>=0||(u.email||"").toLowerCase().indexOf(q)>=0||(u.userId||"").toLowerCase().indexOf(q)>=0;}));}' +

  'function loadEvents(filter){api("/events?limit=200").then(function(d){' +
  'if(!d.ok)return;ALL_EVENTS=d.events;renderEvents(filter);});}' +

  'function renderEvents(filter){var tbody=document.getElementById("events-tbody");' +
  'var events=filter==="all"?ALL_EVENTS:ALL_EVENTS.filter(function(e){return e.result===filter;});' +
  'if(!events.length){tbody.innerHTML="<tr><td colspan=7 class=empty>Nenhum evento</td></tr>";return;}' +
  'var html="";events.forEach(function(e){' +
  'var res=e.result==="bonus"?"<span class=\'pill pill-g\'>bonus</span>":"<span class=\'pill pill-r\'>skip</span>";' +
  'html+="<tr><td>"+(e.fullName||"-")+"<br><small style=color:#64748b>"+(e.userId||"").substring(0,16)+"</small></td>" +' +
  '"<td style=font-size:12px>"+(e.promoName||"-")+"</td>" +' +
  '"<td>"+(e.localHour!=null?e.localHour+"h":"-")+"</td>" +' +
  '"<td style=font-size:12px>"+(e.timezone||"-")+"</td>" +' +
  '"<td>"+res+"</td>" +' +
  '"<td>"+(e.freeSpins||"-")+"</td>" +' +
  '"<td style=font-size:11px>"+fmtDate(e.loggedAt)+"</td></tr>";' +
  '});tbody.innerHTML=html;}' +

  'function loadConfig(){api("/config").then(function(d){' +
  'if(!d.ok)return;var c=d.config;' +
  'document.getElementById("cfg-tz").value=c.defaultTz;' +
  'document.getElementById("cfg-usertz").checked=c.useUserTz;});}' +

  'function saveConfig(){var body={defaultTz:document.getElementById("cfg-tz").value,useUserTz:document.getElementById("cfg-usertz").checked};' +
  'fetch("/admin/config?token="+TOKEN,{method:"POST",headers:{"Content-Type":"application/json","x-admin-token":TOKEN},body:JSON.stringify(body)})' +
  '.then(function(r){return r.json();}).then(function(d){' +
  'var ok=document.getElementById("alert-ok");if(d.ok){ok.style.display="block";setTimeout(function(){ok.style.display="none";},3000);}});}' +

  'if(TOKEN)init();' +
  '</script></body></html>';
}

module.exports = router;
