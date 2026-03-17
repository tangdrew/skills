import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect, Option } from "effect"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { addHandler } from "../../src/commands/add.js"
import { installHandler } from "../../src/commands/install.js"
import { uninstallHandler } from "../../src/commands/uninstall.js"

const validSkillMd = `---
name: test-skill
description: A test skill for unit testing purposes and automation.
---

# Test Skill
`

describe("uninstall command", () => {
  let origHome: string | undefined
  let origCwd: string
  let tmpDir: string
  let projectRoot: string

  beforeEach(() => {
    origHome = process.env.HOME
    origCwd = process.cwd()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-uninstall-test-"))
    process.env.HOME = tmpDir
    projectRoot = path.join(tmpDir, "project")
    fs.mkdirSync(projectRoot)
    fs.mkdirSync(path.join(projectRoot, ".git"))

    const sourceDir = path.join(tmpDir, "test-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd)
  })

  afterEach(() => {
    process.chdir(origCwd)
    process.env.HOME = origHome
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("installs then uninstalls, verifying cleanup", async () => {
    const sourceDir = path.join(tmpDir, "test-skill")

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    process.chdir(projectRoot)

    await Effect.runPromise(
      installHandler({
        name: "test-skill",
        project: true,
        global: false,
        tool: Option.some("claude"),
        mode: Option.none(),
        force: false,
      }),
    )

    const agentsPath = path.join(projectRoot, ".agents", "skills", "test-skill")
    const toolPath = path.join(projectRoot, ".claude", "skills", "test-skill")
    expect(fs.existsSync(agentsPath)).toBe(true)
    expect(fs.existsSync(toolPath)).toBe(true)

    await Effect.runPromise(
      uninstallHandler({
        name: "test-skill",
        project: true,
        global: false,
        tool: Option.some("claude"),
      }),
    )

    expect(fs.existsSync(agentsPath)).toBe(false)
    expect(fs.existsSync(toolPath)).toBe(false)
  })

  it("fails to uninstall if not installed", async () => {
    const sourceDir = path.join(tmpDir, "test-skill")

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    process.chdir(projectRoot)

    await expect(
      Effect.runPromise(
        uninstallHandler({
          name: "test-skill",
          project: true,
          global: false,
          tool: Option.none(),
        }),
      ),
    ).rejects.toThrow("not installed")
  })
})
