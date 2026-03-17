import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect } from "effect"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { checkInstallStatus, installSkill, uninstallSkill } from "../../src/lib/installer.js"
import { addSkillToStore } from "../../src/lib/store.js"
import { DEFAULT_CONFIG } from "../../src/schemas/config.schema.js"

const validSkillMd = `---
name: test-skill
description: A test skill for unit testing purposes and automation.
---

# Test Skill
`

describe("installer", () => {
  let origHome: string | undefined
  let tmpDir: string
  let projectRoot: string

  beforeEach(() => {
    origHome = process.env.HOME
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-install-test-"))
    process.env.HOME = tmpDir
    projectRoot = path.join(tmpDir, "project")
    fs.mkdirSync(projectRoot)
    fs.mkdirSync(path.join(projectRoot, ".git"))

    // Setup store
    fs.mkdirSync(path.join(tmpDir, ".config", "skills-cli", "store"), { recursive: true })

    // Add a skill to store
    const sourceDir = path.join(tmpDir, "source-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd)
    Effect.runSync(addSkillToStore(sourceDir, "test-skill", false))
  })

  afterEach(() => {
    process.env.HOME = origHome
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("installs as symlink to project", async () => {
    const result = await Effect.runPromise(
      installSkill({
        name: "test-skill",
        scope: "project",
        mode: "symlink",
        force: false,
        projectRoot,
        config: DEFAULT_CONFIG,
      }),
    )

    expect(result.mode).toBe("symlink")
    const targetPath = path.join(projectRoot, ".agents", "skills", "test-skill")
    expect(fs.existsSync(targetPath)).toBe(true)
    expect(fs.lstatSync(targetPath).isSymbolicLink()).toBe(true)

    // Verify it's a relative symlink
    const linkTarget = fs.readlinkSync(targetPath)
    expect(path.isAbsolute(linkTarget)).toBe(false)
  })

  it("installs as copy to project", async () => {
    const result = await Effect.runPromise(
      installSkill({
        name: "test-skill",
        scope: "project",
        mode: "copy",
        force: false,
        projectRoot,
        config: DEFAULT_CONFIG,
      }),
    )

    expect(result.mode).toBe("copy")
    const targetPath = path.join(projectRoot, ".agents", "skills", "test-skill")
    expect(fs.existsSync(targetPath)).toBe(true)
    expect(fs.lstatSync(targetPath).isSymbolicLink()).toBe(false)
    expect(fs.existsSync(path.join(targetPath, "SKILL.md"))).toBe(true)
  })

  it("installs globally with absolute symlink", async () => {
    const result = await Effect.runPromise(
      installSkill({
        name: "test-skill",
        scope: "global",
        mode: "symlink",
        force: false,
        config: DEFAULT_CONFIG,
      }),
    )

    const targetPath = path.join(tmpDir, ".agents", "skills", "test-skill")
    expect(fs.existsSync(targetPath)).toBe(true)
    expect(fs.lstatSync(targetPath).isSymbolicLink()).toBe(true)

    const linkTarget = fs.readlinkSync(targetPath)
    expect(path.isAbsolute(linkTarget)).toBe(true)
  })

  it("creates tool symlink pointing to .agents install", async () => {
    const result = await Effect.runPromise(
      installSkill({
        name: "test-skill",
        scope: "project",
        mode: "symlink",
        tool: "claude",
        force: false,
        projectRoot,
        config: DEFAULT_CONFIG,
      }),
    )

    expect(result.toolPath).toBeDefined()
    const toolPath = path.join(projectRoot, ".claude", "skills", "test-skill")
    expect(fs.existsSync(toolPath)).toBe(true)
    expect(fs.lstatSync(toolPath).isSymbolicLink()).toBe(true)

    // Verify tool symlink points to .agents/skills install, not store
    const linkTarget = fs.readlinkSync(toolPath)
    expect(linkTarget).toContain(".agents")
  })

  it("rejects duplicate without force", async () => {
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

    await expect(
      Effect.runPromise(
        installSkill({
          name: "test-skill",
          scope: "project",
          mode: "symlink",
          force: false,
          projectRoot,
          config: DEFAULT_CONFIG,
        }),
      ),
    ).rejects.toThrow("already installed")
  })

  it("overwrites with force", async () => {
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

    await Effect.runPromise(
      installSkill({
        name: "test-skill",
        scope: "project",
        mode: "symlink",
        force: true,
        projectRoot,
        config: DEFAULT_CONFIG,
      }),
    )

    const targetPath = path.join(projectRoot, ".agents", "skills", "test-skill")
    expect(fs.existsSync(targetPath)).toBe(true)
  })

  it("uninstalls from project", async () => {
    await Effect.runPromise(
      installSkill({
        name: "test-skill",
        scope: "project",
        mode: "symlink",
        tool: "claude",
        force: false,
        projectRoot,
        config: DEFAULT_CONFIG,
      }),
    )

    await Effect.runPromise(
      uninstallSkill({
        name: "test-skill",
        scope: "project",
        tool: "claude",
        projectRoot,
        config: DEFAULT_CONFIG,
      }),
    )

    const agentsPath = path.join(projectRoot, ".agents", "skills", "test-skill")
    const toolPath = path.join(projectRoot, ".claude", "skills", "test-skill")
    expect(fs.existsSync(agentsPath)).toBe(false)
    expect(fs.existsSync(toolPath)).toBe(false)
  })

  it("checks install status", async () => {
    const before = checkInstallStatus("test-skill", projectRoot)
    expect(before.global).toBe(false)
    expect(before.project).toBe(false)

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

    const after = checkInstallStatus("test-skill", projectRoot)
    expect(after.global).toBe(false)
    expect(after.project).toBe(true)
  })
})
