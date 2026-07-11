import { EffectCallback, useEffect, useRef } from "react";

const usePrevious = (value: unknown[], initialValue: unknown[]) => {
  const ref = useRef(initialValue);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

export const useEffectDebugger = (
  effectHook: EffectCallback,
  dependencies: unknown[],
  dependencyNames: Array<string | number> = []
) => {
  const previousDeps = usePrevious(dependencies, []);

  const changedDeps = dependencies.reduce<Record<PropertyKey, { before: unknown; after: unknown }>>((accum, dependency, index) => {
    if (dependency !== previousDeps[index]) {
      const keyName = dependencyNames[index] || index;
      return {
        ...accum,
        [keyName]: {
          before: previousDeps[index],
          after: dependency,
        },
      };
    }

    return accum;
  }, {});

  if (Object.keys(changedDeps).length) {
    console.log("[use-effect-debugger] ", changedDeps);
  }

  useEffect(effectHook, dependencies); // eslint-disable-line react-hooks/exhaustive-deps -- This debugging utility intentionally proxies a caller-provided dependency list.
};
