import { execSync } from "node:child_process"
import * as fs from "node:fs"
import { Effect } from "effect"

export class GitError extends Error {
  readonly _tag = "GitError"
  constructor(message: string) {
    super(message)
    this.name = "GitError"
  }
}

export const clone = (url: string, targetDir: string) =>
  Effect.try({
    try: () => {
      execSync(`git clone ${JSON.stringify(url)} ${JSON.stringify(targetDir)}`, {
        stdio: "pipe",
      })
    },
    catch: (e) =>
      new GitError(`Git clone failed: ${e instanceof Error ? e.message : String(e)}`),
  })

export const pull = (repoDir: string) =>
  Effect.try({
    try: () => {
      execSync("git pull", { cwd: repoDir, stdio: "pipe" })
    },
    catch: (e) =>
      new GitError(`Git pull failed: ${e instanceof Error ? e.message : String(e)}`),
  })

export interface ParsedSource {
  type: "git" | "local"
  url?: string
  path?: string
}

const githubShorthandRegex = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/

export const parseSource = (source: string): ParsedSource => {
  if (source.startsWith("git@") || source.startsWith("https://") || source.startsWith("http://") || source.startsWith("file://")) {
    return { type: "git", url: source }
  }
  // Local paths: starts with ./ or ../ or / or ~
  if (source.startsWith("./") || source.startsWith("../") || source.startsWith("/") || source.startsWith("~")) {
    return { type: "local", path: source }
  }
  if (githubShorthandRegex.test(source)) {
    return { type: "git", url: `https://github.com/${source}.git` }
  }
  return { type: "local", path: source }
}

export const isGitRepo = (dirPath: string): boolean =>
  fs.existsSync(`${dirPath}/.git`)

export const hasUncommittedChanges = (repoDir: string): boolean => {
  try {
    const output = execSync("git status --porcelain", {
      cwd: repoDir,
      stdio: "pipe",
    })
    return output.toString().trim().length > 0
  } catch {
    return false
  }
}
