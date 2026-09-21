# Metacognitive traps

Cognitive traps are systematic, repeatable deviations from normative reasoning and decision principles, leading individuals or systems (human or artificial) into persistent patterns of erroneous, suboptimal, or biased inference and choice.

## The problems

In the AI era, there's a new set of metacognitive traps when to coding refers. These are:

- The forming trap: Right question, wrong answer.
  You understand the problem, but you're using the wrong approach to solve it.
- The dislodging trap: Stuck in a rut.
  You realize your approach isn't working, and still struggle to change it.
- The assumption trap: Wrong question, right answer.
  You perfectly solve a problem... just not the one you were supposed to.
- The location trap: So close, but so far.
  You think you're almost done, but realize you skipped crucial problem-solving steps in the beginning.
- The achievement trap: Band-aid on a broken bone.
  You've written a lot of code and keep making small fixes in hopes it'll start working, but actually, it needs a total overhaul.
- The progression trap: Falling behind without noticing.
  You think you're keeping up, but because AI generates code beyond your understanding, you're actually falling behind.
- The interruption trap: Distracting pop-ups.
  Every time you try to focus, an AI code-completion tool throws a suggestion at you, breaking your train of thought.
- The mislead trap: Following bad advice.
  You trust a suggestion (from an AI, a tutorial, or even your own guess) that seems right but actually takes you in the wrong direction.

## Reframing

The shift of perspective is a powerful tool, it's not about denying reality or forced positivity, it's to see a fuller picture that encompasses both challenges and opportunities.

- 1. Identify the Trap: Recognize when you're caught in a trap. Is your thinking absolute? Are you overgeneralazing?
- 2. Challenge the Thought: Question the validity of the distorted thought. What evidence supports or contradicts it?
- 3. Seek Alternative Views: Consider how others might perceive the situation. What would you tell someone else in the same scenario?
- 4. Focus on Growth: Instead of dwelling on setbacks, ask what can be learned from the situation. How can this challenge be turned into an opportunity?

You're the sole expert of your own mind.

## Countermeasures

| Metacognitive Trap    | Tactical Countermeasure                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Forming Trap**      | Ask the AI or team for 3 distinct solution patterns and compare trade-offs _before_ committing to implementation. |
| **Dislodging Trap**   | Enforce a 15-minute time-box: if an approach stalls, `git stash` the changes and force a complete strategy reset. |
| **Assumption Trap**   | Write explicit acceptance criteria and test cases _prior_ to generating or writing solution code.                 |
| **Location Trap**     | Audit core data flows, boundary conditions, and dependencies before classifying a task as "almost done."          |
| **Achievement Trap**  | Flag files requiring >3 consecutive patches; halt incremental edits and trigger a root-cause refactor.            |
| **Progression Trap**  | Perform "explain-back" checks—walk through and document line-by-line execution before accepting generated code.   |
| **Interruption Trap** | Disable automatic inline triggers; switch completion tools to manual keyboard shortcut execution.                 |
| **Mislead Trap**      | Treat generated code with zero trust; verify against official documentation and isolated execution tests.         |

## Agent Skill Decay

With AI, there's a short circuit with the learning journey. One can go very quickly from, here's a problem, to here's the outcome of the overall solution, while skipping all of the lessons that built up the knowledge.
To solve that, it now requires to be proactive and deliberate.

### Slow Down

Mastery still comes from the reps, they used to arrive on their own. Now you have to go and get them.

- Before you prompt: write down what you think is wrong.
  - Form the hypothesis first, then let the agent test it, and find out whether you were right.
- While it works: ask why, a lot.
  - Not just what it changed. Why that approach, what it ruled out, and what it assumed about the system.
- When the patch lands: read the diff. Ask what could still fail.
  - Validate, not just approve, expand and return to the loop.
- When everything checks: record the single highest-value lesson from the loop.
  - The work with the agent should be making it better, and making you better. Capture what is genuinely specific to the problem, not everything you suspect might help.

Each of these relays into a specific subset of skills, end to end:

- Decision Making: choosing what is worth doing.
- Specifying: making the outcome explicit.
- Steering: correcting it mid-flight.
- Verifying: deciding the evidence is enough.

