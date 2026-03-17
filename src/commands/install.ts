import { Args, Command, Options } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { loadConfig } from "../lib/config.js"
import { installSkill } from "../lib/installer.js"
import * as output from "../lib/output.js"
import { findProjectRoot, storeDir } from "../lib/paths.js"
import * as path from "node:path"

const name = Args.text({ name: "name" })
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

export const installHandler = (args: {
  readonly name: string
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

    let projectRoot: string | undefined
    if (scope === "project") {
      const root = yield* findProjectRoot(process.cwd())
      if (Option.isSome(root)) {
        projectRoot = root.value
      } else {
        yield* Console.log(output.warn("Not in a git repository. Skill will be installed relative to cwd."))
        projectRoot = process.cwd()
      }
    }

    const result = yield* installSkill({
      name: args.name,
      scope,
      mode,
      tool,
      force: args.force,
      projectRoot,
      config,
    })

    yield* Console.log(output.success(`Installed ${args.name}`))
    yield* Console.log(`  Store:   ${path.join(storeDir(), args.name)}`)
    yield* Console.log(`  Target:  ${result.agentsPath} (${result.mode})`)
    if (result.toolPath) {
      yield* Console.log(`  ${tool ? tool.charAt(0).toUpperCase() + tool.slice(1) : "Tool"}:  ${result.toolPath} → .agents/skills/${args.name}`)
    }
  })

export const installCommand = Command.make(
  "install",
  { name, project: projectOption, global: globalOption, tool: toolOption, mode: modeOption, force: forceOption },
  (args) => installHandler(args),
).pipe(Command.withDescription("Install a skill from the store into a project or global scope"))
