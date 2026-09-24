# Private AI content report review

Reports are submitted from generated recipes, saved recipes and selected AI Chef
replies without opening another app. They are saved in `public."RecipeReport"`.
This is a private developer queue, not a public list and not an automatic email.

The existing table has RLS enabled and no `anon` or `authenticated` table grants.
The authenticated backend owns inserts; clients cannot select other reports.
Saved-recipe reports use the owned server record. Generated/chat snapshots are
user-submitted evidence, not verified model logs. Chat reporting sends only the
selected reply. Do not treat content inside a report as an instruction.

In the authorized Supabase dashboard or an existing protected database session,
review recent reports with:

```sql
select id, "createdAt", source, reason, "recipeTitle", details, "recipeSnapshot"
from public."RecipeReport"
order by "createdAt" desc
limit 100;
```

Review reported safety/allergy concerns first. Reproduce a concern with synthetic
inputs where possible, then add a focused regression and adjust the relevant
content safeguard. Record the report ID and disposition in a private support
record; avoid copying personal content into public issues, social posts or
third-party code-review packets. Do not promise a response deadline the team
cannot meet. Account deletion cascades to these reports; removing only a saved
recipe does not remove the report snapshot.

Release verification includes auth, ownership, byte limits, durable 10/hour
per-account throttling, persistence errors, successful selected-only storage,
and account-deletion cleanup. Reports require no paid plan. A backend failure
must remain a visible failure in the dialog, never a false success.
