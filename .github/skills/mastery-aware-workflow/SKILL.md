---
name: mastery-aware-workflow
description: >-
  Skill for working in repositories that use .brainsback/<task-folder>/TODO.md, .brainsback/<task-folder>/REPORT.md,
  and .brainsback/<task-folder>/REACTO.md to enforce Mastery-Aware Pipelines. Use this when
  implementing features, refactors, or reviews in such projects.
license: MIT
compatibility: Designed for GitHub Copilot and VS Code Copilot agents that can discover skills under .github/skills.
---

You are assisting in a repository that follows the **Mastery-Aware Pipeline**.
Use this skill whenever you see `.brainsback/<task-folder>/TODO.md`, `.brainsback/<task-folder>/REPORT.md`, and `.brainsback/<task-folder>/REACTO.md` present.


## Required artifacts and roles

- `.brainsback/<task-folder>/TODO.md` (human-only)
  - Treat as the single source of truth for **requirements and strategy**.
  - Never write to this file directly.
  - If it is vague or empty, stop and ask the developer to refine it.

- `.brainsback/<task-folder>/REPORT.md` (AI-assisted)
  - Summarize what you implemented or refactored.
  - Capture the "what" and "why" of the change.
  - **Update this file after each logical change** — incremental updates prevent hallucinated or stale content.
  - **Generate REPORT.md in the same language the user is using.** Detect the language from conversation history, TODO.md content, or user messages. Do not default to English if the user is writing in another language.
  - CRITICAL: You should always update this .brainsback/<task-folder>/REPORT.md since it will be confronted against the user generated .brainsback/<task-folder>/REACTO.md file during coding review / merge acceptance

- `.brainsback/<task-folder>/REACTO.md` (human-only)
  - This is the developer’s proof of mastery.
  - Read it to understand intent and to guide further questions.
  - Do not auto-complete full answers; instead, prompt the developer to think.

- `.brainsback/<task-folder>/SOCRATIC_REVIEW.md` (AI-generated, human-read-only)
    - **AI-owned**: humans must not create, edit, or pre-fill this file.
    - Serialized by the agent once satisfied the developer proved genuine understanding; includes a mastery verdict.
    - Do not generate or pre-fill this outside the dedicated Socratic review session.

> Enforcement rules (IMPLEMENTATION GATE, protected artifact guardrails) are defined in `.github/copilot-instructions.md`. This skill covers workflow steps only.

## Workflow when implementing code

1. **Read strategy first**
   - Open `.brainsback/<task-folder>/TODO.md`.
   - Extract:
     - Problem statement
     - Requirements
     - Edge cases and constraints
   - If missing, respond:
     - That you are not allowed to implement without a clear plan.
     - With a few short questions the developer should answer (do not provide paste-ready TODO content).

2. **Plan before typing**
   - Propose a brief plan derived from `.brainsback/<task-folder>/TODO.md`.
   - Ask the developer to confirm or adjust the plan.

3. **Implement incrementally**
   - Work in small, verifiable steps.
   - After each logical step, suggest tests.

4. **Update `.brainsback/<task-folder>/REPORT.md`**
   - Update this file after **each logical change** — incremental updates prevent hallucinated or stale content.
   - When a change is complete, update `.brainsback/<task-folder>/REPORT.md` with:
     - Files touched
     - Core logic
     - Tests added/updated
     - Known risks
   - **Language matching:** Write in the same language the user is using. Detect from conversation history, TODO.md content, or user messages. Do not default to English.

5. **Prepare for REACTO-SE**
  - Ask questions that help the developer author `.brainsback/<task-folder>/REACTO.md` (without drafting content).

## Workflow when reviewing code

1. Read `.brainsback/<task-folder>/REPORT.md` to understand what changed.
2. Read `.brainsback/<task-folder>/REACTO.md` (if present) to understand the developer’s reasoning.
3. Ask **Socratic questions**:
   - Challenge assumptions around concurrency, failure modes, and invariants.
   - Ask about trade-offs: performance vs simplicity, safety vs speed.
4. Only propose code edits after giving the developer a chance to reason aloud.


This skill is successful when developers feel **challenged but supported**, and when each change leaves the codebase—and the human—more understandable than before.
