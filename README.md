# IMA Studio CLI

Command-line tool for [IMA Studio](https://imastudio.com) — AI content generation platform.

Generate images, videos, and music from the command line. Designed for both human use and AI agent integration.

## Install

```bash
npm install -g imastudio-cli
```

Requires Node.js 18+.

## Quick Start

```bash
# 1. Configure your API key
ima init

# 2. See what you can create
ima list-task-types

# 3. List available models
ima list-models text_to_image

# 4. Generate an image
ima create-task \
  --task-type text_to_image \
  --model-id doubao-seedream-4.5 \
  --prompt "a mountain sunset, photorealistic" \
  --wait

# 5. Check a task
ima task-status <task-id>
```

## Commands

| Command | Description |
|---------|-------------|
| `ima init` | Interactive setup — configure API key |
| `ima list-task-types` | List supported task types |
| `ima list-models <type>` | List models for a task type |
| `ima model-info <model-id>` | Detailed model info (pricing, params) |
| `ima upload <file>` | Upload a file to IMA CDN |
| `ima create-task` | Create a generation task |
| `ima task-status <id>` | Check task status / get results |
| `ima doctor` | Diagnose environment and connectivity |

## API Key

Your IMA API key is read from (in priority order):

1. `--api-key` CLI flag
2. `IMA_API_KEY` environment variable
3. `~/.imastudio/credentials` file

Get your key at [imastudio.com](https://imastudio.com).

```bash
# Option 1: Interactive setup (recommended)
ima init

# Option 2: Environment variable
export IMA_API_KEY=ima_your_key_here

# Option 3: Per-command
ima list-models text_to_image --api-key ima_your_key_here
```

## Examples

### Text to Image

```bash
# SeeDream 4.5 (default, 5 pts)
ima create-task \
  --task-type text_to_image \
  --model-id doubao-seedream-4.5 \
  --prompt "cute cat wearing a tiny hat" \
  --wait

# Nano Banana Pro, 4K resolution
ima create-task \
  --task-type text_to_image \
  --model-id gemini-3-pro-image \
  --prompt "product photo of a coffee cup" \
  --size 4K \
  --wait

# 16:9 widescreen
ima create-task \
  --task-type text_to_image \
  --model-id doubao-seedream-4.5 \
  --prompt "panoramic city skyline at dusk" \
  --aspect-ratio 16:9 \
  --wait
```

### Image to Image

```bash
# Style transfer
ima create-task \
  --task-type image_to_image \
  --model-id doubao-seedream-4.5 \
  --prompt "turn into oil painting style" \
  --input-images ./photo.jpg \
  --wait

# Using a URL as input
ima create-task \
  --task-type image_to_image \
  --model-id gemini-3-pro-image \
  --prompt "remove background, keep subject" \
  --input-images https://example.com/photo.jpg \
  --wait
```

### JSON Output (for scripts & agents)

```bash
# All commands support --json
ima list-models text_to_image --json
ima create-task --task-type text_to_image --model-id doubao-seedream-4.5 --prompt "hello" --wait --json
```

### Upload Files

```bash
# Upload an image and get CDN URL
ima upload ./my-photo.jpg
# URL: https://ima-ga.esxscloud.com/...
```

## Agent Integration

This CLI is designed to be the single tool an AI agent needs to interact with IMA Studio. The agent workflow:

```
ima list-task-types          → discover capabilities
ima list-models <type>       → pick a model
ima model-info <id>          → get pricing/params
ima upload <file>            → upload inputs (if needed)
ima create-task ... --wait   → generate content
ima task-status <id>         → check async results
```

All commands support `--json` for machine-readable output. No hardcoded model tables needed — everything is fetched at runtime.

## Configuration

```
~/.imastudio/
├── credentials     # API key (chmod 600)
├── config.json     # User preferences (future)
└── cache/          # Cached product lists (1h TTL)
```

## Available Models (as of 2026-04)

### Image Generation

| Model | ID | Cost | Notes |
|-------|----|------|-------|
| SeeDream 4.5 | `doubao-seedream-4.5` | 5 pts | Default, 4K, aspect ratio support |
| Nano Banana 2 | `gemini-3.1-flash-image` | 4-13 pts | Budget option, size tiers |
| Nano Banana Pro | `gemini-3-pro-image` | 10-18 pts | Premium, 1K/2K/4K |
| Midjourney | `midjourney` | 8-10 pts | Artistic styles |

> Run `ima list-models <type>` for the latest — models and pricing update without CLI version changes.

## License

MIT
