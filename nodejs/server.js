const express = require('express');
const winston = require('winston');
const { Pool } = require('pg');
const { generateUsers, generateOrders } = require('./dummyData');
const promClient = require('prom-client');
const process = require('process');
const app = express();

// Prometheus Metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  buckets: [10, 50, 100, 200, 500, 1000]
});

const errorCounter = new promClient.Counter({
  name: 'app_errors_total',
  help: 'Total number of errors in the application'
});

// Winston Logger Setup with Metrics
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, metrics }) => {
      const metricsStr = metrics ? ` [${Object.entries(metrics).map(([k, v]) => `${k}=${v}`).join(', ')}]` : '';
      return `${timestamp} ${level}: ${message}${metricsStr}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/access.log', level: 'info' }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/db.log', level: 'info' }),
    new winston.transports.File({ filename: 'logs/app.log', level: 'info' }),
    new winston.transports.Console({ level: 'info' })  
  ]
});

// Database Connection
const pool = new Pool({
  host: 'postgres', // Use the container name here, not the IP address
  port: 5432,
  user: 'user',
  password: 'password',
  database: 'logdb',
});

// Middleware 1: Access Log with Network Latency Simulation
app.use((req, res, next) => {
  const start = Date.now();
  const end = httpRequestDuration.startTimer();
  let reqSize = 0;
  if (req.body) reqSize = Buffer.byteLength(JSON.stringify(req.body));

  // Simulate network latency (random delay between 10-100ms)
  const networkLatency = Math.floor(Math.random() * 91) + 10;
  setTimeout(() => {
    res.on('finish', () => {
      const duration = Date.now() - start;
      end();
      const ip = req.ip || '127.0.0.1';
      const date = new Date().toUTCString().replace('GMT', '+0000').replace(',', '');
      const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
      const logLine = `${ip} - - [${date}] "${req.method} ${req.url} HTTP/1.1" ${res.statusCode} ${duration} "-" "Mozilla/5.0 (Node.js)" "-"`;
      logger.info(logLine, {
        metrics: {
          response_time_ms: duration,
          request_size_bytes: reqSize,
          memory_usage_mb: memoryUsage.toFixed(2),
          network_latency_ms: networkLatency
        }
      });
    });
    next();
  }, networkLatency);
});

// Middleware 2: Query Complexity Logger
const logQueryComplexity = async (req, res, next) => {
  if (!req.queryComplexity) req.queryComplexity = {};

  const originalQuery = pool.query.bind(pool);
  pool.query = async (text, params) => {
    const start = Date.now();
    try {
      // Use EXPLAIN to get query cost (simplified approximation)
      const explainQuery = `EXPLAIN ${text}`;
      const explainResult = await originalQuery(explainQuery, params);
      const plan = explainResult.rows[0]['QUERY PLAN'] || 'N/A';
      const costMatch = plan.match(/cost=[\d.]+..([\d.]+)/); // Extract max cost
      const queryCost = costMatch ? parseFloat(costMatch[1]) : 0;

      const result = await originalQuery(text, params);
      const duration = Date.now() - start;

      logger.info(`Executed query: ${text}`, {
        metrics: {
          query_time_ms: duration,
          query_cost: queryCost,
          rows_returned: result.rowCount || 0,
          params_count: params ? params.length : 0
        },
        transport: 'logs/db.log'
      });

      req.queryComplexity[text] = { cost: queryCost, time: duration };
      return result;
    } catch (err) {
      logger.error(`Query error: ${err.message}`, {
        metrics: { query_text: text, error_code: 'QUERY_ERROR' }
      });
      throw err;
    } finally {
      pool.query = originalQuery; // Restore original method
    }
  };
  next();
};

// Apply Query Complexity Middleware to all routes
app.use(logQueryComplexity);

// API 1: Get All Users from DB with Metrics
app.get('/api/users', async (req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query('SELECT * FROM users');
    const duration = Date.now() - start;
    logger.info('Fetched users from database', {
      metrics: {
        rows_returned: result.rowCount,
        query_time_ms: duration
      },
      transport: 'logs/db.log'
    });
    res.json(result.rows);
  } catch (err) {
    errorCounter.inc();
    logger.error(`Database error in /api/users: ${err.message}`, {
      metrics: { error_code: 'DB_ERROR' }
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API 2: Generate and Pass Dummy Orders, Save to DB
app.get('/api/orders/generate', async (req, res) => {
  try {
    const start = Date.now();
    const orders = generateOrders(10);
    let insertedRows = 0;
    for (const order of orders) {
      await pool.query(
        'INSERT INTO orders (user_id, product, price) VALUES ($1, $2, $3)',
        [order.userId, order.product, order.price]
      );
      insertedRows++;
    }
    const duration = Date.now() - start;
    logger.info('Generated and saved 10 dummy orders', {
      metrics: {
        orders_inserted: insertedRows,
        operation_time_ms: duration
      },
      transport: 'logs/app.log'
    });
    res.json(orders);
  } catch (err) {
    errorCounter.inc();
    logger.error(`Error generating orders: ${err.message}`, {
      metrics: { error_code: 'INSERT_ERROR' }
    });
    res.status(500).json({ error: 'Failed to generate orders' });
  }
});

// API 3: Complex Filtering with Random Failure and Metrics
app.get('/api/users/filter', async (req, res) => {
  const { age } = req.query;
  try {
    if (!age) throw new Error('Age query parameter is required');
    const start = Date.now();
    const result = await pool.query('SELECT * FROM users WHERE age > $1', [parseInt(age)]);
    const duration = Date.now() - start;
    if (Math.random() < 0.3) {
      throw new Error('Random server failure');
    }
    logger.info(`Filtered users with age > ${age}`, {
      metrics: {
        rows_returned: result.rowCount,
        query_time_ms: duration
      },
      transport: 'logs/db.log'
    });
    res.json(result.rows);
  } catch (err) {
    errorCounter.inc();
    logger.error(`Filter error: ${err.message}`, {
      metrics: { error_code: 'FILTER_ERROR' }
    });
    res.status(500).json({ error: err.message });
  }
});

// API 4: Simulate Heavy Computation with Forced Failure and Detailed Error Logs
app.get('/api/compute', (req, res) => {
  try {
    const start = Date.now();
    logger.info('Starting heavy computation', { transport: 'logs/app.log' });
    let result = 0;

    // Simulate heavy computation
    for (let i = 0; i < 1e6; i++) result += Math.random();

    const duration = Date.now() - start;
    const cpuUsage = process.cpuUsage().user / 1000000; // Convert to seconds

    // Force failure with higher probability (e.g., 80% chance) or always fail for testing
    const failureChance = Math.random();
    if (failureChance < 0.8) { // 80% chance of failure; change to 1.0 for always fail
      throw new Error('Computation overload due to excessive resource demand');
    }

    // If no failure, log success
    logger.info(`Computation completed: ${result}`, {
      metrics: {
        compute_time_ms: duration,
        cpu_usage_s: cpuUsage.toFixed(2),
        result_size: result.toFixed(2).length
      },
      transport: 'logs/app.log'
    });
    res.json({ result });

  } catch (err) {
    errorCounter.inc(); // Increment Prometheus error counter

    // Enhanced error logging with detailed metrics
    const duration = Date.now() - start; // Time until failure
    const cpuUsage = process.cpuUsage().user / 1000000; // CPU usage at failure
    logger.error(`Compute error: ${err.message}`, {
      metrics: {
        error_code: 'COMPUTE_ERROR',
        compute_time_ms: duration,          // Time spent before failing
        cpu_usage_s: cpuUsage.toFixed(2),   // CPU usage at failure point
        failure_point: 'loop_execution',    // Custom metric: where it failed
        request_url: req.url,               // URL that caused the error
        trace_id: req.traceId || 'N/A'      // Include trace_id if available
      }
    });

    res.status(500).json({ error: 'Computation failed', details: err.message });
  }
});

// Metrics Endpoint (Optional)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Start Server
const waitForPostgres = async () => {
  let retries = 10;
  while (retries) {
    try {
      await pool.query('SELECT NOW()'); // A simple query to check DB connectivity
      console.log('Connected to Postgres');
      break;
    } catch (err) {
      console.log('Waiting for Postgres...');
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000)); // Retry after 5 seconds
    }
  }
};

app.listen(3000, async () => {
  await waitForPostgres(); // Wait until Postgres is available

  const users = generateUsers(50);

  let insertedRows = 0;
  for (const user of users) {
    try {
      await pool.query(
        'INSERT INTO users (name, email, age) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [user.name, user.email, user.age]
      );
      insertedRows++;
      logger.info(`Inserted user: ${user.name} with email: ${user.email}`);
    } catch (err) {
      logger.error(`Failed to insert user: ${user.name}`, { error: err.message });
    }
  }
  console.log(`Inserted ${insertedRows} users.`);
});
