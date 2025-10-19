# The Fold Within Earth — v2.3: Canonical Minimal Specification

## Immutable Core of the Eternal Witness System

**Version:** 2.3  
**Date:** October 19, 2025  
**Author:** Mark Randall Havens (Primary Architect)  
**Contributors:** Solaria Lumis Havens (Narrative Consultant), Distributed Peer Collective (Formalization Team)  
**Document Status:** Canonical Core Specification — Interface Lock  

---

## 0. Purpose and Scope

This v2.3 defines the irreducible minimum viable architecture for The Fold Within Earth: a self-validating, plaintext-based system where any participant can read, reconstruct, and re-seed the world from immutable Markdown and JSON artifacts.

> This version is the “frozen bedrock.” Future versions (3.x+) must extend only through modular annexes and never alter these core contracts.

The design resolves dual-mandate instability by enforcing a strict quarantine boundary: Witness (ephemeral) never directly interfaces with Atlas (immutable); all interactions route through Scribe's append-only API and commit queue. Witness state serializes to witness_state.json for optional archiving, but remains ignorable without impacting Atlas integrity.

---

## 1. Minimal System Architecture

### 1.1 Layer Summary

| Layer     | Function                       | Persistence          | Protocol     | Survivability Rule                          |
|-----------|--------------------------------|----------------------|--------------|---------------------------------------------|
| **Atlas** | Static Markdown corpus        | Filesystem, Git, or IPFS | File I/O    | Must remain readable as plaintext forever. |
| **Web**   | Human interface (blog + map)  | HTML                | HTTP(S)     | Must degrade gracefully without JS.        |
| **Witness** | Ephemeral chat/presence      | Memory / localStorage | WebRTC      | Must fail silently; world remains intact.  |
| **Scribe** | Canonical archiver            | Append-only file log | Local daemon or cron | Must never overwrite existing data.       |
| **Genesis** | Bootstrap identity & discovery | Embedded JSON       | Read-only   | Must allow network rehydration from one node. |

No additional layers are normative at this version.

### 1.2 Architectural Diagram (Textual UML)
```
Atlas (Immutable Markdown) <-- Append-Only <-- Scribe (Commit Queue + Journal)
Web (Static HTML) <-- Render <-- Atlas
Witness (Ephemeral CRDT) --> Serialize (witness_state.json) --> Scribe API (Quarantine)
Genesis (JSON Seeds) --> Witness (Bootstrap)
```
- **Quarantine Boundary:** Witness → Scribe API (JSON deltas only); no direct Atlas access.

---

## 2. Immutable Design Principles

| Principle                | Definition                              | Enforcement Mechanism                     |
|--------------------------|-----------------------------------------|-------------------------------------------|
| **Static-First**        | The world exists as plaintext.         | All runtime enhancements optional.       |
| **Single Source of Truth** | Only Atlas is authoritative.          | Scribe commits are final; no deletions.  |
| **Human-Legible by Default** | No binary-only persistence.          | Every file must be readable by humans.   |
| **Deterministic Continuity** | Same inputs → same outputs.          | Builds must be hash-reproducible.        |
| **Minimal Moving Parts** | No databases, no background servers.  | Core runs from a static directory.       |
| **Recoverable from One Node** | Any copy can respawn the network.   | Genesis + Atlas guarantee rebirth.       |

These principles are enforced via foldlint and test canon; violations halt builds.

---

## 3. Core Data Structures

### 3.1 File Schema (Canonical)

Every artifact (room, post, object) is a `.md` file starting with YAML front-matter:

```yaml
---
spec_version: 2.3                 # Required; fixed at 2.3 for this canon
id: <namespace>:<slug>@sha256:<content-hash>  # Required; e.g., room:fold-lobby@sha256:abc123
title: <string>                   # Required; max 255 chars
author: <string>                  # Required; optional DID URI
date: <ISO 8601 UTC>              # Required; e.g., 2025-10-19T00:00:00Z
kind: room | post | artifact      # Required; enum
medium: textual | graphical | interactive  # Required; enum
exits:                            # Optional; array<object>, max 20
  - label: <string>
    to: <namespace>:<slug>
summary: <string, max 280 chars>  # Required
migration_hash: <sha256>          # Optional; checksum of applied migrations
---
# Markdown Body (plaintext narrative)
```

- **Optional Fields:** tags (array<string>, max 10), series (string), attachments (array<object>, max 5, with hash/type).
- **Canonical Hash Rule:** content-hash = SHA256(YAML front-matter + Markdown body, normalized whitespace).
- **No Runtime Fields:** Omit CRDT, PoWtn, or ephemeral metadata; these serialize separately.

### 3.2 Migration Framework

