#!/bin/bash

# Script to run and test the Node.js API monitoring system

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Step 1: Ensure logs directory exists
echo -e "${GREEN}Setting up environment...${NC}"
mkdir -p logs
chmod -R 777 logs  # Ensure write permissions

# Step 2: Build and start Docker containers
echo -e "${GREEN}Building and starting Docker containers...${NC}"
docker-compose down  # Clean up any existing containers
docker-compose up --build -d
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to start containers. Check Docker setup.${NC}"
    exit 1
fi

# Wait for services to be ready (10 seconds)
echo -e "${GREEN}Waiting for services to initialize...${NC}"
sleep 10

# Step 3: Test API endpoints
echo -e "${GREEN}Testing API endpoints...${NC}"

# Function to test an API and display response
test_api() {
    URL=$1
    echo -e "\nTesting ${URL}..."
    RESPONSE=$(curl -s -w "\nHTTP Status: %{http_code}\n" ${URL})
    echo "Response:"
    echo "${RESPONSE}"
}

# Test each endpoint
test_api "http://localhost:3000/api/users"
test_api "http://localhost:3000/api/orders/generate"
test_api "http://localhost:3000/api/users/filter?age=30"
test_api "http://localhost:3000/api/compute"

# Step 4: Display logs
echo -e "${GREEN}\nDisplaying logs from ./logs/...${NC}"
for LOG_FILE in logs/*.log; do
    if [ -f "$LOG_FILE" ]; then
        echo -e "\n--- Contents of ${LOG_FILE} ---"
        tail -n 10 "$LOG_FILE"  # Show last 10 lines
    else
        echo -e "${RED}No logs found in ${LOG_FILE}${NC}"
    fi
done

# Step 5: Instructions for further monitoring
echo -e "${GREEN}\nSetup complete!${NC}"
echo "To monitor logs in real-time, run:"
echo "  tail -f logs/access.log logs/error.log logs/db.log logs/app.log"
echo "To stop the system, run:"
echo "  docker-compose down"

# Optional: Keep script running for manual testing
echo -e "${GREEN}Script finished. Containers are still running for manual testing.${NC}"
echo "Press Ctrl+C to exit and stop containers."
trap 'docker-compose down; echo -e "${GREEN}Containers stopped.${NC}"; exit' INT
sleep infinity