import * as readline from "node:readline"
import { Effect } from "effect"

export const confirm = (message: string): Effect.Effect<boolean> =>
  Effect.async<boolean>((resume) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question(`${message} (y/n) `, (answer) => {
      rl.close()
      resume(Effect.succeed(answer.trim().toLowerCase() === "y"))
    })
  })
