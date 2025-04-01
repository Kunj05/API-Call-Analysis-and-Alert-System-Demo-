# Node.js API Monitoring Demo

## What We’re Doing
This project creates a small, containerized Node.js API with PostgreSQL to simulate a distributed system and generate logs for monitoring and analysis. We’re using Docker to run the app and database, Winston for logging, and custom middleware to add metrics like response time, query complexity, and network latency. The goal is to produce varied logs (access, error, database, application) with intentional failures and detailed metrics, serving as a foundation for researching API monitoring, anomaly detection, and predictive analytics in a distributed environment.

### Key Features
- Simulate API calls with dummy data (users, orders).
- Generate logs with metrics (e.g., `response_time_ms`, `query_cost`, `cpu_usage_s`).
- Introduce failures (e.g., 80% chance in `/api/compute`) to test error logging.
- Prepare logs for integration into a larger monitoring system (e.g., ELK, AWS).

## Tech Stack
- **Node.js (Express)**: API server.
- **PostgreSQL**: Stores dummy data.
- **Docker**: Multi-container setup.
- **Winston**: Logs to `access.log`, `error.log`, `db.log`, `app.log`.
- **OpenTelemetry** (optional): Adds tracing (`trace_id`).

## Endpoints
- `GET /api/users`: Fetch all users from PostgreSQL.
- `GET /api/orders/generate`: Generate and save 10 dummy orders.
- `GET /api/users/filter?age=<number>`: Filter users by age (30% failure chance).
- `GET /api/compute`: Simulate heavy computation (80% failure chance).

## Prerequisites
- Docker and Docker Compose installed.
- Bash shell (for scripts).

### Explanation
- **What We’re Doing**: Clearly states we’re simulating a system to generate logs with metrics and failures for monitoring research, tying it to the broader architecture context.
- **Structure**: Markdown sections (`##`) organize purpose, tech, setup, and usage.
- **Instructions**: Simple commands to run and test, with two scripts for flexibility.
- **Logs**: Explains what each log file contains with examples.
- **Next Steps**: Hints at the larger system (ELK, AWS) without overwhelming the small demo scope.
