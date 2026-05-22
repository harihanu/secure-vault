# Superpowers Skills Reference for OpenClaude

> **Source:** https://github.com/obra/superpowers (v5.1.0)
> **Installed at:** `C:\Users\Padmaja T\.openclaude\plugins\marketplaces\claude-plugins-official\plugins\superpowers\`
> **License:** MIT

---

## How Skills Work

Superpowers skills auto-trigger based on context. You don't need to manually invoke most of them — they activate when the right situation arises. The bootstrap skill `using-superpowers` ensures other skills are discovered and loaded at session start.

**Instruction Priority:**
1. Your explicit instructions (CLAUDE.md, direct requests) — highest
2. Superpowers skills — override default system behavior
3. Default system prompt — lowest

---

## Skills Quick Reference

| # | Skill | Trigger | What It Does |
|---|-------|---------|--------------|
| 1 | `using-superpowers` | Session start | Bootstrap — loads all other skills, enforces skill-check discipline |
| 2 | `brainstorming` | Before any creative/feature work | Turns ideas into designs through collaborative Q&A before coding |
| 3 | `writing-plans` | After brainstorming, before coding | Breaks specs into bite-sized implementation tasks with file paths and tests |
| 4 | `executing-plans` | When you have a written plan | Loads plan, reviews critically, executes tasks with checkpoints |
| 5 | `test-driven-development` | Before writing implementation code | Red-green-refactor: write test first, watch it fail, write minimal code to pass |
| 6 | `systematic-debugging` | Any bug, test failure, or unexpected behavior | Structured debugging — root cause analysis before proposing fixes |
| 7 | `subagent-driven-development` | Executing plans with independent tasks | Dispatches fresh subagent per task with two-stage review (spec + code quality) |
| 8 | `dispatching-parallel-agents` | 2+ independent tasks without shared state | Runs tasks concurrently via isolated agents |
| 9 | `requesting-code-review` | After completing major features | Dispatches a code reviewer subagent to catch issues before merge |
| 10 | `receiving-code-review` | When getting review feedback | Technical evaluation of feedback — not blind implementation of suggestions |
| 11 | `verification-before-completion` | Before claiming work is done | Runs verification commands and confirms output before any success claims |
| 12 | `finishing-a-development-branch` | All tests pass, ready to integrate | Presents structured options: merge, PR, or cleanup |
| 13 | `using-git-worktrees` | Starting feature work needing isolation | Creates isolated workspace via git worktrees |
| 14 | `writing-skills` | Creating or editing skills | TDD approach to process documentation |

---

## Detailed Skill Descriptions

### 1. using-superpowers (Bootstrap)
**Auto-triggers:** Every session start
**Purpose:** Establishes the rule that skills must be checked before ANY response. If there's even a 1% chance a skill applies, invoke it.

**Red flags to watch for** (you're rationalizing if you think):
- "This is just a simple question" — Questions are tasks. Check for skills.
- "I need context first" — Skill check comes BEFORE clarifying questions.
- "The skill is overkill" — Simple things become complex. Use it.

---

### 2. brainstorming
**Trigger:** Before creating features, building components, adding functionality, or modifying behavior
**Process:**
1. Understand current project context
2. Ask questions one at a time to refine the idea
3. Present the design
4. Get user approval before coding

**Key rule:** No code until design is approved.

---

### 3. writing-plans
**Trigger:** After brainstorming, when you have a spec or requirements
**Process:**
1. Break work into small 2-5 minute tasks
2. Document which files to touch for each task
3. Include code snippets, testing steps, and docs to check
4. Apply DRY, YAGNI, TDD principles
5. Plan frequent commits

**Output:** A structured implementation plan with bite-sized tasks.

---

### 4. executing-plans
**Trigger:** When a written implementation plan exists
**Process:**
1. Load the plan
2. Review it critically
3. Execute all tasks in order
4. Report when complete

---

### 5. test-driven-development
**Trigger:** Before writing any implementation code
**Process:**
1. Write the test first
2. Watch it fail (red)
3. Write minimal code to pass (green)
4. Refactor
5. Commit

**Anti-patterns to avoid:** See `testing-anti-patterns.md` in the skill directory.

---

### 6. systematic-debugging
**Trigger:** Any bug, test failure, or unexpected behavior
**Process:**
1. Reproduce the issue
2. Gather evidence (logs, state, inputs)
3. Form hypotheses
4. Test hypotheses systematically
5. Identify root cause
6. Propose fix

**Key rule:** No random fixes. No quick patches. Find the root cause.

**Tools included:**
- `find-polluter.sh` — find test pollution
- `root-cause-tracing.md` — tracing techniques
- `condition-based-waiting.md` — async testing patterns

---

### 7. subagent-driven-development
**Trigger:** Executing a plan with independent tasks
**Process:**
1. Dispatch a fresh subagent per task
2. Each subagent gets precisely crafted context (not your session history)
3. Two-stage review after each task:
   - Spec compliance review first
   - Code quality review second

**Why subagents:** Isolated context prevents contamination and preserves your context for coordination.

---

### 8. dispatching-parallel-agents
**Trigger:** 2+ independent tasks without shared state or sequential dependencies
**Process:**
1. Identify independent tasks
2. Craft instructions for each agent
3. Dispatch all agents simultaneously
4. Collect and integrate results

---

### 9. requesting-code-review
**Trigger:** After completing major features, before merging
**Process:**
1. Dispatch a code reviewer subagent
2. Provide crafted context for evaluation
3. Reviewer catches issues before they cascade

**Principle:** Review early, review often.

---

### 10. receiving-code-review
**Trigger:** When receiving code review feedback
**Process:**
1. Evaluate feedback technically
2. Don't blindly implement suggestions
3. Push back if feedback is technically questionable
4. Verify suggestions before applying

**Key rule:** Technical rigor, not performative agreement.

---

### 11. verification-before-completion
**Trigger:** Before claiming work is complete, fixed, or passing
**Process:**
1. Run verification commands
2. Confirm output matches expectations
3. Only then claim success

**Key rule:** Evidence before assertions, always. Claiming work is complete without verification is dishonesty.

---

### 12. finishing-a-development-branch
**Trigger:** Implementation complete, all tests passing
**Process:**
1. Verify all tests pass
2. Present clear options:
   - Merge to main
   - Create PR
   - Cleanup
3. Handle chosen workflow

---

### 13. using-git-worktrees
**Trigger:** Starting feature work that needs isolation
**Process:**
1. Prefer platform's native worktree tools
2. Fall back to manual git worktrees if needed
3. Ensure isolated workspace exists before starting

---

### 14. writing-skills
**Trigger:** Creating or editing skills, or verifying skills work
**Process:**
1. Apply TDD to process documentation
2. Test skills with subagents before deployment
3. Use adversarial pressure testing
4. Show before/after eval results

**References included:**
- `anthropic-best-practices.md`
- `persuasion-principles.md`
- `graphviz-conventions.dot`
- `testing-skills-with-subagents.md`
- `examples/` directory

---

## Typical Workflow

A standard development session follows this flow:

```
User request
    |
    v
