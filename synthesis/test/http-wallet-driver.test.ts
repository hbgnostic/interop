import { createHash } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { P2PKH, PrivateKey, Transaction } from '@bsv/sdk'
import { describe, expect, it } from 'vitest'
import { BRC100_METHODS, isPermissionRefusal, parseSubmissions, probeMethodInventory, runHttpDesktopWallet, WalletRefusal } from '../src/wallet-lab/http-wallet-driver.js'
import {
  AttendedPromptAnswerer,
  DeclaredHookClient,
  DeclaredHookPromptAnswerer,
  createPromptAnswerer,
  decidePrompt,
  fundingTransactionFromBlock,
  merklePathFromBlock,
  requireLoopbackUrl
} from '../src/wallet-lab/http-wallet-hooks.js'

type Handler = (method: string, url: string, body: unknown) => { status: number; body: unknown; headers?: Record<string, string> }

async function serve(handler: Handler): Promise<{ url: string; requests: Array<{ url: string; body: unknown; headers: http.IncomingHttpHeaders }>; close: () => Promise<void> }> {
  const requests: Array<{ url: string; body: unknown; headers: http.IncomingHttpHeaders }> = []
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', chunk => chunks.push(Buffer.from(chunk)))
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      const body = text === '' ? undefined : JSON.parse(text) as unknown
      requests.push({ url: request.url ?? '/', body, headers: request.headers })
      const reply = handler(request.method ?? 'GET', request.url ?? '/', body)
      const bytes = Buffer.from(JSON.stringify(reply.body))
      response.writeHead(reply.status, { 'content-type': 'application/json', 'content-length': String(bytes.length), ...reply.headers }).end(bytes)
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>(resolve => server.close(() => resolve()))
  }
}

function doubleSha256(bytes: Buffer): Buffer {
  return createHash('sha256').update(createHash('sha256').update(bytes).digest()).digest()
}

function merkleRoot(txids: string[]): string {
  let level: Buffer[] = txids.map(txid => Buffer.from(txid, 'hex').reverse())
  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1]!)
    const next: Buffer[] = []
    for (let index = 0; index < level.length; index += 2) next.push(doubleSha256(Buffer.concat([level[index]!, level[index + 1]!])))
    level = next
  }
  return Buffer.from(level[0]!).reverse().toString('hex')
}

