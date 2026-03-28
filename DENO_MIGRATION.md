# Deno Migration Guide

This project has been migrated to Deno.

## Prerequisites

- [Deno](https://deno.com/) installed (v1.40+ recommended).

## Setup

No `npm install` is required. Deno handles dependencies via `deno.json` imports.

Environment variables are loaded from `.env` file using `@std/dotenv`. Ensure your `.env` file is populated.

## Running the Project

The following tasks are defined in `deno.json`:

### Start Server (Production)
```bash
deno task start
```
Starts the server at `http://localhost:8000` (or `PORT` env).

### Development Mode
```bash
deno task dev
```
Starts the server with `--watch` for hot-reloading.

## Key Changes from Node.js version

- **Runtime**: Uses `Deno` runtime instead of Node.js.
- **Dependencies**: Managed in `deno.json`.
- **Fetch**: Uses native `fetch` instead of `node-fetch`.
- **File Extensions**: All local imports must end with `.ts`.
