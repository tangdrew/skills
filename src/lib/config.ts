import * as fs from "node:fs"
import * as path from "node:path"
import { Effect, Schema } from "effect"
import { Config, DEFAULT_CONFIG } from "../schemas/config.schema.js"
import { cacheDir, configDir, configFilePath, storeDir } from "./paths.js"

export const ensureConfigDir = (): Effect.Effect<void, Error> =>
  Effect.try({
    try: () => {
      for (const dir of [configDir(), storeDir(), cacheDir()]) {
        fs.mkdirSync(dir, { recursive: true })
      }
    },
    catch: () => new Error(`Cannot create store at ${storeDir()}`),
  })

export const loadConfig = (): Effect.Effect<Config> =>
  Effect.gen(function* () {
    const filePath = configFilePath()
    if (!fs.existsSync(filePath)) {
      return DEFAULT_CONFIG
    }
    const raw = fs.readFileSync(filePath, "utf-8")
    const json = yield* Effect.try(() => JSON.parse(raw))
    return yield* Schema.decodeUnknown(Config)(json)
  }).pipe(
    Effect.catchAll(() => Effect.succeed(DEFAULT_CONFIG)),
  )

export const saveConfig = (config: Config): Effect.Effect<void> =>
  Effect.sync(() => {
    const filePath = configFilePath()
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n")
  })