describe('desktop HTTP wallet prompt answering', () => {
  it('applies the laboratory decision policy of the extension driver', () => {
    expect(decidePrompt('Origin https://todo.itcve.test\nProtocol todo list')).toBe('allow')
    expect(decidePrompt('Protocol: "tpnil denied permission"')).toBe('deny')
    expect(decidePrompt('Protocol: TPNIL ORIGIN ISOLATION')).toBe('deny')
  })

  it('accepts only loopback hook addresses without credentials', () => {
    expect(requireLoopbackUrl('http://127.0.0.1:9900/prompts', 'hook').port).toBe('9900')
    expect(requireLoopbackUrl('http://localhost:3321', 'hook').hostname).toBe('localhost')
    expect(() => requireLoopbackUrl('https://hook.example.test/prompts', 'hook')).toThrow(/loopback/)
    expect(() => requireLoopbackUrl('http://user:secret@127.0.0.1/prompts', 'hook')).toThrow(/credentials/)
    expect(() => requireLoopbackUrl('file:///tmp/hook', 'hook')).toThrow(/HTTP/)
  })

  it('answers each pending prompt once through the declared hook and records every use', async () => {
    const answers: Array<Record<string, unknown>> = []
    const hook = await serve((method, url, body) => {
      if (method === 'GET' && url === '/automation/pending') {
        return {
          status: 200,
          body: {
            waiting: [
              { ref: 'p1', app: 'https://todo.itcve.test', type: 'grant', message: 'Requested permission: basket todo tokens' },
              { ref: 'p2', app: 'https://deny.itcve.test', type: 'grant', message: 'Protocol: tpnil denied permission' }
            ].filter(item => !answers.some(answer => answer.ref === item.ref))
          }
        }
      }
      if (method === 'POST' && url === '/automation/answer') {
        answers.push(body as Record<string, unknown>)
        return { status: 200, body: { ok: true } }
      }
      return { status: 404, body: { error: 'unknown' } }
    })
    try {
      const client = new DeclaredHookClient()
      const answerer = new DeclaredHookPromptAnswerer(5_000, {
        documentation: 'fixture hook',
        pendingUrl: `${hook.url}/automation/pending`,
        answerUrl: `${hook.url}/automation/answer`,
        promptsField: 'waiting',
        idField: 'ref',
        originField: 'app',
        kindField: 'type',
        textField: 'message',
        answerIdField: 'ref',
        answerDecisionField: 'choice',
        allowValue: 'yes',
        denyValue: 'no'
      }, client)
      await answerer.pollOnce()
      await answerer.pollOnce()
      expect(answers).toEqual([{ ref: 'p1', choice: 'yes' }, { ref: 'p2', choice: 'no' }])
      expect(answerer.permissions.map(item => [item.sequence, item.origin, item.kind, item.decision])).toEqual([
        [1, 'https://todo.itcve.test', 'grant', 'allow'],
        [2, 'https://deny.itcve.test', 'grant', 'deny']
      ])
      expect(client.uses.map(use => [use.purpose, use.method, use.status])).toEqual([
        ['prompt-pending', 'GET', 200],
        ['prompt-answer', 'POST', 200],
        ['prompt-answer', 'POST', 200],
        ['prompt-pending', 'GET', 200]
      ])
      expect(client.uses[1]!.request).toEqual({ ref: 'p1', choice: 'yes' })
    } finally {
      await hook.close()
    }
  })

  it('polls in the background and stops cleanly', async () => {
    let pending = [{ id: 'a', origin: 'https://todo.itcve.test', kind: 'confirm', text: 'Confirm a transaction' }]
    const hook = await serve((method, url) => {
      if (url === '/pending') return { status: 200, body: { prompts: pending } }
      pending = []
      return { status: 200, body: {} }
    })
    try {
      const answerer = new DeclaredHookPromptAnswerer(5_000, {
        documentation: 'fixture hook', pendingUrl: `${hook.url}/pending`, answerUrl: `${hook.url}/answer`, pollIntervalMs: 20
      }, new DeclaredHookClient())
      answerer.start()
      const deadline = Date.now() + 2_000
      while (answerer.permissions.length === 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20))
      await answerer.stop()
      expect(answerer.permissions).toHaveLength(1)
      expect(answerer.describe()).toMatchObject({ mode: 'declared-hook', answered: 1, errors: [] })
    } finally {
      await hook.close()
    }
  })

  it('records hook failures without inventing an answer', async () => {
    const hook = await serve(() => ({ status: 500, body: { error: 'down' } }))
    try {
      const client = new DeclaredHookClient()
      const answerer = new DeclaredHookPromptAnswerer(5_000, {
        documentation: 'fixture hook', pendingUrl: `${hook.url}/pending`, answerUrl: `${hook.url}/answer`
      }, client)
      await expect(answerer.pollOnce()).rejects.toThrow(/HTTP 500/)
      expect(answerer.permissions).toHaveLength(0)
      expect(client.uses).toHaveLength(1)
      expect(client.uses[0]!.status).toBe(500)
    } finally {
      await hook.close()
    }
  })

  it('leaves attended decisions to the operator and keeps its instructions', () => {
    const lines: string[] = []
    const answerer = new AttendedPromptAnswerer(60_000, line => lines.push(line))
    answerer.instruct('Deny the request from https://deny.itcve.test.')
    expect(lines).toEqual(['[attended] Deny the request from https://deny.itcve.test.\n'])
    expect(answerer.permissions).toHaveLength(0)
    expect(answerer.describe()).toMatchObject({ mode: 'attended', timeoutMs: 60_000 })
    expect(createPromptAnswerer({ mode: 'attended' }, new DeclaredHookClient(), () => undefined).timeoutMs).toBe(300_000)
    expect(() => createPromptAnswerer({ mode: 'declared-hook', hook: {
      documentation: 'remote', pendingUrl: 'http://192.0.2.1/pending', answerUrl: 'http://127.0.0.1/answer'
    } }, new DeclaredHookClient(), () => undefined)).toThrow(/loopback/)
  })

  it('records and rejects hook redirects without contacting the destination', async () => {
    const destination = await serve(() => ({ status: 200, body: { prompts: [] } }))
    const redirect = await serve(() => ({ status: 302, body: {}, headers: { location: destination.url } }))
    try {
      const client = new DeclaredHookClient()
      await expect(client.request('redirect-test', 'GET', redirect.url)).rejects.toThrow()
      expect(destination.requests).toHaveLength(0)
      expect(client.uses).toHaveLength(1)
      expect(client.uses[0]!.error).toBeTruthy()
    } finally {
      await redirect.close()
      await destination.close()
    }
  })

  it('rejects incomplete prompt observations before sending any answer', async () => {
    const hook = await serve(() => ({ status: 200, body: { prompts: [{ id: 'p1', origin: 'https://todo.itcve.test' }] } }))
    try {
      const client = new DeclaredHookClient()
      const answerer = new DeclaredHookPromptAnswerer(5_000, {
        documentation: 'fixture hook', pendingUrl: hook.url, answerUrl: `${hook.url}/answer`
      }, client)
      await expect(answerer.pollOnce()).rejects.toThrow(/Malformed pending prompt/)
      expect(answerer.permissions).toHaveLength(0)
      expect(hook.requests).toHaveLength(1)
    } finally {
      await hook.close()
    }
  })
})

