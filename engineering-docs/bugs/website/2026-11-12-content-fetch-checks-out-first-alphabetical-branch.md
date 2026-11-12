---
status: confirmed
severity: minor
target: none
owner: none
opened: 2026-11-12
requirements: []
---

# Bug: `npm run content:fetch` checks out the first alphabetical remote branch instead of `CONTENT_REF`

## Symptom

Running `npm run content:fetch` in a standalone checkout prints:

```text
HEAD is now at 75d97dc4 Coverage badge for main at aabace3cce7e
Content ready. npm run dev will use .content in a standalone checkout.
```

Subsequent `npm run dev`, `npm run build`, or `npm run check:content` immediately
fails with `Error: Content checkout missing` because `.content/` is detached at
`origin/badges` (which contains only `coverage.svg`) instead of `main` (or the
requested `CONTENT_REF`).

## Environment

- Observed on 2026-11-12 inside the website DevCapsule (`Node.js v22.23.1`, Git
  fetching `https://github.com/mycodespace-ai/devcapsule.git`).
- Affects any standalone clone where `mycodespace-ai/devcapsule` has a remote
  branch sorting alphabetically before `main` (currently `badges`).

## Reproduction

1. From a standalone checkout without `.content/`, run `npm run content:fetch`.
2. Run `npm run check:content` or `npm run dev`.

Expected: `.content/` is detached at `origin/main` (or `CONTENT_REF`), and
`npm run check:content` / `npm run dev` succeed.

Actual: `scripts/fetch-content.mjs` runs:

```js
git(["-C", dir, "fetch", "--tags", "origin", "+refs/heads/*:refs/remotes/origin/*", ref]);
git(["-C", dir, "checkout", "--detach", "FETCH_HEAD"]);
```

Passing `+refs/heads/*:refs/remotes/origin/*` and `ref` in the same `git fetch`
writes every remote branch into `.content/.git/FETCH_HEAD` as a mergeable entry
in alphabetical order (`badges` on line 1, `main` on line 6). `git checkout
--detach FETCH_HEAD` resolves `FETCH_HEAD` to line 1 (`origin/badges`), ignoring
`ref`.

## Evidence

Observed `.content/.git/FETCH_HEAD` on 2026-11-12:

```text
75d97dc43097e723470ad427f717e9a624e29787		branch 'badges' of https://github.com/mycodespace-ai/devcapsule
2f40e544b04c205fb90aac4df3ad30e8a5e0d870		branch 'component-status' of https://github.com/mycodespace-ai/devcapsule
47f80afe01491ad55e35716ab66efcfacabc6b84		branch 'coordination' of https://github.com/mycodespace-ai/devcapsule
9e43ec73009b343e9ff71e76438de0bec32f364a		branch 'docs-0.2.15' of https://github.com/mycodespace-ai/devcapsule
7a813b8050fe8975e4065f716c088d4a026b1cbe		branch 'docs-0.3.0' of https://github.com/mycodespace-ai/devcapsule
bb824693a22d8708c76b7159a0860cf9a3175023		branch 'main' of https://github.com/mycodespace-ai/devcapsule
```

Workaround: run `git -C .content checkout --detach origin/main` after
`npm run content:fetch`.

## Hypothesis

Splitting the fetch into two commands—updating remote heads/tags first
(`git fetch --tags origin "+refs/heads/*:refs/remotes/origin/*"`), then fetching
`ref` alone (`git fetch origin <ref>`) before `git checkout --detach FETCH_HEAD`—
ensures `FETCH_HEAD` points to `ref` whether `ref` is a branch, tag, or commit
SHA, while still populating all remote refs needed by `docs/versions.yaml`.

## Close Criteria

Done means: `npm run content:fetch` detaches `.content/` at `main` by default
and at `CONTENT_REF` when set (branch, tag, or commit SHA), even when remote
branches exist that sort before `ref`.

Verification: unit test in `test/` with a local multi-branch fixture (including
a branch sorting before `main`, such as `aa-first`), plus running
`npm run content:fetch && npm run check:content` in a standalone checkout.

Reopen if: `content:fetch` again resolves `FETCH_HEAD` to an unintended ref.
