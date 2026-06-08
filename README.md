# ApostaDez — Servidor de Gamificação

Servidor Node.js que recebe webhooks da ApostaDez e aplica regras de gamificação automaticamente.

## Regra ativa: Login no horário dourado
Usuário que fizer login entre **18h e 19h** (no fuso do próprio usuário) recebe **100 pontos = 100 free spins**.

---

## Instalação local

```bash
# 1. Clone ou extraia o projeto
cd apostadez-gamification

# 2. Instale as dependências
npm install

# 3. Crie o arquivo .env
cp .env.example .env

# 4. Inicie o servidor
npm start
```

O servidor sobe em `http://localhost:3000`.

---

## Deploy no Railway (recomendado — gratuito)

1. Acesse [railway.app](https://railway.app) e crie uma conta
2. Clique em **New Project → Deploy from GitHub repo**
3. Faça upload ou conecte este repositório
4. Railway detecta o `Procfile` e sobe automaticamente
5. Vá em **Settings → Domains** e copie a URL pública (ex: `https://apostadez-gamification.up.railway.app`)

---

## Deploy no Render (alternativa gratuita)

1. Acesse [render.com](https://render.com)
2. **New → Web Service → Connect repository**
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Copie a URL pública gerada

---

## Configurar o webhook na ApostaDez

Depois de fazer o deploy, aponte o webhook da ApostaDez para:

```
POST https://SUA-URL/webhook/login
```

O servidor aceita exatamente o payload que a ApostaDez já envia:

```json
{
  "event": "user.login",
  "timestamp": "2026-06-05T21:30:00.000Z",
  "data": {
    "userId": "6a1a398092d650230c0b9bf4",
    "email": "usuario@email.com",
    "fullName": "Nome do Usuário",
    "tracking": {
      "deviceInfo": { "timezone": "America/Fortaleza" }
    }
  },
  "metadata": {
    "environment": "production",
    "requestId": "uuid-unico"
  }
}
```

---

## Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/webhook/login` | Recebe evento de login |
| `GET`  | `/dashboard/stats` | Estatísticas gerais |
| `GET`  | `/dashboard/users` | Ranking de usuários por pontos |
| `GET`  | `/dashboard/users/:userId` | Pontos de um usuário específico |
| `GET`  | `/dashboard/events?limit=50` | Log dos últimos eventos |

### Exemplo de resposta — bônus concedido
```json
{
  "ok": true,
  "processed": true,
  "bonus": true,
  "userId": "6a1a398092d650230c0b9bf4",
  "points": 100,
  "freeSpins": 100,
  "totalPoints": 100,
  "totalFreeSpins": 100,
  "message": "+100 pontos e 100 free spins concedidos!"
}
```

### Exemplo de resposta — fora da janela
```json
{
  "ok": true,
  "processed": true,
  "bonus": false,
  "userId": "6a1a398092d650230c0b9bf4",
  "reason": "hora local 22h — fora da janela 18h–19h"
}
```

---

## Adicionar novas regras

Edite `src/rules/goldenHour.js` ou crie novos arquivos em `src/rules/` e importe em `src/routes/webhook.js`.

Exemplos de regras futuras:
- Login consecutivo por 7 dias → 500 pontos
- Primeiro depósito → 200 pontos
- Convite de amigo → 150 pontos

---

## Estrutura do projeto

```
apostadez-gamification/
├── server.js              ← entrada principal
├── src/
│   ├── database.js        ← banco de dados JSON (lowdb)
│   ├── routes/
│   │   ├── webhook.js     ← recebe e processa webhooks
│   │   └── dashboard.js   ← endpoints de consulta
│   └── rules/
│       └── goldenHour.js  ← regra do horário dourado
├── data/
│   └── db.json            ← banco de dados (criado automaticamente)
├── .env.example
├── Procfile               ← para Railway/Render
└── package.json
```
