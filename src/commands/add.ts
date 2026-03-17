import * as fs from "node:fs"
import * as path from "node:path"
import { Args, Command, Options } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { ensureConfigDir } from "../lib/config.js"
import { clone, parseSource, pull } from "../lib/git.js"
import * as output from "../lib/output.js"
import { cacheDir, cacheKeyForUrl } from "../lib/paths.js"
import { addEntry, loadRegistry, saveRegistry } from "../lib/registry.js"
import { readSkillFromDir, scanForSkills, validateSkillDir } from "../lib/skill.js"
import { addSkillToStore } from "../lib/store.js"

const source = Args.text({ name: "source" })
const skillOption = Options.text("skill").pipe(Options.repeated, Options.withDescription("Add only specific skill(s) from the source"))
const nameOption = Options.text("name").pipe(Options.optional, Options.withDescription("Override skill name"))
const forceOption = Options.boolean("force").pipe(Options.withDefault(false), Options.withDescription("Overwrite existing skills"))

export const addHandler = (args: {
  readonly source: string
  readonly skill: ReadonlyArray<string>
  readonly name: Option.Option<string>
  readonly force: boolean
}) =>
  Effect.gen(function* () {
    yield* ensureConfigDir()

    const parsed = parseSource(args.source)
    let sourceDir: string

    if (parsed.type === "git") {
      const url = parsed.url!
      const key = cacheKeyForUrl(url)
      const cachePath = path.join(cacheDir(), key)

      if (fs.existsSync(cachePath)) {
        yield* Console.log(output.info(`Pulling latest from ${url}...`))
        yield* pull(cachePath)
      } else {
        yield* Console.log(output.info(`Cloning ${url}...`))
        yield* clone(url, cachePath)
      }
      sourceDir = cachePath
    } else {
      sourceDir = path.resolve(parsed.path!)
      if (!fs.existsSync(sourceDir)) {
        return yield* Effect.fail(new Error(`Source path does not exist: ${sourceDir}`))
      }
    }

    // Scan for skills
    const skillDirs = yield* scanForSkills(sourceDir)

    if (skillDirs.length === 0) {
      return yield* Effect.fail(
        new Error(`No skills found in ${sourceDir}. Each skill must contain a SKILL.md.`),
      )
    }

    // Filter by --skill if specified
    const filtered =
      args.skill.length > 0
        ? skillDirs.filter((d) => args.skill.includes(path.basename(d)))
        : skillDirs

    if (filtered.length === 0) {
      const available = skillDirs.map((d) => path.basename(d)).join(", ")
      return yield* Effect.fail(
        new Error(
          `None of the specified skills found. Available: ${available}`,
        ),
      )
    }

    let registry = yield* loadRegistry()
    const added: Array<{ name: string; description: string }> = []

    for (const skillDir of filtered) {
      const { parsed: validated, warnings } = yield* validateSkillDir(skillDir)

      for (const w of warnings) {
        yield* Console.log(output.warn(w.message))
      }

      // Determine final name
      const dirName = path.basename(skillDir)
      const skillName =
        Option.isSome(args.name) && filtered.length === 1
          ? args.name.value
          : dirName

      yield* addSkillToStore(skillDir, skillName, args.force)

      const now = new Date().toISOString()
      // For git sources, store relative path from cache root so pull can relocate
      const skillRelPath = path.relative(sourceDir, skillDir)
      const entry =
        parsed.type === "git"
          ? {
              source: {
                type: "git" as const,
                url: parsed.url!,
                skill_path: skillRelPath || dirName,
                ref: "main",
              },
              cache_key: cacheKeyForUrl(parsed.url!),
              added_at: now,
              updated_at: now,
            }
          : {
              source: { type: "local" as const, path: path.resolve(sourceDir) },
              added_at: now,
              updated_at: now,
            }

      registry = addEntry(registry, skillName, entry)
      added.push({ name: skillName, description: validated.frontmatter.description })
    }

    yield* saveRegistry(registry)

    yield* Console.log("")
    yield* Console.log(
      `Added ${added.length} skill${added.length === 1 ? "" : "s"} from ${args.source}`,
    )
    yield* Console.log("")
    for (const s of added) {
      yield* Console.log(`  ${s.name}`)
      yield* Console.log(`    ${s.description}`)
    }
  })

export const addCommand = Command.make(
  "add",
  { source, skill: skillOption, name: nameOption, force: forceOption },
  (args) => addHandler(args),
).pipe(Command.withDescription("Acquire skills from a source into the local store"))
