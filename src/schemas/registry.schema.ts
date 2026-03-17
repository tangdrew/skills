import { Schema } from "effect"

export const GitSource = Schema.Struct({
  type: Schema.Literal("git"),
  url: Schema.String,
  skill_path: Schema.String,
  ref: Schema.String,
})
export type GitSource = typeof GitSource.Type

export const LocalSource = Schema.Struct({
  type: Schema.Literal("local"),
  path: Schema.String,
})
export type LocalSource = typeof LocalSource.Type

export const SkillSource = Schema.Union(GitSource, LocalSource)
export type SkillSource = typeof SkillSource.Type

export const RegistryEntry = Schema.Struct({
  source: SkillSource,
  cache_key: Schema.optional(Schema.String),
  added_at: Schema.String,
  updated_at: Schema.String,
})
export type RegistryEntry = typeof RegistryEntry.Type

export const Registry = Schema.Struct({
  skills: Schema.Record({ key: Schema.String, value: RegistryEntry }),
})
export type Registry = typeof Registry.Type

export const EMPTY_REGISTRY: Registry = { skills: {} }
