#!/bin/bash

# Monitor Application Performance

echo "Monitoring application performance..."

# Create monitoring directory
mkdir -p monitoring

# Generate timestamp
timestamp=$(date +"%Y%m%d_%H%M%S")

# Monitor CPU and memory usage
echo "Monitoring system resources..."
top -b -n 1 > monitoring/system_$timestamp.txt

# Monitor Docker container stats
echo "Monitoring Docker container stats..."
docker stats --no-stream > monitoring/docker_$timestamp.txt

# Monitor application logs
echo "Monitoring application logs..."
docker-compose logs --tail=100 > monitoring/logs_$timestamp.txt

# Monitor database performance
echo "Monitoring database performance..."
docker exec university_admission_db pg_stat_statements > monitoring/db_stats_$timestamp.txt

# Monitor API response times
echo "Monitoring API response times..."
curl -w "@monitoring/curl-format.txt" -o /dev/null -s http://localhost:3000/api > monitoring/response_time_$timestamp.txt

echo "Performance monitoring completed."
echo "Reports saved to monitoring/ directory."