### Good Agent Work

While the agent writes the patch, delegate two more with essential abilities each to depend on:

- 1. Deep expertise (what should happen): you understand the problem domain well enough to define a good outcome. Understanding your user/product/business is part of this. Examples:
  - Who the user is, and what they need
  - How the system actually behaves
  - Which edge case would make the feature useless
- 2. Applied judgement (what would convince me it happened): use your taste to turn this into a clear, testable plan by choosing the right context, constraints, tests and verification. Examples:
  - Pass only the right context to hand it
  - Define the constraints it must not cross
  - Choose the tests and verification that make "good" concrete enough to check

Agents run the inner loop. Engineers own the evidence, understaing and verdict, that's the outer loop.

You will, over time, be able to figure out what deserves to exist. Writing up plans, refining, coming up with some definitions of what done means, for correctness, safety and user impact.

# Loop Engineering

AI Agents have leverage, and that alone creates obligations. You must be able to explain exactly what changed, why it was safe, and what will happen if they're wrong.

These obligations can be summarized by three terms:

- 1. Quality: all the check we install before we let the system loose, these produce evidence, and from that we derive a verdict.
- 2. Verdict: the final decision we make before work enters the dependent system.
- 3. Answerability: the guarantee that if someone asks, I can explain why.

Wrap these in a repeatable cycle: investigate, implement, verify, repeat - where an independent check, not the model's own say-so, decides when the work is done.

## Agentic Software Factory

The loop is how one good run becomes a process you can trust to run again. A factory is loops at scale.

Inside the loop, the AI Agents has one main function: capability. The capability to investigate tasks (inspect, search, plan), implement plans (change, refactor, generate), test their results (run checks, compare results) and report back (summarize).

Outside, the Engineer also has one main function: agency. Agency to decide (is this worth doing?), verify (is the evidence enough?), approve (ship, block, or redirect), and own (carry the consequence).

The loop boundary is evidence (diff, tests, logs, why). Constraints and learning feed the next run.

## Hidden Costs

- 1. Cognitive surrender: blindly accepting what AI gives and stop critical thinking.
- 2. Cognitive debt: erosion of the understanding and memory around how to solve the problems.
- 3. Orchestration tax: diminishing returns and cognitive drain experienced when managing parallel AI agents at once.

To fix those, make attention the priority in the architectural decisions, use worktrees, scopes, evidence to reduce the coupling between the initial plan and the work that emerges from it.

## The five pieces

- 1. Automations that go off on a schedule and do discovery and triage by themselves
- 2. Worktrees so two agents working in parallel don't step on each other
- 3. Skills to write down the project knowledge the agent would otherwise just guess
- 4. Plugins and connectors to plug the agent into the tools you already use
- 5. Subagents so one of them has the idea and a different one checks it

## The final puzzle piece

The memory (state), could be a markdown file, or a linear board, or anything that lives outside the single conversation and holds what's done and what is next.

# Spec-Driven Development (SDD)

Emphasizes clarity, early validation, and structured workflows to enhance collaboration and reduce technical debt.

## The Principles:

- 1. Detailed Specification Before Coding
- A comprehensive specification is created before any coding begins.
- The specification outlines requirements, expected behaviors, constraints, and acceptance criteria.
- 2. Single Source of Truth
- The specification serves as the definitive reference point for all stakeholders, including developers, testers and AI tools.
- It ensures that everyone involved has a clear understanding of what the software should achieve.
- 3. Alignment of Business Intent and Implementation
- SDD focuses on maintaining alignment between the original business intent and the final implementation.
- This reduces the risk of miscommunication and ensures that the software meets stakeholder needs.
- 4. Clarity and Early Validation
- By defining specifications upfront, teams can clarify expectations and validate ideas early in the development process.
- This helps identify potential issues before they escalate into larger problems.
- 5. Structured Workflows
- SDD promotes structured workflows that enhance collaboration among team members.
- It encourages a systematic approach to development, which can lead to improved efficiency and reduced techincal debt.
- 6. Continous Maintenance of Specifications
- Specifications are not static; they evolve alongside the software.
- Maintaining and updating the spec ensures that it remains relevant and continues to guide development effectively.
- 7. Integration with AI Tools
- SDD leverages AI tools to generate code and automate tasks based on the defined specifications.
- This integration helps accelerate the development process while ensuring adherence to the established guidelines.

