import * as fs from "node:fs"
import * as path from "node:path"
import matter from "gray-matter"
import { Effect, Schema } from "effect"
import { SkillFrontmatter, SkillName } from "../schemas/skill.schema.js"

export interface ParsedSkill {
  frontmatter: typeof SkillFrontmatter.Type
  body: string
}

export interface SkillWarning {
  skill: string
  message: string
}

export const parseSkillMd = (content: string) =>
  Effect.gen(function* () {
    const { data, content: body } = matter(content)
    const frontmatter = yield* Schema.decodeUnknown(SkillFrontmatter)(data)
    return { frontmatter, body } as ParsedSkill
  })

export const readSkillFromDir = (dirPath: string) =>
  Effect.gen(function* () {
    const skillMdPath = path.join(dirPath, "SKILL.md")
    if (!fs.existsSync(skillMdPath)) {
      return yield* Effect.fail(new Error(`No SKILL.md found in ${dirPath}. Not a valid skill.`))
    }
    const content = fs.readFileSync(skillMdPath, "utf-8")
    return yield* parseSkillMd(content)
  })

export const scanForSkills = (dirPath: string) =>
  Effect.sync(() => {
    if (!fs.existsSync(dirPath)) return [] as string[]
    // Check if the directory itself is a skill
    if (fs.existsSync(path.join(dirPath, "SKILL.md"))) {
      return [dirPath]
    }
    // Recursively scan for directories containing SKILL.md
    const results: string[] = []
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        if (!e.isDirectory() || e.name === ".git" || e.name === "node_modules") continue
        const childPath = path.join(dir, e.name)
        if (fs.existsSync(path.join(childPath, "SKILL.md"))) {
          results.push(childPath)
        } else {
          walk(childPath)
        }
      }
    }
    walk(dirPath)
    return results
  })

export const validateSkillDir = (dirPath: string) =>
  Effect.gen(function* () {
    const parsed = yield* readSkillFromDir(dirPath)
    const warnings: SkillWarning[] = []
    const dirName = path.basename(dirPath)
    const name = parsed.frontmatter.name

    // Lint: check name format against strict SkillName schema
    const nameResult = Schema.decodeUnknownEither(SkillName)(name)
    if (nameResult._tag === "Left") {
      warnings.push({
        skill: name,
        message: `name "${name}" does not follow naming conventions (lowercase alphanumeric with hyphens, max 64 chars).`,
      })
    }

    if (name.length > 64) {
      warnings.push({
        skill: name,
        message: `name "${name}" exceeds 64 characters.`,
      })
    }

    if (name !== dirName) {
      warnings.push({
        skill: name,
        message: `name "${name}" doesn't match directory "${dirName}". Using directory name.`,
      })
    }

    if (parsed.frontmatter.description.length < 20) {
      warnings.push({
        skill: name,
        message: `description for "${name}" is very short. Longer descriptions improve agent activation.`,
      })
    }

    return { parsed, warnings }
  })
