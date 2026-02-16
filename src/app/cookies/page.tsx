import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Cookies() {
  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <div className="flex-1 pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-md p-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Cookie Policy
            </h1>
            <p className="text-gray-500 mb-8">Last updated: February 15, 2026</p>

            <div className="prose prose-gray max-w-none">
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">What Are Cookies?</h2>
                <p className="text-gray-600 mb-4">
                  Cookies are small text files that are stored on your device when you visit 
                  a website. They help the website remember your preferences and improve your 
                  browsing experience.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">How We Use Cookies</h2>
                <p className="text-gray-600 mb-4">
                  Recipe Reborn uses cookies for the following purposes:
                </p>
                
                <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">Essential Cookies</h3>
                <p className="text-gray-600 mb-4">
                  These cookies are necessary for the website to function properly. They enable 
                  core functionality such as security, authentication, and accessibility.
                </p>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mb-4">
                  <li>Authentication cookies to keep you logged in</li>
                  <li>Security cookies to protect against fraud</li>
                  <li>Session cookies for site functionality</li>
                </ul>

                <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">Performance Cookies</h3>
                <p className="text-gray-600 mb-4">
                  These cookies help us understand how visitors interact with our website, 
                  allowing us to improve performance and user experience.
                </p>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mb-4">
                  <li>Analytics cookies to track page views</li>
                  <li>Load balancing cookies for optimal performance</li>
                </ul>

                <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">Functionality Cookies</h3>
                <p className="text-gray-600 mb-4">
                  These cookies remember your preferences and choices to provide enhanced features.
                </p>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                  <li>Preference cookies for dietary settings</li>
                  <li>Language and region preferences</li>
                  <li>Recipe display preferences</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Third-Party Cookies</h2>
                <p className="text-gray-600 mb-4">
                  Some cookies are placed by third-party services that appear on our pages. 
                  We use these for analytics and to improve our service. These third parties 
                  have their own privacy policies.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Managing Cookies</h2>
                <p className="text-gray-600 mb-4">
                  You can control and manage cookies in several ways:
                </p>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                  <li>Browser settings: Most browsers allow you to view and delete cookies</li>
                  <li>Browser extensions: Privacy-focused extensions can block cookies</li>
                  <li>Our settings: Use our cookie preferences (when available)</li>
                </ul>
                <p className="text-gray-600 mt-4">
                  Note: Disabling certain cookies may affect the functionality of our Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Cookie Retention</h2>
                <p className="text-gray-600 mb-4">
                  Different cookies have different lifespans:
                </p>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                  <li>Session cookies: Deleted when you close your browser</li>
                  <li>Persistent cookies: Remain until they expire or you delete them</li>
                  <li>Authentication cookies: Valid for 7 days</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Us</h2>
                <p className="text-gray-600">
                  If you have questions about our use of cookies, please contact us at 
                  privacy@recipereborn.com.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
