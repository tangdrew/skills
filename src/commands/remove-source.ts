import { Args, Command, Options } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { checkInstallStatus } from "../lib/installer.js"
import * as output from "../lib/output.js"
import { cacheKeyForUrl, findProjectRoot } from "../lib/paths.js"
import {
  entriesForCacheKey,
  getEntry,
  loadRegistry,
  removeEntry,
  saveRegistry,
} from "../lib/registry.js"
import { removeSkillFromStore, skillExists } from "../lib/store.js"
import * as fs from "node:fs"
import { cacheDir } from "../lib/paths.js"
import * as path from "node:path"

const name = Args.text({ name: "name" })
const forceOption = Options.boolean("force").pipe(
  Options.withDefault(false),
  Options.withDescription("Skip confirmation"),
)

export const removeSourceHandler = (args: {
  readonly name: string
  readonly force: boolean
}) =>
  Effect.gen(function* () {
    if (!skillExists(args.name)) {
      return yield* Effect.fail(
        new Error(
          `Skill "${args.name}" not found in store. Run "skills list" to see available skills.`,
        ),
      )
    }

    // Check if skill is installed anywhere
    const root = yield* findProjectRoot(process.cwd())
    const projectRoot = Option.isSome(root) ? root.value : undefined
    const status = checkInstallStatus(args.name, projectRoot)

    if ((status.global || status.project) && !args.force) {
      const locations: string[] = []
      if (status.global) locations.push("global")
      if (status.project) locations.push("project")
      return yield* Effect.fail(
        new Error(
          `Skill "${args.name}" is currently installed (${locations.join(", ")}). Use --force to remove anyway.`,
        ),
      )
    }

    yield* removeSkillFromStore(args.name)

    let registry = yield* loadRegistry()
    const entry = getEntry(registry, args.name)

    // Clean up cache if orphaned
    if (entry?.cache_key) {
      registry = removeEntry(registry, args.name)
      const remaining = entriesForCacheKey(registry, entry.cache_key)
      if (remaining.length === 0) {
        const cachePath = path.join(cacheDir(), entry.cache_key)
        if (fs.existsSync(cachePath)) {
          fs.rmSync(cachePath, { recursive: true, force: true })
        }
      }
    } else {
      registry = removeEntry(registry, args.name)
    }

    yield* saveRegistry(registry)
    yield* Console.log(output.success(`Removed "${args.name}" from store`))
  })

export const removeSourceCommand = Command.make(
  "remove-source",
  { name, force: forceOption },
  (args) => removeSourceHandler(args),
).pipe(Command.withDescription("Remove a skill from the store"))
