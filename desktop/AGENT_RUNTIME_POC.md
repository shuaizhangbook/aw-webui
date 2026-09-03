# Claritide agent runtime POC

This phase adds a local, isolated adapter for a developer-supplied CCB runtime. It does not bundle CCB, does not change ActivityWatch collection or sync behavior, and does not store an API key in this repository.

## Development configuration

Configure the desktop process with these four environment variables before launching Claritide:

| Variable | Required | Meaning |
| --- | --- | --- |
| `CLARITIDE_AGENT_EXECUTABLE` | Yes | Absolute path to the runtime executable, such as Node.js or a standalone CCB binary. The path is canonicalized and must be a file. |
| `CLARITIDE_AGENT_ENTRYPOINT` | No | Absolute path to the CCB JavaScript entrypoint when the executable is Node.js. Omit it for a standalone binary. |
| `CLARITIDE_AGENT_ALLOWED_MODELS` | No | Comma-separated model allowlist. Defaults to `default`; at most 16 IDs are accepted. |
| `CLARITIDE_AGENT_TOOLS_MODE` | No | `disabled` (default) or `readonly`. Read-only mode exposes only `Read,Glob,Grep`; it does not pre-approve tools. |

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
3. In the bundled local Workbench, create a project with the native folder picker, create a project-scoped conversation, choose an allowlisted model, then start and send a prompt. Project names, paths, conversations, and transcript text are stored locally; the native workspace handle must be granted again after an app restart.
4. **Stop turn** sends CCB's structured `interrupt` control request and keeps the session process available until its result settles.
5. Returning to the Claritide workspace sends `end_session` first; a runtime that does not exit is killed after three seconds. Hiding or quitting Claritide also terminates tracked runtime processes.

The local page receives only opaque workspace IDs for start requests. It cannot provide a raw path, executable, arguments, or environment values to the native command.

## Fixed safety policy

Every initial CCB process uses a fixed structured-I/O argument set including `--print`, `--bare`, `--setting-sources ""`, `--disable-slash-commands`, `--verbose`, `--input-format stream-json`, `--output-format stream-json`, `--include-partial-messages`, `--replay-user-messages`, `--permission-mode default`, and `--permission-prompt-tool stdio`. `bypassPermissions` and `--allowed-tools` are never used.

The remote `watch.sding.me` document has permission only to navigate the main WebView to the bundled local Workbench. Runtime status, workspace selection, session control, messages, and normalized events are capability-scoped to the local custom-protocol document in that same WebView. Malformed, non-object, oversized, invalid-UTF-8, or cross-session stdout quarantines and terminates the child.

## Phase-one limits

- Session resume is explicitly unsupported.
- Interactive tool approvals are unsupported; requests that require one are denied.
- Write, edit, and shell tools are unsupported.
- The UI keeps the explicit **Full access** control and confirmation step from the approved design, but capability v1 refuses to activate it. It never silently falls back to bypass mode.
- Only one runtime process can be active at a time.
- The external process is not an operating-system sandbox. Keep tools disabled unless the selected workspace and audited runtime are trusted.
- Phase one tracks and terminates the direct runtime child only; process-group/Windows Job Object containment for descendants is required before enabling broader tool access.
- API-key configuration in Claritide system administration is intentionally deferred to a later phase.
