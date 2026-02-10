import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"

/**
 * Minimal Claude Code plugin -> OpenCode + Codex converter.
 *
 * This is a lightweight fallback for environments without Bun.
 * It supports the parts used by this repo (commands + skills).
 *
 * Usage:
 *   node scripts/convert-claude-plugin.mjs            # convert cwd to both targets
 *   node scripts/convert-claude-plugin.mjs --to codex
 *   node scripts/convert-claude-plugin.mjs --to opencode
 *
 * Options:
 *   --opencode-root <path>    override OpenCode install root (default: ~/.config/opencode)
 *   --codex-home <path>       override Codex home (default: ~/.codex)
 *   --overwrite               overwrite existing files instead of skipping
 *   node scripts/convert-claude-plugin.mjs <pluginRoot>
 */

const argv = process.argv.slice(2)

const pluginRoot = (() => {
  const first = argv[0]
  if (!first) return process.cwd()
  if (first.startsWith("-")) return process.cwd()
  return path.resolve(first)
})()

const to = getFlagValue(argv, "--to") ?? "both"
const toOpenCode = to === "both" || to === "opencode"
const toCodex = to === "both" || to === "codex"

const overwrite = argv.includes("--overwrite")

const opencodeRoot = resolvePath(
  getFlagValue(argv, "--opencode-root") ?? path.join(os.homedir(), ".config", "opencode"),
)
const codexRoot = resolvePath(getFlagValue(argv, "--codex-home") ?? path.join(os.homedir(), ".codex"))

const manifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json")
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"))

const commandsDirs = resolveComponentDirs(pluginRoot, "commands", manifest.commands)
const skillsDirs = resolveComponentDirs(pluginRoot, "skills", manifest.skills)

const commands = await loadCommands(commandsDirs)
const skills = await loadSkills(skillsDirs)

if (toOpenCode) {
  const result = await installOpenCode(opencodeRoot, commands, skills, { overwrite })
  console.log(`OpenCode: installed to ${opencodeRoot}`)
  printList("OpenCode: skipped skills due to name collisions:", result.skippedSkills)
  printList("OpenCode: skipped commands due to name collisions:", result.skippedCommands)
  if (overwrite) {
    printList("OpenCode: overwritten skills:", result.overwrittenSkills)
    printList("OpenCode: overwritten commands:", result.overwrittenCommands)
  }
}

if (toCodex) {
  const result = await installCodex(codexRoot, commands, skills, { overwrite })
  console.log(`Codex: installed to ${codexRoot}`)
  printList("Codex: skipped plugin skills due to name collisions:", result.skippedPluginSkills)
  printList("Codex: skipped prompts due to name collisions:", result.skippedPrompts)
  printList("Codex: skipped generated skills due to name collisions:", result.skippedGeneratedSkills)
  if (overwrite) {
    printList("Codex: overwritten plugin skills:", result.overwrittenPluginSkills)
    printList("Codex: overwritten prompts:", result.overwrittenPrompts)
    printList("Codex: overwritten generated skills:", result.overwrittenGeneratedSkills)
  }
}

console.log(`Done. Converted ${manifest.name} v${manifest.version}.`)

function getFlagValue(args, flag) {
  const idx = args.indexOf(flag)
  if (idx === -1) return null
  const value = args[idx + 1]
  if (!value || value.startsWith("-")) return null
  return String(value).trim()
}

function resolvePath(value) {
  const raw = String(value ?? "").trim()
  if (!raw) return process.cwd()
  if (raw === "~") return os.homedir()
  if (raw.startsWith("~/")) return path.resolve(path.join(os.homedir(), raw.slice(2)))
  return path.resolve(raw)
}

function printList(header, items) {
  if (!items || items.length === 0) return
  console.warn(header)
  for (const item of items) console.warn(`- ${item}`)
}

function resolveComponentDirs(root, defaultDir, custom) {
  const dirs = [path.join(root, defaultDir)]
  for (const entry of toPathList(custom)) {
    dirs.push(resolveWithinRoot(root, entry, `${defaultDir} path`))
  }
  return dirs
}

function toPathList(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  return [value]
}

function resolveWithinRoot(root, entry, label) {
  const resolvedRoot = path.resolve(root)
  const resolvedPath = path.resolve(root, entry)
  if (resolvedPath === resolvedRoot) return resolvedPath
  if (resolvedPath.startsWith(resolvedRoot + path.sep)) return resolvedPath
  throw new Error(`Invalid ${label}: ${entry}. Paths must stay within the plugin root.`)
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function walkFiles(root) {
  const results = []
  if (!(await pathExists(root))) return results
  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await walkFiles(fullPath)))
    } else if (entry.isFile()) {
      results.push(fullPath)
    }
  }
  return results
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: raw }
  return { data: parseSimpleYaml(match[1]), body: match[2] }
}

