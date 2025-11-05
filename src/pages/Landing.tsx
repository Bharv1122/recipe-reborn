import React, {useState} from 'react';

export default function Landing() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return setMsg('Enter an email');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({email})
      });
      const data = await res.json();
      if (res.ok) {
        setMsg('Thanks — you are on the waitlist!');
        setEmail('');
      } else {
        setMsg(data.error || 'Error');
      }
    } catch (err) {
      setMsg('Network error');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-yellow-50 p-6">
      <section className="max-w-3xl w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-2">Recipe Reborn</h1>
        <p className="mb-4">Scan. Plan. Cook. Subscribe for early access and Pro features.</p>

        <form onSubmit={submit} className="flex gap-2">
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            placeholder="you@domain.com"
            className="flex-1 p-2 border rounded"
          />
          <button className="px-4 py-2 bg-indigo-600 text-white rounded">Join Waitlist</button>
        </form>

        {msg && <p className="mt-3 text-sm">{msg}</p>}

        <div className="mt-6">
          <a className="text-sm underline" href="/Auth">Sign in</a> • <a className="text-sm underline" href="/MealPlanner">Meal Planner</a>
        </div>
      </section>
    </main>
  );
}