describe('desktop HTTP wallet evidence boundaries', () => {
  it('distinguishes a permission refusal from unavailable methods and infrastructure errors', () => {
    expect(isPermissionRefusal(new WalletRefusal('getPublicKey', 403, 'Forbidden'))).toBe(true)
    expect(isPermissionRefusal(new WalletRefusal('getPublicKey', 400, 'User denied permission'))).toBe(true)
    for (const error of [new Error('timeout'), new WalletRefusal('getPublicKey', 404, 'Not found'), new WalletRefusal('getPublicKey', 500, 'Permission service unavailable'), new WalletRefusal('getPublicKey', 400, 'Invalid key ID')])
      expect(isPermissionRefusal(error)).toBe(false)
  })

  it('accepts only explicit fixture verdicts and binds supplied transaction bytes', () => {
    const transaction = new Transaction()
    transaction.addOutput({ satoshis: 2, lockingScript: new P2PKH().lock(PrivateKey.fromHex('44'.repeat(32)).toPublicKey().toAddress()) })
    const txid = transaction.id('hex')
    expect(parseSubmissions([{ txid, verdict: 'ACCEPTED_BY_NETWORK', rawTx: transaction.toHex() }, { txid, verdict: 'REJECTED' }]).map(item => item.verdict))
      .toEqual(['ACCEPTED_BY_NETWORK', 'REJECTED'])
    for (const verdict of [undefined, null, 'PENDING', 'accepted', true])
      expect(() => parseSubmissions([{ txid, verdict }])).toThrow(/verdict/)
    expect(() => parseSubmissions([null])).toThrow(/Malformed/)
    expect(() => parseSubmissions([{ txid: '', verdict: 'REJECTED' }])).toThrow(/transaction id/)
    expect(() => parseSubmissions([{ txid: 'aa'.repeat(32), verdict: 'ACCEPTED_BY_NETWORK', rawTx: transaction.toHex() }])).toThrow(/mismatch/)
  })

  it('preserves an aborted attempt without producing a completed result', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-http-failure-'))
    try {
      const artifact = { id: 'fixture', version: '1', sha256: '00'.repeat(32), size: 0 }
      await expect(runHttpDesktopWallet({
        webroot: directory, outputDirectory: directory, walletArtifact: artifact, applicationArtifact: artifact,
        expectedWalletVersion: 'fixture', browserExecutable: path.join(directory, 'missing-browser'),
        prompts: { mode: 'attended' },
        fixture: {
          mode: 'declared-hook', applicationOrigin: 'http://127.0.0.1:9', denyOrigin: 'http://127.0.0.1:10', alternateOrigin: 'http://127.0.0.1:11',
          hook: { documentation: 'unit fixture', fundUrl: 'http://127.0.0.1:9/fund', verdictUrl: 'http://127.0.0.1:9/verdict', submissionsUrl: 'http://127.0.0.1:9/submissions' }
        }
      })).rejects.toThrow(/executable/)
      expect(fs.existsSync(path.join(directory, 'record.json'))).toBe(false)
      expect(JSON.parse(fs.readFileSync(path.join(directory, 'evidence', 'attempt-failure.json'), 'utf8')).error).toMatch(/executable/)
      expect(JSON.parse(fs.readFileSync(path.join(directory, 'evidence', 'declared-hooks.json'), 'utf8'))).toEqual([])
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })
})

