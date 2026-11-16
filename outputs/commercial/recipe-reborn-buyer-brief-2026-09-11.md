# Recipe Reborn: buyer brief and revenue priorities

Prepared September 11, 2026; product notes updated September 12 (Pacific). Private working document; nothing has been sent or listed for sale.

**Paused September 12 at the owner's direction.** User acquisition is now the priority. Keep this brief as background only; do not contact buyers, submit sale forms or create listings unless the owner resumes the sale effort.

## Decision

Position Recipe Reborn around one concrete job: **Scan a package. Make your homemade version. See what changed.** Keep the current subscription model while testing whether people cook, return, and pay. The earlier sale exploration is paused. Current evidence supports an early product asset, not an established profitable business.

No asking price is set. A marketplace price ceiling or another company's advertised deal range is not a valuation of this app. Seek nonbinding indications of interest first; evaluate cash at closing, included assets, support commitments, and any conditions against continuing to operate it.

## Verified commercial baseline

Read directly from live Beth's Apps Stripe account and the Recipe Reborn database during this session. All Stripe invoice, charge, and subscription queries reached `has_more: false`.

| Measure | Finding | Interpretation |
|---|---:|---|
| Recipe Reborn payments received in the queried Stripe history | $9.99 USD | One positive paid invoice, corroborated by a successful charge for the same customer and amount; no refund or dispute recorded. Gross receipts, not profit. |
| Recipe Reborn paying customer records with a successful charge | 1 | Does not establish whether this is an independent customer versus an owner, friend, or tester. |
| Current Recipe Reborn subscriptions | 1 past due; 1 trialing; 17 canceled | Zero currently active paid subscriptions. Trialing is not paying. No reliable recurring revenue claim. |
| Unpaid renewal | $9.99 | Open invoice with three payment attempts; a further automatic attempt was scheduled for September 12 at about 5:26 PM Pacific when checked. Recheck before any reminder. |
| Registered accounts | 16 | Includes owner/tester activity; not 16 paying users. |
| Accounts created in the prior 30 days | 9 | Two mobile, two Finnsters, two playtest14, one stephanie, two unknown. |
| Saved recipes | 203 | 11 accounts have saved a recipe; saved records include testing and generated meal plans. |
| Saved recipes in the prior 30 days | 172 across 9 accounts | This is recipe-saving activity, not monthly active users or measured retention. |
| Profit, CAC, retention, store installs | Unverified | Hosting, AI, store costs and independent-user cohorts still need reconciliation. |

Database timestamp: 2026-09-12 06:17:38 UTC. Stripe product IDs matched Recipe Reborn product names on invoice lines; Cheffo Doggo was excluded. No customer names, emails, card details, tokens, or raw records are included here. Other payment channels were not audited.

Funnel instrumentation is incomplete: the prior 30 days show 8 `recipe_generated` events versus 172 saved recipe records, 1 `signup_completed` event versus 9 new accounts, and 284 `return_visit` events without user identity. These are different counters; do not divide them into conversion or retention rates. Payment evidence takes precedence over marketing event labels.

## Buyer shortlist

These are prospective leads identified from their own published acquisition pages. None has expressed interest in Recipe Reborn. Website claims about transactions, speed, confidentiality, and funding are not independently verified.

