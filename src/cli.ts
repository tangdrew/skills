#!/usr/bin/env node
import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"
import { addCommand } from "./commands/add.js"
import { doctorCommand } from "./commands/doctor.js"
import { installCommand } from "./commands/install.js"
import { listCommand } from "./commands/list.js"
import { pullCommand } from "./commands/pull.js"
import { removeSourceCommand } from "./commands/remove-source.js"
import { uninstallCommand } from "./commands/uninstall.js"
import { whereCommand } from "./commands/where.js"

const command = Command.make("skills").pipe(
  Command.withDescription("Manage a local library of Agent Skills"),
  Command.withHandler(() =>
    Console.log("Run 'skills --help' for usage information."),
  ),
  Command.withSubcommands([
    addCommand,
    removeSourceCommand,
    listCommand,
    installCommand,
    uninstallCommand,
    pullCommand,
    whereCommand,
    doctorCommand,
  ]),
)

const cli = Command.run(command, {
  name: "skills",
  version: "0.1.0",
})

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
)
