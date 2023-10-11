# Use an official Node.js runtime as the base image
FROM node:16

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available) to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire project to the working directory
COPY . .

# Compile TypeScript to JavaScript using the provided tsc script
RUN npm run tsc

# Expose the port your app runs on
EXPOSE 3000

# Command to run the app
CMD ["node", "build/app/app.js"]
