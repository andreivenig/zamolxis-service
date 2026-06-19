// Arduino compile microservice
// POST /compile  { sketch: string, fqbn: string, libraries?: string[] }
//   -> { ok, binary_base64, ext, size, stdout, stderr }
// GET  /health   -> { ok: true, cores: [...] }
//
// Auth: header  x-compile-token: <ARDUINO_COMPILE_TOKEN>

const TOKEN = Deno.env.get("ARDUINO_COMPILE_TOKEN") ?? "";
const PORT = Number(Deno.env.get("PORT") ?? "8080");

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-compile-token",
  "access-control-allow-methods": "POST, GET, OPTIONS",
};

async function run(cmd: string[], opts: { cwd?: string } = {}) {
  const p = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd: opts.cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await p.output();
  return {
    code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

async function compile(body: { sketch: string; fqbn: string; libraries?: string[] }) {
  if (!body.sketch || !body.fqbn) throw new Error("missing sketch or fqbn");
  if (body.sketch.length > 200_000) throw new Error("sketch too large");

  const tmp = await Deno.makeTempDir({ prefix: "sk_" });
  const sketchDir = `${tmp}/sketch`;
  await Deno.mkdir(sketchDir, { recursive: true });
  await Deno.writeTextFile(`${sketchDir}/sketch.ino`, body.sketch);

  if (Array.isArray(body.libraries)) {
    for (const lib of body.libraries.slice(0, 10)) {
      await run(["arduino-cli", "lib", "install", lib]);
    }
  }

  const out = await run([
    "arduino-cli", "compile",
    "--fqbn", body.fqbn,
    "--output-dir", `${tmp}/build`,
    sketchDir,
  ]);

  if (out.code !== 0) {
    return { ok: false, stdout: out.stdout, stderr: out.stderr };
  }

  // Find resulting binary (.bin for esp*, .hex for avr, .uf2 for rp2040)
  let binPath = "";
  let ext = "";
  for await (const f of Deno.readDir(`${tmp}/build`)) {
    if (f.isFile && /\.(bin|hex|uf2)$/.test(f.name) && !f.name.includes("partitions") && !f.name.includes("bootloader")) {
      binPath = `${tmp}/build/${f.name}`;
      ext = f.name.split(".").pop()!;
      break;
    }
  }
  if (!binPath) return { ok: false, stdout: out.stdout, stderr: "no output binary produced" };

  const bytes = await Deno.readFile(binPath);
  const b64 = btoa(String.fromCharCode(...bytes));
  Deno.remove(tmp, { recursive: true }).catch(() => {});
  return { ok: true, binary_base64: b64, ext, size: bytes.length, stdout: out.stdout, stderr: out.stderr };
}

Deno.serve({ port: PORT }, async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);

  if (url.pathname === "/health") {
    const cores = await run(["arduino-cli", "core", "list"]);
    return new Response(JSON.stringify({ ok: true, cores: cores.stdout }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  }

  if (url.pathname === "/compile" && req.method === "POST") {
    const auth = req.headers.get("x-compile-token") ?? "";
    if (!TOKEN || auth !== TOKEN) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...cors, "content-type": "application/json" },
      });
    }
    try {
      const body = await req.json();
      const result = await compile(body);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 400,
        headers: { ...cors, "content-type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
        status: 400, headers: { ...cors, "content-type": "application/json" },
      });
    }
  }

  return new Response("not found", { status: 404, headers: cors });
});

console.log(`arduino-compile-service listening on :${PORT}`);
