import { Schema } from "effect"

const skillNamePattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/** Strict name validation — used only for lint warnings, not parse rejection. */
export const SkillName = Schema.String.pipe(
  Schema.filter((s) => {
    if (s.length < 1 || s.length > 64) return false
    return skillNamePattern.test(s)
  }, { message: () => "Skill name must be 1-64 lowercase alphanumeric characters with single hyphens, not starting/ending with a hyphen" }),
)
export type SkillName = typeof SkillName.Type

/** Lenient frontmatter schema — accepts any non-empty name string, rejects only missing description. */
export const SkillFrontmatter = Schema.Struct({
  name: Schema.String.pipe(
    Schema.filter((s) => s.length >= 1, {
      message: () => "Name is required",
    }),
  ),
  description: Schema.String.pipe(
    Schema.filter((s) => s.length >= 1 && s.length <= 1024, {
      message: () => "Description must be 1-1024 characters",
    }),
  ),
  license: Schema.optional(Schema.String),
  compatibility: Schema.optional(
    Schema.String.pipe(
      Schema.filter((s) => s.length >= 1 && s.length <= 500, {
        message: () => "Compatibility must be 1-500 characters",
      }),
    ),
  ),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  "allowed-tools": Schema.optional(Schema.String),
})
export type SkillFrontmatter = typeof SkillFrontmatter.Type