| Priority | Lead | Published fit | Decision and next action |
|---|---|---|---|
| 1: qualification inquiry | [CodeConda](https://www.codeconda.com/sell-your-app) | Says it buys small AI/web/mobile products with paying customers and no stated revenue minimum; emphasizes profitability, usage, transferable code and IP. | Strongest category/size lead, but profitability and steady paid usage are not established. Send the prepared fit inquiry before sharing private metrics. Use its official acquisition form. |
| 2: qualification inquiry | [Sell My Code](https://sellmycode.co/) | Advertises direct purchase of working software, including products not monetized, with no listing fee for the direct path. Public contact: sales@sellmycode.co. | Fits an asset sale better than a revenue multiple. First verify buyer legal identity and completed acquisitions, and ask whether it acquires the whole product or only a code licence. The separate paid marketplace is not the proposed route. |
| Later: marketplace | [Acquire.com](https://help.acquire.com/seller-faqs-1) | Revenue/customer verification and operational product required; limited pre-revenue SaaS exceptions, discretionary acceptance. | Ask about eligibility only after assembling current operating costs and independent usage. Do not pay for a listing or describe the app as profitable yet. |
| Later: marketplace | [Flippa](https://flippa.com/apps) | No minimum active users, but mobile listings must be published and live in a store. Advertises paid listing packages and success fees. | Confirm whether the web product is the appropriate listing asset. Android closed testing alone is not evidence of public store eligibility. No paid listing now. |
| Hold | [Maple Media](https://maplemedia.io/acquisitions/) | Typical apps have six months in a store, a stable user base and revenue. | Current evidence does not meet the typical profile. Revisit after public release and sustained usage. |
| Exclude now | [Capital Apps](https://capitalapps.com/how-we-work) | iOS apps at least one year old with 10,000 monthly downloads. | No verified iOS listing or qualifying downloads. |
| Exclude now | [King Filo Holdings](https://www.kingfiloholdings.com/sell-your-app) | Android apps with at least 500,000 installs. | No evidence of qualifying scale. |
| Hold | [The Happy Harbor](https://www.thehappyhabor.com/acquisition) | Published criteria include $1K MRR or $10K ARR, D30 retention above 20%, six months of data; says pre-revenue exceptions are case by case. | Far outside demonstrated scale. Do not use its advertised deal range as an appraisal. |

Research method: official acquisition pages and eligibility FAQs. Stripe Directory skill was inspected, but the Stripe CLI was unavailable; no directory query was executed. Web search phrases included `sell your app minimum revenue acquisitions`, `buy small apps revenue acquisition`, and `acquire apps pre-revenue company buy small`. No paid discovery tools were installed.

## Product and asset description

Recipe Reborn has a Next.js web application and an Expo React Native mobile application. The core flow uses barcode lookup or a label photo to make a homemade recipe, with saved recipes, meal planning, shopping lists, preferences and cooking assistance. It uses third-party AI and OpenFoodFacts; do not imply a proprietary trained model, owned food database, patents, or exclusive nutrition data.

The simplified mobile flow is committed locally. The automatic additive/nutrition comparison added in this session is for the generated-result screen. It shows the original ingredient matches and matches in the actual homemade ingredients, not an assumed zero. Package nutrition keeps its source and serving basis; homemade values are labeled estimates. Missing nutrients are not zero. OCR values require confirmation. This version does not persist the comparison after leaving the generated result.

The mobile input work also includes voice integration for spoken ingredients, recipe requests and AI Chef questions. Users tap to record, review the transcribed text, and explicitly generate or send. It is spoken input, not an always-listening wake word or a two-way voice conversation. Fridge/pantry capture now offers the device camera and saved photos, sizes upload copies automatically, presents an editable ingredient list and carries reviewed ingredients into recipe creation. These additions require a new native build and the matching backend release before they can be described as delivered to customers.

The redesigned mobile app is not installed on the phone or published. The installed Android build and store status need fresh release QA before a buyer demonstration is described as current. A source-code review or local build is not proof of a production feature.

Potential transaction scope: app-specific source, domain/brand assets the owner can transfer, build/release documentation, and agreed operational handover. Ownership and transferability must be checked asset by asset. The Stripe account is shared with Cheffo Doggo and must not be handed over as an app-specific asset. Cloud accounts, payment history, customer information and third-party licences need a scoped transfer plan; they are not promised in the initial inquiry.

## Revenue work in order

1. Resolve the one unpaid renewal through the existing customer billing portal. A reminder is drafted separately; do not add a manual charge on top of Stripe's scheduled retry. Count recovery only after the invoice is paid and a successful payment is confirmed.
2. Finish phone QA of scan → review → generate → compare → save → meal plan → shopping, plus voice → reviewed text and fridge/pantry camera → reviewed ingredient list. Include microphone/camera denial, cancellation, large photos, real barcode and label-photo cases, missing nutrition, an unavailable estimate, and returning to a saved recipe. The comparison currently lives only on the generated result; retain that limitation in demonstrations.
3. Run a small first-use cohort after release approval: 10 independent people who regularly buy a packaged food and want to cook a version themselves. Ask each to use their own package. Measure successful recipe completion, whether they cooked it, and whether they returned within a week. Separate the owner, friends/testing, and independent customers.
4. Keep one message and one signup link. Use the existing free tier and published subscription checkout rather than adding another coupon or lifetime offer. Proposed campaign source: `package-to-homemade`; this is a draft, not a published campaign.
5. Decision gate: aim for at least 7 of 10 participants finishing without help, 5 reporting they cooked the recipe, and 3 choosing a paid subscription after trying it. These are experiment targets, not forecasts. If users finish but do not cook or pay, interview them before spending on ads or adding features.
6. In parallel, send only the approved qualification inquiries. A qualified reply means the buyer confirms its acquisition entity, fit for this stage, desired assets, and willingness to discuss terms. An inquiry sent or opened is not a buyer found.

The first meaningful revenue milestone is repeat paid use. Ten customers at $9.99/month would produce $99.90 monthly gross before fees and operating costs; that arithmetic is a milestone, not a promise of income or a valuation.

## Evidence still needed before accepting a sale offer

Recent operating costs; independent active-user and retention cohorts; current public/store availability; app-specific asset ownership; licence/dependency inventory; transfer plan and realistic handover hours. Record actual offers separately from requested prices. No valuation, public listing, outreach, account transfer, spending, or contract acceptance occurred in this session.
