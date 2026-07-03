import Link from 'next/link';
import { ChefHat } from 'lucide-react';

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-orange-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-3 mb-6">
            <ChefHat className="h-12 w-12 text-emerald-600" />
            <h1 className="text-4xl font-bold text-gray-900">Cookie Policy</h1>
          </div>
          <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. What Are Cookies?</h2>
            <p className="text-gray-700 leading-relaxed">
              Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work more efficiently and provide information to website owners. Cookies help us remember your preferences, understand how you use our Service, and improve your experience.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. How We Use Cookies</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              RecipeReborn uses cookies and similar tracking technologies for the following purposes:
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">2.1 Essential Cookies</h3>
            <p className="text-gray-700 leading-relaxed mb-2">
              These cookies are necessary for the Service to function properly. They enable core functionality such as:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>User authentication and session management</li>
              <li>Security features and fraud prevention</li>
              <li>Load balancing and performance optimization</li>
              <li>Remembering your login state between visits</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3 font-medium text-emerald-600">
              These cookies cannot be disabled as they are essential for the Service to work.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.2 Functional Cookies</h3>
            <p className="text-gray-700 leading-relaxed mb-2">
              These cookies allow us to remember your preferences and provide enhanced features:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Remembering your dietary preference filters</li>
              <li>Saving your search queries and recent recipes</li>
              <li>Storing your UI preferences (theme, layout)</li>
              <li>Language and region preferences</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.3 Analytics Cookies</h3>
            <p className="text-gray-700 leading-relaxed mb-2">
              These cookies help us understand how users interact with the Service:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Measuring page views and user engagement</li>
              <li>Understanding which features are most popular</li>
              <li>Identifying technical issues and errors</li>
              <li>Analyzing usage patterns to improve the Service</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              We use anonymized data for analytics purposes and do not tie this information to your personal identity.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Types of Cookies We Use</h2>
            
            <div className="space-y-4">
              <div className="border-l-4 border-emerald-600 pl-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Session Cookies</h3>
                <p className="text-gray-700 leading-relaxed">
                  Temporary cookies that are deleted when you close your browser. Used for authentication and session management.
                </p>
              </div>

              <div className="border-l-4 border-orange-500 pl-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Persistent Cookies</h3>
                <p className="text-gray-700 leading-relaxed">
                  Cookies that remain on your device for a set period or until you delete them. Used to remember your preferences across sessions.
                </p>
              </div>

              <div className="border-l-4 border-emerald-600 pl-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">First-Party Cookies</h3>
                <p className="text-gray-700 leading-relaxed">
                  Cookies set by RecipeReborn directly. We have full control over how these cookies are used.
                </p>
              </div>

              <div className="border-l-4 border-orange-500 pl-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Third-Party Cookies</h3>
                <p className="text-gray-700 leading-relaxed">
                  Cookies set by third-party services we use (e.g., analytics providers, AI processing services). These are subject to the respective third-party privacy policies.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Third-Party Services</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use the following third-party services that may set cookies:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Authentication Services:</strong> For secure login and session management</li>
              <li><strong>AI Processing:</strong> For recipe generation functionality</li>
              <li><strong>Hosting and Infrastructure:</strong> For Service delivery and performance</li>
              <li><strong>Analytics:</strong> For understanding Service usage and improvements</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              These third-party services have their own privacy policies and cookie policies. We encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Managing Cookies</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You have several options to manage cookies:
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">5.1 Browser Settings</h3>
            <p className="text-gray-700 leading-relaxed mb-2">
              Most web browsers allow you to control cookies through their settings. You can:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>View and delete existing cookies</li>
              <li>Block third-party cookies</li>
              <li>Block all cookies from specific websites</li>
              <li>Delete all cookies when you close your browser</li>
              <li>Enable "Do Not Track" settings</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3 font-medium text-amber-600">
              Please note: Blocking essential cookies will prevent you from using certain features of the Service, including login and recipe saving functionality.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">5.2 Browser-Specific Instructions</h3>
            <p className="text-gray-700 leading-relaxed mb-2">
              For information on managing cookies in specific browsers, visit:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
              <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
              <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
              <li><strong>Edge:</strong> Settings → Cookies and site permissions</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">5.3 Mobile Devices</h3>
            <p className="text-gray-700 leading-relaxed">
              On mobile devices, you can manage cookies through your device settings or browser app settings. The exact method varies by device and browser.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Cookie Lifespan</h2>
            <p className="text-gray-700 leading-relaxed">
              The cookies we use have varying lifespans:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4 mt-4">
              <li><strong>Session cookies:</strong> Deleted when you close your browser</li>
              <li><strong>Authentication cookies:</strong> Typically 7-30 days, depending on your "remember me" preference</li>
              <li><strong>Preference cookies:</strong> 1-12 months</li>
              <li><strong>Analytics cookies:</strong> Typically 1-2 years</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Do Not Track Signals</h2>
            <p className="text-gray-700 leading-relaxed">
              Some browsers transmit "Do Not Track" (DNT) signals to websites. Currently, there is no industry standard for how to respond to DNT signals. We do not currently respond to DNT signals, but we respect your privacy choices as described in this policy and our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Updates to This Cookie Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in technology, legislation, or our Service. We will post any updates on this page and update the "Last updated" date. We encourage you to review this Cookie Policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about our use of cookies or this Cookie Policy, please contact us through our website or support channels. You can also refer to our <Link href="/privacy" className="text-emerald-600 hover:underline">Privacy Policy</Link> for more information about how we handle your data.
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
