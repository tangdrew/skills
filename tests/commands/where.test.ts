import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect, Option } from "effect"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { addHandler } from "../../src/commands/add.js"
import { whereHandler } from "../../src/commands/where.js"
import { installSkill } from "../../src/lib/installer.js"
import { DEFAULT_CONFIG } from "../../src/schemas/config.schema.js"

const validSkillMd = `---
name: test-skill
description: A test skill for unit testing purposes and automation.
---

# Test Skill
`

describe("where command", () => {
  let origHome: string | undefined
  let tmpDir: string

  beforeEach(() => {
    origHome = process.env.HOME
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-where-test-"))
    process.env.HOME = tmpDir
  })

  afterEach(() => {
    process.env.HOME = origHome
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("shows store and source info", async () => {
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

    // Should not throw
    await Effect.runPromise(whereHandler({ name: "test-skill" }))
  })

  it("fails for nonexistent skill", async () => {
    fs.mkdirSync(path.join(tmpDir, ".config", "skills-cli", "store"), { recursive: true })

    await expect(
      Effect.runPromise(whereHandler({ name: "nonexistent" })),
    ).rejects.toThrow("not found in store")
  })
})
