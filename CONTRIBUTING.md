# Contributing to TAK Server MCP

Thank you for your interest in contributing to TAK Server MCP! We welcome contributions from the community.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a welcoming environment for all contributors.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/skyfi/tak-server-mcp/issues)
2. Create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, TAK Server type)
   - Relevant logs or error messages

### Suggesting Features

1. Check existing [feature requests](https://github.com/skyfi/tak-server-mcp/issues?q=is%3Aissue+label%3Aenhancement)
2. Open a new issue with:
   - Clear use case description
   - Expected behavior
   - Mockups or examples if applicable

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Add/update tests as needed
5. Update documentation
6. Commit with descriptive messages
7. Push to your fork
8. Submit a pull request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/tak-server-mcp.git
cd tak-server-mcp

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Coding Standards

- **TypeScript**: Use TypeScript for all new code
- **Linting**: Run `npm run lint` before committing
- **Formatting**: Use Prettier with project settings
- **Tests**: Maintain or improve test coverage
- **Documentation**: Update JSDoc comments and README

### Commit Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new geospatial analysis tool
fix: correct distance calculation in meters
docs: update API documentation
test: add unit tests for emergency alerts
chore: update dependencies
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=spatial-query

# Run in watch mode
npm test -- --watch
```

### Adding New Tools

1. Create tool file in appropriate directory:
   ```
   src/tools/category/tool-name.ts
   ```

2. Implement the TAKTool interface:
   ```typescript
   export const myNewTool: TAKTool = {
     name: 'tak_my_new_tool',
     description: 'Clear description',
     category: 'appropriate-category',
     inputSchema: { /* JSON Schema */ },
     handler: async (context) => { /* Implementation */ }
   };
   ```

3. Register in `src/tools/registry.ts`
4. Add tests in `tests/tools/`
5. Update documentation

### Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for all public APIs
- Update tool documentation in docs/TOOLS.md
- Include examples for new features

### Review Process

1. All PRs require at least one review
2. CI tests must pass
3. No decrease in test coverage
4. Documentation must be updated
5. Commits should be squashed if needed

## Need Help?

- Join our [Discord](https://discord.gg/skyfi)
- Ask in [GitHub Discussions](https://github.com/skyfi/tak-server-mcp/discussions)
- Email: dev@skyfi.com

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Annual contributor spotlight

Thank you for helping make TAK Server MCP better!