import * as fs from "node:fs"
import * as path from "node:path"
import { Args, Command } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { clone, hasUncommittedChanges, pull as gitPull } from "../lib/git.js"
import { checkInstallStatus } from "../lib/installer.js"
import * as output from "../lib/output.js"
import { cacheDir, cacheKeyForUrl, findProjectRoot, globalAgentsSkillsDir, projectAgentsSkillsDir } from "../lib/paths.js"
import { addEntry, getEntry, gitSourcedEntries, loadRegistry, saveRegistry } from "../lib/registry.js"
import { addSkillToStore } from "../lib/store.js"

const nameArg = Args.text({ name: "name" }).pipe(Args.optional)

export const pullHandler = (args: { readonly name: Option.Option<string> }) =>
  Effect.gen(function* () {
    let registry = yield* loadRegistry()
    const gitEntries = Option.isSome(args.name)
      ? (() => {
          const entry = getEntry(registry, args.name.value)
          if (!entry) return []
          if (entry.source.type !== "git") return []
          return [[args.name.value, entry]] as Array<[string, typeof entry]>
        })()
      : gitSourcedEntries(registry)

    if (gitEntries.length === 0 && Option.isSome(args.name)) {
      const entry = getEntry(registry, args.name.value)
      if (!entry) {
        return yield* Effect.fail(
          new Error(`Skill "${args.name.value}" not found in store.`),
        )
      }
      yield* Console.log(
        output.warn(`local skill "${args.name.value}" has no remote source, skipping`),
      )
      return
    }

    if (gitEntries.length === 0) {
      yield* Console.log("No git-sourced skills to update.")
      return
    }

    yield* Console.log(`Pulling ${gitEntries.length} git-sourced skill${gitEntries.length === 1 ? "" : "s"}...`)
    yield* Console.log("")

    const localSkips: string[] = []
    // Count local-sourced skills for summary
    if (Option.isNone(args.name)) {
      for (const [name, entry] of Object.entries(registry.skills)) {
        if (entry.source.type === "local") localSkips.push(name)
      }
    }

    for (const [name, entry] of gitEntries) {
      if (entry.source.type !== "git") continue

      const cacheKey = entry.cache_key ?? cacheKeyForUrl(entry.source.url)
      const cachePath = path.join(cacheDir(), cacheKey)

      try {
        if (fs.existsSync(cachePath)) {
          if (hasUncommittedChanges(cachePath)) {
            yield* Console.log(
              `  ${name}  ${output.error(`Source repo at ${cachePath} has uncommitted changes. Resolve manually and retry.`)}`,
            )
            continue
          }
          yield* gitPull(cachePath)
        } else {
          yield* clone(entry.source.url, cachePath)
        }

        // Re-copy skill from cache to store
        const skillSourcePath = path.join(cachePath, entry.source.skill_path)
        if (fs.existsSync(skillSourcePath)) {
          yield* addSkillToStore(skillSourcePath, name, true)
          yield* Console.log(`  ${name}  ${output.success("updated")}`)

          // Check for copy-mode installs and warn
          const root = yield* findProjectRoot(process.cwd())
          const projectRoot = Option.isSome(root) ? root.value : undefined
          const isCopyInstall = (installPath: string): boolean => {
            return fs.existsSync(installPath) && !fs.lstatSync(installPath).isSymbolicLink()
          }
          const globalPath = path.join(globalAgentsSkillsDir(), name)
          const projectPath = projectRoot ? path.join(projectAgentsSkillsDir(projectRoot), name) : undefined
          if (isCopyInstall(globalPath) || (projectPath && isCopyInstall(projectPath))) {
            yield* Console.log(`    ${output.info(`Note: "${name}" was installed with copy mode. Reinstall to get updates.`)}`)
          }
        } else {
          yield* Console.log(`  ${name}  ${output.warn("skill path not found in cache")}`)
        }

        // Update timestamp
        const now = new Date().toISOString()
        registry = addEntry(registry, name, { ...entry, updated_at: now })
      } catch {
        yield* Console.log(`  ${name}  ${output.error("pull failed")}`)
      }
    }

    yield* saveRegistry(registry)

    if (localSkips.length > 0) {
      yield* Console.log("")
      yield* Console.log(
        `Skipping ${localSkips.length} local skill${localSkips.length === 1 ? "" : "s"} (${localSkips.join(", ")})`,
      )
    }

    yield* Console.log("")
    yield* Console.log(
      "Symlinked installs are up to date. Copy-mode installs need reinstall.",
    )
  })

export const pullCommand = Command.make(
  "pull",
  { name: nameArg },
  (args) => pullHandler(args),
).pipe(Command.withDescription("Update skills in the store from their original sources"))
