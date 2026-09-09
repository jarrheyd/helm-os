export const meta = {
  name: 'project-health',
  description: 'Daily breadth-first health read across every configured project. Report-only, never writes to a tracker.',
  phases: [{ title: 'Read' }, { title: 'Compose' }],
}

// args: { config } - the parsed os.config.json, passed by the scheduled-task wrapper.
let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch { A = {} } }
if (!A || typeof A !== 'object') A = {}
const C = A.config || {}
const VAULT = (C.paths && C.paths.vaultRoot) || ''
const PROJECTS = C.projects || []

// default staleness floor per state; a project's own floor overrides it.
const FLOOR_BY_STATE = { active: 2, sales: 3, maintenance: 5, paused: 10, closed: Infinity }
const withFloor = PROJECTS.map(p => ({ ...p, floorDays: (typeof p.floor === 'number' ? p.floor : (FLOOR_BY_STATE[p.state] ?? 3)) }))

phase('Read')
const reads = await parallel(withFloor.map(project => () =>
  agent(`Read the health of project "${project.label || project.key}" for a COO risk radar. This is READ-ONLY: never comment, transition, or advance any cursor.
1. Read this project's status file (${project.statusFile || 'its status.md in the project folder'}) and, briefly, its channels: ${JSON.stringify(project.channels || [])}.
2. Judge risk. The project's staleness floor is ${project.floorDays === Infinity ? 'off (closed)' : project.floorDays + ' weekdays'}: if nothing has moved within the floor, flag it as gone quiet. In a sales pursuit, silence itself is the signal.
3. Return a one-line health read: the project, a status of ok / watch / at-risk, and the single most important fact or the reason it is flagged. If genuinely nothing to report and it is within floor, status ok with a short note.`,
    { label: `health:${project.key}`, phase: 'Read', effort: 'low',
      schema: { type: 'object', required: ['project', 'status', 'note'], properties: {
        project: { type: 'string' }, status: { enum: ['ok', 'watch', 'at-risk'] }, note: { type: 'string' } } } })))

phase('Compose')
const rank = { 'at-risk': 0, watch: 1, ok: 2 }
const rows = reads.filter(Boolean).sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3))
const health = await agent(`Compose a short portfolio-health read for the COO from these project rows: ${JSON.stringify(rows)}.
Lead with the projects closest to trouble (at-risk, then watch), one line each: project - status - the fact. End with a single line listing the ok projects by name only. Plain, terse, no padding. If every project is ok, say so in one line.`,
  { label: 'compose-health', phase: 'Compose', effort: 'medium',
    schema: { type: 'object', required: ['read'], properties: { read: { type: 'string' } } } })

return { read: health.read, rows }
