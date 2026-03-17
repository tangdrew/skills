import * as crypto from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"
import { Effect, Option } from "effect"
import type { Config } from "../schemas/config.schema.js"

export const expandTilde = (p: string): string =>
  p.startsWith("~/") || p === "~"
    ? path.join(process.env.HOME ?? "/", p.slice(2))
    : p

export const configDir = (): string =>
  expandTilde("~/.config/skills-cli")

export const storeDir = (): string =>
  path.join(configDir(), "store")

export const cacheDir = (): string =>
  path.join(configDir(), "cache")

export const configFilePath = (): string =>
  path.join(configDir(), "config.json")

export const registryFilePath = (): string =>
  path.join(configDir(), "registry.json")

export const globalAgentsSkillsDir = (): string =>
  expandTilde("~/.agents/skills")

export const globalToolSkillsDir = (tool: string, config?: Config): string => {
  const toolConfig = config?.tools?.[tool]
  if (toolConfig?.global) {
    return expandTilde(toolConfig.global)
  }
  return expandTilde(`~/.${tool}/skills`)
}

export const projectAgentsSkillsDir = (projectRoot: string): string =>
  path.join(projectRoot, ".agents", "skills")

export const projectToolSkillsDir = (projectRoot: string, tool: string, config?: Config): string => {
  const toolConfig = config?.tools?.[tool]
  if (toolConfig?.project) {
    const resolved = toolConfig.project.replace(/<tool>/g, tool).replace(/\.<tool>/g, `.${tool}`)
    return path.join(projectRoot, resolved)
  }
  return path.join(projectRoot, `.${tool}`, "skills")
}

export const findProjectRoot = (startDir: string): Effect.Effect<Option.Option<string>> =>
  Effect.sync(() => {
    let current = path.resolve(startDir)
    const root = path.parse(current).root
    while (current !== root) {
      if (fs.existsSync(path.join(current, ".git"))) {
        return Option.some(current)
      }
      current = path.dirname(current)
    }
    return Option.none()
  })

export const cacheKeyForUrl = (url: string): string =>
  crypto.createHash("sha256").update(url).digest("hex").slice(0, 12)
