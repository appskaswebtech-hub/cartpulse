import { PrismaClient } from "@prisma/support-client";

declare global {
  var supportPrismaGlobal: PrismaClient | undefined;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.supportPrismaGlobal) {
    global.supportPrismaGlobal = new PrismaClient();
  }
}

const supportPrisma: PrismaClient = global.supportPrismaGlobal ?? new PrismaClient();

export default supportPrisma;
