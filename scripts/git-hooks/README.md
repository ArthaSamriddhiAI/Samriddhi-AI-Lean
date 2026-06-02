# Git hooks (repo-resident)

These hooks travel with the repository and enforce working agreements at git
boundaries that a Claude Code PreToolUse hook cannot fully cover. They are
tracked here (not loose in `.git/hooks/`), so they stay versioned and consistent
across clones. North star: the working agreements in `docs/working_agreements/`
are the spec; these hooks are one implementation that references it.

## Install (per clone, one time)

    git config core.hooksPath scripts/git-hooks

This points git at this directory instead of the default `.git/hooks/`. There are
no other git hooks in this repo, so the redirect is clean.

Optional auto-install: add a `prepare` script to `package.json`
(`"prepare": "git config core.hooksPath scripts/git-hooks"`) so the command runs
on `npm install` and the hook travels without a manual step.

## pre-commit

Blocks a commit whose staged content contains a long dash (WA07). Git stages
before running this hook, so it sees the real staged content regardless of how the
commit was invoked. This closes the add-and-commit-in-one-shell-invocation gap
that the Claude Code PreToolUse hook cannot see; the Claude Code hook still covers
the commit message. Emergency bypass: `git commit --no-verify`, but fix the dash
instead.

Reference: `docs/working_agreements/WA07_no_long_dashes.md`