function parseSimpleYaml(yamlText) {
  const data = {}
  const lines = yamlText.split(/\r?\n/)
  let currentListKey = null
  for (const line of lines) {
    if (!line || !line.trim() || line.trim().startsWith("#")) continue

    const listItem = line.match(/^\s*-\s+(.*)$/)
    if (listItem && currentListKey) {
      if (!Array.isArray(data[currentListKey])) data[currentListKey] = []
      data[currentListKey].push(coerceYamlScalar(listItem[1].trim()))
      continue
    }

    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!kv) continue
    const key = kv[1]
    const rest = kv[2] ?? ""
    if (!rest) {
      currentListKey = key
      data[key] = data[key] ?? ""
      continue
    }
    currentListKey = null
    data[key] = coerceYamlScalar(rest.trim())
  }
  return data
}

function coerceYamlScalar(value) {
  const quoted = value.match(/^(["'])(.*)\1$/)
  if (quoted) return quoted[2]
  if (value === "true") return true
  if (value === "false") return false
  const num = Number(value)
  if (!Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(value)) return num
  return value
}

function formatFrontmatter(data, body) {
  const yamlLines = []
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === "") continue
    yamlLines.push(renderYamlKeyValue(key, value))
  }
  const trimmedBody = String(body ?? "").trim()
  if (yamlLines.length === 0) return trimmedBody + "\n"
  return `---\n${yamlLines.join("\n")}\n---\n\n${trimmedBody}\n`
}

function renderYamlKeyValue(key, value) {
  if (Array.isArray(value)) {
    const items = value.map((v) => `  - ${renderYamlScalar(v)}`).join("\n")
    return `${key}:\n${items}`
  }
  return `${key}: ${renderYamlScalar(value)}`
}

function renderYamlScalar(value) {
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(String(value))
}

async function loadCommands(dirs) {
  const files = []
  for (const dir of dirs) {
    const entries = await walkFiles(dir)
    files.push(...entries.filter((p) => p.toLowerCase().endsWith(".md")))
  }

  const commands = []
  for (const file of files) {
    const raw = await fs.readFile(file, "utf8")
    const { data, body } = parseFrontmatter(raw)
    const name = (data.name && String(data.name)) || path.basename(file, ".md")
    const description = data.description ? String(data.description) : undefined
    const argumentHint = data["argument-hint"] ? String(data["argument-hint"]) : undefined
    const allowedTools = data["allowed-tools"]
    const disableModelInvocation = data["disable-model-invocation"] === true ? true : undefined
    commands.push({
      name,
      description,
      argumentHint,
      allowedTools: Array.isArray(allowedTools) ? allowedTools.map(String) : undefined,
      disableModelInvocation,
      body: body.trim(),
    })
  }

  return commands
}

async function loadSkills(dirs) {
  const files = []
  for (const dir of dirs) {
    const entries = await walkFiles(dir)
    files.push(...entries)
  }
  const skillFiles = files.filter((p) => path.basename(p) === "SKILL.md")
  const skills = []
  for (const file of skillFiles) {
    const raw = await fs.readFile(file, "utf8")
    const { data } = parseFrontmatter(raw)
    const name = (data.name && String(data.name)) || path.basename(path.dirname(file))
    skills.push({ name, sourceDir: path.dirname(file) })
  }
  return skills
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function copyDir(sourceDir, targetDir) {
  await ensureDir(targetDir)
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })
  for (const entry of entries) {
    const src = path.join(sourceDir, entry.name)
    const dst = path.join(targetDir, entry.name)
    if (entry.isDirectory()) {
      await copyDir(src, dst)
    } else if (entry.isFile()) {
      await ensureDir(path.dirname(dst))
      await fs.copyFile(src, dst)
    }
  }
}

function normalizeName(value) {
  const trimmed = String(value ?? "").trim()
  if (!trimmed) return "item"
  const normalized = trimmed
    .toLowerCase()
    .replace(/[\\/]+/g, "-")
    .replace(/[:\s]+/g, "-")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || "item"
}

function uniqueName(base, used) {
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  let index = 2
  while (used.has(`${base}-${index}`)) index += 1
  const name = `${base}-${index}`
  used.add(name)
  return name
}

function sanitizeDescription(value, maxLength = 1024) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) return normalized
  const ellipsis = "..."
  return normalized.slice(0, Math.max(0, maxLength - ellipsis.length)).trimEnd() + ellipsis
}

