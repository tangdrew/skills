import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { parseSkillMd, readSkillFromDir, scanForSkills, validateSkillDir } from "../../src/lib/skill.js"

const validSkillMd = `---
name: debug-logs
description: Triage logs and identify likely root causes before changing code.
license: MIT
---

# Debug Logs

Instructions for the skill.
`

const minimalSkillMd = `---
name: my-skill
description: A valid skill.
---

Body content.
`

const noDescriptionSkillMd = `---
name: bad-skill
---

Missing description.
`

const invalidYamlSkillMd = `---
name: [invalid
---
`

describe("parseSkillMd", () => {
  it("parses valid SKILL.md", async () => {
    const result = await Effect.runPromise(parseSkillMd(validSkillMd))
    expect(result.frontmatter.name).toBe("debug-logs")
    expect(result.frontmatter.description).toContain("Triage logs")
    expect(result.frontmatter.license).toBe("MIT")
    expect(result.body).toContain("# Debug Logs")
  })

  it("parses minimal SKILL.md", async () => {
    const result = await Effect.runPromise(parseSkillMd(minimalSkillMd))
    expect(result.frontmatter.name).toBe("my-skill")
  })

  it("rejects missing description", async () => {
    await expect(Effect.runPromise(parseSkillMd(noDescriptionSkillMd))).rejects.toThrow()
  })

  it("rejects invalid YAML", async () => {
    await expect(Effect.runPromise(parseSkillMd(invalidYamlSkillMd))).rejects.toThrow()
  })

  it("accepts invalid skill name leniently (warns at validation time)", async () => {
    const md = `---
name: Invalid_Name
description: A description.
---
`
    const result = await Effect.runPromise(parseSkillMd(md))
    expect(result.frontmatter.name).toBe("Invalid_Name")
  })
})

describe("readSkillFromDir", () => {
  it("reads SKILL.md from directory", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"))
    fs.writeFileSync(path.join(tmpDir, "SKILL.md"), validSkillMd)

    const result = await Effect.runPromise(readSkillFromDir(tmpDir))
    expect(result.frontmatter.name).toBe("debug-logs")

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("fails when no SKILL.md exists", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"))
    await expect(Effect.runPromise(readSkillFromDir(tmpDir))).rejects.toThrow("No SKILL.md")
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

describe("scanForSkills", () => {
  it("finds single skill directory", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"))
    fs.writeFileSync(path.join(tmpDir, "SKILL.md"), validSkillMd)

    const result = await Effect.runPromise(scanForSkills(tmpDir))
    expect(result).toEqual([tmpDir])

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("finds child skill directories", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"))
    const skillA = path.join(tmpDir, "skill-a")
    const skillB = path.join(tmpDir, "skill-b")
    const notSkill = path.join(tmpDir, "not-a-skill")
    fs.mkdirSync(skillA)
    fs.mkdirSync(skillB)
    fs.mkdirSync(notSkill)
    fs.writeFileSync(path.join(skillA, "SKILL.md"), validSkillMd)
    fs.writeFileSync(path.join(skillB, "SKILL.md"), minimalSkillMd)

    const result = await Effect.runPromise(scanForSkills(tmpDir))
    expect(result).toHaveLength(2)
    expect(result).toContain(skillA)
    expect(result).toContain(skillB)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("returns empty for nonexistent dir", async () => {
    const result = await Effect.runPromise(scanForSkills("/nonexistent"))
    expect(result).toEqual([])
  })
})

describe("validateSkillDir", () => {
  it("warns on name mismatch", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"))
    const skillDir = path.join(tmpDir, "wrong-name")
    fs.mkdirSync(skillDir)
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), validSkillMd)

    const { warnings } = await Effect.runPromise(validateSkillDir(skillDir))
    expect(warnings.some((w) => w.message.includes("doesn't match directory"))).toBe(true)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("warns on short description", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"))
    const shortDescMd = `---
name: test
description: Short.
---
`
    fs.writeFileSync(path.join(tmpDir, "SKILL.md"), shortDescMd)

    const { warnings } = await Effect.runPromise(validateSkillDir(tmpDir))
    expect(warnings.some((w) => w.message.includes("very short"))).toBe(true)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("warns on bad name format but still parses", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"))
    const skillDir = path.join(tmpDir, "Bad_Name")
    fs.mkdirSync(skillDir)
    const badNameMd = `---
name: Bad_Name
description: A valid description that is long enough for validation.
---
`
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), badNameMd)

    const { parsed, warnings } = await Effect.runPromise(validateSkillDir(skillDir))
    expect(parsed.frontmatter.name).toBe("Bad_Name")
    expect(warnings.some((w) => w.message.includes("naming conventions"))).toBe(true)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("warns on name exceeding 64 chars but still parses", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"))
    const longName = "a".repeat(70)
    const skillDir = path.join(tmpDir, longName)
    fs.mkdirSync(skillDir)
    const longNameMd = `---
name: ${longName}
description: A valid description that is long enough for validation.
---
`
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), longNameMd)

    const { parsed, warnings } = await Effect.runPromise(validateSkillDir(skillDir))
    expect(parsed.frontmatter.name).toBe(longName)
    expect(warnings.some((w) => w.message.includes("exceeds 64 characters"))).toBe(true)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
