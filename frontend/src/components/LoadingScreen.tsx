import { useEffect, useState } from 'react';
import './LoadingScreen.css';

interface LoadingScreenProps {
  onLoadComplete?: () => void;
}

export function LoadingScreen({ onLoadComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing Security Systems');

  useEffect(() => {
    const stages = [
      { progress: 20, text: 'Loading ML Models' },
      { progress: 40, text: 'Establishing Secure Connection' },
      { progress: 60, text: 'Analyzing Threat Intelligence' },
      { progress: 80, text: 'Calibrating Detection Algorithms' },
      { progress: 100, text: 'System Ready' },
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      if (currentStage < stages.length) {
        setProgress(stages[currentStage].progress);
        setLoadingText(stages[currentStage].text);
        currentStage++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          onLoadComplete?.();
        }, 500);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [onLoadComplete]);

  return (
    <div className="loading-screen">
      {/* Animated background grid */}
      <div className="grid-background" />
      
      {/* Particle effects */}
      <div className="particles">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="loading-content">
        {/* Logo container with glow effect */}
        <div className="logo-container">
          <div className="logo-glow" />
          <div className="shield-container">
            {/* Shield outline with animation */}
            <svg className="shield-svg" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">
              {/* Outer shield glow */}
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#60a5fa', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#1e40af', stopOpacity: 1 }} />
                </linearGradient>
                <linearGradient id="xGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#93c5fd', stopOpacity: 1 }} />
                  <stop offset="50%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#93c5fd', stopOpacity: 1 }} />
                </linearGradient>
              </defs>

              {/* Shield path */}
              <path
                className="shield-path"
                d="M100 20 L170 40 L170 100 Q170 150 100 200 Q30 150 30 100 L30 40 Z"
                fill="url(#shieldGradient)"
                stroke="#60a5fa"
                strokeWidth="3"
                filter="url(#glow)"
              />

              {/* Inner shield detail */}
              <path
                className="shield-inner"
                d="M100 30 L160 48 L160 100 Q160 145 100 190 Q40 145 40 100 L40 48 Z"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1"
                opacity="0.5"
              />

              {/* X symbol */}
              <g className="x-symbol" transform="translate(100, 110)">
                <rect
                  x="-40"
                  y="-8"
                  width="80"
                  height="16"
                  rx="4"
                  transform="rotate(-45)"
                  fill="url(#xGradient)"
                  filter="url(#glow)"
                />
                <rect
                  x="-40"
                  y="-8"
                  width="80"
                  height="16"
                  rx="4"
                  transform="rotate(45)"
                  fill="url(#xGradient)"
                  filter="url(#glow)"
                />
              </g>

              {/* Top crown */}
              <path
                className="crown"
                d="M100 20 L90 10 L100 0 L110 10 Z"
                fill="#ffffff"
                filter="url(#glow)"
              />

              {/* Scanning line effect */}
              <line
                className="scan-line"
                x1="30"
                y1="50"
                x2="170"
                y2="50"
                stroke="#60a5fa"
                strokeWidth="2"
                opacity="0.6"
              />
            </svg>

            {/* Rotating rings */}
            <div className="ring ring-1" />
            <div className="ring ring-2" />
            <div className="ring ring-3" />
          </div>
        </div>

        {/* Brand name with glitch effect */}
        <div className="brand-container">
          <h1 className="brand-name" data-text="VARDAx">
            VARDAx
          </h1>
          <p className="brand-tagline">ML-Powered WAF Protection</p>
        </div>

        {/* Loading progress */}
        <div className="loading-progress">
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}>
              <div className="progress-glow" />
            </div>
            <div className="progress-segments">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="segment" />
              ))}
            </div>
          </div>
          
          <div className="loading-info">
            <span className="loading-text">{loadingText}</span>
            <span className="loading-percentage">{progress}%</span>
          </div>
        </div>

        {/* Status indicators */}
        <div className="status-indicators">
          <div className={`status-item ${progress >= 20 ? 'active' : ''}`}>
            <div className="status-dot" />
            <span>ML Engine</span>
          </div>
          <div className={`status-item ${progress >= 40 ? 'active' : ''}`}>
            <div className="status-dot" />
            <span>Network</span>
          </div>
          <div className={`status-item ${progress >= 60 ? 'active' : ''}`}>
            <div className="status-dot" />
            <span>Threat Intel</span>
          </div>
          <div className={`status-item ${progress >= 80 ? 'active' : ''}`}>
            <div className="status-dot" />
            <span>Detection</span>
          </div>
        </div>
      </div>

      {/* Corner decorations */}
      <div className="corner-decoration top-left" />
      <div className="corner-decoration top-right" />
      <div className="corner-decoration bottom-left" />
      <div className="corner-decoration bottom-right" />
    </div>
  );
}
