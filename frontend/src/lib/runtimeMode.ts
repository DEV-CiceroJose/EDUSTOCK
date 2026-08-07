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
