const REQUEST_TIMEOUT_MS = 30_000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Request timed out after ${ms / 1000}s`));
    }, ms);
    // Don't keep the event loop alive once the wrapped promise settles.
    timer.unref();
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });

export { REQUEST_TIMEOUT_MS, withTimeout };
