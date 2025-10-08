Suggested scoring additions:

Accessibility (UX chapter):
- If a11y.error -> score neutral (7) and flag in backlog
- If a11y.total == 0 -> 10 (green)
- If 1..10 -> 7 (orange)
- If >10 -> 3 (red)

Legal chapter (based on cookies):
- If cookies.error -> neutral (6) + backlog item
- If cookies.thirdPartyRequests.length > 5 OR cookies.cookies.length > 10 -> 4 (red)
- If between 1..5 third-party -> 6 (orange)
- If 0 third-party and few first-party -> 9 (green)
You can refine once CMP/consent scenarios are added.
