-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SuperAdmin', 'Admin', 'Moderator', 'User');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roles" "Role"[];
