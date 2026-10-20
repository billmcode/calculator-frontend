// Node harness that imports and executes the *actual, unmodified*
// `src/api/calculatorApi.ts` module (run directly via Node's
// `--experimental-strip-types`, not transpiled/duplicated) against a real
// HTTP backend.
//
// `calculatorApi.ts` hardcodes relative URLs (e.g. `/api/calculations`),
// which only resolve in a browser against the current page origin. We
// reproduce that by wrapping `global.fetch` to resolve leading-slash paths
// against the real, running Vite dev server (`FT_VITE_BASE`), so requests
// take the exact same path a browser would: through Vite's own `/api`
// proxy (`vite.config.ts`) and on to the mock backend - real network I/O
// at every hop, exercising the shipped code as-is.
//
// Usage: node --experimental-strip-types node_harness.mjs <command> [args...]
const BASE = process.env.FT_VITE_BASE || 'http://localhost:5173';

let lastStatus = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const resp =
    typeof input === 'string' && input.startsWith('/')
      ? await realFetch(BASE + input, init)
      : await realFetch(input, init);
  lastStatus = resp.status;
  return resp;
};

const mod = await import(new URL('../../../src/api/calculatorApi.ts', import.meta.url));

const [, , command, ...args] = process.argv;

async function main() {
  switch (command) {
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide': {
      const a = Number(args[0]);
      const b = Number(args[1]);
      const result = await mod[command](a, b);
      process.stdout.write(JSON.stringify({ ok: true, result, status: lastStatus }));
      break;
    }
    case 'getHistory': {
      const result = await mod.getHistory();
      process.stdout.write(JSON.stringify({ ok: true, result, status: lastStatus }));
      break;
    }
    case 'deleteCalculation': {
      const id = Number(args[0]);
      const result = await mod.deleteCalculation(id);
      process.stdout.write(
        JSON.stringify({ ok: true, result: result === undefined ? null : result, status: lastStatus }),
      );
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((err) => {
  const isApiError = err && err.name === 'ApiError';
  process.stdout.write(
    JSON.stringify({
      ok: false,
      errorName: err && err.name,
      message: err && err.message,
      status: isApiError ? err.status : lastStatus,
      detail: isApiError ? err.detail : undefined,
    }),
  );
  process.exit(1);
});