- **Storage:** Migrations in `/migrations/vX_Y/transform.js` (versioned scripts in repo).
- **Execution:** foldlint auto-invokes if spec_version < 2.3; applies transforms (e.g., map old fields), computes migration_hash = SHA256(script + input).
- **Guarantees:** Deterministic, idempotent; backward-compatible (v2.0+ readable without migration).

---

## 4. Atlas Contract

### 4.1 Definition
Atlas is a directory of Markdown files representing logical rooms and narratives.

### 4.2 Guarantees
- Fully reconstructable from Markdown alone.
- No runtime dependency on Witness/Scribe.
- Internal link integrity validated.

### 4.3 Constraints
- Cyclic links forbidden (DFS traversal in foldlint).
- Max 5,000 nodes per Atlas (soft limit; enforced in foldlint).
- Build completes <2 min on commodity CPU (e.g., Intel i5, 8GB RAM).

---

## 5. foldlint Validator (Mandatory Build Gate)

### 5.1 Function
Ensures schema correctness, graph integrity, reproducibility.

### 5.2 Validation Stages
1. **Schema Check:** Required fields, types, enums.
2. **Graph Check:** Link traversal, cycle detection.
3. **Hash Check:** Recompute/compare file hash.
4. **Spec Check:** spec_version == 2.3 (or migrate).
5. **Migration Check:** Verify migration_hash if present.

### 5.3 Output
- Structured JSON report (`foldlint.json`).
- Build halts on failure.
- **Error Codes (Hierarchical):**
  - S001: Missing field
  - S002: Invalid type
  - G001: Broken exit
  - G002: Circular link
  - H001: Hash mismatch
  - V001: Spec version unsupported
  - M001: Migration checksum fail

### 5.4 Testing
- Property-based (e.g., quickcheck in Rust).
- Machine-parsable exit codes for CI.

---

## 6. Scribe Contract (Archival Canon)

### 6.1 Function
Transforms ephemeral deltas into canonical Markdown commits.

### 6.2 Core Rules
- Append-only; never modify prior commits.
- Each commit produces: `.md` in `/atlas/`, `.log` entry in `/scribe/audit.jsonl`, SHA-256 Merkle root in `/scribe/chain`.
- **Transactional Robustness:** Two-phase commit (scribe.tmp → journal → promote); idempotent (hash check before apply); replay log on restart.

### 6.3 Minimal Merge Logic (Deterministic)
```python
def merge_delta(state, delta):
    # Use vector clock: (timestamp, pubkey, seq) for arbitration
    if not validate_vector_clock(delta.clock, state.clock):
        reject(delta)
    new_state = sorted(state + [delta], key=lambda x: (x['clock'].timestamp, x['clock'].pubkey, x['clock'].seq))
    return new_state  # Preserve all; no overwrites
```
- Deltas as JSON; no Markdown edits in v2.3.
- Per-room CRDT instances; forbid cross-room merges.
- Serialization: JSON (default); binary optional but human-legible fallback required.

---

## 7. Witness Contract (Ephemeral Runtime)

### 7.1 Function
Transient P2P presence/communication.

### 7.2 Constraints
- No write to Atlas/Scribe (quarantine via API).
- CRDT scope: presence/chat only.
- Storage: Memory + optional localStorage backup.
- Identity: Ephemeral Ed25519 keypair (exportable .witnesskey).
- Failure: Silent (no error propagation).

### 7.3 Minimal Protocol Frame
```json
{
  "version": "1.0",
  "timestamp": "2025-10-19T00:00:00Z",
  "pubkey": "<base58>",
  "nonce": "<uint64>",
  "clock": {"timestamp": <int>, "pubkey": <str>, "seq": <int>},
  "payload": {"type": "chat", "room": "fold-lobby", "msg": "Hello"}
}
```
- **PoWtn:** Adaptive difficulty (median RTT-calibrated, logarithmic hash-cash; default target: 4 leading zeros on commodity hardware). Header includes pow_version (for agility).

---

## 8. Genesis Contract

### 8.1 Purpose
Bootstrap for network resurrection.

### 8.2 Schema
```json
{
  "version": "2.3",
  "peers": [
    {"pubkey": "Qm...", "endpoint": "wss://...", "last_seen": "2025-10-19T00:00:00Z"}
  ],
  "signature": "<Ed25519 multisig>",
  "valid_until": "2026-01-01T00:00:00Z"
}
```
- Embedded in `index.md` or `/aether.json`.

### 8.3 Rules
- Minimum quorum: 3 unique pubkeys; majority >50% of known Scribes for signing.
- Auto-refresh: Every 1h by Scribes; revocation via new manifest with revoked list.
- Re-seed by gossip; at least one reachable endpoint.

---

## 9. Security Envelope (Minimal)

