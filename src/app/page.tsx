import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      
      {/* Hero Section */}
      <section
        className="flex-1 flex items-center justify-center py-20 px-4 pt-32"
        style={{
          background:
            "radial-gradient(ellipse at center top, #14AB42 0%, #12A844 20%, #077840 50%, #054E3A 100%)",
        }}
      >
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          {/* Logo */}
          <div className="flex flex-col items-center">
            <Image
              src="/logo.png"
              alt="Recipe Reborn Logo"
              width={500}
              height={500}
              className="w-72 h-auto md:w-96 lg:w-[480px] drop-shadow-2xl"
              priority
            />
          </div>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto font-light">
            Transform processed food ingredients into fresh, healthy recipes with
            the power of AI.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link href="/recipe-generator">
              <button className="bg-white text-emerald-700 hover:bg-emerald-50 font-bold text-lg px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all">
                Start Generating Recipes
              </button>
            </Link>
            <Link href="/features">
              <button className="border-2 border-white text-white hover:bg-white/10 font-semibold text-lg px-8 py-4 rounded-lg transition-all">
                Learn More
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
            Why Choose Recipe Reborn?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered</h3>
              <p className="text-gray-600">
                Our intelligent AI analyzes your ingredients and generates personalized, healthy recipes.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Health Focused</h3>
              <p className="text-gray-600">
                Transform processed ingredients into nutritious meals that support your wellness goals.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Save & Share</h3>
              <p className="text-gray-600">
                Save your favorite recipes and build your personal healthy recipe collection.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
