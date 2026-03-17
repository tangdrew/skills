import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Effect } from "effect"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadConfig, saveConfig } from "../../src/lib/config.js"
import { DEFAULT_CONFIG } from "../../src/schemas/config.schema.js"

describe("config", () => {
  let origHome: string | undefined
  let tmpDir: string

  beforeEach(() => {
    origHome = process.env.HOME
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-config-test-"))
    process.env.HOME = tmpDir
  })

  afterEach(() => {
    process.env.HOME = origHome
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("returns defaults when config file missing", async () => {
    const config = await Effect.runPromise(loadConfig())
    expect(config).toEqual(DEFAULT_CONFIG)
  })

  it("loads valid config file", async () => {
    const configDir = path.join(tmpDir, ".config", "skills-cli")
    fs.mkdirSync(configDir, { recursive: true })
    const customConfig = {
      ...DEFAULT_CONFIG,
      defaultScope: "global" as const,
    }
    fs.writeFileSync(
      path.join(configDir, "config.json"),
      JSON.stringify(customConfig),
    )

    const config = await Effect.runPromise(loadConfig())
    expect(config.defaultScope).toBe("global")
  })

  it("returns defaults for invalid config file", async () => {
    const configDir = path.join(tmpDir, ".config", "skills-cli")
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(path.join(configDir, "config.json"), "not json")

    const config = await Effect.runPromise(loadConfig())
    expect(config).toEqual(DEFAULT_CONFIG)
  })

  it("saves and loads config round-trip", async () => {
    const customConfig = {
      ...DEFAULT_CONFIG,
      defaultMode: "copy" as const,
    }
    await Effect.runPromise(saveConfig(customConfig))
    const loaded = await Effect.runPromise(loadConfig())
    expect(loaded.defaultMode).toBe("copy")
  })
})
