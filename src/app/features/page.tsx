import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function Features() {
  const features = [
    {
      title: "AI-Powered Recipe Generation",
      description: "Our advanced AI analyzes your ingredients and dietary preferences to create unique, delicious recipes tailored just for you.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      color: "emerald"
    },
    {
      title: "Dietary Preference Support",
      description: "Whether you're vegan, keto, gluten-free, or have specific dietary requirements, our AI adapts recipes to meet your needs.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "blue"
    },
    {
      title: "Nutritional Information",
      description: "Get detailed nutritional breakdowns for every recipe, including calories, protein, carbs, and fat content.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: "purple"
    },
    {
      title: "Recipe Collections",
      description: "Save your favorite recipes and build a personal cookbook. Access your saved recipes anytime, anywhere.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
      color: "amber"
    },
    {
      title: "Multiple Cuisine Types",
      description: "From Italian to Asian, Mediterranean to Mexican—explore recipes from cuisines around the world.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "rose"
    },
    {
      title: "Transform Processed Foods",
      description: "Turn everyday processed ingredients into healthier meals. Our AI finds ways to balance and enhance nutritional value.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      color: "teal"
    }
  ];

  const colorClasses: Record<string, { bg: string; text: string; lightBg: string }> = {
    emerald: { bg: "bg-emerald-600", text: "text-emerald-600", lightBg: "bg-emerald-100" },
    blue: { bg: "bg-blue-600", text: "text-blue-600", lightBg: "bg-blue-100" },
    purple: { bg: "bg-purple-600", text: "text-purple-600", lightBg: "bg-purple-100" },
    amber: { bg: "bg-amber-600", text: "text-amber-600", lightBg: "bg-amber-100" },
    rose: { bg: "bg-rose-600", text: "text-rose-600", lightBg: "bg-rose-100" },
    teal: { bg: "bg-teal-600", text: "text-teal-600", lightBg: "bg-teal-100" }
  };

  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <div className="flex-1 pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Powerful Features
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to transform your cooking experience and eat healthier.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {features.map((feature, index) => {
              const colors = colorClasses[feature.color];
              return (
                <div key={index} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className={`w-14 h-14 ${colors.lightBg} rounded-lg flex items-center justify-center mb-4`}>
                    <div className={colors.text}>{feature.icon}</div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="bg-emerald-600 rounded-xl shadow-lg p-8 text-center text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Ready to Transform Your Cooking?
            </h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto">
              Join thousands of users who are already creating healthier meals with Recipe Reborn.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <button className="bg-white text-emerald-700 hover:bg-emerald-50 font-bold px-8 py-3 rounded-lg transition-colors">
                  Get Started Free
                </button>
              </Link>
              <Link href="/recipe-generator">
                <button className="border-2 border-white text-white hover:bg-white/10 font-semibold px-8 py-3 rounded-lg transition-colors">
                  Try Recipe Generator
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
