/**
 * Simple config loader
 */

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue !== undefined &&
        typeof sourceValue === "object" &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === "object" &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetValue as object,
          sourceValue as DeepPartial<typeof targetValue>
        );
      } else if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }
  }

  return result;
}

export interface ConfigWrapper<T> {
  name: string;
  data: T;
}

export function createConfig<T extends object>(name: string, data: T): ConfigWrapper<T> {
  return { name, data };
}

export function extendConfig<T extends object>(
  name: string,
  parent: ConfigWrapper<T>,
  overrides: DeepPartial<T>
): ConfigWrapper<T> {
  return {
    name,
    data: deepMerge(parent.data, overrides),
  };
}
