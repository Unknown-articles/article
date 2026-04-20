# CLAUDE.md — Large System Project

## Visão geral

Aplicação fullstack com backend Node.js e frontend React. Oferece autenticação OIDC, gerenciamento de tarefas (Todo), chat em tempo real e monitoramento de métricas do sistema via WebSocket.

---

## Como rodar

```bash
# Backend  (porta 3001)
cd backend && npm run dev

# Frontend (porta 5173)
cd frontend && npm run dev
```

Não há script raiz para rodar ambos juntos — abrir dois terminais.

---

## Estrutura do projeto

```
large-system/
├── backend/
│   ├── data/
│   │   ├── db.json          # banco JSON (todos, mensagens de chat, etc.)
│   │   └── oidc.db          # SQLite WAL (usuários, tokens, códigos OAuth2)
│   └── src/
│       ├── server.js        # entrada principal: Express + WebSocket + coleta de métricas
│       ├── db/
│       │   ├── jsonDb.js    # CRUD genérico sobre db.json com mutex de escrita
│       │   └── sqliteDb.js  # SQLite via node:sqlite (nativo Node 22+), inicializa schema
│       ├── middleware/
│       │   └── auth.js      # middleware Bearer token
│       ├── routes/
│       │   ├── oidc.js      # provider OIDC completo (discovery, authorize, token, userinfo)
│       │   ├── metrics.js   # REST GET /metrics e GET /metrics/:type
│       │   └── genericApi.js# CRUD REST genérico sobre qualquer collection do jsonDb
│       └── ws/
│           ├── chat.js      # WebSocket de chat com autenticação por token
│           └── monitor.js   # (arquivo legado, lógica migrada para server.js)
└── frontend/
    └── src/
        ├── App.jsx           # roteamento, ProtectedRoute, CallbackHandler OIDC
        ├── index.css         # CSS global com variáveis (sem framework)
        ├── components/
        │   ├── NavBar.jsx
        │   ├── TaskItem.jsx
        │   └── ActionLog.jsx
        ├── context/
        │   ├── AuthContext.jsx   # OIDC + PKCE, acesso via useAuth()
        │   └── TodoContext.jsx   # estado dos todos
        ├── hooks/
        │   └── useWebSocket.js  # hook genérico de WebSocket com reconexão automática
        └── pages/
            ├── LoginPage.jsx
            ├── RegisterPage.jsx
            ├── TodoPage.jsx
            ├── ChatPage.jsx
            └── MetricsPage.jsx
```

---

## Backend

### `server.js` — arquivo central

Concentra três responsabilidades em um único arquivo (por decisão de design):

1. **Servidor Express + HTTP**: rotas, CORS, health check em `/health`.
2. **WebSocket de monitoramento** (`setupMonitorWs`): broadcast de métricas a cada 1 s para clientes inscritos. Suporta subscrições granulares via mensagem `{ action: 'subscribe', metrics: ['cpu', 'memory', 'disk', ...] }`.
3. **Coleta de métricas** (`collectMetrics`): async, executa a cada 1 s via `setInterval`.

#### Métricas coletadas

| Campo      | Fonte                        | Frequência | Observações                                      |
|------------|------------------------------|------------|--------------------------------------------------|
| `cpu`      | `os.cpus()` (delta)          | 1 s        | `{ average, cores[] }` em %                      |
| `memory`   | `os.totalmem/freemem()`      | 1 s        | `{ total, free, used, usedPercent }`             |
| `uptime`   | `os.uptime()`                | 1 s        | segundos                                         |
| `disk`     | `si.fsSize()`                | 1 s        | drives com `size > 0` (exclui CD-ROM vazios)     |
| `network`  | `si.networkInterfaces()` + `si.networkStats()` | 1 s | separado em `ethernet[]` e `wifi[]`; throughput calculado como delta de bytes/s |
| `gpu`      | `si.graphics()`              | 5 s        | `model`, `vram`, `temperatureGpu`, `utilizationGpu`, `utilizationMemory` |

`disk`, `network` e `gpu` usam o pacote `systeminformation`. No Windows, `networkStats()` pode retornar array vazio (sem privilégio elevado) — o código faz fallback para `networkInterfaces()` nesse caso.

#### Endpoints WebSocket

| Path              | Descrição                                    |
|-------------------|----------------------------------------------|
| `/ws/all`         | todas as métricas a cada 1 s                 |
| `/ws/cpu`         | apenas CPU                                   |
| `/ws/memory`      | apenas memória                               |
| `/ws/disk`        | apenas disco                                 |
| `/ws/network`     | apenas rede                                  |
| `/ws/gpu`         | apenas GPU                                   |

O path inicial define a subscrição padrão, mas o cliente pode mudar enviando `{ action: 'subscribe'|'unsubscribe', metrics: string[] }`.

#### Endpoints REST

| Método | Path              | Descrição                                        |
|--------|-------------------|--------------------------------------------------|
| GET    | `/health`         | `{ status: 'ok' }`                              |
| GET    | `/metrics`        | snapshot atual de todas as métricas              |
| GET    | `/metrics/:type`  | snapshot de um tipo específico (`cpu`, `disk`, …)|
| GET/POST/PUT/PATCH/DELETE | `/:collection` | CRUD genérico no jsonDb                |
| POST   | `/api/register`   | cadastro de usuário                              |
| GET    | `/.well-known/openid-configuration` | OIDC discovery              |
| GET    | `/.well-known/jwks.json`            | chaves públicas RSA          |
| GET    | `/oauth2/authorize` | início do fluxo OAuth2 (retorna HTML)          |
| POST   | `/oauth2/login`   | submissão do form de login                       |
| POST   | `/oauth2/token`   | troca de code por access_token + id_token JWT    |
| GET    | `/userinfo`       | dados do usuário autenticado                     |

