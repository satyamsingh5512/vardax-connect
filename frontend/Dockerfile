FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json .
RUN npm install

# Copy application
COPY . .

# Build for production
RUN npm run build

# Expose port
EXPOSE 3000

# Serve with preview
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
