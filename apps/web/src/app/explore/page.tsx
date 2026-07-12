'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';

export default function ExplorePage() {
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const router = useRouter();

  const handleExplore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setStatus('Initializing exploration...');

    try {
      // 1. Dispatch Explore Job
      const res = await fetch(`${API_BASE_URL}/api/visualization/explore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...(branch ? { branch } : {}) }),
      });
      const data = await res.json();
      const jobId = data.jobId;

      // 2. Poll for status
      const pollInterval = setInterval(async () => {
        const statusRes = await fetch(`${API_BASE_URL}/api/visualization/explore/${jobId}/status`);
        const statusData = await statusRes.json();

        if (statusData.status === 'completed' && statusData.repositoryId) {
          clearInterval(pollInterval);
          setStatus('Graph ready! Redirecting...');
          router.push(`/canvas/${statusData.repositoryId}`);
        } else if (statusData.status === 'failed') {
          clearInterval(pollInterval);
          setStatus('Exploration failed. Please check the URL.');
          setIsLoading(false);
        } else {
          const rawProgress = statusData.progress;
          let progressText = '0.00%';
          let stageText = 'Processing...';

          if (typeof rawProgress === 'object' && rawProgress !== null) {
            stageText = rawProgress.stage
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (l: string) => l.toUpperCase());
            progressText = `${Number(rawProgress.percent || 0).toFixed(2)}%`;
          } else if (rawProgress !== undefined) {
            progressText = `${Number(rawProgress || 0).toFixed(2)}%`;
          }

          setStatus(`Status: ${statusData.status} | ${stageText} (${progressText})`);
        }
      }, 10000);
    } catch (err) {
      console.error(err);
      setStatus('An error occurred.');
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          width: '100%',
          maxWidth: '500px',
        }}
      >
        <h1 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '24px' }}>
          Explore Public Repository
        </h1>
        <p style={{ margin: '0 0 24px 0', color: '#64748b' }}>
          Enter a public GitHub URL to map its architecture instantly.
        </p>

        <form
          onSubmit={handleExplore}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/facebook/react"
            required
            disabled={isLoading}
            style={{
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '16px',
            }}
          />

          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="Branch (optional, e.g. main, dev)"
            disabled={isLoading}
            style={{
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              color: '#64748b',
            }}
          />

          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '12px',
              background: isLoading ? '#94a3b8' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
            }}
          >
            {isLoading ? 'Processing...' : 'Visualize Architecture'}
          </button>
        </form>

        {status && (
          <div
            style={{
              marginTop: '20px',
              padding: '12px',
              background: '#f1f5f9',
              borderRadius: '6px',
              color: '#475569',
              fontSize: '14px',
              textAlign: 'center',
            }}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
