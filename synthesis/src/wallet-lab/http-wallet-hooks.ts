import { createHash } from 'node:crypto'
import { MerklePath, Transaction, Utils } from '@bsv/sdk'
import type { PermissionObservation } from './model.js'

// Prompt answering and declared automation hooks for the desktop HTTP wallet driver.
//
// A desktop wallet asks its user before it grants a permission or signs a transaction. The driver
// never answers inside the wallet. It either waits for a person at the wallet (attended mode) or
// sends the laboratory's decision to an automation hook that the wallet documents (declared-hook
// mode). The adapter configuration describes the hook; every request and response is recorded.

export type PromptDecision = 'allow' | 'deny'

export interface DeclaredHookUse {
  sequence: number
  purpose: string
  method: 'GET' | 'POST'
  url: string
  request?: unknown
  status?: number
  response?: unknown
  error?: string
  at: string
}

export interface PromptHookConfiguration {
  /** Where the wallet publisher documents the hook. */
  documentation: string
  /** Lists prompts waiting for a decision. */
  pendingUrl: string
  /** Receives one decision. */
  answerUrl: string
  pendingMethod?: 'GET' | 'POST'
  /** Field of the pending response that holds the prompt array; empty when the response is the array. */
  promptsField?: string
  idField?: string
  originField?: string
  kindField?: string
  textField?: string
  /** Field names of the answer request body. */
  answerIdField?: string
  answerDecisionField?: string
  allowValue?: string
  denyValue?: string
  pollIntervalMs?: number
}

export interface FixtureHookConfiguration {
  documentation: string
  /** Pays the derived fixture key and returns proof material. */
  fundUrl: string
  /** Schedules the next controlled transaction-submission verdict. */
  verdictUrl: string
  /** Reports controlled transaction submissions observed so far. */
  submissionsUrl: string
}

export type PromptAnswering =
  | { mode: 'attended'; timeoutMs?: number }
  | { mode: 'declared-hook'; timeoutMs?: number; hook: PromptHookConfiguration }

export interface PendingPrompt {
  id: string
  origin: string
  kind: string
  text: string
}

/** The laboratory's decision for a prompt. It matches the browser-extension driver's policy. */
export function decidePrompt(text: string): PromptDecision {
  return /tpnil denied permission|tpnil origin isolation/i.test(text) ? 'deny' : 'allow'
}

export function summarizePrompt(text: string): string {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join(' | ')
    .slice(0, 1_000)
}