### Bancos de dados

**SQLite (`oidc.db`)** — via `node:sqlite` (nativo, Node 22+, sem dependência externa):
- `users`: id, username, email, password_hash
- `clients`: client_id, redirect_uris, allowed_scopes
- `authorization_codes`: PKCE, expiração, uso único
- `tokens`: access_token opaco, expiração

**JSON (`db.json`)** — via `jsonDb.js`:
- Collection genérica: qualquer chave JSON vira uma collection
- Suporta filtros (`field[$gt]=val`), sort, pagination (`_sort`, `_order`, `_limit`, `_offset`)
- Mutex de escrita serializa operações concorrentes
- Usado por: `todos`, `messages` (chat)

### Autenticação

OIDC completo implementado do zero em `routes/oidc.js`:
- Fluxo: Authorization Code + **PKCE (S256)**
- ID Token: JWT assinado com RSA-2048 (gerado em memória no startup)
- Access Token: opaco (hex aleatório), armazenado no SQLite
- Client padrão pré-semeado: `default-client` → `http://localhost:5173/callback`

### WebSocket de chat (`ws/chat.js`)

- Autenticação via `?token=<access_token>` na URL do WebSocket
- Broadcast para todos os clientes conectados
- Histórico: últimas 50 mensagens ao conectar
- Mensagens de sistema ao entrar/sair

---

## Frontend

### Tecnologias

- React 18 + React Router v6
- Vite 5
- CSS puro com variáveis CSS (sem Tailwind, sem CSS Modules)
- Sem biblioteca de gráficos (barras implementadas com divs)

### Autenticação (`AuthContext.jsx`)

- OIDC Authorization Code + PKCE implementado no cliente
- `code_verifier` e `state` em `sessionStorage`
- `access_token` em `localStorage`
- `useAuth()` expõe: `user`, `accessToken`, `login()`, `logout()`, `register()`, `handleCallback()`

### Roteamento (`App.jsx`)

| Rota         | Componente        | Protegido |
|--------------|-------------------|-----------|
| `/login`     | LoginPage         | não       |
| `/register`  | RegisterPage      | não       |
| `/callback`  | CallbackHandler   | não       |
| `/`          | TodoPage          | sim       |
| `/chat`      | ChatPage          | sim       |
| `/metrics`   | MetricsPage       | sim       |

### `useWebSocket(url, onMessage)`

Hook genérico em `hooks/useWebSocket.js`:
- Abre conexão WebSocket e mantém via `useRef`
- Expõe `{ connected, send }`
- Fecha ao desmontar o componente

### MetricsPage (`pages/MetricsPage.jsx`)

Cards sempre renderizados (nunca retornam `null`) — exibem "Aguardando dados…" quando o campo não chegou ainda:

| Card         | Dados exibidos                                                          |
|--------------|-------------------------------------------------------------------------|
| CPU          | Barra de uso médio + barra por core; cor: azul < 70%, amarelo < 90%, vermelho ≥ 90% |
| Memória      | Uso %, GB usado / total                                                 |
| Uptime       | Formatado em h m s                                                      |
| Disco        | Por partição: FS, mount point, tipo, barra de uso, usado/livre/total    |
| Rede         | Por interface, agrupado em Ethernet / Wi-Fi: RX e TX em bytes/s + total |
| GPU          | Modelo, vendor, VRAM, temperatura (°C), utilização GPU e VRAM (quando disponível via drivers NVIDIA/AMD) |

---

## CSS (`frontend/src/index.css`)

Variáveis globais:

```css
--primary: #4f46e5   /* indigo */
--danger:  #ef4444   /* vermelho */
--success: #22c55e   /* verde */
--warning: #f59e0b   /* amarelo */
--bg:      #f8fafc   /* fundo claro */
--surface: #ffffff   /* cards */
--border:  #e2e8f0
--text:    #1e293b
--text-muted: #64748b
--radius:  8px
```

Cards de largura total usam `.metric-card-wide` com `grid-column: 1 / -1`.

---

## Dependências relevantes

### Backend
| Pacote              | Uso                                  |
|---------------------|--------------------------------------|
| `express`           | servidor HTTP                        |
| `ws`                | WebSocket server                     |
| `cors`              | CORS middleware                      |
| `jsonwebtoken`      | assinar/verificar JWT (ID Token)     |
| `bcryptjs`          | hash de senhas                       |
| `uuid`              | geração de IDs                       |
| `systeminformation` | métricas de disco, rede e GPU        |
| `node:sqlite`       | SQLite nativo (Node 22+)             |

### Frontend
| Pacote            | Uso                       |
|-------------------|---------------------------|
| `react`           | UI                        |
| `react-dom`       | renderização              |
| `react-router-dom`| roteamento SPA            |
| `vite`            | bundler / dev server      |

---

## Decisões de design notáveis

- **`server.js` monolítico**: coleta de métricas, WebSocket e setup do servidor estão no mesmo arquivo. O arquivo `ws/monitor.js` existe mas está comentado — a lógica foi consolidada em `server.js`.
- **SQLite nativo**: usa `node:sqlite` (disponível a partir do Node 22) em vez do pacote `better-sqlite3`, sem dependências nativas adicionais.
- **OIDC próprio**: o provider OIDC é implementado do zero (sem `oidc-provider` ou similar), com RSA-2048 gerado em memória a cada restart — tokens de sessões anteriores tornam-se inválidos após reiniciar o backend.
- **JSON DB genérico**: o `genericApi.js` expõe CRUD para qualquer collection, permitindo adicionar novas entidades sem código adicional no backend.
- **Sem biblioteca de gráficos**: as barras de progresso nas métricas são divs com `width` dinâmico via inline style.
