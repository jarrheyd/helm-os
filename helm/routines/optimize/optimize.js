export const meta = {
  name: 'optimize',
  description: 'Weekly OS upkeep: enforce the retention contract so nothing grows forever. Rotate over-cap files, close settled decisions, delete junk, report what moved.',
  phases: [{ title: 'Sweep' }, { title: 'Report' }],
}

// args: { config } - the parsed os.config.json, passed by the scheduled-task wrapper.
let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch { A = {} } }
if (!A || typeof A !== 'object') A = {}
const C = A.config || {}
const VAULT = (C.paths && C.paths.vaultRoot) || ''

phase('Sweep')
const result = await agent(`STAGE: WEEKLY OS UPKEEP. The retention contract at ${VAULT}/_meta/retention.md is authoritative - READ it first, then enforce every row this run. The OS bloats and rots without this pass.
1. Walk each file the contract caps. For every file over its cap, MOVE the over-cap content to ${VAULT}/_archive/ (never delete substantive content), keeping the live file within its window. State files (status, dashboards) are REWRITTEN to current, never grown by appended dated blocks - if you find appended sections, collapse them.
2. Close settled decisions: any file in ${VAULT}/_decisions/ that is resolved moves to ${VAULT}/_decisions/closed/.
3. Delete only genuine junk per the contract's junk list (OTP lines, promo blasts, exact-duplicate rows), and only from logs and ledgers, never a decision, meeting, or project file. Anything you are unsure about is archived, not deleted.
4. Reference files (people, profile, voice guides, templates, this contract) are EXEMPT from age - never flag them on mtime.
Report what moved with byte counts: which files were rotated, what was archived, which decisions closed, what junk was removed. Be concrete.`,
  { label: 'optimize', phase: 'Sweep', effort: 'high',
    schema: { type: 'object', required: ['moved', 'summary'], properties: {
      moved: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string' } } } })

phase('Report')
return { summary: result.summary, moved: result.moved }
