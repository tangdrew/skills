import * as clack from "@clack/prompts"
import { Effect } from "effect"
import type { StoreSkill } from "./store.js"

export interface SkillOption {
  skill: StoreSkill
  globalInstalled: boolean
  projectInstalled: boolean
}

export const selectSkillsToInstall = (skills: SkillOption[]) =>
  Effect.async<string[], Error>((resume) => {
    const options = skills.map((s) => {
      const hints: string[] = []
      if (s.globalInstalled) hints.push("✓ global")
      if (s.projectInstalled) hints.push("✓ project")
      const hint = hints.length > 0 ? hints.join(", ") : undefined

      return {
        value: s.skill.name,
        label: s.skill.name,
        hint: [s.skill.parsed.frontmatter.description, hint].filter(Boolean).join("  "),
      }
    })

    clack.multiselect({
      message: "Select skills to install",
      options,
      required: true,
    }).then((result) => {
      if (clack.isCancel(result)) {
        resume(Effect.fail(new Error("Cancelled")))
      } else {
        resume(Effect.succeed(result as string[]))
      }
    })
  })

export const selectTool = () =>
  Effect.async<string | undefined, Error>((resume) => {
    clack.select({
      message: "Symlink into a tool-specific directory?",
      options: [
        { value: "none", label: "None" },
        { value: "claude", label: "Claude Code" },
        { value: "codex", label: "Codex" },
        { value: "cursor", label: "Cursor" },
      ],
    }).then((result) => {
      if (clack.isCancel(result)) {
        resume(Effect.fail(new Error("Cancelled")))
      } else {
        resume(Effect.succeed(result === "none" ? undefined : (result as string)))
      }
    })
  })