async function installOpenCode(opencodeRoot, commands, skills, options = {}) {
  const overwrite = options.overwrite === true
  await ensureDir(opencodeRoot)
  await ensureDir(path.join(opencodeRoot, "agents"))
  await ensureDir(path.join(opencodeRoot, "plugins"))
  await ensureDir(path.join(opencodeRoot, "skills"))

  // Copy skills
  const skippedSkills = []
  const overwrittenSkills = []
  for (const skill of skills) {
    const target = path.join(opencodeRoot, "skills", skill.name)
    if (await pathExists(target)) {
      if (!overwrite) {
        skippedSkills.push(skill.name)
        continue
      }
      overwrittenSkills.push(skill.name)
    }
    await copyDir(skill.sourceDir, target)
  }

  const configPath = path.join(opencodeRoot, "opencode.json")
  let config = {}
  if (await pathExists(configPath)) {
    config = JSON.parse(await fs.readFile(configPath, "utf8"))
  }

  if (!config || typeof config !== "object" || Array.isArray(config)) config = {}

  config.$schema = config.$schema || "https://opencode.ai/config.json"
  const commandMap =
    config.command && typeof config.command === "object" && !Array.isArray(config.command)
      ? config.command
      : {}

  const skippedCommands = []
  const overwrittenCommands = []
  for (const command of commands) {
    if (command.disableModelInvocation) continue
    if (Object.prototype.hasOwnProperty.call(commandMap, command.name)) {
      if (!overwrite) {
        skippedCommands.push(command.name)
        continue
      }
      overwrittenCommands.push(command.name)
    }
    commandMap[command.name] = {
      description: command.description,
      template: command.body,
    }
  }

  config.command = commandMap
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8")

  return { skippedCommands, overwrittenCommands, skippedSkills, overwrittenSkills }
}

async function installCodex(codexRoot, commands, skills, options = {}) {
  const overwrite = options.overwrite === true
  await ensureDir(codexRoot)
  const promptsDir = path.join(codexRoot, "prompts")
  const skillsDir = path.join(codexRoot, "skills")
  await ensureDir(promptsDir)
  await ensureDir(skillsDir)

  const usedSkillNames = new Set()
  const skippedPluginSkills = []
  const overwrittenPluginSkills = []
  for (const skill of skills) {
    usedSkillNames.add(normalizeName(skill.name))
    const target = path.join(skillsDir, skill.name)
    if (await pathExists(target)) {
      if (!overwrite) {
        skippedPluginSkills.push(skill.name)
        continue
      }
      overwrittenPluginSkills.push(skill.name)
    }
    await copyDir(skill.sourceDir, target)
  }

  const promptNames = new Set()
  const skippedPrompts = []
  const skippedGeneratedSkills = []
  const overwrittenPrompts = []
  const overwrittenGeneratedSkills = []

  for (const command of commands) {
    if (command.disableModelInvocation) continue

    const promptName = uniqueName(normalizeName(command.name), promptNames)
    const genSkillName = uniqueName(normalizeName(command.name), usedSkillNames)

    const genSkillDir = path.join(skillsDir, genSkillName)
    const genSkillPath = path.join(genSkillDir, "SKILL.md")
    await ensureDir(genSkillDir)
    if (await pathExists(genSkillPath)) {
      if (!overwrite) {
        skippedGeneratedSkills.push(genSkillName)
      } else {
        overwrittenGeneratedSkills.push(genSkillName)
      }
    }

    const skillFrontmatter = {
      name: genSkillName,
      description: sanitizeDescription(
        command.description ?? `Converted from Claude command ${command.name}`,
      ),
    }
    const skillSections = []
    if (command.argumentHint) skillSections.push(`## Arguments\n${command.argumentHint}`)
    if (command.allowedTools && command.allowedTools.length > 0) {
      skillSections.push(
        `## Allowed tools\n${command.allowedTools.map((t) => `- ${t}`).join("\n")}`,
      )
    }
    skillSections.push(command.body)
    if (!(await pathExists(genSkillPath)) || overwrite) {
      await fs.writeFile(
        genSkillPath,
        formatFrontmatter(skillFrontmatter, skillSections.filter(Boolean).join("\n\n")),
        "utf8",
      )
    }

    const promptPath = path.join(promptsDir, `${promptName}.md`)
    if (await pathExists(promptPath)) {
      if (!overwrite) {
        skippedPrompts.push(promptName)
      } else {
        overwrittenPrompts.push(promptName)
      }
    }

    const promptFrontmatter = {
      description: command.description,
      "argument-hint": command.argumentHint,
    }
    const promptBody = [
      `Use the $${genSkillName} skill for this command and follow its instructions.`,
      "",
      command.body,
    ].join("\n")

    if (!(await pathExists(promptPath)) || overwrite) {
      await fs.writeFile(promptPath, formatFrontmatter(promptFrontmatter, promptBody), "utf8")
    }
  }

  return {
    skippedPluginSkills,
    skippedPrompts,
    skippedGeneratedSkills,
    overwrittenPluginSkills,
    overwrittenPrompts,
    overwrittenGeneratedSkills,
  }
}
