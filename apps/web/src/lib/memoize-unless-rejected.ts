export function memoizeUnlessRejected<T>(create: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    pending ??= create().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
}
