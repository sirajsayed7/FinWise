# Personal Finance Dashboard

A Vercel-ready Next.js MVP for uploading bank statements, extracting transactions, categorizing expenses, and reviewing spending on a mobile-friendly dashboard.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Vercel Blob for statement files
- Postgres for transactions and merchant rules
- OpenAI Structured Outputs for unknown merchant categorization
- PWA manifest for Add to Home Screen

## Local setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in the Vercel Blob, Postgres, and OpenAI keys before connecting real persistence.

## MVP flow

1. Upload a CSV, PDF, or Excel statement.
2. Parse transaction rows into a standard format.
3. Categorize with merchant rules first.
4. Send unknown or low-confidence merchants to OpenAI when `OPENAI_API_KEY` is configured.
5. Save extracted transactions and manual corrections.
6. Review spending by category, merchant, bank, and month.

CSV uploads work in the local demo immediately. PDF and Excel files are accepted in the UI and have server-side extension points in `lib/parser.ts`.

## AI categorization

The categorization engine is intentionally hybrid:

- User-saved rules
- Default merchant rules
- OpenAI Structured Outputs for unresolved transactions
- Manual review for anything below 75% confidence

Only these fields are sent to OpenAI: transaction date, raw description, amount, currency, and direction. Full statements, account numbers, IBANs, addresses, and card numbers are not sent by the AI classifier.

Set `OPENAI_API_KEY` in `.env.local` to enable AI classification. You can optionally set `OPENAI_MODEL`; otherwise the app uses `gpt-4o-mini`.
