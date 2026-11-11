// Annotates the generated Intent review report with outcomes, reasons and
// evidence, then leaves it at .intent/review.json for
// `intent maintainer review --record .intent/review.json`.
//
// Usage (from the repository root, after edits and checks are finished):
//   npx intent maintainer review --json > .intent/review.json
//   node scripts/annotate-intent-review.mjs
//   npx intent maintainer review --record .intent/review.json
//
// The script never invents evidence. Every string names something that was
// actually read or run for this change, and an item with no matching
// annotation fails the run instead of being recorded silently.
import { readFileSync, writeFileSync } from 'node:fs'

const REPORT = '.intent/review.json'

/**
 * Exact annotations, keyed by the review item id Intent generates.
 * Items not listed here fall through to the rules below.
 */
const ITEM_OUTCOMES = {
  'skill:packages/relayboard-skills/skills/relayboard-identity/SKILL.md': {
    outcome: 'updated',
    reason:
      'Corrected a factual error (the seed has four humans, not five) and rewrote the practical section: the source document had implied a consumer could read principal kind, but window.RelayboardMockAPI exposes no principal record at all. Documented both honest options (render unknown, or extend the API) and forbade substituting a hard-coded id list, which is the content-based guess the product forbids.',
    evidence: [
      'app.js:20-28 — seven seeded principals: four kind:human, three kind:agent',
      'app.js:98-125 — all nine mock API methods return boards, threads, messages, resources or {connected,pending}; none returns a principal',
      'app.js:93 — principalOf is an internal helper, not part of the API',
      'npx intent validate packages/relayboard-skills/skills: 3 skill files, all passed',
    ],
  },
  'skill:packages/relayboard-skills/skills/relayboard-mock-api/SKILL.md': {
    outcome: 'updated',
    reason:
      'Added the validation-ordering detail that the source document already had but the guidance lacked: the idempotency lookup runs before the thread, membership and empty-text checks, and a rejected message never consumes a sequence number.',
    evidence: [
      'app.js:104-109 — idempotency lookup precedes thread/membership/empty-text checks; seq is computed but nothing is pushed on failure',
      'docs/mock-api.md:65-69 — the same rule, already documented',
      'npx intent validate packages/relayboard-skills/skills: 3 skill files, all passed',
    ],
  },
  'skill:packages/relayboard-skills/skills/relayboard-thread-sequencing/SKILL.md': {
    outcome: 'no-change',
    reason:
      'Re-read against the current prototype source: seq assignment, the readMessages({ after }) cursor, the stream.cursors versus seen split, visibleMessages gating and idempotent re-send are all still accurate. The changed paths were the shared docs, which the other two skills own.',
    evidence: [
      'app.js:95-97 — markRead/seen versus pendingFor/cursors remain two watermarks',
      'app.js:101 — readMessages filters seq > after and sorts ascending',
      'app.js:107-112 — seq = last(threadId).seq + 1; the cursor advances only while connected',
      'app.js:130 — visibleMessages keeps own messages and seq <= cursor while paused',
    ],
  },
  'source:.gitignore': {
    outcome: 'out-of-scope',
    reason:
      'The root .gitignore holds repository tooling only: node_modules/ because the workspace root owns a package.json that installs the Intent toolchain, and the transient .intent/review.json report that `intent maintainer review --record` consumes. Neither is evidence about Relayboard guidance, and neither changes documented behaviour. The durable review outcome it complements, .intent/review-state.json, stays tracked.',
    evidence: [
      '.gitignore — the root-manifest block and the .intent/review.json block, both commented with their reason',
      'package.json — root manifest, devDependencies only',
      'git check-ignore -v .intent/review.json -> .gitignore:40, while .intent/review-state.json remains tracked (git ls-files .intent/)',
    ],
  },
  'source:.scratch/relayboard-app/spec.md': {
    outcome: 'out-of-scope',
    reason:
      'The /to-spec output for the port, filed under the local-markdown tracker. It describes intended future behaviour and makes no claim about the prototype that a skill teaches, so it is neither evidence a skill cites nor guidance a skill must follow.',
    evidence: [
      'AGENTS.md — new root file declaring .scratch/<feature>/ as the local issue tracker',
      'docs/agents/issue-tracker.md — records .scratch/relayboard-app/spec.md as the only current ticket',
      'the file is not listed in any skill frontmatter sources: grep sources over packages/relayboard-skills/skills/*/SKILL.md finds only docs/{identity-provenance,mock-api,thread-sequencing}.md',
    ],
  },
  'source:docs/agents/domain.md': {
    outcome: 'out-of-scope',
    reason:
      'Consumer rules telling the engineering skills where the glossary and ADRs live. It governs how skills are driven in this repository; it is not a source document that any Relayboard skill cites, and it states the single-context layout decision rather than any product fact.',
    evidence: [
      'written by /setup-matt-pocock-skills; layout chosen as single-context because the prototype, apps/relayboard-web and packages/relayboard-skills share one domain vocabulary',
      'grep sources over packages/relayboard-skills/skills/*/SKILL.md — docs/agents/* is absent from every sources list',
    ],
  },
  'source:docs/agents/issue-tracker.md': {
    outcome: 'out-of-scope',
    reason:
      'The local-markdown issue tracker convention for this repository (paths, numbering, Status: lines, wayfinder operations). Repository process documentation, not a source any skill cites.',
    evidence: [
      'written by /setup-matt-pocock-skills; the tracker stayed local markdown after the repository gained a GitHub remote, because the tickets are worked blockers-first by hand rather than closed through PRs',
      'grep sources over packages/relayboard-skills/skills/*/SKILL.md — docs/agents/* is absent from every sources list',
    ],
  },
  'source:docs/agents/triage-labels.md': {
    outcome: 'out-of-scope',
    reason:
      'The mapping from the five canonical triage roles to this repository\'s Status: strings. Process documentation for the triage skill; no Relayboard guidance depends on it.',
    evidence: [
      'written by /setup-matt-pocock-skills; the default label vocabulary was kept unchanged',
      'grep sources over packages/relayboard-skills/skills/*/SKILL.md — docs/agents/* is absent from every sources list',
    ],
  },
}

