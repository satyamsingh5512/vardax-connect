import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onLoadComplete?: () => void;
}

const LOADING_STAGES = [
  { progress: 15, text: 'Initializing Core Systems' },
  { progress: 30, text: 'Loading ML Detection Models' },
  { progress: 50, text: 'Establishing Secure Connection' },
  { progress: 70, text: 'Calibrating Threat Analysis' },
  { progress: 85, text: 'Syncing Rule Engine' },
  { progress: 100, text: 'System Ready' },
];

export function LoadingScreen({ onLoadComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing...');

  useEffect(() => {
    let currentStage = 0;
    
    const interval = setInterval(() => {
      if (currentStage < LOADING_STAGES.length - 1) {
        currentStage++;
        setProgress(LOADING_STAGES[currentStage].progress);
        setStatusText(LOADING_STAGES[currentStage].text);
      } else {
        clearInterval(interval);
        setTimeout(() => onLoadComplete?.(), 400);
      }
    }, 600);

    // Initial state
    setProgress(LOADING_STAGES[0].progress);
    setStatusText(LOADING_STAGES[0].text);

    return () => clearInterval(interval);
  }, [onLoadComplete]);

  return (
    <div className="vardax-loading">
      {/* Background effects */}
      <div className="hex-grid" />
      <div className="scan-lines" />
      <div className="scan-beam" />

      {/* Main content */}
      <div className="loading-main">
        {/* Shield Logo */}
        <div className="shield-logo">
          <div className="shield-pulse" />
          <div className="shield-pulse" />
          <div className="shield-pulse" />
          <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent-cyan)" />
                <stop offset="50%" stopColor="var(--accent-blue)" />
                <stop offset="100%" stopColor="var(--accent-purple)" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Shield outline */}
            <path
              d="M50 8L88 22V52C88 78 68 98 50 112C32 98 12 78 12 52V22L50 8Z"
              fill="url(#shieldGrad)"
              fillOpacity="0.15"
              stroke="url(#shieldGrad)"
              strokeWidth="2"
              filter="url(#glow)"
            />
            {/* Inner shield */}
            <path
              d="M50 18L78 28V52C78 72 62 88 50 98C38 88 22 72 22 52V28L50 18Z"
              fill="none"
              stroke="var(--accent-blue)"
              strokeWidth="1"
              strokeOpacity="0.5"
            />
            {/* V symbol */}
            <path
              d="M35 45L50 75L65 45"
              fill="none"
              stroke="url(#shieldGrad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow)"
            />
            {/* Checkmark accent */}
            <path
              d="M42 58L48 64L58 50"
              fill="none"
              stroke="var(--accent-green)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={progress >= 100 ? 1 : 0}
              style={{ transition: 'opacity 0.3s ease' }}
            />
          </svg>
        </div>

        {/* Brand */}
        <div className="loading-brand">
          <h1>VARDAx</h1>
          <p>ML-Powered WAF Protection</p>
        </div>

        {/* Progress */}
        <div className="loading-progress-section">
          <div className="loading-progress-bar">
            <div 
              className="loading-progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="loading-status">
            <span className="loading-status-text">{statusText}</span>
            <span className="loading-status-percent">{progress}%</span>
          </div>
        </div>

        {/* System checks */}
        <div className="system-checks">
          <div className={`system-check ${progress >= 30 ? 'active' : ''}`}>
            <span className="system-check-dot" />
            <span>ML Engine</span>
          </div>
          <div className={`system-check ${progress >= 50 ? 'active' : ''}`}>
            <span className="system-check-dot" />
            <span>Network</span>
          </div>
          <div className={`system-check ${progress >= 70 ? 'active' : ''}`}>
            <span className="system-check-dot" />
            <span>Threat Intel</span>
          </div>
          <div className={`system-check ${progress >= 85 ? 'active' : ''}`}>
            <span className="system-check-dot" />
            <span>Rules</span>
          </div>
        </div>
      </div>

      {/* Corner brackets */}
      <div className="corner-bracket top-left" />
      <div className="corner-bracket top-right" />
      <div className="corner-bracket bottom-left" />
      <div className="corner-bracket bottom-right" />

      {/* Version */}
      <div className="version-tag">v1.0.0</div>
    </div>
  );
}
