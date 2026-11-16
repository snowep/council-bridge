# SECRET_HISTORY_PURGE_PLAN.md

**Repository:** `snowep/council-bridge`
**Branch:** `refactor/repository-structure`
**Date:** 2026-11-16
**Audited Commit:** `73f632d531678360a79b5af30825636651fd1caa`

---

## 1. Affected Tracked Key Paths

The following files containing **private-key material** have been committed to the repository:

| Commit | Path | Key ID | Status |
|--------|------|--------|--------|
| `2282636` | `.secrets/founder-keys.json` | `ceb124a4f8eb9373acf0c7196f68e99e` | Active in commit |
| `73f632d` | `.secrets/founder-keys.json` | `ceb124a4f8eb9373acf0c7196f68e99e` | Active in commit |
| `73f632d` | `.secrets/archive/founder-keys-*.json` (147 files) | Various | Archived in commit |

**Total:** 148 tracked files containing private keys across 2 commits.

---

## 2. Private Key Material in Historical Commits

**YES** — Private-key material remains in Git history:

- Commit `2282636` (parent of current branch): Contains `.secrets/founder-keys.json` with private key
- Commit `73f632d` (current HEAD): Contains `.secrets/founder-keys.json` + 147 archived key files in `.secrets/archive/`
- All ancestor commits on `master` branch going back to `93fbf99` (Phase 8) contain the original key

The compromised key (`ceb124a4f8eb9373acf0c7196f68e99e`) was generated during Phase 8 (commit `93fbf99`) and has been present in every commit since.

---

## 3. Safe Git History Removal Procedure

### Prerequisites
- **Explicit Founder approval required** — Do not execute without written approval
- All collaborators must be coordinated before history rewrite
- Backup repository before proceeding

### Option A: git filter-repo (Recommended)
```bash
# Install filter-repo
pip install git-filter-repo

# Remove .secrets/ from entire history
git filter-repo --path .secrets --invert-paths

# Force-push all branches (requires collaborator coordination)
git push origin --force --all
git push origin --force --tags
```

### Option B: BFG Repo-Cleaner (Faster for large repos)
```bash
# Download BFG
# java -jar bfg.jar --delete-folders .secrets
# git reflog expire --expire=now --all
# git gc --prune=now --aggressive
# git push origin --force --all
```

### Post-Purge Verification
```bash
# Verify no .secrets in history
git log --all --full-history --oneline -- .secrets/
# Should return no results

# Verify no private key content in history
git log --all -p -- .secrets/ | grep -i "PRIVATE KEY"
# Should return no results

# Verify current .secrets is ignored
git check-ignore -v .secrets/founder-keys.json
# Should show .gitignore rule
```

---

## 4. Affected Branches and Tags

| Branch | Status | Contains Compromised Key |
|--------|--------|-------------------------|
| `refactor/repository-structure` | **Current HEAD** | YES (commits 2282636, 73f632d) |
| `master` | Upstream | YES (all commits from 93fbf99 onward) |
| `origin/refactor/repository-structure` | Remote | YES |

**Tags:** No tags currently reference the compromised commits.

---

## 5. Required Collaborator/Repository Coordination

### Before History Rewrite
1. **Founder written approval** for `git push --force`
2. Notify all collaborators to:
   - Stash/push local changes
   - Clone fresh after force-push
   - Re-apply uncommitted work
3. Update CI/CD pipelines that may cache repository state
4. Coordinate with any fork owners

### After History Rewrite
1. All collaborators must re-clone: `git clone <repo>`
2. Verify new clone has no `.secrets` in history
3. Rotate any tokens/secrets derived from compromised key
4. Update deployment environments with new public key

---

## 6. Post-Purge Verification Commands