describe('desktop HTTP wallet fixture proofs', () => {
  const payment = new Transaction()
  payment.addOutput({ satoshis: 10_000, lockingScript: new P2PKH().lock(PrivateKey.fromHex('33'.repeat(32)).toPublicKey().toAddress()) })
  const txid = payment.id('hex')

  it('builds a proof from a block listing that reaches the block root', () => {
    for (const txids of [[txid], ['aa'.repeat(32), txid], ['aa'.repeat(32), 'bb'.repeat(32), txid], ['aa'.repeat(32), txid, 'bb'.repeat(32), 'cc'.repeat(32), 'dd'.repeat(32)]]) {
      const index = txids.indexOf(txid)
      expect(merklePathFromBlock(150, txids, index).computeRoot(txid)).toBe(merkleRoot(txids))
    }
  })

  it('binds the hook transaction to its declared root', () => {
    const blockTxids = ['aa'.repeat(32), txid, 'bb'.repeat(32)]
    const material = { txid, rawTx: payment.toHex(), blockHeight: 150, merkleRoot: merkleRoot(blockTxids), blockTxids }
    const transaction = fundingTransactionFromBlock(material)
    expect(transaction.merklePath?.blockHeight).toBe(150)
    expect(() => fundingTransactionFromBlock({ ...material, merkleRoot: 'ee'.repeat(32) })).toThrow(/Merkle root/)
    expect(() => fundingTransactionFromBlock({ ...material, txid: 'ff'.repeat(32) })).toThrow(/mismatch/)
  })
})

describe('desktop HTTP wallet method inventory', () => {
  it('counts the methods a mock HTTP wallet serves', async () => {
    const wallet = await serve((method, url) => {
      const name = url.slice(1)
      if (method !== 'POST' || !(BRC100_METHODS as readonly string[]).includes(name)) return { status: 404, body: { message: 'unknown' } }
      if (name.startsWith('discoverBy')) return { status: 501, body: { code: 'ERR_NOT_IMPLEMENTED' } }
      if (name === 'getVersion') return { status: 200, body: { version: 'fixture-wallet-1.0.0' } }
      return { status: 400, body: { code: 'ERR_INVALID_PARAMETER' } }
    })
    try {
      const probe = await probeMethodInventory(async (method, args) => {
        const response = await fetch(`${wallet.url}/${method}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', originator: 'https://todo.itcve.test' },
          body: JSON.stringify(args)
        })
        return { status: response.status, body: await response.json() as unknown }
      })
      expect(BRC100_METHODS).toHaveLength(28)
      expect(probe.methods).toHaveLength(26)
      expect(probe.methods).not.toContain('discoverByIdentityKey')
      expect(probe.inventory.discoverByAttributes).toEqual({ status: 501, code: 'ERR_NOT_IMPLEMENTED' })
      expect(probe.inventory.getVersion).toEqual({ status: 200 })
      expect(wallet.requests.find(request => request.url === '/listActions')!.body).toEqual({ labels: [] })
      expect(wallet.requests.every(request => request.headers.originator === 'https://todo.itcve.test')).toBe(true)
    } finally {
      await wallet.close()
    }
  })
})
