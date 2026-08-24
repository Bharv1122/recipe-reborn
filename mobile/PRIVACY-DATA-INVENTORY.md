# Mobile privacy and data-use inventory

This is an engineering inventory for store forms, not final legal wording.

| Data | Purpose | Storage / sharing | User control |
| --- | --- | --- | --- |
| Email, password | Account signup and login | Password is sent over HTTPS and stored only as the existing bcrypt hash; the app does not retain it | Password reset and in-app account deletion |
| Access/refresh tokens | Maintain signed-in session | Device Keychain/Keystore; refresh-token hash and device label in Recipe Reborn Postgres | Sign out revokes the device token |
| Subscription/trial status | Enforce and display access | Existing Recipe Reborn account and Stripe-derived server state; app is read-only | Billing management remains on the verified web flow initially |
| Allergies/disliked ingredients | Recipe safety and personalization | Existing Recipe Reborn account; never used to grant access | Editable on web until native profile editing is built |
| Barcode | Product lookup | Sent to Recipe Reborn server, then Open Food Facts | Scanning is user initiated |
| Fridge/pantry photos | Ingredient extraction | User-selected photos are sent over HTTPS to Recipe Reborn and its AI processor for one request; Recipe Reborn does not save the photos | User reviews/corrects the draft before saving the text inventory |
| Shopping lists | Offline shopping | Existing server data plus an on-device SQLite cache and queued check-offs | Signing in or out clears the prior local cache |
| Notification permission, reminder, optional device push token | User-requested reminders | Local reminders stay on device. If the user enables push after EAS setup, a device token is stored in Recipe Reborn Postgres | OS settings, sign out, and the protected token deletion endpoint |
| Diagnostics/analytics | Reliability | No mobile analytics or crash SDK has been added | Decide with consent/privacy review before beta |

Camera and notification permissions are requested in context, not at first launch. No microphone, contacts, precise location, advertising identifier, health API, or tracking permission is requested.
