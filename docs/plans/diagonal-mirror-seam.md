# Diagonal mirror seam fix

- [x] Trace the diagonal composition and identify the boundary-coverage risk.
- [x] Add rendered pixel coverage for both diagonal directions.
- [x] Overlap the source render clip enough to eliminate the antialiased seam.
- [x] Run the required build, check, browser, and diff validation.
- [x] Commit the verified fix on the feature branch.

The opt-in benchmark's semantic probe passed, but its machine-dependent timing
budgets failed twice in this environment. The changed source-clip code is not
executed inside the timed renderer loop.