## The Phases:

- 1. Specify (the "what" and "why")
- 2. Plan (the "how")
- 3. Tasks (the "in what order")
- 4. Implement (the "go")

## The Syntax

EARS - 'Easy Approach to Requirements Syntax' - is the secret weapon of SDD, it produces requirements that are unambiguous enough to act on.

It is defined by five patterns:

- 1. Ubiquitous: always true. ( Defines fundamental properties of the system.)
- 2. Event-driven: when trigger the system shall response. (Triggered only when a specific event occurs.)
- 3. State-driven: while state the system shall behavior. (Activated while the system is in a particular state.)
- 4. Unwanted behavior: if condition then the system shall response. (Manages undesired occurrences such as errors, failures, or faults.)
- 5. Optional features: where feature is included the system shall behavior. (Applies only if a certain optional feature is present.)

The common pitfalls (and how to avoid them):

- 1. Over-specification - Don't spec implementation details, instead spec behavior and constraints.
- 2. Under-specification - EARS or it doesn't count.
- 3. Skipping the constitution - Use project-level rules, so every spec re-litigates the same decisions.
- 4. Treating the spec as immutable - When the behavior changes, update the spec first, the code second.
- 5. No human checkpoints - Don't let it vibe code.
- 6. Specs outside the repository - Outside it rots, the specs lives in the repo alongside the code.

# Clean Code Principles

## SOLID Principles:

These provide a comprehensive framework for creating modular, maintainable, and extensible software systems.

- 1. Single Reponsibility Principle: A class (or module) should have one, and ONLY ONE, well-defined responsibility.
- 2. Open/Closed Principle: Software entities should be open for extension but CLOSED for modification.
- 3. Liskov Substitution Principle: Child classes should be able to replace parent classes WITHOUT affecting functionality.
- 4. Interface Segregation Principle: Clients SHOULD NOT be compelled to rely on interfaces they do not utilize.
- 5. Dependency Inversion Principle: The core functionalities SHOULD remain independent of the underlying mechanisms, making it easier to adapt and extend as grows.

## DRY (Don't Repeat Yourself):

Every piece of function or logic should have a single, unambiguous representation within the codebase.

## KISS (Keep It Simple, Stupid):

All the code writed is for humans. Make it easy and quick to read and understand as possible.

## Naming Conventions:

Choose names for variables, functions and classes that reflect their purpose and behavior. This makes the code self-documented and easier to understand without extensive comments.

## Code-Writing Standards:

Promote code readability, maintainability, and consistency making it easier for the developers to work with the codebase.

- 1. Code Formatting: Consistent use of indentation, spacing and line breaks.
- 2. Comments and Documentation: Clear and concise comments and documentation to explain the purpose, functionality, and usage of the code.
- 3. Error Handling: Proper handling of exceptions and error cases.
- 4. Code Organization: Logical organization of the code into modules, classes and functions.
- 5. Testing: Writing unit and integration tests to ensure code correctness and maintainability.

P.D. Clean Code is a mindset and a commitment to delivering high-quality software that is easy to read, maintain and extend.

# Effective Communication

Effective AI agent communication operates accross two distinct domains:

1. Human to Agent (coordination): focused on clarity, trust and predictability.
2. Agent to Agent (interactions): focused on determinism, efficiency and security)

## Principles

For each domain there's different principles:

### Human to Agent:

- Explicit intent and action disclosure: Inform the user of planned multi-step operation before executing consequential or non-reversible actions, providing a clear window for human intervention.
- Progresive summarization: Lead with direct outcomes or actionable summaries, surfacing execution traces, tool logs, and reasoning steps only when requested to avoid cognitive overload.
- Adaptive tone and persona consistency: Align communication style, channel formality, and brevity to the operational context while avoiding misleading conversational fluff.
- Graceful bounds and human escalation: Express confidence limits explicitly when encountering high ambiguity rather than hallucinating answers, providing clean state handoff to human operators.

### Agent to Agent

