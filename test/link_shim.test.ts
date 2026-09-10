import { describe, it, expect, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { installCliShim } from "../src/cli";

const savedPath = process.env.PATH || "";
afterEach(() => {
  process.env.PATH = savedPath;
});

async function makeRepo(): Promise<string> {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-repo-"));
  await fs.mkdir(path.join(repo, "bin"), { recursive: true });
  await fs.writeFile(path.join(repo, "bin", "ompimpa"), "#!/usr/bin/env bun\n", "utf-8");
  await fs.chmod(path.join(repo, "bin", "ompimpa"), 0o755);
  return repo;
}

describe("installCliShim (one-step installer)", () => {
  it("memasang symlink ke direktori bin pertama di PATH", async () => {
    const repo = await makeRepo();
    const binDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-bindir-"));
    process.env.PATH = `${binDir}${path.delimiter}${savedPath}`;
    try {
      const res = await installCliShim(repo, [binDir]);
      expect(res.installed).toBe(path.join(binDir, "ompimpa"));
      const st = await fs.lstat(path.join(binDir, "ompimpa"));
      expect(st.isSymbolicLink()).toBeTrue();
      expect(await fs.readlink(path.join(binDir, "ompimpa"))).toBe(path.join(repo, "bin", "ompimpa"));
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
      await fs.rm(binDir, { recursive: true, force: true });
    }
  });

  it("idempoten: symlink basi diganti tanpa duplikat", async () => {
    const repo = await makeRepo();
    const binDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-bindir-"));
    process.env.PATH = `${binDir}${path.delimiter}${savedPath}`;
    try {
      await fs.symlink(path.join(repo, "bin", "ompimpa"), path.join(binDir, "ompimpa"));
      const res = await installCliShim(repo, [binDir]);
      expect(res.installed).toBe(path.join(binDir, "ompimpa"));
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
      await fs.rm(binDir, { recursive: true, force: true });
    }
  });

  it("tidak menimpa berkas nyata milik pengguna", async () => {
    const repo = await makeRepo();
    const binDir = await fs.mkdtemp(path.join(os.tmpdir(), "ompimpa-bindir-"));
    process.env.PATH = `${binDir}${path.delimiter}${savedPath}`;
    try {
      await fs.writeFile(path.join(binDir, "ompimpa"), "milik pengguna", "utf-8");
      const res = await installCliShim(repo, [binDir]);
      expect(res.installed).toBeNull();
      expect(await fs.readFile(path.join(binDir, "ompimpa"), "utf-8")).toBe("milik pengguna");
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
      await fs.rm(binDir, { recursive: true, force: true });
    }
  });

  it("melewati direktori bin yang tidak ada di PATH", async () => {
    const repo = await makeRepo();
    try {
      const res = await installCliShim(repo, [path.join(os.tmpdir(), "pasti-tidak-di-path-xyz")]);
      expect(res.installed).toBeNull();
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });
});
