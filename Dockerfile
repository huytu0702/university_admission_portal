# Use Node.js 18 as the base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose ports
EXPOSE 3000 3001

# Initialize the project
RUN chmod +x init.sh
RUN ./init.sh

# Start the application
CMD ["./start.sh"]