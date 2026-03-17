import { Command } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { checkInstallStatus } from "../lib/installer.js"
import * as output from "../lib/output.js"
import { findProjectRoot } from "../lib/paths.js"
import { listSkills } from "../lib/store.js"

export const listHandler = () =>
  Effect.gen(function* () {
    const skills = yield* listSkills()

    if (skills.length === 0) {
      yield* Console.log("No skills in store. Run 'skills add <source>' to get started.")
      return
    }

    const root = yield* findProjectRoot(process.cwd())
    const projectRoot = Option.isSome(root) ? root.value : undefined

    yield* Console.log(
      output.sectionHeader(`Available skills (${skills.length} in store)`),
    )
    yield* Console.log("")

    for (const skill of skills) {
      const status = checkInstallStatus(skill.name, projectRoot)
      yield* Console.log(
        output.skillRow(
          skill.name,
          skill.parsed.frontmatter.description,
          status.global,
          status.project,
        ),
      )
      yield* Console.log("")
    }

    yield* Console.log(`${output.installed} = installed  ${output.notInstalled} = not installed`)
  })

export const listCommand = Command.make("list", {}, () => listHandler()).pipe(
  Command.withDescription("List all skills in the store"),
)
