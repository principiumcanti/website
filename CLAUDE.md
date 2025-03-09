# Principium Canti - Development Guidelines

## Build Commands
- `make install` - Install dependencies
- `make upgrade` - Update dependencies
- `make s` or `make serve` - Start development server with live reload
- `make build` - Build site for production
- `bundle exec jekyll serve --trace --livereload` - Start dev server manually
- `JEKYLL_ENV=production bundle exec jekyll build --trace` - Build for production manually
- `docker-compose up` - Start local development environment with database

## Code Style Guidelines

### HTML/Jekyll
- 2-space indentation
- Double quotes for attributes
- Use Bootstrap utility classes first, then custom classes
- Use semantic HTML5 elements appropriately
- Liquid templates: `{% %}` for logic, `{{ }}` for output

### SCSS
- 2-space indentation
- Use component-specific SCSS files in `_sass` directory
- Follow BEM-like naming convention (block__element--modifier)
- Use variables from `_sass/variables.scss` for consistency

### JavaScript/Netlify Functions
- 2-space indentation
- Use ES6+ features
- Add JSDoc comments for functions
- Handle errors with try/catch blocks
- Use async/await for asynchronous code
- Follow Auth0 security best practices for authentication
- Use environment variables for sensitive configuration

This site is deployed via Netlify. All database operations should use prepared statements to prevent SQL injection.