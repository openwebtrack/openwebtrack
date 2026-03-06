# Contributing to OpenWebTrack

Thank you for your interest in contributing to OpenWebTrack! We welcome contributions from everyone.

## Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- npm (comes with Node.js)
- A PostgreSQL database (for local development)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/Ge0rg3e/openwebtrack.git
    cd openwebtrack
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Environment Setup:**

    Copy the example environment file and configure it:

    ```bash
    cp .env.example .env
    ```

    Update `.env` with your database credentials and other necessary variables.

4.  **Database Setup:**

    Push the schema to your local database:

    ```bash
    npm run db:push
    ```

5.  **Run the development server:**

    ```bash
    npm run dev
    ```

    The application should now be running at `http://localhost:5173`.

## Development Workflow

1.  **Create a new branch:**

    ```bash
    git checkout -b feature/your-feature-name
    ```

    or

    ```bash
    git checkout -b fix/your-bug-fix
    ```

2.  **Run checks:**

    Ensure your code passes type checking and linting:

    ```bash
    npm run check
    npm run lint
    ```

    To automatically format your code:

    ```bash
    npm run format
    ```

3.  **Database Changes:**

    If you modify the database schema (in `src/lib/server/db/schema.ts`), run:

    ```bash
    npm run db:generate
    ```

    and/or

    ```bash
    npm run db:push
    ```

## Project Structure

- `src/routes`: SvelteKit routes and pages.
- `src/lib`: Shared libraries, components, and utilities.
    - `server/db`: Database schema and configuration (Drizzle ORM).
    - `components`: Reusable Svelte components.
- `static`: Static assets.

## Pull Requests

1.  Push your branch to your fork.
2.  Open a Pull Request against the `main` branch.
3.  Provide a clear description of your changes.
4.  Link to any relevant issues.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