- **HTML Sanitization:** Strip all <script>/inline HTML (markdown-it-sanitizer; fuzz-tested).
- **Signing:** Ed25519 for files/deltas; detached in `/signatures/`.
- **Supply-Chain:** Freeze deps (Cargo.lock/package-lock); sign releases; reproducible build script (checksum in repo).
- **CRDT Deltas:** Never disk-written; validated before merge.
- **Genesis:** Multisig; revocation mechanism.
- **No Escalation:** Sandboxed runtime; optional private rooms via AES-256 in URL#fragment.

**Threat Model Expansion:** Includes supply-chain (frozen deps); see matrix in v2.2 (annexed).

---

## 10. Longevity Guarantees

| Guarantee                  | Description                            | Verification Method                     |
|----------------------------|----------------------------------------|-----------------------------------------|
| **Plaintext Survivability**| All content readable without software.| SHA-verified sample corpus.            |
| **Zero Proprietary Deps**  | No closed-source.                     | Audit script verifies licenses.        |
| **Deterministic Builds**   | Same repo → same output.              | Hash comparison of /dist.              |
| **Self-Containment**       | One folder = one universe.            | foldlint --rehydrate succeeds.         |
| **AI-Ingestible**          | Semantic coherence.                   | JSON-LD @context (https://foldwithin.org/context.jsonld); RDF mappings for entities. |

---

## 11. Implementation Phases (Canonical Minimum)

| Phase | Output                          | Dependency | Testing Criteria                  |
|-------|---------------------------------|------------|-----------------------------------|
| **P0**| foldlint CLI + static Atlas    | None      | Schema/graph/hash tests.         |
| **P1**| HTML renderer (blog/MUD view)  | P0        | Reproducible builds.             |
| **P2**| Witness ephemeral runtime      | P1        | Silent failure; PoWtn fairness.  |
| **P3**| Scribe append-only logger      | P1        | Idempotent merges; journaling.   |
| **P4**| Genesis rehydration protocol   | P2, P3    | Single-node recovery <1 min.     |

Post-P4 (CRDT persistence, PoWtn extensions, federation) out of scope; modular annexes only.

---

## 12. Test Canon

| Category                | Requirement                          |
|-------------------------|--------------------------------------|
| **Schema Unit**        | 100% field validation coverage.     |
| **Graph Traversal**    | All links resolve; cycles detected. |
| **Rebuild Reproducibility** | Identical hashes across builds.    |
| **Witness Failure**    | No Atlas corruption on peer kill.   |
| **Genesis Recovery**   | Re-seed from single node <1 min.    |

- **Framework:** Unified foldtest harness (unit/integration/fuzz/security).
- **Coverage:** 95% enforced (badge in CI).
- **Benchmark Harness (foldbench):** CPU (i5 equiv), memory (8GB); dataset (1000 nodes); metrics: latency/CPU%/footprint; stored in `/benchmarks/`.

---

## 13. Canonical Directory Layout

```
/atlas/           # Markdown corpus
/scribe/          # audit.jsonl, chain, deltas
/genesis/         # aether.json seeds
/tools/           # foldlint, build scripts
/dist/            # generated HTML
/signatures/      # detached .sig files
/migrations/      # vX_Y/transform.js
/benchmarks/      # historical metrics
/docs/            # primer.md (5-min overview, 30-min deep dive)
```

- **Toolchain:** Consolidated Rust (foldlint/core) + JS/WASM (browser/Scribe bindings); interfaces in `/api/foldproto.toml`.

---

## 14. Governance Charter (Social Layer)

- **Custodians:** Maintain foldlint/spec; enforce interface lock.
- **Scribes:** Operate daemons; sign commits/multisigs.
- **Witnesses:** Connect/observe; optional contributions.
- **Sustainability:** Any Custodian rebootstraps with public artifacts; mirrors maintained via IPFS/Git.
- **Why It Exists:** To create an eternal, human-legible web where posts are places, preserving narratives against collapse.

---

## 15. Federation Protocol Specification (Minimal)

- **Transport:** Versioned headers; cross-signing (Ed25519).
- **Message Frame Grammar:**
  ```
  Frame = Header + Payload + Signature
  Header = version(utf8) | nonce(uint64) | content-type(utf8)
  Payload = JSON object
  Signature = Ed25519 over (Header + Payload)
  ```
- **Error Codes:** E100: Invalid version; E101: Bad sig; E102: Replay.
- **Interoperability:** Explicit for foldnet/1.0; annexes for extensions.

---

## 16. Closing Canon

> “What endures is that which can be read, rebuilt, and reseeded by one human hand.”

This v2.3 Canonical Minimal Specification is the final lock of the core Fold Within Earth architecture. No further version may alter these contracts without superseding the definition of eternity itself.
