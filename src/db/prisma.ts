import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config/env';

// Polyfill BigInt serialization for JSON.stringify & Fastify serialization
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function (): string {
  return this.toString();
};

// Polyfill Decimal serialization
(Prisma.Decimal.prototype as any).toJSON = function (): number {
  return Number(this.toString());
};

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: config.isProduction ? ['error', 'warn'] : ['warn', 'error'],
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
