export type RuntimeMode = { useMock: boolean; demo: boolean }

export function resolveRuntimeMode(input: {
  production: boolean
  demo: boolean
  requestedMock: boolean
}): RuntimeMode {
  return {
    useMock: input.production ? false : input.requestedMock,
    demo: input.demo,
  }
}

export function getRuntimeMode(requestedMock: boolean): RuntimeMode {
  return resolveRuntimeMode({
    production: import.meta.env.PROD,
    demo: import.meta.env.VITE_DEMO_MODE === "true",
    requestedMock,
  })
}
