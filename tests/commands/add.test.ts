import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect, Option } from "effect"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { addHandler } from "../../src/commands/add.js"
import { loadRegistry } from "../../src/lib/registry.js"
import { skillExists } from "../../src/lib/store.js"

const validSkillMd = `---
name: test-skill
description: A test skill for unit testing purposes and automation.
---

# Test Skill
`

describe("add command", () => {
  let origHome: string | undefined
  let tmpDir: string

  beforeEach(() => {
    origHome = process.env.HOME
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-add-test-"))
    process.env.HOME = tmpDir
  })

  afterEach(() => {
    process.env.HOME = origHome
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("adds a single skill from local directory", async () => {
    // Create a source skill
    const sourceDir = path.join(tmpDir, "my-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd.replace("test-skill", "my-skill"))

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    expect(skillExists("my-skill")).toBe(true)
    const registry = await Effect.runPromise(loadRegistry())
    expect(registry.skills["my-skill"]).toBeDefined()
    expect(registry.skills["my-skill"].source.type).toBe("local")
  })

  it("adds multiple skills from a directory", async () => {
    const sourceDir = path.join(tmpDir, "repo")
    fs.mkdirSync(sourceDir)

    for (const name of ["skill-a", "skill-b"]) {
      const dir = path.join(sourceDir, name)
      fs.mkdirSync(dir)
      fs.writeFileSync(
        path.join(dir, "SKILL.md"),
        validSkillMd.replace("test-skill", name),
      )
    }

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    expect(skillExists("skill-a")).toBe(true)
    expect(skillExists("skill-b")).toBe(true)
  })

  it("filters by --skill", async () => {
    const sourceDir = path.join(tmpDir, "repo")
    fs.mkdirSync(sourceDir)

    for (const name of ["skill-a", "skill-b"]) {
      const dir = path.join(sourceDir, name)
      fs.mkdirSync(dir)
      fs.writeFileSync(
        path.join(dir, "SKILL.md"),
        validSkillMd.replace("test-skill", name),
      )
    }

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: ["skill-a"],
        name: Option.none(),
        force: false,
      }),
    )

    expect(skillExists("skill-a")).toBe(true)
    expect(skillExists("skill-b")).toBe(false)
  })

  it("overrides name with --name for single skill", async () => {
    const sourceDir = path.join(tmpDir, "my-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd.replace("test-skill", "my-skill"))

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.some("custom-name"),
        force: false,
      }),
    )

    expect(skillExists("custom-name")).toBe(true)
    expect(skillExists("my-skill")).toBe(false)
  })
})
