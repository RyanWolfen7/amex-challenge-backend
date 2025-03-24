# 🚀 Amex Challenge Backend

![Node.js](https://img.shields.io/badge/Node.js-v16-green) ![License](https://img.shields.io/badge/License-MIT-blue) ![Build](https://img.shields.io/badge/Build-Passing-brightgreen)

A high-performance, resilient Node.js backend service with caching, rate limiting, and circuit breaker patterns.

---

## 📂 Folder Structure

```
amex-challenge-backend/
├── src/
│   ├── routes/          # API route handlers
│   ├── utils/           # Utility functions (e.g., circuit breaker, caching)
│   ├── middlewares/     # Custom middleware (e.g., rate limiter, security headers)
│   └── app.js           # Main application entry point
├── test/                # Test scripts and test cases
├── Dockerfile           # Docker configuration
├── package.json         # Project metadata and dependencies
└── README.md            # Project documentation
```

---

## 📜 Table of Contents

- [Installation](#installation)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Testing](#testing)
- [Features](#features)
- [Thought Process](#thought-process)
- [TODOs](#todos)

---

## ⚙️ Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/amex-challenge-backend.git
cd amex-challenge-backend

# Install dependencies
npm install

# Start the server
npm start

# Start in development mode
npm run dev
```

---

## 📡 API Endpoints

### Events

| Method | Endpoint                | Description                          |
|--------|--------------------------|--------------------------------------|
| GET    | `/events`               | Retrieve all events                 |
| GET    | `/events/:id`           | Retrieve a specific event by ID     |
| GET    | `/events/user/:id`      | Retrieve all events for a user      |
| POST   | `/events`               | Create a new event                  |
| GET    | `/events/circuit-status`| Get circuit breaker status          |

### Users

| Method | Endpoint     | Description                  |
|--------|--------------|------------------------------|
| GET    | `/users`     | Retrieve all users          |
| GET    | `/users/:id` | Retrieve a specific user    |

---

## 🚀 Deployment

### Local Deployment

```bash
# Start the server for local development
npm run dev

# Start the server for production
npm start
```

### Docker Deployment

```bash
# Build the Docker image
docker build -t amex-challenge-backend .

# Run the container
docker run -p 3000:3000 amex-challenge-backend
```

### Cloud Deployment

The application is designed to be deployed to any cloud platform:

1. **AWS**:
   - Push to Elastic Beanstalk or deploy as a container in ECS.
   - Set environment variables for configuration.

2. **Azure**:
   - Deploy to App Service or Azure Container Instances.
   - Configure environment variables in Application Settings.

3. **GCP**:
   - Deploy to Cloud Run or App Engine.
   - Set environment variables in the cloud console.

---

## 🧪 Testing

### Manual Testing

The application includes a PowerShell script for manual API testing:

```bash
# Run the manual API test script
cd amex-challenge-backend\test
.\api.test.ps1
```

This script will run a series of requests to test all endpoints and provide detailed output of the responses. Make sure you have another terminal up with the server so you can see the logs when running this.

### Automated Testing

The application uses Jest for unit and integration testing:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch
```

---

## 🌟 Features

### ⚡ Caching

- Caches API responses to reduce latency.
- Supports configurable TTL (Time To Live).
- Automatically cleans up expired items.

### 🔒 Rate Limiting

- Protects against abuse with 100 requests per minute per client.
- Configurable limits and time windows.
- Returns appropriate 429 status codes when limits are exceeded.

### 🛡️ Circuit Breaker Pattern

- Prevents cascading failures.
- Automatically detects and isolates failing services.
- Self-healing with automatic retries.
- Status monitoring via `/events/circuit-status` endpoint.

### 🛠️ Security Headers

- XSS Protection.
- Content Security Policy.
- CORS protection.
- Additional security headers.

---

## 🧠 Thought Process

Originally I was going to start the project in Bun as I've been using this more lately, but when looking through the Node docs I saw they added multi-threading and I wanted to try it. I originally was going to handle that ugly for loop on another concurrent worker to speed up time. Way unnecessary but I already busted time setting up the main cluster. I had to do a lot of prep work and a few POCs before attempting the project.

You may notice rateLimiter.test.js is now with AI notes. I wanted to get AMEX 100% test coverage and my tests broke after I implemented the clusters. I will try to address it on another branch, so consider main the 2-ish hour submission. Other than that I only used AI on the docs and the v2 of the PowerShell script for rapid manual testing.

### Order of operations
- Initial Look
    - Needs
        - Auth
            - No env
            - No SSL certs
        - Central logging (P1)
        - Better error handling
        - Basic security
            - Rate limiter
            - TLS/SSL certs
            - XSS
            - CORS configuration
        - Performance issues
            - No code splitting
            - No cacher
            - Single threaded node
        - CI/CD
- Initial calls
    - Noticed that ID doesn't seem right for events
    - getEventByID should be its own call
        - If you call this endpoint with an actual id it crashes
            - Only can call by event-1 or event-3
    - get userBy ID should be its own call
- Build out my priority list and current schema
- Updated JSON with needed tools and refactored
- Updated logger
    - Found that getEvents has a fetch error that wasn't caught with initial errors
    - Installed pino-pretty as dev dep
    - Changed object to print well
    - Added error handling
- Refactored routes
    - Registered routes
    - Migrated routes
    - Look into refactoring one later (endpoint can't be changed so I'm going to try concurrent threads)
- Created a cacher
    - Takes 500ms+ endpoints to < 1ms 
    - Make a connection to Redis or enterprise for prod
- Added simple rate limiter to protect from DDOS attacks
- Added XSS headers
- Created circuit breaker
    - Only added it to the events routes, would add it to whole thing, but I want to try something new I found in node (I've mostly been using Bun lately)
- Updated shell script to be interactive and manually test each endpoint
- Trying node multi-thread implementation

My approach was to first analyze the existing system for critical vulnerabilities and performance bottlenecks. Security and reliability were top priorities - implementing rate limiting and XSS protection to prevent common attacks, while adding circuit breakers to prevent cascading failures in downstream services.

The performance improvements focused on caching, which dramatically reduced response times from 500ms+ to under 1ms for frequently requested resources. Rather than building a distributed cache immediately, I opted for an in-memory solution that could later be swapped with Redis for production environments. This gave us immediate benefits while leaving the door open for more robust solutions.

Refactoring the routes improved code organization while maintaining backward compatibility with existing API contracts. The logger implementation was enhanced to provide structured logging with proper error context, making debugging and monitoring more effective.

Throughout the process, I maintained a balance between immediate improvements and setting up patterns that could scale with the application's growth. Each decision was guided by the principles of reliability, performance, security, and maintainability.

---

## ✅ TODOs

To take this application into production, consider the following steps:

1. **Authentication and Authorization**:
   - Implement JWT-based authentication.
   - Add role-based access control (RBAC) for sensitive endpoints.

2. **Environment Configuration**:
   - Ensure all sensitive data (e.g., API keys, database credentials) are managed using environment variables.
   - Verify that `dotenv` is properly configured for loading environment variables.

3. **Database Integration**:
   - Replace in-memory caching with a distributed cache like Redis.
   - Add a database (e.g., PostgreSQL, MongoDB) for persistent storage.

4. **Logging and Monitoring**:
   - Integrate centralized logging (e.g., ELK stack, Datadog).
   - Add monitoring tools like Prometheus and Grafana for performance metrics.

5. **Error Handling**:
   - Implement a global error handler for consistent error responses.
   - Add retry mechanisms for transient errors.

6. **Security Enhancements**:
   - Enforce HTTPS with TLS certificates.
   - Add input validation and sanitization to prevent injection attacks.
   - Configure CORS policies for allowed origins.

7. **Scalability**:
   - Use a process manager like PM2 for clustering.
   - Deploy to a container orchestration platform like Kubernetes.

8. **CI/CD Pipeline**:
   - Set up automated testing and deployment pipelines using GitHub Actions or Jenkins.

9. **Documentation**:
   - Add API documentation using tools like Swagger or Postman.
   - Provide detailed setup and troubleshooting guides.

10. **Load Testing**:
    - Perform load testing using tools like Apache JMeter or k6.
    - Optimize performance based on test results.

---

## 📜 License

MIT