# HEALOSBENCH — Notes

## Results

Run `bun run eval -- --strategy=zero_shot`, `few_shot`, and `cot` after setup and paste the summary tables here.

| Strategy   | Chief | Vitals | Meds F1 | Dx F1 | Plan F1 | F/U | Cost |
|------------|-------|--------|---------|-------|---------|-----|------|
| zero_shot  | TBD   | TBD    | TBD     | TBD   | TBD     | TBD | TBD  |
| few_shot   | TBD   | TBD    | TBD     | TBD   | TBD     | TBD | TBD  |
| cot        | TBD   | TBD    | TBD     | TBD   | TBD     | TBD | TBD  |

## Observations

Fill after running evals.

## What I'd build next

- Prompt diff view between run versions
- Active-learning surface: 5 highest-disagreement cases between strategies
- Cost guardrail before run starts

## What I cut

- Multi-user auth (not needed for eval harness)
- Cross-model comparison (Sonnet vs Haiku)

## Concurrency / 429 handling

The runner uses a `Semaphore(5)` to cap concurrent LLM calls. When Anthropic returns a 429, the individual case retries with exponential backoff (`2^attempt * 1000ms + jitter`), up to 3 times. The semaphore slot is held during backoff so other cases aren't launched while one is cooling down.
