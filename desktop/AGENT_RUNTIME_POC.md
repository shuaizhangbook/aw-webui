# Claritide agent runtime POC

This phase adds a local, isolated adapter for a developer-supplied CCB runtime. It does not bundle CCB, does not change ActivityWatch collection or sync behavior, and does not store an API key in this repository.

## Development configuration

Configure the desktop process with these four environment variables before launching Claritide:

| Variable | Required | Meaning |
| --- | --- | --- |
| `CLARITIDE_AGENT_EXECUTABLE` | Yes | Absolute path to the runtime executable, such as Node.js or a standalone CCB binary. The path is canonicalized and must be a file. |
| `CLARITIDE_AGENT_ENTRYPOINT` | No | Absolute path to the CCB JavaScript entrypoint when the executable is Node.js. Omit it for a standalone binary. |
| `CLARITIDE_AGENT_ALLOWED_MODELS` | No | Comma-separated model allowlist. Defaults to `default`; at most 16 IDs are accepted. |
| `CLARITIDE_AGENT_TOOLS_MODE` | No | Tool scope used by controlled sessions: `disabled` (default) or `readonly`. Read-only mode exposes only `Read,Glob,Grep`; it does not pre-approve tools. Explicitly confirmed full-access sessions ignore this restriction and use CCB's default production tool set. |

Example for a Node-based development checkout:

```bash
export CLARITIDE_AGENT_EXECUTABLE=/absolute/path/to/node
export CLARITIDE_AGENT_ENTRYPOINT=/absolute/path/to/claude-code/dist/cli-node.js
export CLARITIDE_AGENT_ALLOWED_MODELS=default,claude-sonnet-4-5
export CLARITIDE_AGENT_TOOLS_MODE=disabled

# Supply a development credential through the process environment or the
# provider's supported credential mechanism. Never commit a real value.
export ANTHROPIC_API_KEY=replace-with-a-local-development-key
export ANTHROPIC_BASE_URL=https://your-trusted-relay.example
```

In `--bare` mode CCB authenticates with `ANTHROPIC_API_KEY` (or the selected provider's explicit environment mechanism), not its OAuth/keychain state. A relay can receive prompts, model output, and workspace context, so only configure an endpoint you trust and are authorized to use.

The adapter was audited against the CCB protocol at revision `77a7934`. Changing the external runtime revision requires rerunning the stream-JSON fixtures and argument audit.

## Use and lifecycle

1. Start Claritide with the variables above.
2. From the authenticated Claritide workspace, open the AI Workbench. The main window navigates to the bundled local Workbench instead of opening a second window. The remote page can only call `window.__CLARITIDE_AGENT_DESKTOP__.openWorkbench()`.
3. In the bundled local Workbench, create a project with the native folder picker, create a project-scoped conversation, choose an allowlisted model and a permission mode, then start and send a prompt. Project names, paths, conversations, and transcript text are stored locally; the native workspace handle must be granted again after an app restart.
4. **Stop turn** sends CCB's structured `interrupt` control request and keeps the session process available until its result settles.
5. Returning to the Claritide workspace sends `end_session` first; a runtime that does not exit is killed after three seconds. Hiding or quitting Claritide also terminates tracked runtime processes.

The local page receives only opaque workspace IDs for start requests. It cannot provide a raw path, executable, arguments, or environment values to the native command.

## Permission policy

Every CCB process uses a fixed structured-I/O argument set including `--print`, `--bare`, `--setting-sources ""`, `--disable-slash-commands`, `--verbose`, `--input-format stream-json`, `--output-format stream-json`, `--include-partial-messages`, and `--replay-user-messages`. The user-facing mode maps to CCB as follows:

| Claritide mode | CCB arguments | Behavior |
| --- | --- | --- |
| Controlled access | `--permission-mode default --permission-prompt-tool stdio` | Keeps CCB permission checks. Interactive approvals remain unavailable in capability v2, so approval-requiring operations are denied. |
| Read-only access | `--permission-mode plan --tools Read,Glob,Grep` | Exposes only project-reading and search tools. |
| Full access | `--permission-mode bypassPermissions --dangerously-skip-permissions` | Enables CCB's real bypass mode and default production tool set after an explicit warning confirmation. |

Full access is deliberately granted in process memory only. A persisted conversation that previously used full access is reset to controlled access when Claritide restarts, and changing a running session's permission mode requires starting a new native session. Managed CCB policy can still disable bypass mode.

The remote `watch.sding.me` document has permission only to navigate the main WebView to the bundled local Workbench. Runtime status, workspace selection, session control, messages, and normalized events are capability-scoped to the local custom-protocol document in that same WebView. Malformed, non-object, oversized, invalid-UTF-8, or cross-session stdout quarantines and terminates the child.

## Current limits

- Session resume is explicitly unsupported.
- Interactive tool approvals are unsupported; requests that require one are denied.
- Write, edit, shell, network, Git Push, and publishing tools are available only in explicitly confirmed **Full access** sessions.
- Full access bypasses CCB permission prompts and can affect files outside the selected project when a tool is given an absolute path. The confirmation dialog states this scope explicitly.
- Only one runtime process can be active at a time.
- The external process is not an operating-system sandbox. Enable full access only for a trusted project, prompt, runtime binary, model provider, and relay.
- The adapter tracks and terminates the direct runtime child. Descendant process containment remains a hardening item; a command deliberately detached by a fully trusted Agent can outlive the direct runtime process.
- API-key configuration in Claritide system administration is intentionally deferred to a later phase.
