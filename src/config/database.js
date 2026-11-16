const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const connectDB = async () => {
  if (!process.env.DATABASE_URL) {
    console.warn(
      "[Warning] DATABASE_URL is not set in .env. Please add your Neon.tech or Supabase PostgreSQL URL."
    );
    return;
  }

  try {
    await prisma.$connect();
    console.log("PostgreSQL (Prisma) connected successfully");
  } catch (err) {
    console.error("PostgreSQL connection error:", err.message);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    } else {
      console.warn(
        "[Dev Mode] Server running without active PostgreSQL connection. Update DATABASE_URL in .env with your Neon/Supabase/Local Postgres URL and run: npx prisma db push"
      );
    }
  }
};

module.exports = { prisma, connectDB };
