import { Schema } from "effect"

const ToolConfig = Schema.Struct({
  global: Schema.String,
  project: Schema.String,
})

export const Config = Schema.Struct({
  defaultScope: Schema.Literal("project", "global"),
  defaultMode: Schema.Literal("symlink", "copy"),
  tools: Schema.Record({ key: Schema.String, value: ToolConfig }),
})
export type Config = typeof Config.Type

export const DEFAULT_CONFIG: Config = {
  defaultScope: "project",
  defaultMode: "symlink",
  tools: {
    claude: {
      global: "~/.claude/skills",
      project: ".<tool>/skills",
    },
    codex: {
      global: "~/.codex/skills",
      project: ".<tool>/skills",
    },
    cursor: {
      global: "~/.cursor/skills",
      project: ".<tool>/skills",
    },
  },
}
