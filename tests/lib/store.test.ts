import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect } from "effect"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { addSkillToStore, listSkills, removeSkillFromStore, skillExists } from "../../src/lib/store.js"

const validSkillMd = `---
name: test-skill
description: A test skill for unit testing purposes.
---

# Test Skill
`

describe("store", () => {
  let origHome: string | undefined
  let tmpDir: string

  beforeEach(() => {
    origHome = process.env.HOME
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-store-test-"))
    process.env.HOME = tmpDir
    // Create store dir
    fs.mkdirSync(path.join(tmpDir, ".config", "skills-cli", "store"), { recursive: true })
  })

  afterEach(() => {
    process.env.HOME = origHome
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("lists empty store", async () => {
    const skills = await Effect.runPromise(listSkills())
    expect(skills).toEqual([])
  })

  it("adds a skill to store", async () => {
    // Create source skill dir
    const sourceDir = path.join(tmpDir, "source-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd)

    await Effect.runPromise(addSkillToStore(sourceDir, "test-skill", false))
    expect(skillExists("test-skill")).toBe(true)
  })

  it("lists skills after adding", async () => {
    const sourceDir = path.join(tmpDir, "source-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd)

    await Effect.runPromise(addSkillToStore(sourceDir, "test-skill", false))
    const skills = await Effect.runPromise(listSkills())
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe("test-skill")
  })

  it("rejects duplicate without force", async () => {
    const sourceDir = path.join(tmpDir, "source-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd)

    await Effect.runPromise(addSkillToStore(sourceDir, "test-skill", false))
    await expect(
      Effect.runPromise(addSkillToStore(sourceDir, "test-skill", false)),
    ).rejects.toThrow("already exists")
  })

  it("overwrites with force", async () => {
    const sourceDir = path.join(tmpDir, "source-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd)

    await Effect.runPromise(addSkillToStore(sourceDir, "test-skill", false))
    await Effect.runPromise(addSkillToStore(sourceDir, "test-skill", true))
    expect(skillExists("test-skill")).toBe(true)
  })

  it("removes a skill", async () => {
    const sourceDir = path.join(tmpDir, "source-skill")
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), validSkillMd)

    await Effect.runPromise(addSkillToStore(sourceDir, "test-skill", false))
    await Effect.runPromise(removeSkillFromStore("test-skill"))
    expect(skillExists("test-skill")).toBe(false)
  })
})
