# Firestore Security Specification

## 1. Data Invariants
- Every farmer record lives at `/farmers/{farmerKey}`, where `farmerKey` is a 64-character lowercase SHA-256 hex digest derived client-side from `normalizedFarmerName` and `passcode` (no plaintext passcode is stored).
- `list` queries on `/farmers` are completely denied (`allow list: if false;`) so no user can enumerate or scrape other farmers.
- `farmerKey` inside the document must match the `{farmerKey}` path variable and remain immutable on updates.
- `rackSize` is strictly bounded to integers between `2` and `6`.
- `tiers` is strictly bounded to `<= 6` entries, and each tier entry validates allowed keys when populated.
- `createdAt` is immutable and both `createdAt` and `updatedAt` must equal `request.time`.

## 2. Adversarial Payloads Blocked by Rules
1. Listing all farmers (`list /farmers`) -> `PERMISSION_DENIED`.
2. Short or malformed document ID (`farmers/admin`, `farmers/../../etc`) -> rejected by `isValidFarmerKey`.
3. Path/body key mismatch (`farmerKey` != `{farmerKey}`) -> rejected by `isValidFarmerDoc`.
4. Shadow/ghost field injection (`isAdmin: true`, `extraField: 1`) -> rejected by `hasOnly`.
5. Missing required fields on create -> rejected by `hasAll`.
6. Unbounded `farmerName` (> 40 chars or empty) -> rejected by `.size()` check.
7. Invalid `activeZone` (not `'kitchen'` or `'garden'`) -> rejected by enum check.
8. Out-of-bounds `rackSize` (`1`, `99`, or float/string) -> rejected by integer range check `[2, 6]`.
9. Unbounded `tiers` array (`tiers.size() > 6`) -> rejected by `.size() <= 6`.
10. Client-forged timestamps (`createdAt` or `updatedAt != request.time`) -> rejected by temporal integrity check.
11. Mutating `createdAt` or `farmerKey` on update -> rejected by immutability check.
12. Deleting a farmer document -> rejected by `allow delete: if false`.
13. Private collections (`/farmers`, `/parents`, `/users`, `/store_orders`) remain un-listable globally; public Leaderboard rankings read exclusively from schema-validated `/leaderboard_students` (non-PII harvest counters) and append-only `/grade_sale_events` (anonymized school/grade ZAR totals without `buyerUid` or wallet balances).
