# Base UI - assistant-ui

The complete "Base" chat UI extracted from the assistant-ui monorepo. Self-contained Next.js 16 app that wires up the same components used by `apps/docs/components/examples/base.tsx` in the monorepo.

## What this is

A standalone, runnable Next.js app that renders the same Base chat UI you see in the assistant-ui docs:

- Sidebar with thread list (new chat, search, archive, rename, delete)
- Header with thread title and collapsible sidebar
- Mobile sidebar (drawer) on small screens
- Lexical composer with attachment, mic/dictation, send, and slash-command + mention popovers
- Suggestion chip groups (Weather, Code, Write, Analyze, Brainstorm)
- Model selector dropdown (gpt-5.4-nano default)
- Thread view with reasoning, tool groups, and tool fallback
- Action bar with copy, refresh, more menu (export as markdown), and message timing
- User message with edit (opens edit composer) and branch picker
- Error primitive that surfaces streaming errors

## Setup

From the monorepo root:

```bash
pnpm install
```

This picks up the new folder as a workspace member (the root `pnpm-workspace.yaml` glob includes everything under the repo).

Copy the env file and set your OpenAI key:

```bash
cp base-ui-extracted/.env.example base-ui-extracted/.env.local
# then edit .env.local and set OPENAI_API_KEY
```

Run the dev server:

```bash
cd base-ui-extracted
pnpm dev
```

Open `http://localhost:3000`.

The empty-state welcome view ("How can I help you today?") and suggestion chips render without an API key. Sending a message requires `OPENAI_API_KEY`.

## Tech

- Next.js 16, React 19
- `@assistant-ui/react` (headless chat primitives) — workspace dep
- `@assistant-ui/react-ai-sdk` (Vercel AI SDK transport) — workspace dep
- `@assistant-ui/react-lexical` (Lexical composer) — workspace dep
- `@base-ui/react` (popover, dialog, tooltip, command, etc.) — Base UI primitives
- `radix-ui` (Slot for the Radix button primitive, plus Sheet and Tooltip)
- Tailwind CSS v4, `tw-animate-css`
- shadcn-compatible `components.json` registry (`base-nova` style)

## File layout

```
base-ui-extracted/
├── app/                    Next.js app router (page, layout, runtime, API)
├── base.tsx                The 984-line "Base" component (the chat UI itself)
├── components/
│   ├── assistant-ui/       15 chat components (attachment, thread, etc.)
│   ├── docs/assistant/     Model options mapper
│   └── ui/
│       ├── base/           9 Base UI shadcn primitives
│       └── radix/          3 Radix shadcn primitives (button, sheet, tooltip)
├── constants/              MODELS list
├── lib/                    cn() helper
└── public/                 favicon + model icon SVGs
```

## Wiring

`app/page.tsx` → `app/assistant.tsx` sets up the assistant runtime via `useChatRuntime` and `AssistantChatTransport` (Vercel AI SDK), then renders `<Base />` inside `<AssistantRuntimeProvider>`. `<Base />` is exported from the top-level `base.tsx` (the verbatim example from the monorepo's docs).

`app/api/chat/route.ts` is a Vercel AI SDK `streamText` route that streams responses from `gpt-5.4-nano` with reasoning enabled (`reasoningEffort: "low"`, `sendReasoning: true`).

`@/*` resolves to the project root via `tsconfig.json`'s `paths` mapping — every copied component's existing `@/...` imports work unchanged.
