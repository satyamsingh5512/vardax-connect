import React, { useEffect, useState } from 'react';

interface Alert {
    alert_id: string;
    timestamp: number;
    request_id: string;
    source_ip: string;
    attack_type: string;
    severity: number;
    description: string;
    uri: string;
    shap_data?: ShapData;
}

interface ShapData {
    base_value: number;
    feature_names: string[];
    feature_values: number[];
    shap_values: number[];
    summary: string;
    top_features?: TopFeature[];
}

interface TopFeature {
    feature: string;
    description: string;
    shap_value: number;
    impact: string;
    magnitude: number;
}

interface ShapPlotProps {
    alert: Alert;
}

// Feature name to human-readable mapping
const FEATURE_LABELS: Record<string, string> = {
    header_entropy: 'Header Randomness',
    header_count: 'Header Count',
    cookie_count: 'Cookies',
    cookie_entropy: 'Cookie Randomness',
    uri_length: 'URL Length',
    query_param_count: 'Query Parameters',
    path_depth: 'URL Depth',
    path_entropy: 'Path Randomness',
    total_arg_length: 'Argument Size',
    max_arg_length: 'Max Arg Size',
    arg_entropy: 'Argument Randomness',
    special_char_count: 'Special Characters',
    has_sql_keywords: 'SQL Keywords',
    has_script_tags: 'Script Tags',
    has_path_traversal: 'Path Traversal',
    has_command_injection: 'Command Injection',
    request_rate: 'Request Rate',
    error_rate: 'Error Rate',
    unique_endpoints: 'Endpoint Diversity',
};

const ShapPlot: React.FC<ShapPlotProps> = ({ alert }) => {
    const [shapData, setShapData] = useState<ShapData | null>(null);
    const [loading, setLoading] = useState(true);

    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

    useEffect(() => {
        // If SHAP data is embedded in alert
        if (alert.shap_data) {
            setShapData(alert.shap_data);
            setLoading(false);
            return;
        }

        // Otherwise fetch from API
        const fetchShapData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_URL}/api/v1/alerts/${alert.alert_id}/shap`);
                if (res.ok) {
                    const data = await res.json();
                    setShapData(data);
                } else {
                    // Generate mock data for demo
                    setShapData(generateMockShapData(alert));
                }
            } catch (err) {
                console.error('Failed to fetch SHAP data:', err);
                setShapData(generateMockShapData(alert));
            } finally {
                setLoading(false);
            }
        };

        fetchShapData();
    }, [alert, API_URL]);

    // Generate mock SHAP data for demonstration
    const generateMockShapData = (alert: Alert): ShapData => {
        const featureNames = Object.keys(FEATURE_LABELS);
        const shapValues = featureNames.map((_, i) => {
            // Generate realistic-looking SHAP values based on attack type
            if (alert.attack_type.toLowerCase() === 'sqli') {
                if (i === 12) return 0.45;  // has_sql_keywords
                if (i === 11) return 0.25;  // special_char_count
            }
            if (alert.attack_type.toLowerCase() === 'xss') {
                if (i === 13) return 0.5;   // has_script_tags
                if (i === 10) return 0.2;   // arg_entropy
            }
            return (Math.random() - 0.5) * 0.1;
        });

        const topFeatures: TopFeature[] = featureNames
            .map((name, i) => ({
                feature: name,
                description: FEATURE_LABELS[name] || name,
                shap_value: shapValues[i],
                impact: shapValues[i] > 0 ? 'increases' : 'decreases',
                magnitude: Math.abs(shapValues[i]),
            }))
            .sort((a, b) => b.magnitude - a.magnitude)
            .slice(0, 5);

        return {
            base_value: 0.1,
            feature_names: featureNames,
            feature_values: featureNames.map(() => Math.random() * 2),
            shap_values: shapValues,
            summary: topFeatures
                .slice(0, 3)
                .map((f) => `${f.description} (${f.impact} risk)`)
                .join(', '),
            top_features: topFeatures,
        };
    };

    if (loading) {
        return (
            <div className="shap-container">
                <div className="placeholder">Loading explanation...</div>
            </div>
        );
    }

    if (!shapData) {
        return (
            <div className="shap-container">
                <div className="placeholder">No explanation available</div>
            </div>
        );
    }

    // Get top 5 features by absolute SHAP value
    const topFeatures =
        shapData.top_features ||
        shapData.feature_names
            .map((name, i) => ({
                feature: name,
                description: FEATURE_LABELS[name] || name,
                shap_value: shapData.shap_values[i],
                impact: shapData.shap_values[i] > 0 ? 'increases' : 'decreases',
                magnitude: Math.abs(shapData.shap_values[i]),
            }))
            .sort((a, b) => b.magnitude - a.magnitude)
            .slice(0, 5);

    const maxMagnitude = Math.max(...topFeatures.map((f) => f.magnitude));

    return (
        <div className="shap-container">
            <div className="shap-header">
                <h3>Why was this flagged?</h3>
                <div className="shap-summary">{shapData.summary}</div>
            </div>

            <div className="shap-features">
                {topFeatures.map((feature, index) => (
                    <div key={feature.feature} className="shap-feature">
                        <div className="feature-header">
                            <span className="feature-name">{feature.description}</span>
                            <span className="feature-value">
                                SHAP: {feature.shap_value >= 0 ? '+' : ''}
                                {feature.shap_value.toFixed(3)}
                            </span>
                        </div>
                        <div className="feature-bar-container">
                            <div
                                className={`feature-bar ${feature.shap_value >= 0 ? 'positive' : 'negative'}`}
                                style={{
                                    width: `${(feature.magnitude / maxMagnitude) * 100}%`,
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="shap-legend">
                <div className="legend-item">
                    <span className="legend-dot positive" />
                    <span>Increases risk</span>
                </div>
                <div className="legend-item">
                    <span className="legend-dot negative" />
                    <span>Decreases risk</span>
                </div>
            </div>
        </div>
    );
};

export default ShapPlot;
