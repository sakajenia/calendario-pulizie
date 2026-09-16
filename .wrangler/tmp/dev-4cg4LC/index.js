var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.ts
var DURATA_GETTONE = 30 * 24 * 60 * 60 * 1e3;
var SALE = "ppm-2026";
var TIPI = [
  "users",
  "apartments",
  "requests",
  "inspections",
  "interventions",
  "adminExpenses"
];
var json = /* @__PURE__ */ __name((dati, status = 200) => new Response(JSON.stringify(dati), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
}), "json");
var bytes = /* @__PURE__ */ __name((s) => new TextEncoder().encode(s), "bytes");
async function impronta(testo) {
  const buf = await crypto.subtle.digest("SHA-256", bytes(testo));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(impronta, "impronta");
async function chiave(segreto) {
  return crypto.subtle.importKey("raw", bytes(segreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
__name(chiave, "chiave");
async function creaGettone(utenteId, segreto) {
  const corpo = `${utenteId}.${Date.now() + DURATA_GETTONE}`;
  const firma = await crypto.subtle.sign("HMAC", await chiave(segreto), bytes(corpo));
  const esa = [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${corpo}.${esa}`;
}
__name(creaGettone, "creaGettone");
async function leggiGettone(gettone, segreto) {
  if (!gettone) return null;
  const pezzi = gettone.split(".");
  if (pezzi.length !== 3) return null;
  const [utenteId, scadenza, esa] = pezzi;
  if (!/^\d+$/.test(scadenza) || Number(scadenza) < Date.now()) return null;
  const firma = Uint8Array.from(esa.match(/.{1,2}/g) ?? [], (h) => parseInt(h, 16));
  const valida = await crypto.subtle.verify("HMAC", await chiave(segreto), firma, bytes(`${utenteId}.${scadenza}`));
  return valida ? utenteId : null;
}
__name(leggiGettone, "leggiGettone");
var gettoneDallaRichiesta = /* @__PURE__ */ __name((req) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null, "gettoneDallaRichiesta");
async function accesso(req, env, segreto) {
  const corpo = await req.json().catch(() => ({}));
  const id = (corpo.identificativo ?? "").trim().toLowerCase();
  const password = corpo.password ?? "";
  if (!id || !password) return json({ errore: "Servono nome utente e password" }, 400);
  const riga = await env.DB.prepare("SELECT id, email, username, password_hash, ruolo, nome FROM utente WHERE lower(email) = ?1 OR lower(username) = ?1").bind(id).first();
  if (!riga) return json({ errore: "Nessun utente trovato per questa email o nome utente" }, 401);
  if (await impronta(SALE + password) !== riga.password_hash) {
    return json({ errore: "Password errata fornita per questo utente" }, 401);
  }
  return json({
    gettone: await creaGettone(riga.id, segreto),
    utente: { id: riga.id, nome: riga.nome, email: riga.email, username: riga.username, ruolo: riga.ruolo }
  });
}
__name(accesso, "accesso");
async function leggiDati(req, env) {
  const da = Number(new URL(req.url).searchParams.get("da") ?? 0);
  const esito = await env.DB.prepare("SELECT tipo, id, dati, eliminato, aggiornato FROM record WHERE aggiornato > ?1 ORDER BY aggiornato ASC LIMIT 5000").bind(Number.isFinite(da) ? da : 0).all();
  const record = (esito.results ?? []).map((r) => ({
    tipo: r.tipo,
    id: r.id,
    eliminato: r.eliminato === 1,
    aggiornato: r.aggiornato,
    dati: r.dati ? JSON.parse(r.dati) : null
  }));
  const adesso = record.length ? record[record.length - 1].aggiornato : Date.now();
  return json({ record, adesso });
}
__name(leggiDati, "leggiDati");
async function scriviDati(req, env) {
  const corpo = await req.json().catch(() => ({}));
  const righe = (corpo.record ?? []).filter((r) => r && TIPI.includes(r.tipo) && typeof r.id === "string");
  if (righe.length === 0) return json({ scritti: 0, adesso: Date.now() });
  if (righe.length > 2e3) return json({ errore: "Troppe righe in una volta sola" }, 413);
  const adesso = Date.now();
  const stmt = env.DB.prepare(
    `INSERT INTO record (tipo, id, dati, eliminato, aggiornato) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (tipo, id) DO UPDATE SET dati = ?3, eliminato = ?4, aggiornato = ?5`
  );
  await env.DB.batch(
    righe.map((r) => stmt.bind(r.tipo, r.id, r.eliminato ? null : JSON.stringify(r.dati), r.eliminato ? 1 : 0, adesso))
  );
  return json({ scritti: righe.length, adesso });
}
__name(scriviDati, "scriviDati");
var worker_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    if (!env.DB) {
      return json({ errore: "Archivio condiviso non collegato" }, 503);
    }
    const segreto = env.SYNC_SECRET ?? "propromanager-archivio";
    try {
      if (url.pathname === "/api/stato") return json({ ok: true });
      if (url.pathname === "/api/accesso" && req.method === "POST") return accesso(req, env, segreto);
      const utenteId = await leggiGettone(gettoneDallaRichiesta(req), segreto);
      if (!utenteId) return json({ errore: "Accesso scaduto: rientra con la password" }, 401);
      if (url.pathname === "/api/dati" && req.method === "GET") return leggiDati(req, env);
      if (url.pathname === "/api/dati" && req.method === "POST") return scriviDati(req, env);
      return json({ errore: "Non trovato" }, 404);
    } catch (e) {
      return json({ errore: `Archivio non raggiungibile: ${String(e).slice(0, 200)}` }, 500);
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-Bobepv/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Bobepv/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
