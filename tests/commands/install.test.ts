import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect, Option } from "effect"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { addHandler } from "../../src/commands/add.js"
import { installHandler } from "../../src/commands/install.js"
import { skillExists } from "../../src/lib/store.js"

const validSkillMd = `---
name: test-skill
description: A test skill for unit testing purposes and automation.
---

# Test Skill
`

describe("install command", () => {
  let origHome: string | undefined
  let tmpDir: string
  let projectRoot: string

  beforeEach(() => {
    origHome = process.env.HOME
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-install-cmd-test-"))
    process.env.HOME = tmpDir
    projectRoot = path.join(tmpDir, "project")
    fs.mkdirSync(projectRoot)
    fs.mkdirSync(path.join(projectRoot, ".git"))

    // Add a skill to store
    const sourceDir = path.join(tmpDir, "test-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd)
  })

  afterEach(() => {
    process.env.HOME = origHome
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("adds to store and installs to project with symlink", async () => {
    const sourceDir = path.join(tmpDir, "test-skill")

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    expect(skillExists("test-skill")).toBe(true)

    // Save cwd, change to project root
    const origCwd = process.cwd()
    process.chdir(projectRoot)

    try {
      await Effect.runPromise(
        installHandler({
          name: "test-skill",
          project: true,
          global: false,
          tool: Option.none(),
          mode: Option.none(),
          force: false,
        }),
      )

      const targetPath = path.join(projectRoot, ".agents", "skills", "test-skill")
      expect(fs.existsSync(targetPath)).toBe(true)
      expect(fs.lstatSync(targetPath).isSymbolicLink()).toBe(true)
      expect(fs.existsSync(path.join(targetPath, "SKILL.md"))).toBe(true)
    } finally {
      process.chdir(origCwd)
    }
  })

  it("installs with copy mode", async () => {
    const sourceDir = path.join(tmpDir, "test-skill")

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    const origCwd = process.cwd()
    process.chdir(projectRoot)

    try {
      await Effect.runPromise(
        installHandler({
          name: "test-skill",
          project: true,
          global: false,
          tool: Option.none(),
          mode: Option.some("copy"),
          force: false,
        }),
      )

      const targetPath = path.join(projectRoot, ".agents", "skills", "test-skill")
      expect(fs.existsSync(targetPath)).toBe(true)
      expect(fs.lstatSync(targetPath).isSymbolicLink()).toBe(false)
      expect(fs.existsSync(path.join(targetPath, "SKILL.md"))).toBe(true)
    } finally {
      process.chdir(origCwd)
    }
  })

  it("installs with --tool creates two-tier symlink", async () => {
    const sourceDir = path.join(tmpDir, "test-skill")

    await Effect.runPromise(
      addHandler({
        source: sourceDir,
        skill: [],
        name: Option.none(),
        force: false,
      }),
    )

    const origCwd = process.cwd()
    process.chdir(projectRoot)

    try {
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
      expect(fs.lstatSync(toolPath).isSymbolicLink()).toBe(true)

      // Tool symlink should point to .agents install
      const linkTarget = fs.readlinkSync(toolPath)
      expect(linkTarget).toContain(".agents")
    } finally {
      process.chdir(origCwd)
    }
  })

  it("fails when skill not in store", async () => {
    const origCwd = process.cwd()
    process.chdir(projectRoot)

    try {
      await expect(
        Effect.runPromise(
          installHandler({
            name: "nonexistent",
            project: true,
            global: false,
            tool: Option.none(),
            mode: Option.none(),
            force: false,
          }),
        ),
      ).rejects.toThrow("not found in store")
    } finally {
      process.chdir(origCwd)
    }
  })
})
