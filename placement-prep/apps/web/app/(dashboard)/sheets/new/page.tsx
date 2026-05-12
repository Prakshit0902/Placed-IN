'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Template = {
  template_id: string;
  company: string;
  role: string;
  duration_days: number;
  total_weeks: number;
  total_questions: number;
  updated_at: string;
};

export default function NewSheetPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dropdown states
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('');

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('http://localhost:4000/api/templates');
        if (!res.ok) throw new Error('Failed to fetch templates');
        const json = await res.json();
        if (json.success) {
          setTemplates(json.data);
        } else {
          throw new Error(json.message || 'Error loading templates');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  // Filter uniquely
  const companies = Array.from(new Set(templates.map((t) => t.company)));
  const roles = Array.from(new Set(templates.map((t) => t.role)));
  const durations = Array.from(new Set(templates.map((t) => t.duration_days)));

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !selectedRole || !selectedDuration) return;

    // Find the matching template (Phase 1: Just routing to already generated ones)
    const template = templates.find(
      (t) =>
        t.company === selectedCompany &&
        t.role === selectedRole &&
        t.duration_days.toString() === selectedDuration
    );

    if (template) {
      window.location.href = `/sheets/${template.template_id}`;
    } else {
      alert('No template found for this exact combination yet!');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Placement Prep Assistant</h1>
        <p className="mt-2 text-gray-600">Phase 1 MVP: Select your target company and timeline to get a structured prep sheet.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 mb-10">
        <h2 className="text-xl font-semibold mb-6">Generate New Study Plan</h2>
        
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-full"></div>
            <div className="h-10 bg-gray-200 rounded w-full"></div>
            <div className="h-10 bg-gray-200 rounded w-1/2"></div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-md">Error: {error}</div>
        ) : templates.length === 0 ? (
          <div className="p-4 bg-yellow-50 text-yellow-700 rounded-md">
            No templates found. Please run the Python generator pipeline first.
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2.5 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Company...</option>
                  {companies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2.5 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Role...</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (Days)</label>
                <select
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2.5 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Timeline...</option>
                  {durations.map((d) => (
                    <option key={d} value={d}>{d} Days</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition-colors"
            >
              Generate Sheet
            </button>
          </form>
        )}
      </div>

      {templates.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-6">Available Templates (From DB)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Link 
                href={`/sheets/${template.template_id}`} 
                key={template.template_id}
                className="block bg-white p-6 border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                    {template.company}
                  </h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {template.duration_days} Days
                  </span>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>Role: <span className="font-medium text-gray-900">{template.role}</span></p>
                  <p>Weeks: <span className="font-medium text-gray-900">{template.total_weeks}</span></p>
                  <p>Questions: <span className="font-medium text-gray-900">{template.total_questions}</span></p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
