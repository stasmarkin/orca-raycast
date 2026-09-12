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
