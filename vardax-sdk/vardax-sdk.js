/**
 * VARDAx Protection SDK
 * 
 * Add this script to any website to protect it with VARDAx ML-powered WAF.
 * 
 * Usage:
 * <script src="https://your-cdn.com/vardax-sdk.js"></script>
 * <script>
 *   VARDAx.init({
 *     apiUrl: 'https://your-ngrok-url.ngrok.io',
 *     apiKey: 'your-api-key',
 *     mode: 'monitor' // or 'protect'
 *   });
 * </script>
 */

(function(window) {
    'use strict';

    const VARDAx = {
        config: {
            apiUrl: '',
            apiKey: '',
            mode: 'monitor', // 'monitor' or 'protect'
            debug: false,
            blockPage: null
        },

        /**
         * Initialize VARDAx protection
         */
        init: function(options) {
            this.config = { ...this.config, ...options };
            
            if (!this.config.apiUrl) {
                console.error('[VARDAx] API URL is required');
                return;
            }

            this.log('Initializing VARDAx Protection...');
            this.log('Mode:', this.config.mode);
            
            // Intercept fetch requests
            this.interceptFetch();
            
            // Intercept XMLHttpRequest
            this.interceptXHR();
            
            // Intercept form submissions
            this.interceptForms();
            
            // Monitor page navigation
            this.monitorNavigation();
            
            this.log('VARDAx Protection Active ✓');
        },

        /**
         * Log debug messages
         */
        log: function(...args) {
            if (this.config.debug) {
                console.log('[VARDAx]', ...args);
            }
        },

        /**
         * Generate request ID
         */
        generateRequestId: function() {
            return `sdk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        },

        /**
         * Extract request features
         */
        extractFeatures: function(url, method, body) {
            const urlObj = new URL(url, window.location.origin);
            
            return {
                request_id: this.generateRequestId(),
                timestamp: new Date().toISOString(),
                client_ip: 'browser', // Will be set by server
                method: method.toUpperCase(),
                uri: urlObj.pathname,
                query_string: urlObj.search.substring(1) || null,
                user_agent: navigator.userAgent,
                referer: document.referrer || null,
                origin: window.location.origin,
                has_cookie: document.cookie.length > 0,
                body_length: body ? body.length : 0,
                page_url: window.location.href
            };
        },

        /**
         * Send request to VARDAx for analysis
         */
        analyzeRequest: async function(features) {
            try {
                const response = await fetch(`${this.config.apiUrl}/api/v1/traffic/ingest`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-VARDAx-SDK': 'browser',
                        'X-API-Key': this.config.apiKey || ''
                    },
                    body: JSON.stringify(features)
                });

                if (!response.ok) {
                    this.log('VARDAx analysis failed:', response.status);
                    return { allowed: true, score: 0 }; // Fail open
                }

                const result = await response.json();
                this.log('Analysis result:', result);
                
                return {
                    allowed: true, // For now, always allow (monitoring mode)
                    score: result.anomaly_score || 0,
                    explanations: result.explanations || []
                };

            } catch (error) {
                this.log('Error analyzing request:', error);
                return { allowed: true, score: 0 }; // Fail open
            }
        },

        /**
         * Block request with custom page
         */
        blockRequest: function(reason, score) {
            if (this.config.blockPage) {
                window.location.href = this.config.blockPage;
            } else {
                document.body.innerHTML = `
                    <div style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        text-align: center;
                        padding: 20px;
                    ">
                        <div style="
                            background: white;
                            color: #333;
                            padding: 40px;
                            border-radius: 20px;
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                            max-width: 500px;
                        ">
                            <div style="font-size: 60px; margin-bottom: 20px;">🛡️</div>
                            <h1 style="margin: 0 0 10px 0; font-size: 28px;">Request Blocked</h1>
                            <p style="color: #666; margin: 0 0 20px 0;">
                                This request was blocked by VARDAx security protection.
                            </p>
                            <div style="
                                background: #f0f0f0;
                                padding: 15px;
                                border-radius: 10px;
                                margin-bottom: 20px;
                            ">
                                <div style="font-size: 14px; color: #999; margin-bottom: 5px;">
                                    Anomaly Score
                                </div>
                                <div style="font-size: 24px; font-weight: bold; color: #ef4444;">
                                    ${(score * 100).toFixed(0)}%
                                </div>
                            </div>
                            <p style="font-size: 14px; color: #999;">
                                Reason: ${reason}
                            </p>
                            <button onclick="window.history.back()" style="
                                background: #667eea;
                                color: white;
                                border: none;
                                padding: 12px 30px;
                                border-radius: 8px;
                                font-size: 16px;
                                cursor: pointer;
                                margin-top: 20px;
                            ">
                                Go Back
                            </button>
                        </div>
                    </div>
                `;
            }
        },

        /**
         * Intercept fetch API
         */
        interceptFetch: function() {
            const originalFetch = window.fetch;
            const self = this;

            window.fetch = async function(...args) {
                const [url, options = {}] = args;
                const method = options.method || 'GET';
                const body = options.body || null;

                // Extract features
                const features = self.extractFeatures(url, method, body);
                
                // Analyze with VARDAx (async, non-blocking)
                self.analyzeRequest(features).then(result => {
                    if (!result.allowed && self.config.mode === 'protect') {
                        self.blockRequest('Suspicious activity detected', result.score);
                    }
                });

                // Continue with original request
                return originalFetch.apply(this, args);
            };

            this.log('Fetch API intercepted');
        },

        /**
         * Intercept XMLHttpRequest
         */
        interceptXHR: function() {
            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSend = XMLHttpRequest.prototype.send;
            const self = this;

            XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                this._vardax_method = method;
                this._vardax_url = url;
                return originalOpen.apply(this, [method, url, ...rest]);
            };

            XMLHttpRequest.prototype.send = function(body) {
                if (this._vardax_url) {
                    const features = self.extractFeatures(
                        this._vardax_url,
                        this._vardax_method || 'GET',
                        body
                    );
                    
                    // Analyze with VARDAx
                    self.analyzeRequest(features);
                }
                
                return originalSend.apply(this, arguments);
            };

            this.log('XMLHttpRequest intercepted');
        },

        /**
         * Intercept form submissions
         */
        interceptForms: function() {
            const self = this;

            document.addEventListener('submit', function(e) {
                const form = e.target;
                const action = form.action || window.location.href;
                const method = form.method || 'GET';
                const formData = new FormData(form);
                const body = new URLSearchParams(formData).toString();

                const features = self.extractFeatures(action, method, body);
                
                // Analyze with VARDAx
                self.analyzeRequest(features).then(result => {
                    if (!result.allowed && self.config.mode === 'protect') {
                        e.preventDefault();
                        self.blockRequest('Form submission blocked', result.score);
                    }
                });
            }, true);

            this.log('Form submissions intercepted');
        },

        /**
         * Monitor page navigation
         */
        monitorNavigation: function() {
            const self = this;

            // Monitor initial page load
            window.addEventListener('load', function() {
                const features = self.extractFeatures(
                    window.location.href,
                    'GET',
                    null
                );
                self.analyzeRequest(features);
            });

            // Monitor history changes (SPA navigation)
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;

            history.pushState = function(...args) {
                originalPushState.apply(this, args);
                const features = self.extractFeatures(
                    window.location.href,
                    'GET',
                    null
                );
                self.analyzeRequest(features);
            };

            history.replaceState = function(...args) {
                originalReplaceState.apply(this, args);
                const features = self.extractFeatures(
                    window.location.href,
                    'GET',
                    null
                );
                self.analyzeRequest(features);
            };

            this.log('Navigation monitoring active');
        },

        /**
         * Get protection status
         */
        getStatus: function() {
            return {
                active: true,
                mode: this.config.mode,
                apiUrl: this.config.apiUrl
            };
        }
    };

    // Expose VARDAx globally
    window.VARDAx = VARDAx;

    // Auto-initialize if config is present
    if (window.VARDAx_CONFIG) {
        VARDAx.init(window.VARDAx_CONFIG);
    }

})(window);
