/* Test fixture for the WA12 gate (never executed). Reaches the SDK only
 * TRANSITIVELY through spendy-lib, proving the checker walks the chain. */
import { client } from "./spendy-lib";

console.log("test fixture; would construct:", typeof client);
