type func = (...args: any) => any;
export function memoize<T extends func>(
  callback: T,
  resolver?: (...args: Parameters<T>) => string
): T;
export function memoize(callback: func, resolver?: (...args: any[]) => string) {
  if (typeof callback !== "function") {
    throw new Error("`callback` should be a function");
  }

  if (resolver !== undefined && typeof resolver !== "function") {
    throw new Error("`resolver` should be a function");
  }

  if (callback.length === 0) {
    return lazy(callback);
  }

  const cache = new Map<string, any>();

  const memoized = function () {
    const args = Array.prototype.slice.call(arguments); // to simplify JSON.stringify
    const key = resolver
      ? // @ts-ignore
        resolver.apply(this, args)
      : JSON.stringify(args);

    if (!cache.has(key)) {
      // @ts-ignore
      cache.set(key, callback.apply(this, args));
    }

    return cache.get(key);
  };
  return memoized;
}

export function lazy<T extends () => any>(f: T): T {
  let didRun = false;
  let result: ReturnType<T> | undefined;
  return (() => {
    if (!didRun) {
      didRun = true;
      result = f();
    }
    return result;
  }) as unknown as T;
}
