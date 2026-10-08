# Contributing to @guardcore

Thank you for your interest in contributing to @guardcore. This guide will help you get started.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How to Report Bugs

Please open a [GitHub Issue](https://github.com/Guard-Core/guard-core-ts/issues/new?template=bug_report.md) with the following information:

- **Title**: A clear and descriptive title
- **Steps to reproduce**: Minimal steps to reproduce the behavior
- **Expected behavior**: What you expected to happen
- **Actual behavior**: What actually happened, including error messages and stack traces
- **Environment**:
  - Node.js version
  - Package manager and version (pnpm, npm, yarn)
  - @guardcore package versions
  - Adapter used (Express, Fastify, NestJS, Hono)
  - Operating system

## Enhancement Suggestions

Open a [Feature Request](https://github.com/Guard-Core/guard-core-ts/issues/new?template=feature_request.md) with:

- A clear description of the problem you are trying to solve
- Your proposed solution with TypeScript API examples
- Alternatives you considered
- Any additional context

## Pull Request Requirements

All PRs must meet the following criteria before merging:

- **TypeScript strict mode**: No `any` types, no `@ts-ignore`, no `@ts-expect-error`
- **Tests written**: All new code must have corresponding vitest tests
- **All tests pass**: `pnpm test` must pass across all packages
- **Type checking**: `tsc --noEmit` must pass cleanly
- **100% statement coverage**: Coverage must not drop below 100%
- **No `any`**: Use proper types, generics, or `unknown` where needed
- **No comments**: Code should be self-explanatory through clear naming

## Development Setup

```bash
git clone https://github.com/Guard-Core/guard-core-ts.git
cd guard-core-ts
pnpm install
pnpm build
pnpm test
```

### Prerequisites

- Node.js 18+ (22 recommended)
- pnpm 10+
- Redis (for integration tests)

## Testing

This project uses [vitest](https://vitest.dev/) for testing.

```bash
pnpm test              # Run all tests
pnpm --filter @guardcore/core test   # Run core tests only
make test-coverage     # Run with coverage report
```

### Coverage Thresholds

All packages must maintain 100% statement and line coverage.

## Code Style

- **TypeScript strict mode** is mandatory
- **No comments** in the code; code reads itself
- **No `any` type** anywhere in the codebase
- **camelCase** for variables, functions, and methods
- **PascalCase** for types, interfaces, and classes
- **Formatting and linting** are enforced by the CI pipeline

## Monorepo Structure

This project is a pnpm workspace monorepo with Turborepo:

| Package | Description |
| --- | --- |
| `@guardcore/core` | Framework-agnostic security engine |
| `@guardcore/express` | Express middleware adapter |
| `@guardcore/fastify` | Fastify plugin adapter |
| `@guardcore/nestjs` | NestJS middleware + GuardModule |
| `@guardcore/hono` | Hono middleware (edge-safe) |

All security logic lives in `@guardcore/core`. Adapter packages are thin wrappers that wire the core engine into their respective frameworks.

## Versioning

This project follows [Semantic Versioning](https://semver.org/). All packages are released in lock-step: when one package is released, all packages receive the same version bump.

Use `make bump-version VERSION=x.y.z` to update all package versions simultaneously.

## Release Process

1. Ensure all tests pass: `pnpm test`
2. Ensure type checking passes: `pnpm lint`
3. Bump version: `make bump-version VERSION=x.y.z`
4. Update CHANGELOG.md
5. Create a PR with the version bump
6. After merge, create a GitHub Release with the tag `vx.y.z`
7. The release workflow automatically publishes all packages to npm
