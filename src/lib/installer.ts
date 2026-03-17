import { execSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { Effect } from "effect"
import type { Config } from "../schemas/config.schema.js"
import {
  globalAgentsSkillsDir,
  globalToolSkillsDir,
  projectAgentsSkillsDir,
  projectToolSkillsDir,
} from "./paths.js"
import { getSkillPath, skillExists } from "./store.js"

export interface InstallOptions {
  name: string
  scope: "project" | "global"
  mode: "symlink" | "copy"
  tool?: string | undefined
  force: boolean
  projectRoot?: string | undefined
  config: Config
}

export interface InstallResult {
  agentsPath: string
  toolPath?: string | undefined
  mode: "symlink" | "copy"
}

export const installSkill = (opts: InstallOptions) =>
  Effect.gen(function* () {
    if (!skillExists(opts.name)) {
      return yield* Effect.fail(
        new Error(
          `Skill "${opts.name}" not found in store. Run "skills list" to see available skills.`,
        ),
      )
    }

    const storePath = getSkillPath(opts.name)

    // Determine .agents/skills target
    const agentsDir =
      opts.scope === "global"
        ? globalAgentsSkillsDir()
        : projectAgentsSkillsDir(opts.projectRoot!)
    const agentsTarget = path.join(agentsDir, opts.name)

    if (fs.existsSync(agentsTarget)) {
      if (!opts.force) {
        return yield* Effect.fail(
          new Error(
            `Skill "${opts.name}" already installed at ${agentsTarget}. Use --force to overwrite.`,
          ),
        )
      }
      fs.rmSync(agentsTarget, { recursive: true, force: true })
    }

    fs.mkdirSync(agentsDir, { recursive: true })

    if (opts.mode === "symlink") {
      // Use relative symlink for project scope, absolute for global
      if (opts.scope === "project") {
        const relPath = path.relative(agentsDir, storePath)
        fs.symlinkSync(relPath, agentsTarget)
      } else {
        fs.symlinkSync(storePath, agentsTarget)
      }
    } else {
      execSync(`cp -r ${JSON.stringify(storePath)} ${JSON.stringify(agentsTarget)}`)
    }

    let toolPath: string | undefined
    // Tool-specific symlink: points to the .agents/skills/<name> install, not to the store
    if (opts.tool) {
      const toolDir =
        opts.scope === "global"
          ? globalToolSkillsDir(opts.tool, opts.config)
          : projectToolSkillsDir(opts.projectRoot!, opts.tool, opts.config)
      const toolTarget = path.join(toolDir, opts.name)

      if (fs.existsSync(toolTarget)) {
        if (!opts.force) {
          return yield* Effect.fail(
            new Error(
              `Tool symlink already exists at ${toolTarget}. Use --force to overwrite.`,
            ),
          )
        }
        fs.rmSync(toolTarget, { recursive: true, force: true })
      }

      fs.mkdirSync(toolDir, { recursive: true })

      // Tool symlink always points to the .agents/skills install
      const relPath = path.relative(toolDir, agentsTarget)
      fs.symlinkSync(relPath, toolTarget)
      toolPath = toolTarget
    }

    return { agentsPath: agentsTarget, toolPath, mode: opts.mode } as InstallResult
  })

export interface UninstallOptions {
  name: string
  scope: "project" | "global"
  tool?: string | undefined
  projectRoot?: string | undefined
  config: Config
}

export const uninstallSkill = (opts: UninstallOptions) =>
  Effect.gen(function* () {
    const agentsDir =
      opts.scope === "global"
        ? globalAgentsSkillsDir()
        : projectAgentsSkillsDir(opts.projectRoot!)
    const agentsTarget = path.join(agentsDir, opts.name)

    if (!fs.existsSync(agentsTarget)) {
      return yield* Effect.fail(
        new Error(`Skill "${opts.name}" is not installed in ${opts.scope} scope.`),
      )
    }

    fs.rmSync(agentsTarget, { recursive: true, force: true })

    if (opts.tool) {
      const toolDir =
        opts.scope === "global"
          ? globalToolSkillsDir(opts.tool, opts.config)
          : projectToolSkillsDir(opts.projectRoot!, opts.tool, opts.config)
      const toolTarget = path.join(toolDir, opts.name)
      if (fs.existsSync(toolTarget)) {
        fs.rmSync(toolTarget, { recursive: true, force: true })
      }
    }
  })

export const checkInstallStatus = (
  name: string,
  projectRoot: string | undefined,
): { global: boolean; project: boolean } => {
  const globalPath = path.join(globalAgentsSkillsDir(), name)
  const projectPath = projectRoot
    ? path.join(projectAgentsSkillsDir(projectRoot), name)
    : undefined

  return {
    global: fs.existsSync(globalPath),
    project: projectPath ? fs.existsSync(projectPath) : false,
  }
}