export function requireLoopbackUrl(value: string, label: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new TypeError(`${label} is not a URL: ${value}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new TypeError(`${label} must use HTTP: ${value}`)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new TypeError(`${label} must be a loopback address: ${value}`)
  if (url.username !== '' || url.password !== '') throw new TypeError(`${label} must not carry credentials`)
  return url
}

function field(record: unknown, name: string): unknown {
  if (name === '') return record
  return record !== null && typeof record === 'object' ? (record as Record<string, unknown>)[name] : undefined
}

/** Sends JSON to declared hooks and keeps the record of every use. */
export class DeclaredHookClient {
  readonly uses: DeclaredHookUse[] = []
  private sequence = 0

  constructor(private readonly requestTimeoutMs = 10_000) {}

  async request(purpose: string, method: 'GET' | 'POST', target: string, body?: unknown): Promise<{ status: number; body: unknown }> {
    const url = requireLoopbackUrl(target, `${purpose} hook`)
    const use: DeclaredHookUse = {
      sequence: ++this.sequence,
      purpose,
      method,
      url: url.toString(),
      ...(body === undefined ? {} : { request: body }),
      at: new Date().toISOString()
    }
    this.uses.push(use)
    try {
      const response = await fetch(url, {
        method,
        headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'error',
        signal: AbortSignal.timeout(this.requestTimeoutMs)
      })
      const text = await response.text()
      let parsed: unknown = text
      try {
        parsed = text === '' ? null : JSON.parse(text)
      } catch { /* A non-JSON reply is recorded as text. */ }
      use.status = response.status
      use.response = parsed
      return { status: response.status, body: parsed }
    } catch (error) {
      use.error = error instanceof Error ? error.message : String(error)
      throw error
    }
  }
}

export interface PromptAnswerer {
  readonly mode: PromptAnswering['mode']
  /** Bound for one wallet call that may wait on a prompt. */
  readonly timeoutMs: number
  readonly permissions: PermissionObservation[]
  start(): void
  stop(): Promise<void>
  /** Tells the person at the wallet what the laboratory expects next (attended mode only). */
  instruct(message: string): void
  describe(): Record<string, unknown>
}

/** A person answers the wallet's prompts. The driver only states the expected decision and waits. */
export class AttendedPromptAnswerer implements PromptAnswerer {
  readonly mode = 'attended' as const
  readonly permissions: PermissionObservation[] = []
  readonly instructions: Array<{ at: string; message: string }> = []

  constructor(readonly timeoutMs: number, private readonly write: (line: string) => void = line => process.stdout.write(line)) {}

  start(): void {}

  async stop(): Promise<void> {}

  instruct(message: string): void {
    this.instructions.push({ at: new Date().toISOString(), message })
    this.write(`[attended] ${message}\n`)
  }

  describe(): Record<string, unknown> {
    return {
      mode: this.mode,
      timeoutMs: this.timeoutMs,
      instructions: this.instructions,
      note: 'Prompt decisions were made by the operator at the wallet. The driver did not observe them.'
    }
  }
}

/** Polls the wallet's documented hook and answers each prompt with the laboratory decision. */
export class DeclaredHookPromptAnswerer implements PromptAnswerer {
  readonly mode = 'declared-hook' as const
  readonly permissions: PermissionObservation[] = []
  private timer: NodeJS.Timeout | undefined
  private polling: Promise<void> | undefined
  private readonly answered = new Set<string>()
  readonly errors: string[] = []

  constructor(
    readonly timeoutMs: number,
    private readonly hook: PromptHookConfiguration,
    private readonly client: DeclaredHookClient,
    private readonly log: (line: string) => void = () => undefined
  ) {
    requireLoopbackUrl(hook.pendingUrl, 'prompt pending')
    requireLoopbackUrl(hook.answerUrl, 'prompt answer')
  }

  start(): void {
    const interval = this.hook.pollIntervalMs ?? 250
    this.timer = setInterval(() => {
      if (this.polling !== undefined) return
      this.polling = this.pollOnce()
        .catch(error => { this.errors.push(error instanceof Error ? error.message : String(error)) })
        .finally(() => { this.polling = undefined })
    }, interval)
  }

  async stop(): Promise<void> {
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
    await this.polling
  }

  instruct(): void {}

  async pending(): Promise<PendingPrompt[]> {
    const reply = await this.client.request('prompt-pending', this.hook.pendingMethod ?? 'GET', this.hook.pendingUrl,
      (this.hook.pendingMethod ?? 'GET') === 'POST' ? {} : undefined)
    if (reply.status !== 200) throw new Error(`Prompt hook answered HTTP ${reply.status}`)
    const list = field(reply.body, this.hook.promptsField ?? 'prompts')
    if (!Array.isArray(list)) throw new Error('Prompt hook response holds no prompt list')
    return list.map(item => {
      const id = field(item, this.hook.idField ?? 'id')
      const origin = field(item, this.hook.originField ?? 'origin')
      const text = field(item, this.hook.textField ?? 'text')
      if (!((typeof id === 'string' && id.trim() !== '') || (typeof id === 'number' && Number.isFinite(id))) ||
          typeof origin !== 'string' || origin.trim() === '' || typeof text !== 'string' || text.trim() === '')
        throw new Error('Malformed pending prompt: id, origin and text are required')
      return { id: String(id), origin, kind: String(field(item, this.hook.kindField ?? 'kind') ?? 'permission'), text }
    })
  }

  async pollOnce(): Promise<void> {
    for (const prompt of await this.pending()) {
      if (this.answered.has(prompt.id)) continue
      const decision = decidePrompt(prompt.text)
      const value = decision === 'allow' ? this.hook.allowValue ?? 'allow' : this.hook.denyValue ?? 'deny'
      const reply = await this.client.request('prompt-answer', 'POST', this.hook.answerUrl, {
        [this.hook.answerIdField ?? 'id']: prompt.id,
        [this.hook.answerDecisionField ?? 'decision']: value
      })
      if (reply.status !== 200) throw new Error(`Prompt answer hook answered HTTP ${reply.status}`)
      this.answered.add(prompt.id)
      const sequence = this.permissions.length + 1
      this.permissions.push({ sequence, origin: prompt.origin, kind: prompt.kind, decision, summary: summarizePrompt(prompt.text) })
      this.log(`permission ${sequence}: ${decision} ${prompt.kind} for ${prompt.origin}`)
    }
  }

  describe(): Record<string, unknown> {
    return { mode: this.mode, timeoutMs: this.timeoutMs, hook: this.hook, answered: this.permissions.length, errors: this.errors }
  }
}

export function createPromptAnswerer(
  configuration: PromptAnswering,
  client: DeclaredHookClient,
  log: (line: string) => void
): PromptAnswerer {
  if (configuration.mode === 'attended')
    return new AttendedPromptAnswerer(configuration.timeoutMs ?? 300_000, line => log(line.trimEnd()))
  if (configuration.mode === 'declared-hook')
    return new DeclaredHookPromptAnswerer(configuration.timeoutMs ?? 120_000, configuration.hook, client, log)
  throw new TypeError(`Unknown prompt answering mode: ${String((configuration as { mode?: unknown }).mode)}`)
}

/** Proof material a fixture hook returns for a payment mined in one block. */
export interface BlockFundingMaterial {
  txid: string
  rawTx: string
  blockHeight: number
  merkleRoot: string
  /** Block transaction ids in display order, as a node's block listing gives them. */
  blockTxids: string[]
}

function doubleSha256(bytes: Buffer): Buffer {
  return createHash('sha256').update(createHash('sha256').update(bytes).digest()).digest()
}

/** Builds the BRC-74 path of one transaction from its block's transaction list. */
export function merklePathFromBlock(height: number, txids: string[], index: number): MerklePath {
  if (!Number.isSafeInteger(index) || index < 0 || index >= txids.length) throw new RangeError('Transaction is not in the block list')
  const display = (hash: Buffer): string => Buffer.from(hash).reverse().toString('hex')
  let level: Buffer[] = txids.map(txid => Buffer.from(txid, 'hex').reverse())
  let offset = index
  const path: Array<Array<{ offset: number; hash?: string; txid?: boolean; duplicate?: boolean }>> = []
  if (level.length === 1) return new MerklePath(height, [[{ offset: 0, hash: txids[0]!, txid: true }]])
  for (let depth = 0; ; depth += 1) {
    const leaves: Array<{ offset: number; hash?: string; txid?: boolean; duplicate?: boolean }> = []
    if (depth === 0) leaves.push({ offset, hash: txids[offset]!, txid: true })
    const sibling = offset ^ 1
    if (sibling < level.length) leaves.push({ offset: sibling, hash: display(level[sibling]!) })
    else leaves.push({ offset: sibling, duplicate: true })
    path.push(leaves.sort((left, right) => left.offset - right.offset))
    if (level.length === 1) break
    if (level.length % 2 === 1) level.push(level[level.length - 1]!)
    const next: Buffer[] = []
    for (let item = 0; item < level.length; item += 2) next.push(doubleSha256(Buffer.concat([level[item]!, level[item + 1]!])))
    level = next
    offset >>= 1
    if (level.length === 1) break
  }
  return new MerklePath(height, path as never)
}

export function fundingTransactionFromBlock(material: BlockFundingMaterial): Transaction {
  const transaction = Transaction.fromHex(material.rawTx)
  const txid = transaction.id('hex')
  if (txid !== material.txid) throw new Error(`Fixture hook transaction id mismatch: ${txid}`)
  transaction.merklePath = merklePathFromBlock(material.blockHeight, material.blockTxids, material.blockTxids.indexOf(txid))
  if (transaction.merklePath.computeRoot(txid) !== material.merkleRoot)
    throw new Error('Fixture hook proof does not reach the declared Merkle root')
  return transaction
}

export function bytesToHex(bytes: number[] | Uint8Array): string {
  return Utils.toHex([...bytes])
}
