import HeroSection from "@/components/HeroSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      
      {/* Why Choose RecipeReborn Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
            Why Choose{" "}
            <span className="text-emerald-600">Recipe</span>
            <span className="text-yellow-500">Reborn</span>?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                AI-Powered Recipes
              </h3>
              <p className="text-gray-600">
                Our advanced AI analyzes processed ingredients and creates fresh, wholesome alternatives tailored to your needs.
              </p>
            </div>
            
            <div className="text-center p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-5xl mb-4">🥗</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                Diet Customization
              </h3>
              <p className="text-gray-600">
                Transform recipes to vegan, keto, gluten-free, paleo, or low-carb with one-click transformations.
              </p>
            </div>
            
            <div className="text-center p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-5xl mb-4">🌿</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                Fresh Ingredients
              </h3>
              <p className="text-gray-600">
                We use whole, unprocessed ingredients to help you cook healthier meals for you and your family.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
