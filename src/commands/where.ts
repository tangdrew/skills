import * as fs from "node:fs"
import * as path from "node:path"
import { Args, Command } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { checkInstallStatus } from "../lib/installer.js"
import { loadConfig } from "../lib/config.js"
import * as output from "../lib/output.js"
import {
  findProjectRoot,
  globalAgentsSkillsDir,
  globalToolSkillsDir,
  projectAgentsSkillsDir,
  projectToolSkillsDir,
} from "../lib/paths.js"
import { getEntry, loadRegistry } from "../lib/registry.js"
import { getSkillPath, skillExists } from "../lib/store.js"

const name = Args.text({ name: "name" })

export const whereHandler = (args: { readonly name: string }) =>
  Effect.gen(function* () {
    if (!skillExists(args.name)) {
      return yield* Effect.fail(
        new Error(
          `Skill "${args.name}" not found in store. Run "skills list" to see available skills.`,
        ),
      )
    }

    const registry = yield* loadRegistry()
    const entry = getEntry(registry, args.name)
    const config = yield* loadConfig()

    yield* Console.log(output.sectionHeader(args.name))
    yield* Console.log("")
    yield* Console.log(`  Store:    ${getSkillPath(args.name)}`)

    if (entry) {
      if (entry.source.type === "git") {
        yield* Console.log(
          `  Source:   ${entry.source.url} (${entry.source.skill_path})`,
        )
      } else {
        yield* Console.log(`  Source:   ${entry.source.path} (local)`)
      }
    }

    // Global status
    yield* Console.log("")
    yield* Console.log("  Global:")
    const globalAgents = path.join(globalAgentsSkillsDir(), args.name)
    const globalAgentsExists = fs.existsSync(globalAgents)
    const globalAgentsType = globalAgentsExists
      ? fs.lstatSync(globalAgents).isSymbolicLink()
        ? "symlink"
        : "copy"
      : "not installed"
    yield* Console.log(`    .agents   ${globalAgentsExists ? `${globalAgents} → ${globalAgentsType}` : "not installed"}`)

    for (const [tool] of Object.entries(config.tools)) {
      const toolPath = path.join(globalToolSkillsDir(tool, config), args.name)
      const toolExists = fs.existsSync(toolPath)
      yield* Console.log(`    .${tool}   ${toolExists ? `${toolPath} → symlink` : "not installed"}`)
    }

    // Project status
    const root = yield* findProjectRoot(process.cwd())
    if (Option.isSome(root)) {
      const projectRoot = root.value
      yield* Console.log("")
      yield* Console.log(`  Project (${projectRoot}):`)

      const projectAgents = path.join(projectAgentsSkillsDir(projectRoot), args.name)
      const projectAgentsExists = fs.existsSync(projectAgents)
      const projectAgentsType = projectAgentsExists
        ? fs.lstatSync(projectAgents).isSymbolicLink()
          ? "symlink"
          : "copy"
        : "not installed"
      yield* Console.log(
        `    .agents   ${projectAgentsExists ? `${path.relative(projectRoot, projectAgents)} → ${projectAgentsType}` : "not installed"}`,
      )

      for (const [tool] of Object.entries(config.tools)) {
        const toolPath = path.join(projectToolSkillsDir(projectRoot, tool, config), args.name)
        const toolExists = fs.existsSync(toolPath)
        if (toolExists) {
          const linkTarget = fs.lstatSync(toolPath).isSymbolicLink()
            ? fs.readlinkSync(toolPath)
            : "copy"
          yield* Console.log(
            `    .${tool}   ${path.relative(projectRoot, toolPath)} → ${linkTarget}`,
          )
        } else {
          yield* Console.log(`    .${tool}   not installed`)
        }
      }
    }
  })

export const whereCommand = Command.make(
  "where",
  { name },
  (args) => whereHandler(args),
).pipe(Command.withDescription("Show everywhere a skill exists"))
