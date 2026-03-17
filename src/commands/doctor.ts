import * as fs from "node:fs"
import * as path from "node:path"
import { Command } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { checkInstallStatus } from "../lib/installer.js"
import { loadConfig } from "../lib/config.js"
import * as output from "../lib/output.js"
import {
  findProjectRoot,
  globalAgentsSkillsDir,
  globalToolSkillsDir,
  projectAgentsSkillsDir,
  projectToolSkillsDir,
  storeDir,
} from "../lib/paths.js"
import { loadRegistry } from "../lib/registry.js"
import { listSkills } from "../lib/store.js"
import { readSkillFromDir } from "../lib/skill.js"

interface DiagnosticIssue {
  severity: "error" | "warning"
  message: string
}

export const doctorHandler = () =>
  Effect.gen(function* () {
    const issues: DiagnosticIssue[] = []
    const config = yield* loadConfig()

    // Check store
    const store = storeDir()
    if (!fs.existsSync(store)) {
      issues.push({ severity: "error", message: "Store directory does not exist" })
      yield* printReport([], issues, undefined)
      return
    }

    const skills = yield* listSkills()
    yield* Console.log(`Store: OK (${skills.length} skill${skills.length === 1 ? "" : "s"})`)

    // Validate each skill
    for (const skill of skills) {
      const skillMdPath = path.join(skill.path, "SKILL.md")
      if (!fs.existsSync(skillMdPath)) {
        issues.push({ severity: "error", message: `${skill.name}: missing SKILL.md` })
        continue
      }

      const parsed = yield* readSkillFromDir(skill.path).pipe(
        Effect.catchAll(() => {
          issues.push({ severity: "error", message: `${skill.name}: invalid SKILL.md` })
          return Effect.succeed(null)
        }),
      )

      if (parsed) {
        if (parsed.frontmatter.name !== skill.name) {
          issues.push({
            severity: "warning",
            message: `${skill.name}: name "${parsed.frontmatter.name}" doesn't match directory`,
          })
        }
        if (parsed.frontmatter.description.length < 20) {
          issues.push({
            severity: "warning",
            message: `${skill.name}: description is very short (${parsed.frontmatter.description.length} chars)`,
          })
        }
      }
    }

    // Check registry consistency
    const registry = yield* loadRegistry()
    for (const [name] of Object.entries(registry.skills)) {
      if (!skills.find((s) => s.name === name)) {
        issues.push({
          severity: "warning",
          message: `${name}: in registry but not in store`,
        })
      }
    }

    // Check installs
    const root = yield* findProjectRoot(process.cwd())
    const projectRoot = Option.isSome(root) ? root.value : undefined

    if (projectRoot) {
      yield* checkInstalledDir(
        path.join(projectAgentsSkillsDir(projectRoot)),
        `project: ${projectRoot}`,
        ".agents/skills",
        issues,
      )

      for (const [tool] of Object.entries(config.tools)) {
        yield* checkInstalledDir(
          projectToolSkillsDir(projectRoot, tool, config),
          `project: ${projectRoot}`,
          `.${tool}/skills`,
          issues,
        )
      }
    }

    yield* checkInstalledDir(globalAgentsSkillsDir(), "global", "~/.agents/skills", issues)
    for (const [tool] of Object.entries(config.tools)) {
      yield* checkInstalledDir(
        globalToolSkillsDir(tool, config),
        "global",
        `~/.${tool}/skills`,
        issues,
      )
    }

    // Check for global+project duplicates
    if (projectRoot) {
      for (const skill of skills) {
        const status = checkInstallStatus(skill.name, projectRoot)
        if (status.global && status.project) {
          issues.push({
            severity: "warning",
            message: `${skill.name}: installed globally and in project (project takes precedence)`,
          })
        }
      }
    }

    // Print issues
    if (issues.length > 0) {
      yield* Console.log("")
      const errors = issues.filter((i) => i.severity === "error")
      const warnings = issues.filter((i) => i.severity === "warning")

      if (errors.length > 0) {
        yield* Console.log(output.sectionHeader("Errors:"))
        for (const e of errors) {
          yield* Console.log(`  ${output.error(e.message)}`)
        }
      }
      if (warnings.length > 0) {
        yield* Console.log(output.sectionHeader("Warnings:"))
        for (const w of warnings) {
          yield* Console.log(`  - ${w.message}`)
        }
      }
    } else {
      yield* Console.log("\nAll checks passed.")
    }
  })

const checkInstalledDir = (
  dir: string,
  scope: string,
  label: string,
  issues: DiagnosticIssue[],
) =>
  Effect.gen(function* () {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    let installed = 0
    let ok = 0

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      installed++
      const fullPath = path.join(dir, entry.name)

      if (fs.lstatSync(fullPath).isSymbolicLink()) {
        try {
          fs.realpathSync(fullPath)
          ok++
        } catch {
          issues.push({
            severity: "error",
            message: `${entry.name}: broken symlink at ${fullPath}`,
          })
        }
      } else {
        // Copy - check SKILL.md exists
        if (fs.existsSync(path.join(fullPath, "SKILL.md"))) {
          ok++
        } else {
          issues.push({
            severity: "error",
            message: `${entry.name}: copied install at ${fullPath} missing SKILL.md`,
          })
        }
      }
    }

    if (installed > 0) {
      const status = ok === installed ? "all OK" : `${ok}/${installed} OK`
      yield* Console.log(`\nInstalled (${scope}):\n  ${label}:  ${installed} installed, ${status}`)
    }
  })

const printReport = (
  _skills: unknown[],
  issues: DiagnosticIssue[],
  _projectRoot: string | undefined,
) =>
  Effect.gen(function* () {
    for (const issue of issues) {
      if (issue.severity === "error") {
        yield* Console.log(output.error(issue.message))
      } else {
        yield* Console.log(`  - ${issue.message}`)
      }
    }
  })

export const doctorCommand = Command.make("doctor", {}, () => doctorHandler()).pipe(
  Command.withDescription("Validate the store and all install targets"),
)
