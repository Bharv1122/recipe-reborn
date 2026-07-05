-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dislikedIngredients" TEXT[] DEFAULT ARRAY[]::TEXT[];
