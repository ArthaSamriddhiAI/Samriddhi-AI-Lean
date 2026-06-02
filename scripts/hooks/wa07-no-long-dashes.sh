#!/usr/bin/env bash
# WA07 (mechanical layer): block a git commit whose staged content or commit
# message contains a long dash (em, en, horizontal bar, figure dash, minus sign,
# non-breaking hyphen). The chat-prose layer is enforced by prompt (CLAUDE.md and
# the chat block); this hook is the files-and-commits layer of the two-layer rule.
# Dash detection runs in node (portable; does not depend on grep -P, which BSD
# grep lacks). The dash set is built from numeric code points, so this script
# carries no literal long-dash glyph (the spirit of the in-repo stripLongDashes).
# Reference: docs/working_agreements/WA07_no_long_dashes.md
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
INPUT="$(cat)"
case "$INPUT" in *"git commit"*) : ;; *) exit 0 ;; esac
FOUND="$(git diff --cached -U0 2>/dev/null | WA_INPUT="$INPUT" node -e '
const codes=new Set([0x2011,0x2012,0x2013,0x2014,0x2015,0x2212]);
const NL=String.fromCharCode(10);
const hasDash=(str)=>{ for(const ch of str){ if(codes.has(ch.codePointAt(0))) return true; } return false; };
let s="";
process.stdin.on("data",(d)=>s+=d).on("end",()=>{
  const out=[];
  for(const l of s.split(NL)){ if(l.startsWith("+") && !l.startsWith("+++") && hasDash(l)) out.push("staged: "+l.slice(0,200)); }
  try{ const j=JSON.parse(process.env.WA_INPUT||"{}"); const cmd=(j.tool_input&&j.tool_input.command)||""; if(hasDash(cmd)) out.push("message: a long dash is in the commit message"); }catch(e){}
  process.stdout.write(out.join(NL));
});' 2>/dev/null)"
if [ -n "$FOUND" ]; then
  echo "WA07: a long dash is present in this commit. Replace em, en, and other long dashes with commas, semicolons, colons, or periods. See docs/working_agreements/WA07_no_long_dashes.md." >&2
  printf '%s\n' "$FOUND" >&2
  exit 2
fi
exit 0
