const express = require('express');
const router  = express.Router();
const { getConfig, saveConfig, getStats, getAllUsers, getEvents } = require('../database');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'apostadez2026';

// ── Auth middleware ───────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'não autorizado' });
  }
  next();
}

// ── GET /admin/panel — painel HTML ────────────────────────────
router.get('/panel', (req, res) => {
  const token = req.query.token || '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(buildPanel(token));
});

// ── GET /admin/config ─────────────────────────────────────────
router.get('/config', auth, (_req, res) => {
  res.json({ ok: true, config: getConfig() });
});

// ── POST /admin/config ────────────────────────────────────────
router.post('/config', auth, (req, res) => {
  const allowed = ['active','windowStart','windowEnd','points','spinCost','spinValue','frequency','expiryDays','defaultTz','useUserTz'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'active' || key === 'useUserTz') updates[key] = req.body[key] === true || req.body[key] === 'true';
      else if (['points','spinCost','expiryDays'].includes(key)) updates[key] = parseInt(req.body[key], 10);
      else if (key === 'spinValue') updates[key] = parseFloat(req.body[key]);
      else updates[key] = req.body[key];
    }
  }
  const config = saveConfig(updates);
  console.log('[ADMIN] Config atualizada:', updates);
  res.json({ ok: true, config });
});

// ── GET /admin/stats ──────────────────────────────────────────
router.get('/stats', auth, (_req, res) => {
  res.json({ ok: true, stats: getStats(), config: getConfig() });
});

