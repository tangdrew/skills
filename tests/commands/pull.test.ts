import { execSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect, Option } from "effect"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { addHandler } from "../../src/commands/add.js"
import { pullHandler } from "../../src/commands/pull.js"
import { getSkillPath } from "../../src/lib/store.js"

const validSkillMd = (name: string) => `---
name: ${name}
description: A test skill for unit testing purposes and automation.
---

# ${name}
`

describe("pull command", () => {
  let origHome: string | undefined
  let tmpDir: string
  let sourceRepo: string

  beforeEach(() => {
    origHome = process.env.HOME
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-pull-test-"))
    process.env.HOME = tmpDir

    // Create a git repo with a skill
    sourceRepo = path.join(tmpDir, "source-repo")
    fs.mkdirSync(sourceRepo)
    execSync("git init", { cwd: sourceRepo, stdio: "pipe" })
    execSync("git config user.email 'test@test.com'", { cwd: sourceRepo, stdio: "pipe" })
    execSync("git config user.name 'Test'", { cwd: sourceRepo, stdio: "pipe" })

    const skillDir = path.join(sourceRepo, "my-skill")
    fs.mkdirSync(skillDir)
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), validSkillMd("my-skill"))
    execSync("git add . && git commit -m 'init'", { cwd: sourceRepo, stdio: "pipe" })
  })

  afterEach(() => {
    process.env.HOME = origHome
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("pulls updates from git source", async () => {
    // Add skill using file:// URL so it's treated as a git source
    await Effect.runPromise(
      addHandler({
        source: `file://${sourceRepo}`,
        skill: ["my-skill"],
        name: Option.none(),
        force: false,
      }),
    )

    // Modify the source repo
    const skillMdPath = path.join(sourceRepo, "my-skill", "SKILL.md")
    fs.writeFileSync(skillMdPath, validSkillMd("my-skill").replace("A test skill", "An updated skill"))
    execSync("git add . && git commit -m 'update'", { cwd: sourceRepo, stdio: "pipe" })

    // Pull
    await Effect.runPromise(pullHandler({ name: Option.none() }))

    // Verify store was updated
    const storeMd = fs.readFileSync(path.join(getSkillPath("my-skill"), "SKILL.md"), "utf-8")
    expect(storeMd).toContain("An updated skill")
  })

  it("reports error for uncommitted changes in cache", async () => {
    // Add skill using file:// URL so it's treated as a git source
    await Effect.runPromise(
      addHandler({
        source: `file://${sourceRepo}`,
        skill: ["my-skill"],
        name: Option.none(),
        force: false,
      }),
    )

    // Find the cache directory and make it dirty
    const cacheBase = path.join(tmpDir, ".config", "skills-cli", "cache")
    const cacheEntries = fs.readdirSync(cacheBase)
    expect(cacheEntries.length).toBeGreaterThan(0)
    const cachePath = path.join(cacheBase, cacheEntries[0])

    // Create an uncommitted change in the cache repo
    fs.writeFileSync(path.join(cachePath, "dirty.txt"), "uncommitted")

    // Pull should skip this skill with an error message (not throw)
    await Effect.runPromise(pullHandler({ name: Option.none() }))
  })

  it("skips local-sourced skills", async () => {
    // Add a local skill
    const localDir = path.join(tmpDir, "local-skill")
    fs.mkdirSync(localDir)
    fs.writeFileSync(path.join(localDir, "SKILL.md"), validSkillMd("local-skill"))

    await Effect.runPromise(
      addHandler({
        source: localDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    // Pull should not fail, just skip
    await Effect.runPromise(
      pullHandler({ name: Option.some("local-skill") }),
    )
  })
})
