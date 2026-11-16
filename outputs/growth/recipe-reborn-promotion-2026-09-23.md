# Recipe Reborn: try one recipe

Prepared and published September 23, 2026. Beth's fresh “use stephs she ok it” instruction authorized Stephanie Dill's Facebook session. The neutral page variant below was published once on Stephanie's personal profile with Public audience and boosting off. [View the live post](https://www.facebook.com/stephanie.dill.2025/posts/pfbid01JfDfxPiLWDW8zikKUr5Swdk3cbsT4NfRSB4Ma81rZvPPL3G9dxpFA5SXcPK1M8jl). See [publication status and screenshot](C:/Users/bethh/Documents/recipe-reborn/outputs/growth/app-promotion-publication-status-2026-09-23.md). App-sale and buyer outreach remain paused. Spending was $0.

## Personal Facebook draft — unused

I made Recipe Reborn to turn packaged favorites into homemade recipes. Pick something from your kitchen, take a photo of the ingredient label, and see what you could make yourself.

You get 3 free recipes a month, with no card required.

Try one recipe: https://recipereborn.com/?src=rr-sep23-personal

## Neutral page copy — published on Stephanie's profile

What would a homemade version of your favorite packaged food look like?

Take a photo of its ingredient label with Recipe Reborn and turn it into a recipe you can cook. Start with 3 free recipes a month, no card required.

Try one recipe: https://recipereborn.com/?src=rr-sep23-page

## Image and publishing instructions

Use the existing Recipe Reborn brand image: [og-image.png](C:/Users/bethh/Documents/recipe-reborn/public/og-image.png). It was visually inspected; it contains the existing logo and no invented testimonials or numerical results. The public image at https://recipereborn.com/og-image.png returned HTTP 200 on September 23.

The published link post uses that existing link-preview image. The live card and tagged destination were verified. Beth authorized using the neutral page copy on Stephanie's profile; the personal draft above was not used. The approved one-post action is complete. Do not publish either variant again as part of this request.

Both tagged landing URLs returned HTTP 200 and retained their `src` parameter. The live `/signup` and `/pricing` pages confirm the standard Free offer: 3 recipe generations a month, no card required. These source tags do not grant Premium or a special trial.

The main invitation uses the web app, so an Android install is not necessary. The signed-in live generator exposes label photos, barcodes, typed ingredients, URL import, and voice chat. This campaign focuses on one starting point, the ingredient label. Do not advertise the newer local native voice/photo work as shipped.

## First group and feedback

The target is 10 new people creating a first recipe, followed by at least 3 returning to make another within a week. These are goals, not achieved results. The approved post is published. Use voluntary feedback to remove confusion before broadening promotion; posting permission does not authorize sending replies or further outreach. No automated messages, purchased lists, paid ads, or recurring task was created.

For people who ask how to begin: open the link, photograph a label or type its ingredients, review the extracted text, and choose **Transform to Fresh**. Create the free account when prompted to continue to the full recipe. If a label is unavailable, the homepage offers an example. The guest preview and a saved recipe are different steps.

Suggested feedback question after someone voluntarily tries it: “What did you make, and was there any point where you weren't sure what to do?” Ask whether they actually cooked it separately. A saved recipe does not prove cooking.

If someone wants follow-up, a later prompt can be: “Have another favorite you'd like to try making at home?” No follow-up is sent by this packet, and it does not enroll anyone into reminders.

## Measurement

The published campaign uses `rr-sep23-page`; `rr-sep23-personal` remains unused. Record the actual destination as Stephanie's personal Facebook profile despite “page” in the approved tag. Existing first-touch attribution keeps the first stored source; a later campaign link does not overwrite it. Blocked browser storage can lose attribution. A typed community code can replace the campaign source. Do not treat tagged signups as the complete audience or link views as users.

Run the adjacent read-only SQL after publication and again after a full week. It returns new accounts, accounts with a saved recipe, accounts saving again at least 24 hours later within 7 days, and the number whose full 7-day observation window has elapsed. It excludes the known owner and `@example.com` synthetic accounts. Other testers or duplicate accounts may remain: confirm the volunteer list privately before calling them independent users. It returns aggregates, not emails or recipe content.

`recipe_generated` and `preview_started` events are anonymous activity signals, not unique people. Saved Recipe rows also include generated meal-plan records. Historical `return_visit` events are unreliable because first visits were counted. The correction was deployed later September 23 in `938a76a`; use the verified release boundary for any new analysis. The corrected event still measures a browser returning after a 24-hour gap, not a unique person or a cooked meal.

## Optional Android tester invitation — separate from the web post

Draft for separate account-specific approval:

“I'm looking for 10 more people in the US with Android phones to help test Recipe Reborn. You'll need to join the closed test with your Google account, stay opted in for at least 14 days, and try the app during that time. If you'd like to help, message me for the testing steps.”

The Android owning task reported a live Play Console check today: closed Alpha build 8 is available to eligible testers, only 2 testers are currently opted in, and production is inactive. The account needs at least 12 testers continuously opted in for 14 days before applying for production access. Meeting that threshold does not guarantee a public launch. The newer local native changes are not in the September 7 Play build.

The Android owning task subsequently verified the current **Testers** page in Play Console: the active Alpha track uses the selected `RecipeReborn Test` email list (14 listed addresses), Google Groups is not selected, and the US is the only targeted country. Fourteen listed addresses is not fourteen opted-in testers.

For each volunteer, first have the app owner add their Google-account email to that selected list; collect it privately, not in a public comment. This packet does not authorize or perform tester-list changes. An already-listed person can use their listed account. Then:

1. On the Android phone in the US, sign into Google Play with that same Google account.
2. Open the verified opt-in URL: https://play.google.com/apps/testing/com.recipereborn.app and choose **Become a tester**.
3. Install or update using https://play.google.com/store/apps/details?id=com.recipereborn.app while signed into that eligible account.
4. Remain opted in continuously for at least 14 days and try the app during the test.

Posting either link alone does not grant access to unlisted people. The listing is for eligible closed-test participants; do not describe it as a public Play launch. These read-only instructions were verified by the Android owner today; no tester addresses or settings were changed. This separate invitation does not block the primary web post.

## Next measurement

Publication is complete; no Facebook login action remains. The next useful check is whether this campaign produces first recipes and later repeat use using the measurement definitions above. A future check is not scheduled by this document. Beth separately authorized pushing all completed fixes; that push and automatic web deployment are complete, as recorded in [push verification](C:/Users/bethh/Documents/recipe-reborn/outputs/releases/recipe-reborn-push-verification-2026-09-23.md). The earlier minimal web proposal was superseded. No native store upload, billing change, or spending was performed.
