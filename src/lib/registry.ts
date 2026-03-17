import * as fs from "node:fs"
import * as path from "node:path"
import { Effect, Schema } from "effect"
import { EMPTY_REGISTRY, Registry, type RegistryEntry } from "../schemas/registry.schema.js"
import { registryFilePath } from "./paths.js"

export const loadRegistry = (): Effect.Effect<Registry> =>
  Effect.gen(function* () {
    const filePath = registryFilePath()
    if (!fs.existsSync(filePath)) {
      return EMPTY_REGISTRY
    }
    const raw = fs.readFileSync(filePath, "utf-8")
    const json = JSON.parse(raw)
    return yield* Schema.decodeUnknown(Registry)(json)
  }).pipe(
    Effect.catchAll(() => Effect.succeed(EMPTY_REGISTRY)),
  )

export const saveRegistry = (registry: Registry): Effect.Effect<void> =>
  Effect.sync(() => {
    const filePath = registryFilePath()
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(registry, null, 2) + "\n")
  })

// Pure functions for registry manipulation

export const addEntry = (
  registry: Registry,
  name: string,
  entry: RegistryEntry,
): Registry => ({
  skills: { ...registry.skills, [name]: entry },
})

export const removeEntry = (
  registry: Registry,
  name: string,
): Registry => {
  const { [name]: _, ...rest } = registry.skills
  return { skills: rest }
}

export const getEntry = (
  registry: Registry,
  name: string,
): RegistryEntry | undefined => registry.skills[name]

export const gitSourcedEntries = (
  registry: Registry,
): Array<[string, RegistryEntry]> =>
  Object.entries(registry.skills).filter(
    ([, entry]) => entry.source.type === "git",
  )

export const entriesForCacheKey = (
  registry: Registry,
  cacheKey: string,
): Array<[string, RegistryEntry]> =>
  Object.entries(registry.skills).filter(
    ([, entry]) => entry.cache_key === cacheKey,
  )
