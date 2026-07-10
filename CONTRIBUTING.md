# Contributing

Thank you for contributing.

## Development Setup

1. Install dependencies:

```bash
npm install
```

2. Create local environment file:

```bash
cp .env.example .env.local
```

3. Prepare database and start development server:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

## Contribution Guidelines

- Keep changes focused and scoped
- Follow existing project conventions
- Avoid unrelated refactoring in feature/fix commits
- Do not commit secrets, tokens, or private keys
- Update documentation when behavior changes

## Pull Request Checklist

- Code compiles successfully
- Type checks pass
- Changed behavior is documented
- No sensitive data in commits
