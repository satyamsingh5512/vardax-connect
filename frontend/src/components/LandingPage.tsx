import { useState } from 'react';

interface LandingPageProps {
    onLaunch: () => void;
}

export function LandingPage({ onLaunch }: LandingPageProps) {
    const [isLaunching, setIsLaunching] = useState(false);

    const handleLaunch = () => {
        setIsLaunching(true);
        // Add a small delay for effect
        setTimeout(() => {
            onLaunch();
        }, 800);
    };

    return (
        <div className="landing-container">
            {/* Background/Overlay */}
            <div className="landing-bg">
                <div className="grid-overlay"></div>
                <div className="glow-orb top-right"></div>
                <div className="glow-orb bottom-left"></div>
            </div>

            <div className="landing-content">
                {/* Header */}
                <header className="landing-header">
                    <div className="brand">
                        <div className="logo-icon">
                            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
                                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                        <span className="brand-name">VARDAx <span className="brand-suffix">Sentinelas</span></span>
                    </div>
                    <nav className="landing-nav">
                        <a href="#features">Features</a>
                        <a href="#architecture">Architecture</a>
                        <a href="https://github.com/satyamsingh5512/vardax-connect" target="_blank" rel="noopener noreferrer">GitHub</a>
                    </nav>
                </header>

                {/* Hero Section */}
                <main className="hero-section">
                    <div className="hero-text-container">
                        <div className="hero-badge">Next-Gen WAF Technology</div>
                        <h1 className="hero-title">
                            Autonomous Cyber Defense, <br />
                            <span className="text-gradient">ML-Augmented.</span>
                        </h1>
                        <p className="hero-subtitle">
                            Sentinelas integrates advanced Machine Learning with Coraza WAF to detect and block
                            zero-day threats in real-time. Experience the future of indigenous security.
                        </p>

                        <div className="hero-actions">
                            <button
                                className={`btn-launch ${isLaunching ? 'launching' : ''}`}
                                onClick={handleLaunch}
                                disabled={isLaunching}
                            >
                                {isLaunching ? (
                                    <span className="flex items-center gap-2">
                                        <span className="spinner"></span> Initializing...
                                    </span>
                                ) : (
                                    <>
                                        Launch Dashboard <span className="arrow">→</span>
                                    </>
                                )}
                            </button>
                            <button className="btn-secondary">View Documentation</button>
                        </div>
                    </div>

                    <div className="hero-visual">
                        <div className="shield-container">
                            <div className="shield-glow"></div>
                            <svg className="shield-icon" viewBox="0 0 24 24" fill="none">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1" />
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="url(#shield-gradient)" fillOpacity="0.1" />
                                <defs>
                                    <linearGradient id="shield-gradient" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#3b82f6" />
                                        <stop offset="1" stopColor="#06b6d4" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            {/* Animated particles/nodes would go here */}
                            <div className="floating-node node-1"></div>
                            <div className="floating-node node-2"></div>
                            <div className="floating-node node-3"></div>
                        </div>
                    </div>
                </main>

                {/* Features Grid */}
                <section className="features-section" id="features">
                    <div className="feature-card">
                        <div className="feature-icon icon-brain">🧠</div>
                        <h3>ML-Augmented</h3>
                        <p>Autoencoder & XGBoost models analyze traffic patterns to detect anomalies that traditional rules miss.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon icon-bolt">⚡</div>
                        <h3>Real-time Analytics</h3>
                        <p>Instant visualization of threat landscape with WebSocket streaming and high-performance TimescaleDB storage.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon icon-search">🔍</div>
                        <h3>Explainable AI</h3>
                        <p>SHAP integration provides transparency into every blocking decision, reducing false positives.</p>
                    </div>
                </section>

                <footer className="landing-footer">
                    <p>© 2026 VARDAx Security. Built for Defense Hackathon.</p>
                </footer>
            </div>
        </div>
    );
}
