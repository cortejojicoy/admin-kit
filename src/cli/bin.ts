/**
 * The executable wrapper.
 *
 * Invocation lives here rather than at the bottom of `index.ts` so that module
 * stays a plain import — a guard on `process.argv[1]` looks like it works until
 * the repository directory happens to be named after the binary, at which point
 * merely importing the CLI runs it.
 */
import { main } from './index'

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
