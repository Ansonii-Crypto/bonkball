# Player ranking emblems

Place each tier's SVG emblems in its matching folder, named:

- `1st.svg`
- `2nd.svg`
- `3rd.svg`

For example: `S/1st.svg`, `A/2nd.svg`, or `F/3rd.svg`.

| Folder | Tier colour |
| --- | --- |
| S | `#fe2f44` |
| A | `#fca475` |
| B | `#fcfe90` |
| C | `#7c905f` |
| D | `#82c6cb` |
| E | `#eda4e3` |
| F | `#a36cfd` |

Use a transparent background and a consistent SVG `viewBox` so the emblems can be displayed at matching sizes. Keep artwork within the viewBox and use self-contained SVGs without scripts or external assets.

S and A tier placements use their SVG files on public player cards. B through F keep the existing placement text until their artwork is ready.

S and A now replace the main-page tier circle at the top right of each card. Top-three players use their placement SVG; other players use `default.svg`. Separate placement emblems beneath the class are omitted for S and A. Player assessment pages retain the standard tier circles.

B tier also uses placement/default SVGs on main-page cards. Player assessment details and history entries use the default S, A, or B emblem for the assessment tier, without applying current leaderboard placement to historical assessments.