brainstorming (refine the idea)
    |
    v
using-git-worktrees (isolate workspace)
    |
    v
writing-plans (break into tasks)
    |
    v
subagent-driven-development OR executing-plans
    |  (each task: TDD -> implement -> verify)
    v
requesting-code-review (catch issues)
    |
    v
verification-before-completion (final check)
    |
    v
finishing-a-development-branch (merge/PR)
```

---

## How to Use in Future OpenClaude Sessions

1. **Skills auto-activate** — you don't need to do anything special. Just start coding.
2. **To manually invoke a skill:** Ask OpenClaude to use a specific skill, e.g., "Use systematic-debugging to find this bug" or "Let's do brainstorming for this feature."
3. **To check available skills:** Ask "What superpowers skills are available?"
4. **Skills are already installed** — no re-installation needed after restart.

---

## File Locations

| Item | Path |
|------|------|
| Plugin root | `C:\Users\Padmaja T\.openclaude\plugins\marketplaces\claude-plugins-official\plugins\superpowers\` |
| Skills directory | `superpowers\<skill-name>\SKILL.md` |
| Hooks | `superpowers\hooks\hooks.json` |
| Plugin metadata | `superpowers\.claude-plugin\plugin.json` |
| This reference | Saved to your chosen location |

---

*Generated: 2026-05-22 | Superpowers v5.1.0 | For OpenClaude + Mimo 2.5 Pro*
