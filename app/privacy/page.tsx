import Link from 'next/link';
import Image from 'next/image';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-3 mb-6">
            <Image src="/logo-mark.png" alt="Recipe Reborn emblem" width={48} height={48} className="h-12 w-12 rounded-full shadow-md" />
            <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
          </div>
          <p className="text-emerald-50/90">Last updated: September 23, 2026</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              This Privacy Policy explains how Recipe Reborn (RecipeReborn) collects, uses, discloses, and protects information when you use our website and mobile apps.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">2.1 Personal Information</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Account information can include:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Email address</li>
              <li>Password, sent over HTTPS and stored as a password hash rather than readable text</li>
              <li>Name, if provided, and your account identifier</li>
              <li>Food allergies, dietary preferences, and disliked ingredients you choose to provide</li>
              <li>Existing subscription or trial status used to provide access to account features</li>
              <li>Account creation date</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.2 Usage Information</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We process information you submit and information needed to provide the features you use:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Recipes generated and saved</li>
              <li>Recipe ratings and personal notes</li>
              <li>Ingredient inputs and customization preferences</li>
              <li>Confirmed refrigerator and pantry inventory lists</li>
              <li>Package-label, recipe, fridge, and pantry photos you submit for AI analysis</li>
              <li>Optional microphone recordings you submit for transcription, and the text returned for you to review</li>
              <li>AI Chef questions and recent conversation context used to answer them</li>
              <li>Package nutrition facts and estimated recipe nutrition, including comparisons kept with recipes you save</li>
              <li>Recipe reports, including the selected concern, optional note, and reported recipe contents</li>
              <li>Search queries and filter selections</li>
              <li>Login times and session data</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.3 Technical Information</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>IP address</li>
              <li>Browser type and version</li>
              <li>Device information</li>
              <li>Operating system</li>
              <li>Referring/exit pages</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.4 Mobile Permissions and Device Storage</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Camera, photo selection, microphone, and notification features are optional. Microphone access is requested when you choose voice input. Recording occurs in the foreground, stops after one minute, and can be canceled. You can type instead. Photos and recordings that you submit leave your device and are processed through Recipe Reborn and Google Gemini to provide the requested feature.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              The mobile app uses the device&apos;s secure credential storage for sign-in tokens and a limited cached profile: account ID, name, email, allergies, and disliked ingredients. It also keeps shopping lists and pending item check-offs in a local device database so previously loaded lists can work offline. Sign-out clears these credentials, cached profile, and shopping cache.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              AI Chef keeps up to 40 messages per account in a local device database. Closing the chat does not erase this history; use Clear chat history to remove it. Recent messages are sent again when needed to answer your next question.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Local meal reminders stay on your device. If you enable push notifications, an app-specific push token, platform, and device label are sent to Recipe Reborn and the notification service to register your device. Notification delivery uses Expo and the platform notification provider. You can change notification permission in your device settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use the collected information for the following purposes:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Service Provision:</strong> To provide, maintain, and improve the RecipeReborn Service</li>
              <li><strong>Account Management:</strong> To create and manage your user account</li>
              <li><strong>Recipe Generation:</strong> To process your ingredient inputs and generate personalized recipes using AI</li>
              <li><strong>Photo and Voice Features:</strong> To read submitted food photos and transcribe recordings you choose to send</li>
              <li><strong>Cooking Assistance:</strong> To answer AI Chef questions and estimate nutrition from recipe ingredients, instructions, and serving counts</li>
              <li><strong>Personalization:</strong> To remember your preferences and provide customized experiences</li>
              <li><strong>Communication:</strong> To send you service-related notifications and updates</li>
              <li><strong>Security:</strong> To monitor and analyze usage to protect against unauthorized access</li>
              <li><strong>Improvement:</strong> To understand how users interact with the Service and make improvements</li>
              <li><strong>Content Safety:</strong> To review user reports about unsafe, offensive, or inaccurate AI-generated recipes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. How We Share Your Information</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Service Providers:</strong> With third-party vendors who perform services on our behalf (e.g., hosting, analytics, AI processing)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to respond to legal process</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong>Protection of Rights:</strong> To protect our rights, privacy, safety, or property</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Security</h2>
            <p className="text-gray-700 leading-relaxed">
              We use security measures to protect your personal information, including:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4 mt-4">
              <li>Hashed passwords and secure device storage for mobile sign-in credentials</li>
              <li>Secure HTTPS connections</li>
              <li>Access controls and authentication requirements</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              However, no method of transmission over the Internet is 100% secure. While we strive to protect your personal information, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Your Rights and Choices</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Access:</strong> Request access to the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
              <li><strong>Export:</strong> Request a copy of your data in a portable format</li>
              <li><strong>Opt-Out:</strong> Opt-out of promotional communications (service emails may still be sent)</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              To delete your account, open Account → Delete account in the mobile app, or follow our <Link href="/account-deletion" className="text-emerald-700 hover:underline">account deletion instructions</Link>. For other requests, contact <a href={SUPPORT_MAILTO} className="text-emerald-700 hover:underline">{SUPPORT_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Data Retention</h2>
            <p className="text-gray-700 leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide the Service. If you delete your account, we will delete or anonymize your personal information within a reasonable timeframe, except where we are required to retain it for legal or regulatory purposes.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              Recipe Reborn does not save submitted source photos or microphone recordings as account content. The mobile app attempts to remove temporary upload copies and recordings after processing or cancellation; photos in your photo library remain under your control. Extracted ingredients, reviewed pantry inventory, transcripts used in a saved recipe or chat, and saved nutrition comparisons can remain as part of those features. AI Chef conversation history is stored locally as described above. Provider processing and retention are separate from what Recipe Reborn saves in your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies and Tracking Technologies</h2>
            <p className="text-gray-700 leading-relaxed">
              We use cookies and similar tracking technologies to provide functionality and improve your experience. For detailed information, please see our <Link href="/cookies" className="text-emerald-600 hover:underline">Cookie Policy</Link>.
            </p>
            <p className="mt-3 text-gray-700 leading-relaxed">
              We count a small set of product steps, such as preview started, signup completed, preferences completed, and recipe generated. These funnel events store only the event name, page, acquisition source, and time; they do not include email, recipe contents, or raw IP addresses. Local storage remembers the time of your last visit so we can count a return after at least 24 hours.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Third-Party AI Services</h2>
            <p className="text-gray-700 leading-relaxed">
              Recipe Reborn currently uses Google Gemini for recipe generation, photo analysis, voice transcription, AI Chef answers, and nutrition estimates. We send the content needed for your request, which may include ingredients, photos, audio, recipe details, recent chat messages, and saved allergy or dietary preferences. Our AI requests do not deliberately include your account email or sign-in credentials.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              Google&apos;s processing is governed by the applicable <a href="https://ai.google.dev/gemini-api/terms" className="text-emerald-700 hover:underline">Gemini API terms</a>, including its data-use and security-related retention provisions. We do not promise that provider processing is memory-only or that every provider copy is deleted immediately after a response. Avoid including unrelated personal or confidential information in photos, recordings, or cooking questions.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              Product barcode lookups send the barcode to Open Food Facts through our server. A barcode lookup does not require uploading a photo of the barcode to that product-data service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Children's Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              Recipe Reborn is intended for adults aged 18 and over. We do not knowingly collect personal information from children. If you believe a child has provided personal information, contact us so we can investigate and take appropriate steps to remove it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Changes to This Privacy Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. Your continued use of the Service after changes constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions, concerns, or requests regarding this Privacy
              Policy or our privacy practices — including a request to access or delete
              your data — email us at{' '}
              <a href={SUPPORT_MAILTO} className="text-emerald-700 hover:underline">
                {SUPPORT_EMAIL}
              </a>
              . We aim to respond within 30 days.
            </p>
          </section>

          {/* Back to Home Button */}
          <div className="pt-8 border-t text-center">
            <Link href="/">
              <button className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                ← Back to Home
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