- Structured schemas over plain text: Exchange data using strict, machine-readable schemas rather than natural language to ensure deterministic parsing and failure handling.
- Explicit task semantics: require every handoff to carry an explicit operational intent tag to elimiate ambiguity and prevent infinite delegation loops.
- Bounded context transfer: pass lightweight task state, payload identifiers, and verified artifacts rather than dumping raw conversation histories into peer context windows.
- Identity and delegation binding: Enforce zero-trust standards where every request carries short-lived, identity-bound authorization tokens (via MCP or ACP) to mantain a complete audit log or delegating authorities.

## Preventions

To prevent token burning let's define the core strategies:

- Pass-by-Reference (Artifact Pointers): Exchange file paths, object URIs, or content hashes instead of embedding raw document contents, API payloads, or full file diffs directly inside active prompt windows.
- Ephemeral Sub-Agent Isolation: Delegate heavy retrieval, log parsing, or code analysis to single-purpose sub-agents with fresh context windows. The sub-agent completes the task and returns only a minimal, consolidated result to the primary orchestrator, keeping the main context clean.
- Prompt & Prefix Caching: Lock system instructions, tool definitions, and standard schema definitions into static prompt prefixes. This leverages model-level KV-caching, drastically reducing input token costs across multi-turn interactions.
- Context State Compaction: Automatically prune tool outputs, intermediate scratchpads, and historical turns after an action completes—retaining only the system prompt, current goal, and active execution state.

# The Process Map

Coding agents ship code faster than any human ever has. But without careful guidance, they make codebases worse. And the worse the codebase, the worse the AI performs. It's a vicious circle.

Here's a categorized process with a subset of specific skills and steps:

1. Getting Started: Set up once, then find your way around.

- /setup: reads the codebase and perform's setting up tasks
- /onboarding: explores the codebase and creates a general mapping with core descriptions

2. The Main Flow: the idea->ship spine, in order.

- /propose: recieves the idea from the user, invokes a triage of subagents (neutral, deep expert, applied judge) to analyze and debate a solution, then present the results to the user for approval.
- /specs: from a proposal, creates the specifications to implement, then present the results to the user for approval.
- /implement: builds work that has already been decided from specifications, ticket, or plain invocation.
- /review: Reviews the diff between HEAD and a fixed point, along two axes. Standards and Specs.

3. Shaping: explore and open question and produce a decision/answer that feeds the flow.

- /research: answers a question by reading the sources that own the answer, then leaves a cited Markdown file in the repo (memo). It works only from primary sources: official docs, source code, specs, first-party APIs.
- /goal: check for any deviation from the main objective between a given spec and implementation at a fixed point (commit, branch, HEAD)

4. Upkeep: Keep the codebase and issue list healthy; generates work for the flow. Never code.

- /improve: surveys the given codebase for deepening opportunities.
- /diagnose: runs a phased diagnosis on a hard bug, build a repro, minimise it, rank hypotheses, instrument, provide a fix with regression tests and clen up.
- /commit: groups the diff and creates one or more comprehensive commits to track the work done.

5. Productivity: Human-facing workflows the user run, not about code.

- /interview: takes a loose idea and interviews in rounds (frontier) to the user, until a plan seems feasible.
- /teach: resumes the working topic into a teaching workspace.

6. Reference: Reusable layer other areas invoke or cite.

- /codebase: fixes the terms used to design a module, it defines each one precisely, banning loose substitutes.
- /domain: provides the sharped project ubiquitous language, forcing precise terms to be used until the boundaries are exact.
- /stack: references main, secondary and complementary tools, libraries and technologies utilized by domain.

## The Harness

Every repeated correction is a missing piece of the harness. The practical test is what happens after the agent gets something wrong.

It is useful to be precise about where the pieces fit, from procedures, records, corrections, memos. For that purpose, we can use the following:

- Instuctions: records unusual facts about a codebase.
- Skills: packages reusable procedures such as verifying a schema change.
- Commands: run a explicit entry point or directive from the human-in-the-loop.
- Plugins: provide governed access to the ownership, catalog, archive etc.

The harness is the working environment around the agent: context, tools, permissions, tests, logs and recovery.
