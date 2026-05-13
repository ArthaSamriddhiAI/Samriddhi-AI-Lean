-- CreateTable
CREATE TABLE "investors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayInitials" TEXT NOT NULL,
    "metaLine" TEXT NOT NULL,
    "structureLine" TEXT NOT NULL,
    "riskAppetite" TEXT NOT NULL,
    "timeHorizon" TEXT NOT NULL,
    "modelCell" TEXT NOT NULL,
    "liquidAumCr" REAL NOT NULL,
    "liquidityTier" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "profileMd" TEXT NOT NULL,
    "onboardingTranscript" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "testAxis" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "holdingsCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investorId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "workflow" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "status" TEXT,
    "frozenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentJson" TEXT NOT NULL,
    "contextNote" TEXT,
    CONSTRAINT "cases_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "investors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cases_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "snapshots" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "apiKey" TEXT,
    "modelChoice" TEXT NOT NULL DEFAULT 'claude-opus-4-7',
    "advisorName" TEXT NOT NULL DEFAULT 'Priya Nair',
    "firmName" TEXT NOT NULL DEFAULT 'Anand Rathi Wealth · UHNI desk',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "cases_investorId_idx" ON "cases"("investorId");

-- CreateIndex
CREATE INDEX "cases_snapshotId_idx" ON "cases"("snapshotId");
