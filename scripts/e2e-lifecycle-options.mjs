export function lifecycleEnvironment(arguments_, environment) {
  const baseIndex = arguments_.indexOf('--base');
  const requested = baseIndex >= 0 ? arguments_[baseIndex + 1] : '/';
  const normalized = `/${String(requested ?? '/').replace(/^\/+|\/+$/g, '')}/`;
  const normalizedEnvironment = { ...environment };
  delete normalizedEnvironment.NO_COLOR;
  return {
    ...normalizedEnvironment,
    BASE_PATH: normalized === '//' ? '/' : normalized,
  };
}
