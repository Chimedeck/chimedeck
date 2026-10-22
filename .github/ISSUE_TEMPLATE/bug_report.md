---
name: Bug report
about: Report a defect. See docs/bug-workflow.md for the full reproduce-first pipeline.
title: ''
labels: bug
assignees: ''

---

<!--
Before filing: a bug is not ready to work until it has expected-vs-actual and evidence.
The full pipeline (reproduce → root cause → fix → verify) lives in docs/bug-workflow.md.
-->

**Summary**
A clear, concise description of the defect.

**Severity**
<!-- Sev 1 Fix Immediately | Sev 2 High | Sev 3 Medium | Sev 4 Low -->

**Environment**
- Where: <!-- test / production -->
- Surface: <!-- web / iOS / android -->
- OS / Browser / Version:
- Device (if mobile):

**Steps to reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected vs actual**
- Expected:
- Actual:

**Evidence**
<!-- Screenshots, console errors, Sentry link, and an API round-trip (request + stored
result) where relevant. UI screenshots alone do not prove a persistence bug. -->

**Failing test**
<!-- Path to the test that reproduces this and FAILS (tests/e2e/<file>.spec.ts), or
"none yet". A bug is not demonstrated until a red automated test proves it. -->

**Classification**
<!-- product_defect | data | config | regression -->

**Affected surface**
<!-- The code / data / API / UI you believe is involved. -->

**Additional context**
Anything else that helps locate the root cause.
