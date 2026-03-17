import pc from "picocolors"

export const success = (msg: string): string =>
  pc.green(`✓ ${msg}`)

export const warn = (msg: string): string =>
  pc.yellow(`Warning: ${msg}`)

export const error = (msg: string): string =>
  pc.red(`Error: ${msg}`)

export const info = (msg: string): string =>
  pc.cyan(msg)

export const installed = "✓"
export const notInstalled = "·"

export const sectionHeader = (title: string): string =>
  pc.bold(title)

export const skillRow = (
  name: string,
  description: string,
  globalInstalled: boolean,
  projectInstalled: boolean,
): string => {
  const globalStatus = globalInstalled ? pc.green(installed) : pc.dim(notInstalled)
  const projectStatus = projectInstalled ? pc.green(installed) : pc.dim(notInstalled)
  return [
    `  ${pc.bold(name)}`,
    `    ${description}`,
    `    ${globalStatus} global    ${projectStatus} project`,
  ].join("\n")
}
