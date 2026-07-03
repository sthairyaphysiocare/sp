/* Minimal Hrana-over-HTTP (v2/v3 pipeline) shim so @libsql/client/web can
 * talk to a local file database exactly as it talks to Turso. */
import http from "node:http";
import { createClient } from "@libsql/client";

const db = createClient({ url: process.env.SHIM_DB || "file:/tmp/shim.db" });

function fromHrana(v) {
  switch (v.type) {
    case "null":
      return null;
    case "integer":
      return BigInt(v.value);
    case "float":
      return Number(v.value);
    case "text":
      return String(v.value);
    case "blob":
      return Buffer.from(v.base64, "base64");
    default:
      return null;
  }
}
function toHrana(v) {
  if (v === null || v === undefined) return { type: "null" };
  if (typeof v === "bigint") return { type: "integer", value: String(v) };
  if (typeof v === "number")
    return Number.isInteger(v)
      ? { type: "integer", value: String(v) }
      : { type: "float", value: v };
  if (v instanceof Uint8Array || Buffer.isBuffer(v))
    return { type: "blob", base64: Buffer.from(v).toString("base64") };
  return { type: "text", value: String(v) };
}

async function runStmt(stmt, sqlStore) {
  const sql = stmt.sql ?? (sqlStore ? sqlStore.get(stmt.sql_id) : undefined);
  if (typeof sql !== "string") throw new Error("failed to downcast any to string");
  const args = (stmt.args ?? []).map(fromHrana);
  const named = {};
  for (const na of stmt.named_args ?? []) named[na.name] = fromHrana(na.value);
  const res = await db.execute({
    sql,
    args: Object.keys(named).length ? named : args,
  });
  return {
    cols: res.columns.map((name) => ({ name, decltype: null })),
    rows: res.rows.map((row) => res.columns.map((_, i) => toHrana(row[i]))),
    affected_row_count: Number(res.rowsAffected ?? 0),
    last_insert_rowid: res.lastInsertRowid != null ? String(res.lastInsertRowid) : null,
    replication_index: null,
    rows_read: 0,
    rows_written: 0,
    query_duration_ms: 0,
  };
}

const server = http.createServer(async (req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    try {
      if (req.url === "/v2" || req.url === "/v3") {
        // health probes
        res.writeHead(200).end();
        return;
      }
      if (!/\/v[23]\/pipeline$/.test(req.url ?? "")) {
        res.writeHead(404).end("not found");
        return;
      }
      const { requests = [] } = JSON.parse(body || "{}");
      const sqlStore = new Map();
      globalThis.__pipelines = (globalThis.__pipelines ?? 0) + 1;
      console.log(`pipeline #${globalThis.__pipelines} (${requests.length} stmts)`);
      if (process.env.SHIM_DEBUG) console.log("REQ:", JSON.stringify(requests).slice(0, 1500));
      const results = [];
      for (const r of requests) {
        try {
          if (r.type === "execute") {
            results.push({
              type: "ok",
              response: { type: "execute", result: await runStmt(r.stmt, sqlStore) },
            });
          } else if (r.type === "store_sql") {
            sqlStore.set(r.sql_id, r.sql);
            results.push({ type: "ok", response: { type: "store_sql" } });
          } else if (r.type === "close_sql") {
            sqlStore.delete(r.sql_id);
            results.push({ type: "ok", response: { type: "close_sql" } });
          } else if (r.type === "batch") {
            const stepRes = [];
            const stepErr = [];
            const evalCond = (cond) => {
              if (!cond) return true;
              if (cond.type === "ok")
                return (
                  stepErr[cond.step] === null &&
                  stepRes[cond.step] !== undefined &&
                  stepRes[cond.step] !== null
                );
              if (cond.type === "error") return stepErr[cond.step] != null;
              if (cond.type === "not") return !evalCond(cond.cond);
              if (cond.type === "and") return cond.conds.every(evalCond);
              if (cond.type === "or") return cond.conds.some(evalCond);
              return true;
            };
            for (const step of r.batch.steps) {
              if (!evalCond(step.condition)) {
                stepRes.push(null);
                stepErr.push(null);
                continue;
              }
              try {
                stepRes.push(await runStmt(step.stmt, sqlStore));
                stepErr.push(null);
              } catch (e) {
                stepRes.push(null);
                stepErr.push({ message: String(e.message ?? e) });
              }
            }
            results.push({
              type: "ok",
              response: { type: "batch", result: { step_results: stepRes, step_errors: stepErr } },
            });
          } else if (r.type === "close") {
            results.push({ type: "ok", response: { type: "close" } });
          } else {
            results.push({ type: "error", error: { message: `unsupported request: ${r.type}` } });
          }
        } catch (e) {
          results.push({ type: "error", error: { message: String(e.message ?? e) } });
        }
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ baton: null, base_url: null, results }));
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(e.message ?? e) }));
    }
  });
});
server.listen(8080, "127.0.0.1", () => console.log("hrana shim on http://127.0.0.1:8080"));
