import { Args, Command, Options } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { loadConfig } from "../lib/config.js"
import { uninstallSkill } from "../lib/installer.js"
import * as output from "../lib/output.js"
import { findProjectRoot } from "../lib/paths.js"

const name = Args.text({ name: "name" })
const projectOption = Options.boolean("project").pipe(
  Options.withDefault(false),
  Options.withDescription("Remove from project scope (default)"),
)
const globalOption = Options.boolean("global").pipe(
  Options.withDefault(false),
  Options.withDescription("Remove from global scope"),
)
const toolOption = Options.text("tool").pipe(
  Options.optional,
  Options.withDescription("Also remove tool-specific symlink"),
)

export const uninstallHandler = (args: {
  readonly name: string
  readonly project: boolean
  readonly global: boolean
  readonly tool: Option.Option<string>
}) =>
  Effect.gen(function* () {
    const config = yield* loadConfig()
    const scope = args.global ? "global" as const : "project" as const
    const tool = Option.isSome(args.tool) ? args.tool.value : undefined

    let projectRoot: string | undefined
    if (scope === "project") {
      const root = yield* findProjectRoot(process.cwd())
      if (Option.isSome(root)) {
        projectRoot = root.value
      } else {
        projectRoot = process.cwd()
      }
    }

    yield* uninstallSkill({
      name: args.name,
      scope,
      tool,
      projectRoot,
      config,
    })

    yield* Console.log(output.success(`Uninstalled ${args.name} from ${scope} scope`))
  })

export const uninstallCommand = Command.make(
  "uninstall",
  { name, project: projectOption, global: globalOption, tool: toolOption },
  (args) => uninstallHandler(args),
).pipe(Command.withDescription("Remove an installed skill from a target scope"))
