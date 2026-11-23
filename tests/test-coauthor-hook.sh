#!/bin/sh
# T8, T9: no-claude-coauthor.sh PreToolUse hook
H=$(cd "$(dirname "$0")/../plugin/hooks" && pwd)/no-claude-coauthor.sh
W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT
rc=0

run() { jq -n --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}' | bash "$H" 2>/dev/null; }

# expect_deny <ID> <label> <command>
expect_deny() {
  o=$(run "$3")
  if [ "$(printf %s "$o" | jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null)" = deny ] &&
     printf %s "$o" | jq -r '.hookSpecificOutput.permissionDecisionReason' | grep -qiE 'co-author|generated with'; then
    echo "ok $1 $2: denied"
  else
    echo "not ok $1 $2: expected deny with reason, got: $o"; rc=1
  fi
}
# expect_allow <ID> <label> <command>
expect_allow() {
  o=$(run "$3")
  if [ -z "$o" ]; then echo "ok $1 $2: allowed (no output)"; else echo "not ok $1 $2: expected no output, got: $o"; rc=1; fi
}

expect_deny T8 "git commit -m trailer" 'git commit -m "x" -m "Co-Authored-By: Claude <noreply@anthropic.com>"'
expect_deny T8 "gh pr create footer" 'gh pr create --title t --body "summary

🤖 Generated with [Claude Code](https://claude.com/claude-code)"'
expect_deny T8 "glab mr create trailer" 'glab mr create --description "Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>"'
expect_deny T8 "git merge -m trailer" 'git merge --no-ff -m "m Co-Authored-By: Claude" feature'

printf 'fix\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n' > "$W/msg.txt"
printf 'body\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n' > "$W/body.md"
printf 'clean message\n' > "$W/clean.txt"
expect_deny T9 "git commit -F file" "git commit -F $W/msg.txt"
expect_deny T9 "gh pr create --body-file" "gh pr create --title t --body-file $W/body.md"
expect_allow T9 "git commit -m fix bug" 'git commit -m "fix bug"'
expect_allow T9 "git log --grep" 'git log --grep Co-Authored-By'
expect_allow T9 "git commit -F clean file (extra)" "git commit -F $W/clean.txt"

# T8b: git global options and a path to git before the subcommand
TRL='-m "x" -m "Co-Authored-By: Claude <noreply@anthropic.com>"'
expect_deny T8b "git -C dir commit" "git -C /some/repo commit $TRL"
expect_deny T8b "git -c k=v commit" "git -c user.name=me commit $TRL"
expect_deny T8b "/usr/bin/git commit" "/usr/bin/git commit $TRL"
expect_deny T8b "git --no-pager commit" "git --no-pager commit $TRL"
expect_deny T8b "git -C dir merge" "git -C /some/repo merge --no-ff $TRL feature"
expect_deny T8b "git -C quoted dir commit" "git -C \"/some repo\" commit $TRL"
expect_allow T8b "git -C dir commit clean" 'git -C /some/repo commit -m "fix bug"'
expect_allow T8b "git -C dir log" 'git -C /some/repo log --grep Co-Authored-By'

# T9b: message files via --body-file, $(cat path) and a relative -F under git -C
expect_deny T9b "gh pr edit --body-file" "gh pr edit 3 --body-file $W/body.md"
expect_deny T9b "glab --description \$(cat path)" "glab mr create --title t --description \"\$(cat $W/body.md)\" --yes"
expect_deny T9b "glab --description \$(cat \"path\")" "glab mr create --title t --description \"\$(cat \"$W/body.md\")\" --yes"
expect_deny T9b "git commit -m \$(cat path)" "git commit -m \"\$(cat $W/msg.txt)\""
expect_allow T9b "glab --description \$(cat clean)" "glab mr create --title t --description \"\$(cat $W/clean.txt)\" --yes"
mkdir -p "$W/sub"; cp "$W/msg.txt" "$W/sub/rel.txt"
o=$(jq -n --arg c "git -C sub commit -F rel.txt" --arg d "$W" '{tool_name:"Bash",cwd:$d,tool_input:{command:$c}}' | bash "$H" 2>/dev/null)
if [ "$(printf %s "$o" | jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null)" = deny ]; then
  echo "ok T9b git -C sub commit -F relative file: denied"
else
  echo "not ok T9b git -C sub commit -F relative file: expected deny, got: $o"; rc=1
fi

exit "$rc"