// ── HTML do painel ────────────────────────────────────────────
function buildPanel(token) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ApostaDez — Painel Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f1117;color:#e2e8f0;min-height:100vh;padding:2rem 1rem}
.container{max-width:700px;margin:0 auto}
h1{font-size:22px;font-weight:600;margin-bottom:4px}
.sub{font-size:14px;color:#94a3b8;margin-bottom:2rem}
.card{background:#1e2130;border:1px solid #2d3348;border-radius:12px;padding:1.5rem;margin-bottom:1rem}
.card-title{font-size:13px;font-weight:600;color:#94a3b8;letter-spacing:.06em;text-transform:uppercase;margin-bottom:1rem;display:flex;align-items:center;gap:8px}
.row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #2d3348;gap:12px}
.row:last-child{border-bottom:none}
.row-label{font-size:14px;color:#e2e8f0;flex:1}
.row-sub{font-size:12px;color:#64748b;margin-top:2px}
input[type=time],input[type=number],input[type=text],select{background:#0f1117;border:1px solid #2d3348;border-radius:8px;padding:6px 10px;font-size:13px;color:#e2e8f0;width:130px;text-align:right}
select{text-align:left;width:160px}
input:focus,select:focus{outline:none;border-color:#6366f1}
.toggle{position:relative;display:inline-block;width:36px;height:20px}
.toggle input{opacity:0;width:0;height:0}
.tslider{position:absolute;cursor:pointer;inset:0;background:#374151;border-radius:20px;transition:.2s}
.tslider:before{content:'';position:absolute;width:14px;height:14px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}
input:checked+.tslider{background:#6366f1}
input:checked+.tslider:before{transform:translateX(16px)}
.btn{background:#6366f1;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:500;cursor:pointer;width:100%;margin-top:1rem;transition:background .2s}
.btn:hover{background:#4f46e5}
.btn-danger{background:#dc2626}
.btn-danger:hover{background:#b91c1c}
.alert{border-radius:8px;padding:10px 14px;font-size:13px;margin-top:10px;display:none}
.alert-ok{background:#064e3b;color:#6ee7b7;border:1px solid #065f46}
.alert-err{background:#450a0a;color:#fca5a5;border:1px solid #7f1d1d}
.login-card{max-width:340px;margin:100px auto}
.metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:1rem}
.metric{background:#0f1117;border-radius:8px;padding:12px;text-align:center}
.metric-val{font-size:24px;font-weight:600;color:#6366f1}
.metric-label{font-size:11px;color:#64748b;margin-top:2px}
.preview{background:#0f1117;border-radius:8px;padding:12px 16px;margin-top:12px;font-size:13px;color:#94a3b8}
.preview strong{color:#6ee7b7}
#login-err{color:#fca5a5;font-size:13px;margin-top:8px;display:none}
</style>
</head>
<body>
<div class="container" id="app">

${token ? '' : `
<div class="card login-card">
  <div class="card-title">🔐 Acesso admin</div>
  <div style="margin-bottom:12px">
    <label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:6px">Senha</label>
    <input type="password" id="pwd" placeholder="Digite a senha" style="width:100%;text-align:left" onkeydown="if(event.key==='Enter')doLogin()"/>
  </div>
  <button class="btn" onclick="doLogin()">Entrar</button>
  <div id="login-err">Senha incorreta</div>
</div>
`}

<div id="main" style="display:${token ? 'block' : 'none'}">
  <h1>🎰 ApostaDez — Admin</h1>
  <div class="sub">Painel de configuração da gamificação</div>

  <div class="card" id="stats-card">
    <div class="card-title">📊 Estatísticas</div>
    <div class="metric-grid">
      <div class="metric"><div class="metric-val" id="s-users">—</div><div class="metric-label">Usuários</div></div>
      <div class="metric"><div class="metric-val" id="s-bonused">—</div><div class="metric-label">Bonificados</div></div>
      <div class="metric"><div class="metric-val" id="s-pts">—</div><div class="metric-label">Pontos emitidos</div></div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">⚙️ Configurações da regra</div>

    <div class="row">
      <div><div class="row-label">Regra ativa</div><div class="row-sub">Liga/desliga sem apagar configs</div></div>
      <label class="toggle"><input type="checkbox" id="cfg-active"><span class="tslider"></span></label>
    </div>
    <div class="row">
      <div><div class="row-label">Hora de início</div><div class="row-sub">Janela começa às</div></div>
      <input type="time" id="cfg-start"/>
    </div>
    <div class="row">
      <div><div class="row-label">Hora de fim</div><div class="row-sub">Pode cruzar meia-noite</div></div>
      <input type="time" id="cfg-end"/>
    </div>
    <div class="row">
      <div><div class="row-label">Pontos por login</div></div>
      <input type="number" id="cfg-points" min="1"/>
    </div>
    <div class="row">
      <div><div class="row-label">Custo de cada free spin</div><div class="row-sub">Pontos necessários por spin</div></div>
      <input type="number" id="cfg-spincost" min="1"/>
    </div>
    <div class="row">
      <div><div class="row-label">Valor monetário do spin</div><div class="row-sub">Em reais (R$)</div></div>
      <input type="number" id="cfg-spinvalue" min="0.01" step="0.01"/>
    </div>
    <div class="row">
      <div><div class="row-label">Frequência por usuário</div></div>
      <select id="cfg-freq">
        <option value="daily">1x por dia</option>
        <option value="weekly">1x por semana</option>
        <option value="unlimited">Ilimitado</option>
      </select>
    </div>
    <div class="row">
      <div><div class="row-label">Validade dos pontos</div><div class="row-sub">Em dias</div></div>
      <input type="number" id="cfg-expiry" min="1"/>
    </div>
    <div class="row">
      <div><div class="row-label">Fuso padrão</div><div class="row-sub">Quando payload não informa</div></div>
      <select id="cfg-tz">
        <option value="America/Sao_Paulo">São Paulo</option>
        <option value="America/Fortaleza">Fortaleza</option>
        <option value="America/Manaus">Manaus</option>
        <option value="America/Belem">Belém</option>
        <option value="UTC">UTC</option>
      </select>
    </div>
    <div class="row">
      <div><div class="row-label">Usar fuso do usuário</div><div class="row-sub">Prioriza timezone do payload</div></div>
      <label class="toggle"><input type="checkbox" id="cfg-usertz"><span class="tslider"></span></label>
    </div>

    <div class="preview" id="preview-box"></div>
    <button class="btn" onclick="saveConfig()">💾 Salvar configurações</button>
    <div class="alert alert-ok" id="alert-ok">✅ Configurações salvas com sucesso!</div>
    <div class="alert alert-err" id="alert-err">❌ Erro ao salvar.</div>
  </div>
</div>
</div>

<script>
let TOKEN = '${token}' || '';

function doLogin(){
  const pwd = document.getElementById('pwd').value;
  fetch('/admin/config?token='+encodeURIComponent(pwd))
    .then(r => r.json())
    .then(d => {
      if(d.ok){ TOKEN=pwd; document.getElementById('main').style.display='block'; document.querySelector('.login-card').style.display='none'; loadConfig(); loadStats(); }
      else { document.getElementById('login-err').style.display='block'; }
    }).catch(()=>{ document.getElementById('login-err').style.display='block'; });
}

function loadConfig(){
  fetch('/admin/config?token='+TOKEN)
    .then(r=>r.json()).then(d=>{
      if(!d.ok) return;
      const c = d.config;
      document.getElementById('cfg-active').checked   = c.active;
      document.getElementById('cfg-start').value      = c.windowStart;
      document.getElementById('cfg-end').value        = c.windowEnd;
      document.getElementById('cfg-points').value     = c.points;
      document.getElementById('cfg-spincost').value   = c.spinCost;
      document.getElementById('cfg-spinvalue').value  = c.spinValue;
      document.getElementById('cfg-freq').value       = c.frequency;
      document.getElementById('cfg-expiry').value     = c.expiryDays;
      document.getElementById('cfg-tz').value         = c.defaultTz;
      document.getElementById('cfg-usertz').checked   = c.useUserTz;
      updatePreview(c);
      ['cfg-start','cfg-end','cfg-points','cfg-spincost','cfg-spinvalue','cfg-freq','cfg-expiry','cfg-tz'].forEach(id=>{
        document.getElementById(id).addEventListener('input', ()=>updatePreview(getFormValues()));
      });
      ['cfg-active','cfg-usertz'].forEach(id=>{
        document.getElementById(id).addEventListener('change', ()=>updatePreview(getFormValues()));
      });
    });
}

function loadStats(){
  fetch('/admin/stats?token='+TOKEN)
    .then(r=>r.json()).then(d=>{
      if(!d.ok) return;
      const s = d.stats;
      document.getElementById('s-users').textContent   = s.totalUsers;
      document.getElementById('s-bonused').textContent = s.totalBonused;
      document.getElementById('s-pts').textContent     = s.totalPointsGiven;
    });
}

function getFormValues(){
  return {
    active     : document.getElementById('cfg-active').checked,
    windowStart: document.getElementById('cfg-start').value,
    windowEnd  : document.getElementById('cfg-end').value,
    points     : parseInt(document.getElementById('cfg-points').value)||100,
    spinCost   : parseInt(document.getElementById('cfg-spincost').value)||1,
    spinValue  : parseFloat(document.getElementById('cfg-spinvalue').value)||0.20,
    frequency  : document.getElementById('cfg-freq').value,
    expiryDays : parseInt(document.getElementById('cfg-expiry').value)||30,
    defaultTz  : document.getElementById('cfg-tz').value,
    useUserTz  : document.getElementById('cfg-usertz').checked,
  };
}

function updatePreview(c){
  const spins = Math.floor(c.points / c.spinCost);
  const val   = (spins * c.spinValue).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  document.getElementById('preview-box').innerHTML =
    'Resumo: login entre <strong>'+c.windowStart+'–'+c.windowEnd+'</strong> → '+
    '<strong>'+c.points+' pts</strong> → <strong>'+spins+' free spins</strong> ('+val+') · '+
    'frequência: <strong>'+{daily:'1x/dia',weekly:'1x/semana',unlimited:'ilimitado'}[c.frequency]+'</strong>';
}

function saveConfig(){
  const body = getFormValues();
  fetch('/admin/config?token='+TOKEN,{method:'POST',headers:{'Content-Type':'application/json','x-admin-token':TOKEN},body:JSON.stringify(body)})
    .then(r=>r.json()).then(d=>{
      const ok  = document.getElementById('alert-ok');
      const err = document.getElementById('alert-err');
      if(d.ok){ok.style.display='block';setTimeout(()=>ok.style.display='none',3000);}
      else    {err.style.display='block';setTimeout(()=>err.style.display='none',3000);}
    });
}

if(TOKEN){ loadConfig(); loadStats(); }
</script>
</body>
</html>`;
}

module.exports = router;
