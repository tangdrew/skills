import { Args, Command, Options } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { loadConfig } from "../lib/config.js"
import { checkInstallStatus, installSkill } from "../lib/installer.js"
import * as output from "../lib/output.js"
import { findProjectRoot, storeDir } from "../lib/paths.js"
import { selectSkillsToInstall, selectTool, type SkillOption } from "../lib/prompt.js"
import { listSkills } from "../lib/store.js"
import * as path from "node:path"

const name = Args.text({ name: "name" }).pipe(Args.optional)
const projectOption = Options.boolean("project").pipe(
  Options.withDefault(false),
  Options.withDescription("Install into the current project (default)"),
)
const globalOption = Options.boolean("global").pipe(
  Options.withDefault(false),
  Options.withDescription("Install into the global scope"),
)
const toolOption = Options.text("tool").pipe(
  Options.optional,
  Options.withDescription("Additionally symlink into tool-specific directory"),
)
const modeOption = Options.choice("mode", ["symlink", "copy"]).pipe(
  Options.optional,
  Options.withDescription("Install mode: symlink (default) or copy"),
)
const forceOption = Options.boolean("force").pipe(
  Options.withDefault(false),
  Options.withDescription("Overwrite existing install"),
)

const resolveProjectRoot = (scope: "project" | "global") =>
  Effect.gen(function* () {
    if (scope !== "project") return undefined
    const root = yield* findProjectRoot(process.cwd())
    if (Option.isSome(root)) return root.value
    yield* Console.log(output.warn("Not in a git repository. Skill will be installed relative to cwd."))
    return process.cwd()
  })

const installOne = (
  skillName: string,
  opts: { scope: "project" | "global"; mode: "symlink" | "copy"; tool: string | undefined; force: boolean; projectRoot: string | undefined; config: import("../schemas/config.schema.js").Config },
) =>
  Effect.gen(function* () {
    const result = yield* installSkill({
      name: skillName,
      ...opts,
    })

    yield* Console.log(output.success(`Installed ${skillName}`))
    yield* Console.log(`  Store:   ${path.join(storeDir(), skillName)}`)
    yield* Console.log(`  Target:  ${result.agentsPath} (${result.mode})`)
    if (result.toolPath) {
      yield* Console.log(`  ${opts.tool ? opts.tool.charAt(0).toUpperCase() + opts.tool.slice(1) : "Tool"}:  ${result.toolPath} → .agents/skills/${skillName}`)
    }
  })

export const installHandler = (args: {
  readonly name: Option.Option<string>
  readonly project: boolean
  readonly global: boolean
  readonly tool: Option.Option<string>
  readonly mode: Option.Option<string>
  readonly force: boolean
}) =>
  Effect.gen(function* () {
    const config = yield* loadConfig()
    const scope = args.global ? "global" as const : "project" as const
    const mode = (Option.isSome(args.mode) ? args.mode.value : config.defaultMode) as "symlink" | "copy"
    const tool = Option.isSome(args.tool) ? args.tool.value : undefined
    const projectRoot = yield* resolveProjectRoot(scope)

    if (Option.isSome(args.name)) {
      // Direct install — existing behavior
      yield* installOne(args.name.value, { scope, mode, tool, force: args.force, projectRoot, config })
      return
    }

    // Interactive mode
    if (!process.stdin.isTTY) {
      return yield* Effect.fail(new Error("No skill name provided. Usage: skills install <name>"))
    }

    const skills = yield* listSkills()
    if (skills.length === 0) {
      yield* Console.log("No skills in store. Add one first with: skills add <source>")
      return
    }

    const skillOptions: SkillOption[] = skills.map((skill) => {
      const status = checkInstallStatus(skill.name, projectRoot)
      return { skill, globalInstalled: status.global, projectInstalled: status.project }
    })

    const selectedNames = yield* selectSkillsToInstall(skillOptions)

    const resolvedTool = tool ?? (yield* selectTool())

    for (const skillName of selectedNames) {
      yield* installOne(skillName, { scope, mode, tool: resolvedTool, force: args.force, projectRoot, config }).pipe(
        Effect.catchAll((err) => Console.log(output.error(`${skillName}: ${err.message}`))),
      )
    }
  })

export const installCommand = Command.make(
  "install",
  { name, project: projectOption, global: globalOption, tool: toolOption, mode: modeOption, force: forceOption },
  (args) => installHandler(args),
).pipe(Command.withDescription("Install a skill from the store into a project or global scope"))
