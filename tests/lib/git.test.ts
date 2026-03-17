import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { execSync } from "node:child_process"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { clone, hasUncommittedChanges, parseSource, pull } from "../../src/lib/git.js"

describe("parseSource", () => {
  it("detects git SSH URL", () => {
    const result = parseSource("git@github.com:user/repo.git")
    expect(result.type).toBe("git")
    expect(result.url).toBe("git@github.com:user/repo.git")
  })

  it("detects HTTPS URL", () => {
    const result = parseSource("https://github.com/user/repo.git")
    expect(result.type).toBe("git")
    expect(result.url).toBe("https://github.com/user/repo.git")
  })

  it("detects GitHub shorthand", () => {
    const result = parseSource("user/repo")
    expect(result.type).toBe("git")
    expect(result.url).toBe("https://github.com/user/repo.git")
  })

  it("detects local path", () => {
    const result = parseSource("./my-skill")
    expect(result.type).toBe("local")
    expect(result.path).toBe("./my-skill")
  })

  it("detects absolute local path", () => {
    const result = parseSource("/home/user/skills")
    expect(result.type).toBe("local")
    expect(result.path).toBe("/home/user/skills")
  })
})

describe("clone and pull", () => {
  it("clones a local git repo", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-git-test-"))
    const sourceRepo = path.join(tmpDir, "source")
    const cloneDest = path.join(tmpDir, "clone")

    // Create a minimal git repo
    fs.mkdirSync(sourceRepo)
    execSync("git init", { cwd: sourceRepo, stdio: "pipe" })
    execSync("git config user.email 'test@test.com'", { cwd: sourceRepo, stdio: "pipe" })
    execSync("git config user.name 'Test'", { cwd: sourceRepo, stdio: "pipe" })
    fs.writeFileSync(path.join(sourceRepo, "README.md"), "# Test")
    execSync("git add . && git commit -m 'init'", { cwd: sourceRepo, stdio: "pipe" })

    await Effect.runPromise(clone(sourceRepo, cloneDest))
    expect(fs.existsSync(path.join(cloneDest, "README.md"))).toBe(true)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("pulls updates from origin", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-git-test-"))
    const sourceRepo = path.join(tmpDir, "source")
    const cloneDest = path.join(tmpDir, "clone")

    // Create repo and clone
    fs.mkdirSync(sourceRepo)
    execSync("git init", { cwd: sourceRepo, stdio: "pipe" })
    execSync("git config user.email 'test@test.com'", { cwd: sourceRepo, stdio: "pipe" })
    execSync("git config user.name 'Test'", { cwd: sourceRepo, stdio: "pipe" })
    fs.writeFileSync(path.join(sourceRepo, "README.md"), "# Test")
    execSync("git add . && git commit -m 'init'", { cwd: sourceRepo, stdio: "pipe" })

    // Clone without --depth so we can pull
    execSync(`git clone ${sourceRepo} ${cloneDest}`, { stdio: "pipe" })

    // Add a file to source and commit
    fs.writeFileSync(path.join(sourceRepo, "new.txt"), "new file")
    execSync("git add . && git commit -m 'add file'", { cwd: sourceRepo, stdio: "pipe" })

    await Effect.runPromise(pull(cloneDest))
    expect(fs.existsSync(path.join(cloneDest, "new.txt"))).toBe(true)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

describe("hasUncommittedChanges", () => {
  it("returns false for clean repo", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-git-test-"))
    fs.mkdirSync(tmpDir, { recursive: true })
    execSync("git init", { cwd: tmpDir, stdio: "pipe" })
    execSync("git config user.email 'test@test.com'", { cwd: tmpDir, stdio: "pipe" })
    execSync("git config user.name 'Test'", { cwd: tmpDir, stdio: "pipe" })
    fs.writeFileSync(path.join(tmpDir, "file.txt"), "content")
    execSync("git add . && git commit -m 'init'", { cwd: tmpDir, stdio: "pipe" })

    expect(hasUncommittedChanges(tmpDir)).toBe(false)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("returns true for dirty repo", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-git-test-"))
    fs.mkdirSync(tmpDir, { recursive: true })
    execSync("git init", { cwd: tmpDir, stdio: "pipe" })
    execSync("git config user.email 'test@test.com'", { cwd: tmpDir, stdio: "pipe" })
    execSync("git config user.name 'Test'", { cwd: tmpDir, stdio: "pipe" })
    fs.writeFileSync(path.join(tmpDir, "file.txt"), "content")
    execSync("git add . && git commit -m 'init'", { cwd: tmpDir, stdio: "pipe" })

    // Make uncommitted change
    fs.writeFileSync(path.join(tmpDir, "file.txt"), "modified")

    expect(hasUncommittedChanges(tmpDir)).toBe(true)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
