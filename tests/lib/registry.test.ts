import { describe, expect, it } from "vitest"
import {
  addEntry,
  entriesForCacheKey,
  getEntry,
  gitSourcedEntries,
  removeEntry,
} from "../../src/lib/registry.js"
import { EMPTY_REGISTRY, type RegistryEntry } from "../../src/schemas/registry.schema.js"

const makeGitEntry = (url: string, skillPath: string, cacheKey: string): RegistryEntry => ({
  source: { type: "git", url, skill_path: skillPath, ref: "main" },
  cache_key: cacheKey,
  added_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
})

const makeLocalEntry = (localPath: string): RegistryEntry => ({
  source: { type: "local", path: localPath },
  added_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
})

describe("registry pure functions", () => {
  it("adds an entry", () => {
    const entry = makeGitEntry("https://github.com/user/repo.git", "skill-a", "abc123")
    const reg = addEntry(EMPTY_REGISTRY, "skill-a", entry)
    expect(reg.skills["skill-a"]).toBe(entry)
  })

  it("removes an entry", () => {
    const entry = makeGitEntry("https://github.com/user/repo.git", "skill-a", "abc123")
    const reg = addEntry(EMPTY_REGISTRY, "skill-a", entry)
    const reg2 = removeEntry(reg, "skill-a")
    expect(reg2.skills["skill-a"]).toBeUndefined()
  })

  it("gets an entry", () => {
    const entry = makeGitEntry("https://github.com/user/repo.git", "skill-a", "abc123")
    const reg = addEntry(EMPTY_REGISTRY, "skill-a", entry)
    expect(getEntry(reg, "skill-a")).toBe(entry)
    expect(getEntry(reg, "nonexistent")).toBeUndefined()
  })

  it("filters git-sourced entries", () => {
    let reg = EMPTY_REGISTRY
    reg = addEntry(reg, "git-skill", makeGitEntry("https://url", "git-skill", "key1"))
    reg = addEntry(reg, "local-skill", makeLocalEntry("/some/path"))
    const gitEntries = gitSourcedEntries(reg)
    expect(gitEntries).toHaveLength(1)
    expect(gitEntries[0][0]).toBe("git-skill")
  })

  it("filters by cache key", () => {
    let reg = EMPTY_REGISTRY
    reg = addEntry(reg, "skill-a", makeGitEntry("https://url", "skill-a", "key1"))
    reg = addEntry(reg, "skill-b", makeGitEntry("https://url", "skill-b", "key1"))
    reg = addEntry(reg, "skill-c", makeGitEntry("https://other", "skill-c", "key2"))

    const entries = entriesForCacheKey(reg, "key1")
    expect(entries).toHaveLength(2)
  })
})
