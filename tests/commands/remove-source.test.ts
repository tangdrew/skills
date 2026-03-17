import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect, Option } from "effect"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { addHandler } from "../../src/commands/add.js"
import { removeSourceHandler } from "../../src/commands/remove-source.js"
import { installSkill } from "../../src/lib/installer.js"
import { loadRegistry } from "../../src/lib/registry.js"
import { skillExists } from "../../src/lib/store.js"
import { DEFAULT_CONFIG } from "../../src/schemas/config.schema.js"

const validSkillMd = `---
name: test-skill
description: A test skill for unit testing purposes and automation.
---

# Test Skill
`

describe("remove-source command", () => {
  let origHome: string | undefined
  let tmpDir: string

  beforeEach(() => {
    origHome = process.env.HOME
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-remove-test-"))
    process.env.HOME = tmpDir
  })

  afterEach(() => {
    process.env.HOME = origHome
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("removes a skill from store and registry", async () => {
    const sourceDir = path.join(tmpDir, "test-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd)

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    expect(skillExists("test-skill")).toBe(true)

    await Effect.runPromise(
      removeSourceHandler({ name: "test-skill", force: true }),
    )

    expect(skillExists("test-skill")).toBe(false)
    const registry = await Effect.runPromise(loadRegistry())
    expect(registry.skills["test-skill"]).toBeUndefined()
  })

  it("fails for nonexistent skill", async () => {
    // Ensure config dir exists
    fs.mkdirSync(path.join(tmpDir, ".config", "skills-cli", "store"), { recursive: true })

    await expect(
      Effect.runPromise(
        removeSourceHandler({ name: "nonexistent", force: true }),
      ),
    ).rejects.toThrow("not found in store")
  })

  it("requires --force when skill is installed", async () => {
    const sourceDir = path.join(tmpDir, "test-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd)

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    // Install globally
    await Effect.runPromise(
      installSkill({
        name: "test-skill",
        scope: "global",
        mode: "symlink",
        force: false,
        config: DEFAULT_CONFIG,
      }),
    )

    // Should fail without --force
    await expect(
      Effect.runPromise(
        removeSourceHandler({ name: "test-skill", force: false }),
      ),
    ).rejects.toThrow("currently installed")

    // Should succeed with --force
    await Effect.runPromise(
      removeSourceHandler({ name: "test-skill", force: true }),
    )

    expect(skillExists("test-skill")).toBe(false)
  })
})
