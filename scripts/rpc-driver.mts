/* Reproduce the browser's exact server-function calls against the local
 * production build. Uses TanStack's real client fetcher (seroval framing). */
const { runWithStartContext } = await import(
  new URL(
    "../node_modules/@tanstack/start-storage-context/dist/esm/async-local-storage.js",
    import.meta.url,
  ).href
);
const { serverFnFetcher } = await import(
  new URL(
    "../node_modules/@tanstack/start-client-core/dist/esm/client-rpc/serverFnFetcher.js",
    import.meta.url,
  ).href
);

const BASE = "http://127.0.0.1:8788/_serverFn/";
const IDS = {
  loadSnapshot: "880624e50edced738585069774e8da5301d3bd5b93b3ef4ba8bbe7c6cca72c05",
  syncState: "47744f03ccbc24726dd640f0ac81216dae6c320916e45bc1c721bcbcff400223",
  verifyLogin: "1fea4070ca9236081975ca4dc5a6dc9f825b683ee24f1f0cdf19b884f3aedfde",
  migrate: "7d630a1c462439611f1cf1f9d9cd41772743bc52bedc8d307405dab26c0d8d88",
  unlockUser: "4545343dec98bdf9d2480b6bd90dcca937c28baa8a6d979305e1dfc1b0e0fe29",
};

const ctx = {
  getRouter: () => ({}) as never,
  request: new Request("http://127.0.0.1:3333/"),
  startOptions: { serializationAdapters: [] },
  contextAfterGlobalMiddlewares: {},
  executedRequestMiddlewares: new Set(),
  handlerType: "serverFn",
} as never;
const call = (name: keyof typeof IDS, ...args: unknown[]) =>
  runWithStartContext(ctx, () =>
    serverFnFetcher(BASE + IDS[name], (args.length ? args : [{}]) as never, fetch as never),
  ).then((r: unknown) => {
    const o = r as { result?: unknown; error?: unknown };
    if (o && typeof o === "object" && "error" in o && o.error)
      throw new Error("server error: " + JSON.stringify(o.error));
    return o && typeof o === "object" && "result" in o ? o.result : r;
  }) as Promise<unknown>;

function section(t: string) {
  console.log("\n=== " + t + " ===");
}

try {
  section("1. loadSnapshot (GET — what hydration does)");
  const snap = (await call("loadSnapshot", { method: "GET" })) as Record<string, unknown[]> & {
    empty: boolean;
  };
  console.log(
    "ok. empty =",
    snap.empty,
    "| users:",
    snap.users?.length,
    "patients:",
    snap.patients?.length,
  );

  section("2. syncState (POST — what Save/Update does)");
  const state = {
    users: [
      {
        id: "u-admin",
        email: "admin",
        name: "Dr. Plinija",
        role: "admin",
        password: "password",
        emailId: "a@b.c",
      },
      {
        id: "u-new",
        email: "reception1",
        name: "New Receptionist",
        role: "reception",
        password: "hello123",
        emailId: "",
      },
    ],
    patients: [
      {
        id: "p1",
        pid: "STP000001",
        n: "Test Patient",
        sn: "test patient",
        dob: "1990-01-01",
        g: "M",
        m: "999",
        am: "",
        e: "",
        oc: "",
        em: "",
        emN: "",
        emP: "",
        bg: "",
        h: 170,
        w: 70,
        cc: "Back pain",
        pi: "",
        sx: "",
        med: "",
        al: "",
        cm: [],
        lf: "",
        fh: "",
        br: "br-puttur",
        status: "active",
        ts: Date.now(),
      },
    ],
    visits: [],
    notes: [],
    bookings: [],
    blocked: [],
    settings: {
      publicStatsEnabled: false,
      branches: [
        {
          id: "br-puttur",
          name: "Puttur",
          address: "x",
          mapUrl: "",
          phone: "1",
          license: "",
          enabled: true,
        },
      ],
      whatsappNumber: "9",
      globalEmail: "g@x.com",
      stats: { patients: "1+", years: "1+", recovery: "1%", programs: "1+" },
      specialities: [],
      cliniciansEnabled: false,
      clinicians: [],
    },
    session: { userId: null },
  };
  const syncRes = await call("syncState", {
    method: "POST",
    data: { data: JSON.stringify(state) },
  });
  console.log("ok. result =", JSON.stringify(syncRes));

  section("3. loadSnapshot again (what a page refresh does)");
  const snap2 = (await call("loadSnapshot", { method: "GET" })) as Record<string, unknown[]> & {
    empty: boolean;
  };
  console.log(
    "ok. users now:",
    snap2.users?.length,
    "patients:",
    snap2.patients?.length,
    "| user names:",
    (snap2.users as Array<{ name: string }>).map((u) => u.name).join(", "),
  );

  section("4. verifyLogin with the new user's password (POST)");
  const login = await call("verifyLogin", {
    method: "POST",
    data: { username: "reception1", password: "hello123" },
  });
  console.log("ok. result =", JSON.stringify(login));

  section("5. unlockUser (POST)");
  const unlock = await call("unlockUser", { method: "POST", data: { userId: "u-new" } });
  console.log("ok. result =", JSON.stringify(unlock));

  console.log("\nALL RPC CALLS SUCCEEDED");
} catch (err) {
  console.error("\nRPC FAILURE:", err);
  process.exit(1);
}

