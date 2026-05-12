'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function SheetViewerPage() {
  const { id } = useParams();
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSheet() {
      try {
        const res = await fetch(`http://localhost:4000/api/templates/${id}`);
        if (!res.ok) throw new Error('Failed to fetch template');
        const json = await res.json();
        
        if (json.success) {
          setTemplate(json.data);
        } else {
          throw new Error(json.message);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchSheet();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-red-50 text-red-700 p-6 rounded-lg text-center">
          <p className="text-lg font-medium mb-4">Error loading prep sheet</p>
          <p className="text-sm opacity-80 mb-6">{error || 'Template not found'}</p>
          <Link href="/sheets/new" className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  const { template_data } = template;

  return (
    <div className="max-w-5xl mx-auto p-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <Link href="/sheets/new" className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-6 inline-flex items-center">
          ← Back to Generator
        </Link>
        
        <div className="flex flex-col md:flex-row md:justify-between md:items-end mt-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {template.company} • {template.role} 
            </h1>
            <p className="text-gray-500 mt-2 text-lg">
              {template.duration_days} Day Master Plan
            </p>
          </div>
          
          <div className="mt-4 md:mt-0 flex gap-4 text-sm">
             <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg font-medium">
               {template.total_weeks} Weeks
             </div>
             <div className="bg-green-50 text-green-800 px-4 py-2 rounded-lg font-medium">
               {template.total_questions} Questions
             </div>
          </div>
        </div>
      </div>

      {/* Week by Week Viewer */}
      <div className="space-y-6">
        {template_data.weeks?.map((week: any) => (
          <div key={week.week_number} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between sm:items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Week {week.week_number}: {week.theme}
                </h3>
                {week.notes && (
                  <p className="text-sm text-gray-600 mt-1">{week.notes}</p>
                )}
              </div>
              
              <div className="mt-4 sm:mt-0 flex items-center space-x-3 text-sm text-gray-500">
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {week.estimated_hours}h
                </span>
                <span className="flex items-center font-medium text-gray-900">
                  {week.total_questions} Qs
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                 <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Focus Areas</h4>
                 <div className="flex flex-wrap gap-2">
                   {week.focus_areas?.map((area: string, i: number) => (
                     <span key={i} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                       {area.replace('-', ' ').toUpperCase()}
                     </span>
                   ))}
                 </div>
              </div>

              {week.total_questions > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Question Breakdown</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* DSA Breakdown */}
                    <div className="bg-green-50 p-4 rounded-lg">
                       <p className="text-xs text-green-800 font-medium mb-1">Easy DSA</p>
                       <p className="text-2xl font-bold text-green-900">{week.breakdown.dsa?.easy || 0}</p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                       <p className="text-xs text-yellow-800 font-medium mb-1">Medium DSA</p>
                       <p className="text-2xl font-bold text-yellow-900">{week.breakdown.dsa?.medium || 0}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                       <p className="text-xs text-red-800 font-medium mb-1">Hard DSA</p>
                       <p className="text-2xl font-bold text-red-900">{week.breakdown.dsa?.hard || 0}</p>
                    </div>
                    {/* System Design / Behavioral */}
                    <div className="bg-purple-50 p-4 rounded-lg">
                       <p className="text-xs text-purple-800 font-medium mb-1">Sys Design & Behav.</p>
                       <p className="text-2xl font-bold text-purple-900">
                         {(week.breakdown.system_design || 0) + (week.breakdown.behavioral || 0)}
                       </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );
}
