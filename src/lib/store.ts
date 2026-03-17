import { execSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { Effect } from "effect"
import { storeDir } from "./paths.js"
import { type ParsedSkill, readSkillFromDir } from "./skill.js"

export interface StoreSkill {
  name: string
  path: string
  parsed: ParsedSkill
}

export const listSkills = () =>
  Effect.gen(function* () {
    const dir = storeDir()
    if (!fs.existsSync(dir)) return [] as StoreSkill[]
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const skills: StoreSkill[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillPath = path.join(dir, entry.name)
      const parsed = yield* readSkillFromDir(skillPath).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      )
      if (parsed) {
        skills.push({ name: entry.name, path: skillPath, parsed })
      }
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name))
  })

export const skillExists = (name: string): boolean =>
  fs.existsSync(path.join(storeDir(), name))

export const getSkillPath = (name: string): string =>
  path.join(storeDir(), name)

export const addSkillToStore = (sourcePath: string, name: string, force: boolean) =>
  Effect.gen(function* () {
    const targetPath = getSkillPath(name)
    if (fs.existsSync(targetPath)) {
      if (!force) {
        return yield* Effect.fail(
          new Error(`Skill "${name}" already exists in store. Use --force to overwrite.`),
        )
      }
      fs.rmSync(targetPath, { recursive: true, force: true })
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    execSync(`cp -r ${JSON.stringify(sourcePath)} ${JSON.stringify(targetPath)}`)
  })

export const removeSkillFromStore = (name: string) =>
  Effect.sync(() => {
    const targetPath = getSkillPath(name)
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true })
    }
  })
