FROM node:20-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY tsconfig.json ./

# Copy prisma schema
COPY prisma ./prisma/

# Install all dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy all source folders
COPY src ./src
COPY lib ./lib
COPY helper ./helper
COPY types ./types
COPY service ./service
COPY generated ./generated
COPY idl ./idl
COPY scripts ./scripts

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]