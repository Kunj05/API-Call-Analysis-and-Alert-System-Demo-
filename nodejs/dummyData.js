const faker = require('faker');

function generateUsers(num) {
  const users = [];
  for (let i = 0; i < num; i++) {
    users.push({
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      age: Math.floor(Math.random() * (60 - 18 + 1)) + 18 // Random age between 18 and 60
    });
  }
  return users;
}

function generateOrders(count) {
  const orders = [];
  for (let i = 0; i < count; i++) {
    orders.push({
      userId: faker.datatype.number({ min: 1, max: 50 }),
      product: faker.commerce.productName(),
      price: faker.datatype.number({ min: 10, max: 1000 })
    });
  }
  return orders;
}

module.exports = { generateUsers, generateOrders };