# Football Results Website

This context defines the language for a football results website that shows football fixtures and final or latest football results from an external data provider.

## Language

**Sanam Phonball**:
The website brand name for this football results experience. It means the place where users come to check football fixtures and results.
_Avoid_: Kapook, betting brand, generic live score clone

**Football Results Website**:
A public web experience for viewing football fixtures, football results, and match details. It is organized around matches and competitions rather than articles or betting markets.
_Avoid_: News site, betting site

**Football Schedule and Results Data**:
Match data supplied by an external provider for upcoming fixtures and completed or latest results. It includes at least match start time, teams, competition, score when available, and match status.
_Avoid_: Static sample data, manually entered results

**Football Data Provider**:
The external service that supplies Football Schedule and Results Data to the website. Provider credentials are private integration details and should not be visible to website visitors.
_Avoid_: Public browser API, embedded API key

**Live Scores Feed**:
The provider feed used in the first version of the website, sourced from the football livescores endpoint. It is the authority for which matches appear in the initial product, even when the UI labels them as today's programme or results.
_Avoid_: Complete fixture calendar, manually curated schedule

**Latest Available Results**:
The most recent Football Schedule and Results Data the website can show when the provider is temporarily unavailable. Users should be able to tell when the displayed data was last updated.
_Avoid_: Fake live data, silent stale data

**Fixture**:
A scheduled football match that has not yet been completed. A fixture belongs to one **Competition** and has two teams, a start time, and a match status.
_Avoid_: Event, game listing

**Football Result**:
The score and status of a match that is in progress or completed. A result should be shown only when the provider has score data for the match.
_Avoid_: Live feed, play-by-play

**Match Detail**:
Additional information about one selected match, opened from the match row without leaving the current Match Day view. It belongs to exactly one Fixture or Football Result.
_Avoid_: Separate article page, unrelated news detail

**Quick Football Viewer**:
The primary audience mode for Sanam Phonball: users who want to scan today's fixtures and results quickly, especially on mobile. It favors clear grouping, fast filters, and recognizable match status over deep statistical analysis.
_Avoid_: Analyst dashboard, betting terminal

**Match Day**:
The calendar date used to group fixtures and results on the website. The default Match Day is today in Thailand time.
_Avoid_: Browser-local day, UTC day

## Example Dialogue

Dev: "Should this page show only today's finished results?"

Domain expert: "No, it should use Football Schedule and Results Data so users can see upcoming fixtures and the latest available results for the selected Match Day."

Dev: "If a user opens the site from another country, which date is 'today'?"

Domain expert: "Today means the current Match Day in Thailand time."

Dev: "Can the frontend call the football API directly?"

Domain expert: "No. The website uses a Football Data Provider, but provider credentials must stay private."

Dev: "Does the first version need every fixture scheduled for today?"

Domain expert: "No. The first version shows the matches available from the Live Scores Feed."

Dev: "What should users see if the provider returns no usable data?"

Domain expert: "Show a clear empty or retry state. If Latest Available Results exist, show them with the last updated time instead of pretending they are fresh."

Dev: "Where should detailed match information appear?"

Domain expert: "Open Match Detail from the selected row while keeping the user on the same Match Day."

Dev: "Should the first version optimize for deep stats or quick scanning?"

Domain expert: "Quick scanning. Sanam Phonball is a Quick Football Viewer first."
