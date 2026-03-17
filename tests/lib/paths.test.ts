import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect, Option } from "effect"
import { describe, expect, it } from "vitest"
import { cacheKeyForUrl, expandTilde, findProjectRoot } from "../../src/lib/paths.js"

describe("expandTilde", () => {
  it("expands ~/path to home directory", () => {
    const result = expandTilde("~/foo/bar")
    expect(result).toBe(path.join(os.homedir(), "foo/bar"))
  })

  it("expands bare ~", () => {
    const result = expandTilde("~")
    expect(result).toBe(os.homedir())
  })

  it("does not expand paths without tilde", () => {
    expect(expandTilde("/usr/bin")).toBe("/usr/bin")
    expect(expandTilde("relative/path")).toBe("relative/path")
  })
})

describe("cacheKeyForUrl", () => {
  it("returns a 12-char hex string", () => {
    const key = cacheKeyForUrl("https://github.com/user/repo.git")
    expect(key).toMatch(/^[0-9a-f]{12}$/)
  })

  it("returns same key for same URL", () => {
    const url = "https://github.com/user/repo.git"
    expect(cacheKeyForUrl(url)).toBe(cacheKeyForUrl(url))
  })

  it("returns different keys for different URLs", () => {
    const key1 = cacheKeyForUrl("https://github.com/user/repo1.git")
    const key2 = cacheKeyForUrl("https://github.com/user/repo2.git")
    expect(key1).not.toBe(key2)
  })
})

describe("findProjectRoot", () => {
  it("finds .git directory walking up", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"))
    const gitDir = path.join(tmpDir, ".git")
    const nested = path.join(tmpDir, "a", "b", "c")
    fs.mkdirSync(gitDir)
    fs.mkdirSync(nested, { recursive: true })

    const result = Effect.runSync(findProjectRoot(nested))
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toBe(tmpDir)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("returns None when no .git found", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"))
    const nested = path.join(tmpDir, "a", "b")
    fs.mkdirSync(nested, { recursive: true })

    const result = Effect.runSync(findProjectRoot(nested))
    expect(Option.isNone(result)).toBe(true)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
