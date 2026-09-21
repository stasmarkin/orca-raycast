/**
 * `@raycast/api` only resolves inside the Raycast runtime, so unit tests alias it here.
 * Only the surface the tested modules touch at import time needs to exist.
 */

export function getPreferenceValues<T>(): T {
  return {} as T;
}

export const Clipboard = {
  readText: async (): Promise<string | undefined> => undefined,
};

const storage = new Map<string, string>();

export const LocalStorage = {
  getItem: async <T>(key: string): Promise<T | undefined> => storage.get(key) as T | undefined,
  setItem: async (key: string, value: string): Promise<void> => {
    storage.set(key, value);
  },
};
