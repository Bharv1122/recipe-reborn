import { Camera, ScanBarcode, Mic, Keyboard, Link as LinkIcon, AlertTriangle, Leaf, PiggyBank } from 'lucide-react';

// Animated "see it in action" demo — a phone frame looping the core story:
// scan a label → additives detected → fresh recipe + savings. Pure CSS, no
// video asset, so it loads instantly and loops forever.
export function LandingDemo() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <style>{`
        @keyframes rr-scene-1 { 0%, 30% { opacity: 1; } 36%, 94% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes rr-scene-2 { 0%, 30% { opacity: 0; } 36%, 63% { opacity: 1; } 69%, 100% { opacity: 0; } }
        @keyframes rr-scene-3 { 0%, 63% { opacity: 0; } 69%, 94% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes rr-scanline { 0%, 30% { transform: translateY(0); opacity: .9; } 15% { transform: translateY(150px); } 31%, 100% { opacity: 0; } }
      `}</style>
      <h2 className="text-3xl font-bold text-center text-white mb-4 drop-shadow-sm">
        See It in Action
      </h2>
      <p className="text-center text-emerald-50/90 mb-12 max-w-2xl mx-auto">
        From freezer aisle to fresh dinner in three steps.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Animated phone demo */}
        <div className="flex justify-center">
          <div className="relative w-[270px] h-[520px] rounded-[2.2rem] border-8 border-gray-900 bg-white shadow-2xl overflow-hidden">
            {/* notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-gray-900 rounded-b-xl z-20" />

            {/* Scene 1: scanning the label */}
            <div className="absolute inset-0 p-5 pt-10" style={{ animation: 'rr-scene-1 9s infinite' }}>
              <p className="text-xs font-semibold text-emerald-700 mb-2">📸 Scanning label…</p>
              <div className="rounded-lg border border-gray-300 bg-amber-50 p-3 relative overflow-hidden">
                <p className="text-[10px] font-bold text-gray-800 mb-1">INGREDIENTS:</p>
                <p className="text-[9px] leading-relaxed text-gray-700">
                  WATER, ENRICHED FLOUR, HIGH FRUCTOSE CORN SYRUP, PALM OIL, MODIFIED FOOD
                  STARCH, SODIUM NITRITE, MONOSODIUM GLUTAMATE, YELLOW 5, RED 40, BHT,
                  ARTIFICIAL FLAVOR, DISODIUM INOSINATE…
                </p>
                <div
                  className="absolute left-0 right-0 top-6 h-0.5 bg-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.9)]"
                  style={{ animation: 'rr-scanline 9s infinite' }}
                />
              </div>
              <div className="mt-4 flex justify-center">
                <div className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-medium text-emerald-700">
                  Reading the fine print for you…
                </div>
              </div>
            </div>

            {/* Scene 2: additives detected */}
            <div className="absolute inset-0 p-5 pt-10 opacity-0" style={{ animation: 'rr-scene-2 9s infinite' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                <p className="text-xs font-semibold text-red-600">Found in this product:</p>
              </div>
              <p className="text-3xl font-extrabold text-red-600 mb-3">7 additives</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {['Sodium nitrite', 'MSG', 'Red 40', 'Yellow 5', 'BHT', 'HFCS', 'Mod. starch'].map((a) => (
                  <span key={a} className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-medium">
                    {a}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <Leaf className="h-3.5 w-3.5 text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-700">Your fresh version:</p>
              </div>
              <p className="text-3xl font-extrabold text-emerald-600">0 additives</p>
              <p className="text-[11px] text-gray-500 mt-2">Building your homemade recipe…</p>
            </div>

            {/* Scene 3: the fresh recipe */}
            <div className="absolute inset-0 p-5 pt-10 opacity-0" style={{ animation: 'rr-scene-3 9s infinite' }}>
              <p className="text-sm font-bold text-gray-900 leading-snug mb-2">
                Creamy Homestyle Mac &amp; Cheese
              </p>
              <div className="rounded-lg bg-gradient-to-r from-emerald-50 to-orange-50 border border-emerald-200 p-2.5 mb-3 flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <p className="text-[10px] font-semibold text-emerald-700">
                  You save ~$3.40 per serving
                </p>
              </div>
              <ul className="space-y-1.5">
                {['8 oz elbow pasta', '2 cups sharp cheddar, grated', '1 cup whole milk', '2 tbsp butter', 'Pinch of paprika'].map((i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-700">
                    <span className="text-emerald-600">•</span>
                    {i}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg bg-emerald-600 py-2 text-center text-[11px] font-semibold text-white">
                Real food. Same comfort. ✨
              </div>
            </div>
          </div>
        </div>

        {/* Every way to start — mirrors the signed-in generator panel */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-sm">
            Start however you like
          </h3>
          <p className="text-emerald-50/90 mb-6">
            Five ways in — every one ends with a fresh, additive-free recipe.
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-lg">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Camera className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Snap the label</p>
                <p className="text-sm text-gray-600">Photograph any ingredient list — AI reads even the fine print</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-lg">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <ScanBarcode className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Scan the barcode</p>
                <p className="text-sm text-gray-600">Point your camera at the barcode for an instant ingredient lookup</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-lg">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Mic className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Just talk to it</p>
                <p className="text-sm text-gray-600">Chat by voice — tell it what you&apos;re craving or what&apos;s in your pantry</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-lg">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Keyboard className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Type it</p>
                <p className="text-sm text-gray-600">Paste an ingredient list, or list what&apos;s in your fridge</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-lg">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <LinkIcon className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Import a recipe URL</p>
                <p className="text-sm text-gray-600">Bring in any online recipe and make it fresher</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
