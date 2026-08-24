# Store privacy answer worksheet

This engineering worksheet must be reviewed against the final signed build before submission.

## Apple privacy labels

- Contact Info / Email Address: collected, linked to identity, app functionality and account management; not used for tracking.
- User Content / Photos: collected only when the user submits pantry/fridge photos for transient AI processing; linked to the signed-in request; not stored by Recipe Reborn; app functionality; not tracking.
- User Content / Other User Content: ingredients, recipes, confirmed pantry inventory, meal plans, collections, and shopping lists; linked to identity; app functionality; not tracking.
- Identifiers / User ID and device token: linked to identity; authentication, security, and optional notifications; not tracking.
- Purchases: subscription state is linked to identity for entitlement and account management; not tracking.
- Diagnostics: no native crash or analytics SDK in this beta foundation.

## Google Play Data safety

- Data encrypted in transit: Yes (production HTTPS only).
- Account deletion: Available in app and documented at https://recipereborn.com/account-deletion.
- Data sold: No.
- Data shared: User-submitted ingredient text and pantry/fridge photos are processed by the configured AI service to provide requested features; payment data is handled by Stripe on hosted pages; barcode queries use the server's product-data provider.
- Optional data: camera/photo selection and push permission are user initiated. Core account email and session data are required for signed-in features.
- Independent security review: do not claim until one is completed.