```bash
# 1. Confirm no .secrets in any commit
git log --all --full-history -- .secrets/ && echo "FAIL: .secrets still in history" || echo "PASS: .secrets purged"

# 2. Confirm no private key material in history
git log --all -p | grep -i "BEGIN PRIVATE KEY" && echo "FAIL: Private key in history" || echo "PASS: No private keys in history"

# 3. Confirm current .secrets is ignored
git check-ignore .secrets/founder-keys.json && echo "PASS: Ignored" || echo "FAIL: Not ignored"

# 4. Confirm only current key exists locally
ls -la .secrets/
# Should show ONLY founder-keys.json (new key: cf435b81fef1003cc93f21015ce34989)

# 5. Verify new key works
node --import=tsx -e "
import { loadFounderKeyPair, verifyFounderRequest, signFounderRequest } from './src/auth/founder.js';
const k = loadFounderKeyPair();
const s = signFounderRequest('test', {}, k.private_key_pem, k.key_id);
console.log('Key ID:', k.key_id);
console.log('Sign/Verify:', verifyFounderRequest(s.operation, s.payload, s.timestamp, s.nonce, s.signature, k.public_key, k.key_id));
"

# 6. Verify old key rejected
node --import=tsx -e "
import { verifyFounderRequest } from './src/auth/founder.js';
const oldPub = \`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyPWI28qcIq4p/KBi+AjL
3nIFwAiIEC3ANtCrPZ14oD4bxNx08sYiA54aSlkgaEJgUsg3Uv4sAO/95bfKZwbp
2s53xBQPHeFD+OsFvEj0nklkVJuGAse0ZK6e08aKKePxXtKQQ8XyEWMLcgdO/MqJ
aG3L08lL/N4g25djuPpVrDqu0WRxl0VS1u+mzA7G39FPRfnNGfomuKWp7eXy0LUF
MscmwkXSaIkZEbJlh4kXthvGwVjinypVHQ0oDJvnRyvlNVkCGmeD2JYbJKfj7Oa3
VzYWN5r8UJwq1RuULlwMIa3VHOYeKllfrhNzD+/uhlEBbg5GXThaTFRGfGK30J1S
jQIDAQAB
-----END PUBLIC KEY-----\`;
import { signFounderRequest } from './src/auth/founder.js';
const oldPriv = \`-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDI9Yjbypwirin8
oGL4CMvecgXACIgQLcA20Ks9nXigPhvE3HTyxiIDnhpKWSBoQmBSyDdS/iwA7/3l
t8pnBunaznfEFA8d4UP46wW8SPSeSWRUm4YCx7Rkrp7Txoop4/Fe0pBDxfIRYwty
B078yolobcvTyUv83iDbl2O4+lWsOq7RZHGXRVLW76bMDsbf0U9F+c0Z+ia4pant
5fLQtQUyxybCRdJoiRkRsmWHiRe2G8bBWOKfKlUdDSgMm+dHK+U1WQIaZ4PYlhsk
p+Ps5rdXNhY3mvxQnCrVG5QuXAwhrdUc5h4qWV+uE3MP7+6GUQFuDkZdOFpMVEZ8
YrfQnVKNAgMBAAECggEAHBmZRYKTSpYn8NdMf3pbZ4NyImQPApQjKIcNKtR2JZIJ
uAFLqRbjcrYM3xCPY4TEi07LzaMU7Byi2BhXCQkCckIkpRpY8sipBIl4h9d7vRZu
HRaSKplaNCnms54ze6AQBD5VReTL8Hp1A0DaXqbDiAKyWa7wHS/CUHJe02LN0AM1
AnDxhlaGaAe1p2STC0XxQoQzm094FgCwEp5OeU/YfhdVskkCYxzlsh7t6rn78nZq
YxmilxFkykAhrWhg09lCHBf7ivfEpQLqAetRnAgFKvgexFwo1m4gMpkF7+nOh32A
IPbMRDMPw/5HyCCp1nCqNbnTUaKwZOXIktSHiborgQKBgQD2BcIWgDtYVkWfoLis
CEgFW8zGddwsia5vaf4QM1aly49gwP1+2OWooGy7D/DYC6brStaNgQEvrLgPel6k
AEjPjBNW2bV0owWOmiqOntnGuJcQo8YZ0fSrOV82hDJyDbQvfAyUifoEKg6M2OMi
t/UgMJpnVaGsoDljJ2nEtiqrhQKBgQDRG+v+lojlbH3X0OAJo1NNekgerd1LtrXN
QFjv7DGDjalrrCvs3f1BwwytNuYrbZpg86i5cS9oYce+sCDuAwBq/nj379BaKoO5
4oFB4UfLU36uEgSQoKcW/3yogWJMYaJ/ynKW1whsakLsEfB4eM6CMWIv1XjmAGi7
FnpkWKPlaQKBgGQSn4pLitg574Qo+jVwAOu9FaS8mFy9fGjxcljgqSQzkxTGK9cH
HxPifZfxugQHaVRYUsGocfUUiqIxIoIPY46Y6dzwHbFeBoqlBx6QWwFMYJZyJ8ik
8KMdaS9hwqtGC78s9GkPXtWGzfhY2LtsnJcFbikOWf9ABVfh1lIfz2eJAoGAJs/L
6aD/H7YXVWtLaf6Kg6Lip+8VV+w9qi77Uuy/8+7jNzzpmjlJvF77h1rdNcpOERio
hGLhrboYXOhL9GFSPomk4j/8p/+kG2hTHWs27CI/LQfjGQT4fmhFNvFs0Uh95MIq
qpyWz6iZaz+ZJoMlsTyBQOeaXPZOegseBGn/YaECgYEAlhKAuE6hmstVYRotk+LY
YCKG3iZn7U7b+gSu65mxykKbQhLP/Cd/SEulTPAkF44pgcxsU3MQgLAgPeX9FloH
IYPYtbjoCyykHTU9GL6SsT/scqSN8ussevk0tVhPwDJ9Uf+pR46bmlHrlN27e7Bj
ptNf+6Ad09Dd8wnYN/BdROw=
-----END PRIVATE KEY-----\`;
const s = signFounderRequest('test', {}, oldPriv, 'ceb124a4f8eb9373acf0c7196f68e99e');
import { loadFounderKeyPair } from './src/auth/founder.js';
const k = loadFounderKeyPair();
console.log('Old key rejected:', !verifyFounderRequest(s.operation, s.payload, s.timestamp, s.nonce, s.signature, k.public_key, k.key_id));
"
```

---

## 7. Current Remediation Status (Local Only)

| Action | Status |
|--------|--------|
| `.secrets/` added to `.gitignore` | ✅ Complete |
| `.secrets/founder-keys.json` untracked | ✅ Complete (`git rm --cached`) |
| New key generated locally | ✅ Complete (`cf435b81fef1003cc93f21015ce34989`) |
| Old key rejected by new key | ✅ Verified |
| Archive directory removed | ✅ Complete |
| `.secrets/` permissions (0700/0600) | ⚠️ Windows — not enforced by filesystem |
| Public key endpoint exposes new key | ✅ Verified |

---

## 8. Approval Gate

**HISTORY REWRITE REQUIRES EXPLICIT FOUNDER WRITTEN APPROVAL**

Do not execute `git push --force` or history rewriting tools without:
1. Written Founder approval for force-push
2. All collaborators notified and prepared
3. CI/CD pipeline downtime scheduled
4. Verification commands tested in isolated clone

**Key rotation and local remediation complete. History purge blocked pending approval.**