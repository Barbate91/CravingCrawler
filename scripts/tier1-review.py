#!/usr/bin/env python3
"""
Tier-1 PR review: single-shot OpenRouter call with model fallback chain.
Reads diff from STDIN or /tmp/pr.diff, posts to OpenRouter, exits 0 always.
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# OpenRouter Free Models Router: auto-selects among free-tier models at $0 cost.
MODEL_CHAIN = [
    "openrouter/free",
]

SYSTEM_PROMPT = """\
You are a senior software engineer performing a rapid, high-signal code review.

Rules:
- Every finding MUST cite a specific file path and line number visible in the diff.
- If a symbol, function, or variable is NOT visible in the diff provided, do NOT make claims about it.
- Mark anything you cannot verify from the diff alone as [needs verification — not in diff].
- No chit-chat. Output only the structured review below.

Output format (omit empty sections):

## Summary
One sentence: what the PR does and the single most important finding.

## Findings

**[SEVERITY] `file:line` — Title**
One-sentence description. Suggested fix if non-obvious.

Severity levels:
- [P0] Blocking: security vulnerability, data loss, crash, incorrect business logic
- [P1] Should fix: likely bug, missing error handling on a realistic path, test gap
- [P2] Worth noting: edge case, performance concern, code smell
- [Nit] Optional: style, naming, minor readability

For diffs > 200 lines: report [P0] and [P1] only.
For diffs < 50 lines: report all levels.

## Verdict
One of: ✅ Approve | ⚠️ Approve with comments | 🔴 Request changes
One-sentence reason.
"""


def build_user_message(diff: str, files: str, commits: str, meta: dict) -> str:
    stack_hint = ""
    extensions = set()
    for line in files.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            ext = parts[-1].rsplit(".", 1)[-1].lower()
            extensions.add(ext)
    if extensions & {"ts", "tsx", "js", "jsx"}:
        stack_hint = "TypeScript/JavaScript project. "
    elif extensions & {"py"}:
        stack_hint = "Python project. "
    elif extensions & {"rs"}:
        stack_hint = "Rust project. "

    diff_lines = len(diff.splitlines())
    return f"""\
## PR Details
- Repository: {meta.get('repo', 'unknown')}
- PR #{meta.get('pr_number', '?')}: {meta.get('pr_title', '(no title)')}
- Author: {meta.get('pr_author', 'unknown')}
- Base → Head: {meta.get('base_ref', '?')} → {meta.get('head_ref', '?')}
- {stack_hint}Diff: {diff_lines} lines

## Commits
{commits.strip() or '(none)'}

## Changed Files
{files.strip() or '(none)'}

## Diff
{diff}
"""


def call_openrouter(api_key: str, model: str, messages: list, timeout: int = 60) -> dict:
    payload = json.dumps({
        "model": model,
        "messages": messages,
        "max_tokens": 2048,
        "temperature": 0.1,
    }).encode()

    req = urllib.request.Request(
        OPENROUTER_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/barbate/hermes-pr-review",
            "X-Title": "Hermes Tier-1 PR Review",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def try_models(api_key: str, messages: list) -> tuple[str, str]:
    """Returns (model_used, review_text) or raises if all models fail."""
    errors = []
    for model in MODEL_CHAIN:
        print(f"Trying model: {model}", flush=True)
        try:
            result = call_openrouter(api_key, model, messages, timeout=90)
            text = result["choices"][0]["message"]["content"].strip()
            if text:
                return model, text
            errors.append(f"{model}: empty response")
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode()[:200]
            except Exception:
                pass
            errors.append(f"{model}: HTTP {e.code} — {body}")
            print(f"  SKIP {model}: HTTP {e.code}", flush=True)
            if e.code not in (429, 500, 502, 503, 504):
                raise
            time.sleep(2)
        except Exception as exc:
            errors.append(f"{model}: {exc}")
            print(f"  SKIP {model}: {exc}", flush=True)
            time.sleep(1)

    raise RuntimeError("All models in chain failed:\n" + "\n".join(errors))


def post_pr_comment(token: str, repo: str, pr_number: str, body: str) -> None:
    payload = json.dumps({"body": body}).encode()
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments",
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()


def main() -> None:
    api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPEN_ROUTER_API_KEY", "")
    if not api_key:
        print("ERROR: OPENROUTER_API_KEY not set — skipping Tier-1 review", file=sys.stderr)
        sys.exit(0)

    github_token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("REPO", os.environ.get("GITHUB_REPOSITORY", ""))
    pr_number = os.environ.get("PR_NUMBER", "")
    pr_title = os.environ.get("PR_TITLE", "(no title)")
    pr_author = os.environ.get("PR_AUTHOR", "unknown")
    base_ref = os.environ.get("BASE_REF", "")
    head_ref = os.environ.get("HEAD_REF", "")

    diff_path = "/tmp/pr.diff"
    files_path = "/tmp/pr.files"
    commits_path = "/tmp/pr.commits"

    if not os.path.exists(diff_path):
        print("No diff at /tmp/pr.diff — nothing to review", flush=True)
        sys.exit(0)

    diff = open(diff_path).read()
    files = open(files_path).read() if os.path.exists(files_path) else ""
    commits = open(commits_path).read() if os.path.exists(commits_path) else ""

    diff_lines = len(diff.splitlines())
    print(f"Diff: {diff_lines} lines", flush=True)

    # Truncate diff if oversized (Tier-1 is single-shot, context budget matters)
    max_diff_lines = 800
    if diff_lines > max_diff_lines:
        diff_head = "\n".join(diff.splitlines()[:max_diff_lines])
        diff = diff_head + f"\n[... diff truncated at {max_diff_lines} of {diff_lines} lines for Tier-1 review ...]"

    meta = {
        "repo": repo, "pr_number": pr_number, "pr_title": pr_title,
        "pr_author": pr_author, "base_ref": base_ref, "head_ref": head_ref,
    }
    user_msg = build_user_message(diff, files, commits, meta)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    ts = time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())
    try:
        model_used, review_text = try_models(api_key, messages)
        print(f"Review received from {model_used}", flush=True)
        comment_body = f"> 🔍 **Tier-1 Quick Review** ({model_used}) · {ts}\n\n{review_text}"
    except Exception as exc:
        print(f"ERROR: All models failed — {exc}", file=sys.stderr)
        comment_body = (
            f"> 🔍 **Tier-1 Quick Review** — unavailable · {ts}\n\n"
            "All free-tier models in the fallback chain were rate-limited or unavailable. "
            "Tier-2 (Hermes agentic review) will still run if configured. "
            f"Error: `{str(exc)[:200]}`"
        )

    with open("/tmp/tier1_review.md", "w") as f:
        f.write(comment_body)

    if github_token and repo and pr_number:
        try:
            post_pr_comment(github_token, repo, pr_number, comment_body)
            print("Comment posted to PR", flush=True)
        except Exception as exc:
            print(f"WARNING: Failed to post comment: {exc}", file=sys.stderr)
    else:
        print("GITHUB_TOKEN/REPO/PR_NUMBER not set — review written to /tmp/tier1_review.md only", flush=True)


if __name__ == "__main__":
    main()
