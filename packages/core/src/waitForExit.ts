import type { ReadStream } from 'node:tty';

export interface WaitForExitOptions {
  /** Input stream to watch for Enter. Defaults to process.stdin. */
  input?: NodeJS.ReadableStream & { isTTY?: boolean };
  /** Force Enter handling on even when the input is not a TTY (tests). */
  interactive?: boolean;
}

export type ExitReason = 'enter' | 'signal';

const CTRL_C = String.fromCharCode(3);

/**
 * Resolves when the user presses Enter, or on SIGINT / SIGTERM. Both paths resolve normally so the
 * caller can close the server and return, which lets the process exit with status 0 instead of a
 * thrown exit error and a stack trace.
 */
export function waitForExit(opts: WaitForExitOptions = {}): Promise<ExitReason> {
  const input = opts.input ?? (process.stdin as ReadStream);
  const interactive = opts.interactive ?? !!input.isTTY;
  return new Promise((resolve) => {
    let done = false;
    const finish = (reason: ExitReason) => {
      if (done) return;
      done = true;
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      if (interactive) {
        input.removeListener('data', onData);
        input.pause();
      }
      resolve(reason);
    };
    const onSignal = () => finish('signal');
    const onData = (chunk: Buffer | string) => {
      const text = chunk.toString();
      if (text.includes(CTRL_C)) finish('signal');
      else if (text.includes('\n') || text.includes('\r')) finish('enter');
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
    if (interactive) {
      input.on('data', onData);
      input.resume();
    }
  });
}

/** The line printed once the server is up. */
export const EXIT_HINT = 'Press ENTER to exit.';
export const STOPPED_LINE = 'Stopped. The query results on this machine were never transmitted.';
