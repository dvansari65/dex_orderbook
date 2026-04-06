import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { loadIndexerEnv, resolveDatabaseUrl } from "./env";

loadIndexerEnv();
const adapter = new PrismaPg({
  connectionString: resolveDatabaseUrl(),
});

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
