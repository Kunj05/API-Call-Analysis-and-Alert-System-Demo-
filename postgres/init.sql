CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  age INT
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INT,
  product VARCHAR(100),
  price INT
);