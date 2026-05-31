'use client';

import { useState } from 'react';
import { ExternalLink, CheckCircle, Circle, Clock, Sparkles } from 'lucide-react';
import { updateProgress } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const AssistantDrawer = dynamic(() => import('./AssistantDrawer'), { ssr: false });

interface QuestionRowProps {
  question: any;
  weekNumber: number;
  sheetId: string;
  isPersonalized: boolean;
}

export function QuestionRow({ question, weekNumber, sheetId, isPersonalized }: QuestionRowProps) {
  const { getToken } = useAuth();
  const [status, setStatus] = useState(question.status || 'not_started');
  const [updating, setUpdating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleStatus = async () => {
    if (updating) return;
    const newStatus = status === 'completed' ? 'not_started' : 'completed';
    setStatus(newStatus);
    setUpdating(true);

    try {
      const token = await getToken();
      if (!token) return;
      const payload = {
        week_number: weekNumber,
        question_id: question.id,
        status: newStatus,
        ...(isPersonalized ? { sheet_id: sheetId } : { template_id: sheetId }),
      };
      await updateProgress(token, payload);
    } catch (error) {
      console.error(error);
      setStatus(status); // revert
    } finally {
      setUpdating(false);
    }
  };

  const isCompleted = status === 'completed';

  return (
    <>
      <div className={`group flex items-center justify-between p-4 border-b border-border/50 hover:bg-surface-elevated transition-colors ${isCompleted ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <button
            onClick={toggleStatus}
            disabled={updating}
            className="mt-1 flex-shrink-0 focus:outline-none"
          >
            {isCompleted ? (
              <CheckCircle className="h-5 w-5 text-success transition-transform group-hover:scale-110" />
            ) : (
              <Circle className="h-5 w-5 text-muted hover:text-primary transition-colors" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5">
              <Link
                href={`/problems/${question.id}`}
                className={`font-medium hover:text-primary-light transition-colors ${isCompleted ? 'line-through text-muted' : 'text-foreground'}`}
              >
                {question.title}
              </Link>
              <a
                href={`https://leetcode.com/problems/${question.slug}/`}
                target="_blank"
                rel="noreferrer"
                className="text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                title="Open on LeetCode"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                question.difficulty === 'Easy' ? 'badge-easy' :
                question.difficulty === 'Medium' ? 'badge-medium' : 'badge-hard'
              }`}>
                {question.difficulty}
              </span>
              {question.lc_status === 'ATTEMPTED' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  Attempted
                </span>
              )}
              {question.frequency ? (
                <span className="text-xs text-muted">Freq: {question.frequency}</span>
              ) : null}
              <div className="flex items-center gap-1 text-xs text-muted">
                <Clock className="h-3 w-3" />
                {question.difficulty === 'Easy' ? '20m' : question.difficulty === 'Medium' ? '45m' : '90m'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Topic tags */}
          <div className="hidden md:flex flex-wrap gap-1.5 max-w-[180px] justify-end">
            {question.topic_tags?.slice(0, 3).map((tag: string) => (
              <span key={tag} className="px-2 py-0.5 bg-surface text-muted text-[10px] rounded border border-border/50">
                {tag}
              </span>
            ))}
          </div>

          {/* AI Assistant button */}
          <button
            onClick={() => setDrawerOpen(true)}
            title="Open AI Assistant"
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
              border: '1px solid rgba(139,92,246,0.3)',
              color: '#a78bfa',
            }}
          >
            <Sparkles className="h-3 w-3" />
            AI
          </button>
        </div>
      </div>

      <AssistantDrawer
        problem={drawerOpen ? { id: question.id, title: question.title, difficulty: question.difficulty, topic_tags: question.topic_tags } : null}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
