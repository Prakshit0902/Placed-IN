import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-gray-50 p-6">
      <main className="max-w-3xl text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold text-blue-900 tracking-tight mb-6">
          Placement Prep Assistant
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 mb-10">
          Supercharge your interview prep. Get a tailored day-by-day prep sheet based on real data asked by top companies.
        </p>
        <Link 
          href="/sheets/new"
          className="px-8 py-4 bg-blue-600 text-white font-semibold text-lg hover:bg-blue-700 transition rounded-xl shadow-lg hover:shadow-xl inline-block"
        >
          Create My Study Plan
        </Link>
      </main>
    </div>
  );
}
