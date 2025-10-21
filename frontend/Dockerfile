# Stage 1: Build the React application
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json ./
# Use package-lock.json if available for reproducible builds
COPY package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the application from a lightweight web server
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
