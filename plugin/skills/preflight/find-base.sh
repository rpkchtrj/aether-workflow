#!/usr/bin/env bash
# Find the branch the current branch was created from.
# Prints "<base> <how>" (how = reflog | nearest) and exits 0.
# Exits 2 with candidates on stderr when two different branches tie; exits 1 when it cannot tell.
set -uo pipefail

cur=$(git symbolic-ref --quiet --short HEAD) || { echo "detached HEAD: pass the base explicitly" >&2; exit 1; }
up=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)
remotes=$(git remote)

# Branch name without its remote prefix, so main and origin/main count as one branch.
plain() {
  local r
  for r in $remotes; do
    case "$1" in "$r"/*) echo "${1#"$r"/}"; return ;; esac
  done
  echo "$1"
}

# 1. Reflog: the branch's creation entry, or the checkout that created it.
created=$(git reflog show --format='%gs' "refs/heads/$cur" 2>/dev/null | tail -1 | sed -n 's/^branch: Created from //p')
created=${created#refs/heads/}
created=${created#refs/remotes/}
if [ "$created" = "HEAD" ]; then
  created=$(git reflog --format='%gs' HEAD 2>/dev/null | grep -E "^checkout: moving from .+ to $cur\$" | tail -1 | sed -E 's/^checkout: moving from (.+) to .*/\1/')
fi
if [ -n "$created" ] && [ "$(plain "$created")" != "$cur" ] && [ "$created" != "$up" ] \
  && git rev-parse -q --verify "$created^{commit}" >/dev/null; then
  echo "$created reflog"
  exit 0
fi

# 2. Nearest: fewest commits of ours since the fork point; ties broken by fewest commits of theirs,
# so the parent beats sibling branches that forked from the same place.
best_n=""
best=()
while read -r ref; do
  [ "$(plain "$ref")" = "$cur" ] && continue
  git merge-base --is-ancestor HEAD "$ref" && continue  # already contains this branch: built on top of it
  read -r theirs ours < <(git rev-list --left-right --count "$ref...HEAD")
  n=$((ours * 1000000 + theirs))
  if [ -z "$best_n" ] || [ "$n" -lt "$best_n" ]; then
    best_n=$n
    best=("$ref")
  elif [ "$n" -eq "$best_n" ]; then
    best+=("$ref")
  fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes | grep -v '/HEAD$' | grep -vx "$(git remote | head -1)")

[ ${#best[@]} -eq 0 ] && { echo "no candidate base branch found" >&2; exit 1; }

# Prefer a local branch over its remote copy; a tie between different names is ambiguous.
names=$(for r in "${best[@]}"; do plain "$r"; done | sort -u)
if [ "$(echo "$names" | wc -l | tr -d ' ')" -gt 1 ]; then
  echo "ambiguous base, tied: $(echo $names)" >&2
  exit 2
fi
for r in "${best[@]}"; do
  [ "$r" = "$(plain "$r")" ] && { echo "$r nearest"; exit 0; }
done
echo "${best[0]} nearest"
