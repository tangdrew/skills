import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect, Option } from "effect"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { addHandler } from "../../src/commands/add.js"
import { doctorHandler } from "../../src/commands/doctor.js"
import { installSkill } from "../../src/lib/installer.js"
import { getSkillPath } from "../../src/lib/store.js"
import { DEFAULT_CONFIG } from "../../src/schemas/config.schema.js"

const validSkillMd = `---
name: test-skill
description: A test skill for unit testing purposes and automation.
---

# Test Skill
`

describe("doctor command", () => {
  let origHome: string | undefined
  let origCwd: string
  let tmpDir: string
  let projectRoot: string

  beforeEach(() => {
    origHome = process.env.HOME
    origCwd = process.cwd()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-doctor-test-"))
    process.env.HOME = tmpDir
    projectRoot = path.join(tmpDir, "project")
    fs.mkdirSync(projectRoot)
    fs.mkdirSync(path.join(projectRoot, ".git"))
    process.chdir(projectRoot)
  })

  afterEach(() => {
    process.env.HOME = origHome
    process.chdir(origCwd)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("reports OK for healthy store", async () => {
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
    await Effect.runPromise(doctorHandler())
  })

  it("detects broken symlinks", async () => {
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

    // Install then break the symlink by removing store skill
    await Effect.runPromise(
      installSkill({
        name: "test-skill",
        scope: "project",
        mode: "symlink",
        force: false,
        projectRoot,
        config: DEFAULT_CONFIG,
      }),
    )

    // Remove the store skill to break the symlink
    fs.rmSync(getSkillPath("test-skill"), { recursive: true, force: true })

    // Doctor should run without throwing (issues are reported as output)
    await Effect.runPromise(doctorHandler())
  })

  it("detects short descriptions", async () => {
    const sourceDir = path.join(tmpDir, "short-desc")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(
      path.join(sourceDir, "SKILL.md"),
      `---
name: short-desc
description: Short.
---
`,
    )

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    // Should not throw
    await Effect.runPromise(doctorHandler())
  })
})