// === 6. SCALE TEST: realistic clinic volume through the Workers runtime ===
{
  console.log("\n=== 6. scale test: 150 patients + 400 visits in one sync ===");
  const mkP = (i: number) => ({
    id: `p${i}`,
    pid: `STP${String(i).padStart(6, "0")}`,
    n: `Patient ${i} O'Test`,
    sn: `patient ${i}`,
    dob: "1990-01-01",
    g: "M",
    m: String(9000000000 + i),
    am: "",
    e: "",
    oc: "",
    em: "",
    emN: "",
    emP: "",
    bg: "",
    h: 170,
    w: 70,
    cc: "Complaint; with 'quotes'",
    pi: "",
    sx: "",
    med: "",
    al: "",
    cm: [1],
    lf: "",
    fh: "",
    br: "br-puttur",
    status: "active",
    ts: i,
  });
  const mkV = (i: number) => ({
    id: `v${i}`,
    patientId: `p${(i % 150) + 1}`,
    vN: 1,
    dt: "2026-07-01",
    tId: "u-admin",
    tN: "Dr",
    pS: 5,
    sym: "s",
    rom: "r",
    str: "s",
    tx: "t",
    adv: "a",
    fi: 10,
    nxt: "",
    nxtTm: null,
    dur: 30,
  });
  const big = {
    users: [
      {
        id: "u-admin",
        email: "admin",
        name: "Dr. Plinija",
        role: "admin",
        password: "password",
        emailId: "",
      },
    ],
    patients: Array.from({ length: 150 }, (_, i) => mkP(i + 1)),
    visits: Array.from({ length: 400 }, (_, i) => mkV(i + 1)),
    notes: [],
    bookings: [],
    blocked: [],
    settings: {
      publicStatsEnabled: false,
      branches: [
        {
          id: "br-puttur",
          name: "Puttur",
          address: "x",
          mapUrl: "",
          phone: "1",
          license: "",
          enabled: true,
        },
      ],
      whatsappNumber: "9",
      globalEmail: "g@x.com",
      stats: { patients: "1+", years: "1+", recovery: "1%", programs: "1+" },
      specialities: [],
      cliniciansEnabled: false,
      clinicians: [],
    },
    session: { userId: null },
  };
  const t0 = Date.now();
  const res = (await call("syncState", {
    method: "POST",
    data: { data: JSON.stringify(big) },
  })) as { ok: boolean; failures: string[] };
  console.log(
    `sync of 551 records: ok=${res.ok} failures=${res.failures.length} in ${Date.now() - t0}ms`,
  );
  const snap3 = (await call("loadSnapshot", { method: "GET" })) as {
    users: unknown[];
    patients: unknown[];
    visits: unknown[];
  };
  console.log(
    `refresh sees: users=${snap3.users.length} patients=${snap3.patients.length} visits=${snap3.visits.length}`,
  );
  if (snap3.patients.length !== 150 || snap3.visits.length !== 400)
    throw new Error("scale persistence mismatch");
  console.log("SCALE TEST PASSED");
}
