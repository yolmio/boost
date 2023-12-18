import { App, hub } from "../hub";

export type AppFunc = (app: App, ...args: any[]) => any;
export type RestOfAppFuncArgs<T extends AppFunc> = T extends (
  app: App,
  ...args: infer U
) => any
  ? U
  : never;

export function memoizePerApp<T extends AppFunc>(
  callback: T,
  resolver?: (...args: RestOfAppFuncArgs<T>) => string,
): (...args: RestOfAppFuncArgs<T>) => ReturnType<T>;
export function memoizePerApp(
  callback: AppFunc,
  resolver?: (app: App, ...args: any[]) => string,
) {
  if (typeof callback !== "function") {
    throw new Error("`callback` should be a function");
  }

  if (resolver !== undefined && typeof resolver !== "function") {
    throw new Error("`resolver` should be a function");
  }

  if (callback.length === 1) {
    return lazyPerApp(callback);
  }

  const perAppCache = new Map<string, Map<string, any>>();

  const memoized = function () {
    if (!hub.currentAppName) {
      throw new Error("No current app");
    }
    let cache = perAppCache.get(hub.currentAppName);
    if (!cache) {
      cache = new Map<string, any>();
      perAppCache.set(hub.currentAppName, cache);
    }
    const args = Array.prototype.slice.call(arguments); // to simplify JSON.stringify
    const key = resolver
      ? // @ts-ignore
        resolver.apply(this, ...args)
      : JSON.stringify(args);

    if (!cache.has(key)) {
      // @ts-ignore
      cache.set(key, callback.call(this, hub.currentApp, ...args));
    }

    return cache.get(key);
  };
  return memoized;
}

export function lazyPerApp<T extends (app: App) => any>(
  f: T,
): () => ReturnType<T> {
  const results: Record<string, ReturnType<T>> = {};
  return () => {
    if (!hub.currentAppName) {
      throw new Error("No current app");
    }
    if (!results[hub.currentAppName]) {
      results[hub.currentAppName] = f(results[hub.currentAppName]);
    }
    return results[hub.currentAppName];
  };
}

type func = (...args: any) => any;
export function memoize<T extends func>(
  callback: T,
  resolver?: (...args: Parameters<T>) => string,
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
