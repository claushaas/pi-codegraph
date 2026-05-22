import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodegraphCliError, runCodegraph } from "../src/cli.js";
import {
  getCodegraphBin,
  getCodegraphInvocation,
  TIMEOUTS,
} from "../src/config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cria um mock mínimo de ExtensionAPI com pi.exec controlável. */
function createMockPi(
  execImpl: (
    cmd: string,
    args: string[],
    opts?: { signal?: AbortSignal; timeout?: number },
  ) => Promise<{ stdout: string; stderr: string; code: number }>,
): ExtensionAPI {
  return {
    exec: vi.fn(execImpl),
  } as unknown as ExtensionAPI;
}

/** Mock que retorna sucesso. */
function mockSuccess(
  stdout = "",
  stderr = "",
): ReturnType<typeof createMockPi> {
  return createMockPi(async (_cmd, _args, _opts) => ({
    stdout,
    stderr,
    code: 0,
  }));
}

/** Mock que retorna erro. */
function mockError(
  code: number,
  stderr = "",
  stdout = "",
): ReturnType<typeof createMockPi> {
  return createMockPi(async (_cmd, _args, _opts) => ({ stdout, stderr, code }));
}

// ---------------------------------------------------------------------------
// getCodegraphBin
// ---------------------------------------------------------------------------

describe("getCodegraphBin", () => {
  const original = process.env.PI_CODEGRAPH_BIN;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PI_CODEGRAPH_BIN;
    } else {
      process.env.PI_CODEGRAPH_BIN = original;
    }
  });

  it("usa a CLI empacotada por padrão", () => {
    delete process.env.PI_CODEGRAPH_BIN;
    expect(getCodegraphBin()).toContain("@colbymchenry/codegraph");
    const invocation = getCodegraphInvocation();
    expect(invocation.bin).toBe(process.execPath);
    expect(invocation.prefixArgs[0]).toContain("@colbymchenry/codegraph");
  });

  it("respeita PI_CODEGRAPH_BIN", () => {
    process.env.PI_CODEGRAPH_BIN = "/usr/local/bin/codegraph-custom";
    expect(getCodegraphBin()).toBe("/usr/local/bin/codegraph-custom");
    expect(getCodegraphInvocation()).toEqual({
      bin: "/usr/local/bin/codegraph-custom",
      prefixArgs: [],
    });
  });
});

// ---------------------------------------------------------------------------
// runCodegraph — sucesso
// ---------------------------------------------------------------------------

describe("runCodegraph (sucesso)", () => {
  it("chama pi.exec com binário, args e timeout padrão", async () => {
    const pi = mockSuccess("ok");
    await runCodegraph(pi, ["status", "."]);
    expect(pi.exec).toHaveBeenCalledOnce();
    const [bin, args, opts] = (pi.exec as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(bin).toBe(process.execPath);
    expect(args[0]).toContain("@colbymchenry/codegraph");
    expect(args.slice(1)).toEqual(["status", "."]);
    expect(opts).toMatchObject({ timeout: TIMEOUTS.quick });
  });

  it("respeita timeout customizado", async () => {
    const pi = mockSuccess();
    await runCodegraph(pi, ["index", "."], { timeout: 120_000 });
    const [, , opts] = (pi.exec as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.timeout).toBe(120_000);
  });

  it("retorna stdout, stderr e code no resultado", async () => {
    const pi = mockSuccess("hello", "world");
    const result = await runCodegraph(pi, ["status"]);
    expect(result.stdout).toBe("hello");
    expect(result.stderr).toBe("world");
    expect(result.code).toBe(0);
  });

  it("passa signal para pi.exec", async () => {
    const controller = new AbortController();
    const pi = mockSuccess();
    await runCodegraph(pi, ["status"], {}, controller.signal);
    const [, , opts] = (pi.exec as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.signal).toBe(controller.signal);
  });
});

// ---------------------------------------------------------------------------
// runCodegraph — erro
// ---------------------------------------------------------------------------

describe("runCodegraph (erro)", () => {
  it("lança CodegraphCliError quando code !== 0", async () => {
    const pi = mockError(1, "fatal error");
    await expect(runCodegraph(pi, ["status"])).rejects.toThrow(
      CodegraphCliError,
    );
  });

  it("inclui código, stdout e stderr no erro", async () => {
    const pi = mockError(2, "stderr msg", "stdout msg");
    try {
      await runCodegraph(pi, ["index"]);
      expect.fail("deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(CodegraphCliError);
      const ce = err as CodegraphCliError;
      expect(ce.code).toBe(2);
      expect(ce.stdout).toBe("stdout msg");
      expect(ce.stderr).toBe("stderr msg");
      expect(ce.message).toContain("codegraph index");
      expect(ce.message).toContain("código 2");
    }
  });

  it("usa stdout no erro quando stderr é vazio", async () => {
    const pi = mockError(3, "", "only stdout");
    try {
      await runCodegraph(pi, ["sync"]);
      expect.fail("deveria ter lançado");
    } catch (err) {
      const ce = err as CodegraphCliError;
      expect(ce.message).toContain("only stdout");
    }
  });

  it("mostra placeholder quando stdout e stderr são vazios", async () => {
    const pi = mockError(4, "", "");
    try {
      await runCodegraph(pi, ["status"]);
      expect.fail("deveria ter lançado");
    } catch (err) {
      const ce = err as CodegraphCliError;
      expect(ce.message).toContain("(sem saída)");
    }
  });
});

// ---------------------------------------------------------------------------
// runCodegraph — parse JSON
// ---------------------------------------------------------------------------

describe("runCodegraph (parse JSON)", () => {
  it("parseia JSON quando parseJson é true e stdout é JSON válido", async () => {
    const data = { languages: ["ts"], nodes: 42 };
    const pi = mockSuccess(JSON.stringify(data));
    const result = await runCodegraph(pi, ["query", "foo", "--json"], {
      parseJson: true,
    });
    expect(result.json).toEqual(data);
  });

  it("não popula json quando parseJson é false (padrão)", async () => {
    const pi = mockSuccess('{"a":1}');
    const result = await runCodegraph(pi, ["query", "foo"]);
    expect(result.json).toBeUndefined();
  });

  it("não popula json quando stdout é vazio", async () => {
    const pi = mockSuccess("  ");
    const result = await runCodegraph(pi, ["status"], { parseJson: true });
    expect(result.json).toBeUndefined();
  });

  it("não popula json quando stdout é JSON inválido (fallback silencioso)", async () => {
    const pi = mockSuccess("not json at all");
    const result = await runCodegraph(pi, ["query", "foo"], {
      parseJson: true,
    });
    expect(result.json).toBeUndefined();
    // stdout permanece como texto
    expect(result.stdout).toBe("not json at all");
  });

  it("preserva stdout mesmo quando JSON falha no parse", async () => {
    const pi = mockSuccess("{ broken");
    const result = await runCodegraph(pi, ["query", "x", "--json"], {
      parseJson: true,
    });
    expect(result.json).toBeUndefined();
    expect(result.stdout).toBe("{ broken");
  });
});
