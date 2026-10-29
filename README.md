# cba — Codebase Agent

Semantic code search and explanation tool for humans and AI agents. Like ripgrep, but it understands your code.

```bash
cba index .                          # Index a codebase (local embeddings, no API key needed)
cba search 'auth flow'               # Semantic search with AI explanations
cba ask 'How does error handling work?'  # One-shot Q&A grounded in code
cba chat                             # Interactive chat about your codebase
cba mcp                              # Start MCP server for Claude Code / Cursor
```

## What it does

**`search + explain`** — returns ranked code chunks AND a brief LLM-generated explanation of each result's relevance.

- **Semantic search**: Finds code by meaning, not just keywords. "auth flow" finds `validateToken()`, `SessionManager`, login middleware — even if they never contain the word "auth".
- **AST-aware chunking**: Uses tree-sitter to split code into semantic units (functions, classes, interfaces) instead of dumb line windows.
- **Local embeddings**: Runs `all-MiniLM-L6-v2` locally via ONNX — no embedding API key needed. Model downloads (~80MB) on first run and is cached.
- **LLM explanations**: Grok explains *why* each result is relevant (optional, requires xAI API key).

## Architecture

```
@cba/core  ←──  @cba/cli  (CLI binary)
           ←──  @cba/mcp  (MCP server for AI agents)
```

Three packages, one engine:

| Package | Purpose |
|---------|---------|
| `@cba/core` | Indexing pipeline, vector search, LLM integration, memory |
| `@cba/cli` | CLI commands (`cba index`, `cba search`, `cba ask`, `cba chat`, etc.) |
| `@cba/mcp` | MCP server with tools for Claude Code, Cursor, and other AI agents |

## Setup

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install

```bash
git clone https://github.com/davidgeorgehope/cba.git
cd cba
pnpm install
pnpm build
```

### Configure

Only one API key is needed — and only for LLM features (explain, ask, chat):

```bash
# Create a .env file (auto-loaded by the CLI)
echo "XAI_API_KEY=xai-..." > .env

# Or set globally
mkdir -p ~/.cba
echo "XAI_API_KEY=xai-..." > ~/.cba/.env
```

Indexing and pure vector search work without any API key.

### Run

```bash
# From the repo directory:
node packages/cli/dist/bin.js --help

# Or link globally:
pnpm -C packages/cli link --global
cba --help
```

## CLI Commands

### `cba index [path]`

Index a codebase for semantic search. Scans files, parses ASTs with tree-sitter, chunks by semantic boundaries, embeds locally, and stores vectors in LanceDB.

```bash
cba index .                    # Index current directory
cba index /path/to/project     # Index a specific project
cba index . --reindex           # Force full re-index
cba index . --exclude '*.test.ts'  # Exclude patterns
```

Supports incremental re-indexing — only processes changed files on subsequent runs.

### `cba search <query>`

Semantic search with optional AI explanations.

```bash
cba search 'authentication flow'         # Search + Grok explanations
cba search 'database queries' --no-explain  # Fast retrieval only
cba search 'error handling' --limit 5    # Limit results
cba search 'api routes' --lang python    # Filter by language
cba search 'config' --path 'src/**'      # Filter by path
cba search 'auth' --json                 # JSON output for piping
cba search 'auth' --json | jq '.[].filePath'
```

### `cba ask <question>`

One-shot question answering grounded in your code.

```bash
cba ask 'How does the app handle authentication?'
cba ask 'What database is used and how is it configured?' --show-sources
cba ask 'What are the main API endpoints?' --context 15  # More context chunks
```

### `cba chat`

Interactive REPL with streaming responses and conversation memory.

```bash
cba chat                    # Start new session
cba chat --resume <id>      # Resume a conversation
```

In-session commands: `/exit`, `/clear`, `/sources`, `/memory`

### `cba status`

```bash
cba status                  # Show current project status
cba status --list           # List all indexed projects
```

### `cba memory`

Persistent per-project memory for facts about your codebase.

```bash
cba memory list
cba memory search 'database'
cba memory add 'Uses PostgreSQL with Prisma ORM' -c technology
cba memory delete <id>
cba memory clear
```

### `cba mcp`

Start an MCP server on stdio for AI agent integration.

```bash
cba mcp                         # Use current directory
cba mcp --project /path/to/repo # Specify project
```

### `cba config`

```bash
cba config show       # Show current config
cba config set llm.chatModel grok-4.7
cba config init       # Initialize ~/.cba directory
```

### Global Options

```
-p, --project <path>   Project path (default: cwd)
--json                 Machine-readable JSON output
--no-color             Disable colors
--verbose              Verbose logging
```

## MCP Server

Connect cba to Claude Code, Cursor, or any MCP-compatible AI agent:

```json
{
  "mcpServers": {
    "codebase-agent": {
      "command": "node",
      "args": ["/path/to/cba/packages/cli/dist/bin.js", "mcp", "--project", "/path/to/your/project"]
    }
  }
}
```

### Tools

| Tool | Description |
|------|-------------|
| `codebase_search` | Semantic search with optional LLM explanations |
| `codebase_explain` | Explain a concept or pattern in the codebase |
| `codebase_ask` | Answer a question grounded in the code |
| `index_project` | Index or re-index a project |
| `memory_search` | Search persistent codebase memory |
| `memory_add` | Store a fact about the codebase |

### Resources

- `cba://projects` — List all indexed projects
- `cba://status/{path}` — Index status for a project

### Prompts

- `explain-codebase` — Generate a comprehensive explanation of a codebase area
- `review-code` — Review code for issues, patterns, and improvements

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Embeddings | `all-MiniLM-L6-v2` via `@huggingface/transformers` (local, no API key) |
| Vector DB | LanceDB (embedded, no server) |
| Parsing | tree-sitter (TS, JS, Python, Go, Rust, Java) |
| LLM | xAI Grok via `openai` SDK (api.x.ai) |
| CLI | Commander.js, chalk, ora |
| MCP | `@modelcontextprotocol/sdk` |
| Build | pnpm workspaces, turbo, TypeScript |

## Supported Languages

Full AST-aware chunking: TypeScript, JavaScript, Python, Go, Rust, Java

Sliding-window fallback (still indexed and searchable): all other text file types including YAML, JSON, Markdown, HTML, CSS, SQL, Shell, Ruby, PHP, C/C++, C#, Swift, Kotlin, Scala, and more.

## How It Works

1. **Scan** — Walk directories, respect `.gitignore`, hash file contents for incremental updates
2. **Parse** — tree-sitter AST parsing per language, extract semantic nodes (functions, classes, methods, types)
3. **Chunk** — Split into semantic units (~512 tokens). Large functions/classes are sub-chunked. Unsupported languages use sliding windows.
4. **Embed** — Generate 384-dim vectors locally with `all-MiniLM-L6-v2`
5. **Store** — Upsert into LanceDB at `~/.cba/data/{projectHash}/`
6. **Search** — Embed query, vector similarity search, normalize scores, apply filters
7. **Explain** — Send top chunks to Grok in a single batch call, get per-result explanations

## License

MIT