/** Generic annotation for the planning record when only the records themselves moved. */
const PLANNING_TOOLING_ONLY = {
  outcome: 'updated',
  reason:
    'Planning records brought in line with what was actually done and measured: the spec now states that the review was recorded per item at the repository root (with the exact commands and their output), the recorded-checks table reflects the passing in-repository result instead of an open gate, and the history records the identity correction, the mock-api ordering addition, and the app being wired as the first consumer.',
  evidence: [
    'skills/_artifacts/skill_spec.md — sections "Why the review was recorded at the repository root", "Checks recorded" and "History" updated in the same change',
    'skills/_artifacts/domain_map.yaml — identity gap names the missing principal read',
    'skills/_artifacts/skill_tree.yaml — review.ignore covers repository tooling',
    'npm run skills:check: 0 authoring issues, 0 pending review items (after recording)',
    'npx intent validate packages/relayboard-skills/skills: 3 skill files, all passed',
  ],
}

/**
 * Path-prefix rules. Anything under `.scratch/` is planning material for the
 * local-markdown issue tracker: specs and tickets describe intended future
 * behaviour and are never a source a skill cites, so they are recorded as
 * out-of-scope without a per-file entry. `docs/agents/` is the same category —
 * consumer rules for how the engineering skills are driven in this repository.
 * The check is a prefix, not a list, so a new ticket or a new agent doc does not
 * need a code change to pass the gate.
 */
const PATH_RULES = [
  {
    test: (p) => p.startsWith('.scratch/') || p.startsWith('docs/agents/'),
    annotation: {
      outcome: 'out-of-scope',
      reason:
        'Repository planning or process material: a spec, a ticket, or a consumer rule for how the engineering skills are driven in this repository. It describes intended future behaviour or repository workflow, makes no claim about the current implementation that a skill teaches, and no SKILL.md lists it in `sources`.',
      evidence: [
        'AGENTS.md — declares `.scratch/<feature>/` as the local issue tracker and points the `## Agent skills` block at `docs/agents/`',
        'docs/agents/issue-tracker.md — records the conventions for spec and ticket files under `.scratch/`',
        'grep `sources` over packages/relayboard-skills/skills/*/SKILL.md lists only docs/{identity-provenance,mock-api,thread-sequencing}.md — nothing under .scratch/ or docs/agents/',
      ],
    },
  },
  {
    // The root glossary defines the vocabulary the skills speak in, so it is
    // genuinely relevant — but it is a dictionary, not guidance a skill cites.
    test: (p) => p === 'GLOSSARY.md',
    annotation: {
      outcome: 'out-of-scope',
      reason:
        'The repository glossary: definitions of the domain terms, not guidance a skill cites. It does not assert behaviour, only what a word means here, and no SKILL.md lists it in `sources`. It stays deliberately outside the package because the prototype, the app and the skills package share one vocabulary rather than three.',
      evidence: [
        'GLOSSARY.md — grouped term definitions, with prototype-only and app-only terms marked',
        'docs/agents/domain.md — records the single-context layout decision that puts the glossary at the repository root',
        'grep `sources` over packages/relayboard-skills/skills/*/SKILL.md does not list GLOSSARY.md',
      ],
    },
  },
]

const annotate = (item) => {
  const exact = ITEM_OUTCOMES[item.id]
  if (exact) return exact
  if (item.kind === 'planning') return PLANNING_TOOLING_ONLY
  for (const rule of PATH_RULES) {
    if (item.path && rule.test(item.path)) return rule.annotation
  }
  return null
}

const report = JSON.parse(readFileSync(REPORT, 'utf8'))
const unresolved = []

for (const item of report.items) {
  const annotation = annotate(item)
  if (annotation === null) {
    unresolved.push(`${item.id} (no annotation)`)
    continue
  }
  if (item.problems.length > 0) {
    unresolved.push(`${item.id} (unresolved: ${item.problems.join('; ')})`)
    continue
  }
  item.outcome = annotation.outcome
  item.reason = annotation.reason
  item.evidence = annotation.evidence
}

if (unresolved.length > 0) {
  console.error('Refusing to write; these items still need a human decision:')
  for (const line of unresolved) console.error(`  - ${line}`)
  process.exit(1)
}

writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
console.log(`Annotated ${report.items.length} review item(s) in ${REPORT}.`)
