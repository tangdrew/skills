import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect, Option } from "effect"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { addHandler } from "../../src/commands/add.js"
import { listSkills } from "../../src/lib/store.js"
import { checkInstallStatus, installSkill } from "../../src/lib/installer.js"
import { DEFAULT_CONFIG } from "../../src/schemas/config.schema.js"

const validSkillMd = (name: string) => `---
name: ${name}
description: A test skill for unit testing purposes and automation.
---

# ${name}
`

describe("list command", () => {
  let origHome: string | undefined
  let tmpDir: string
  let projectRoot: string

  beforeEach(() => {
    origHome = process.env.HOME
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-list-test-"))
    process.env.HOME = tmpDir
    projectRoot = path.join(tmpDir, "project")
    fs.mkdirSync(projectRoot)
    fs.mkdirSync(path.join(projectRoot, ".git"))
  })

  afterEach(() => {
    process.env.HOME = origHome
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("returns empty for empty store", async () => {
    fs.mkdirSync(path.join(tmpDir, ".config", "skills-cli", "store"), { recursive: true })

    const skills = await Effect.runPromise(listSkills())
    expect(skills).toHaveLength(0)
  })

  it("lists skills after adding", async () => {
    const sourceDir = path.join(tmpDir, "repo")
    fs.mkdirSync(sourceDir)
    const skillA = path.join(sourceDir, "skill-a")
    const skillB = path.join(sourceDir, "skill-b")
    fs.mkdirSync(skillA)
    fs.mkdirSync(skillB)
    fs.writeFileSync(path.join(skillA, "SKILL.md"), validSkillMd("skill-a"))
    fs.writeFileSync(path.join(skillB, "SKILL.md"), validSkillMd("skill-b"))

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    const skills = await Effect.runPromise(listSkills())
    expect(skills).toHaveLength(2)
    expect(skills.map((s) => s.name)).toContain("skill-a")
    expect(skills.map((s) => s.name)).toContain("skill-b")
  })

  it("shows install status indicators", async () => {
    const sourceDir = path.join(tmpDir, "test-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd("test-skill"))

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    // Before install
    const beforeStatus = checkInstallStatus("test-skill", projectRoot)
    expect(beforeStatus.global).toBe(false)
    expect(beforeStatus.project).toBe(false)

    // Install to project
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

    // After install
    const afterStatus = checkInstallStatus("test-skill", projectRoot)
    expect(afterStatus.global).toBe(false)
    expect(afterStatus.project).toBe(true)
  })
})
