/* CLI wrapper around seedDatabase. Run via `npm run db:seed`. */

import { prisma } from "../lib/prisma";
import { seedDatabase } from "./seed";

console.log("Seeding Samriddhi MVP database.");

seedDatabase()
  .then((result) => {
    console.log(`  ${result.snapshots} snapshot metadata rows.`);
    console.log(`  ${result.investors} investor archetypes.`);
    console.log("  1 settings row (defaults).");
    console.log(`  ${result.cases} pre-generated case fixtures.`);
    console.log("Done.");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
