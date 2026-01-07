import React from 'react';

interface Alert {
    alert_id: string;
    timestamp: number;
    request_id: string;
    source_ip: string;
    attack_type: string;
    severity: number;
    description: string;
    uri: string;
}

interface AlertStreamProps {
    alerts: Alert[];
    onSelectAlert: (alert: Alert) => void;
    selectedAlertId?: string;
}

const AlertStream: React.FC<AlertStreamProps> = ({ alerts, onSelectAlert, selectedAlertId }) => {
    const formatTime = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const getSeverityClass = (severity: number): string => {
        if (severity >= 0.8) return 'severity-high';
        if (severity >= 0.5) return 'severity-medium';
        return 'severity-low';
    };

    const getAttackTypeClass = (type: string): string => {
        const typeMap: Record<string, string> = {
            sqli: 'sqli',
            xss: 'xss',
            lfi: 'lfi',
            rce: 'rce',
        };
        return typeMap[type.toLowerCase()] || 'default';
    };

    return (
        <div className="alert-stream">
            {alerts.length === 0 ? (
                <div className="placeholder">
                    <p>No alerts yet. Watching for threats...</p>
                </div>
            ) : (
                alerts.map((alert) => (
                    <div
                        key={alert.alert_id}
                        className={`alert-item ${selectedAlertId === alert.alert_id ? 'selected' : ''}`}
                        onClick={() => onSelectAlert(alert)}
                    >
                        <div className="alert-header">
                            <span className={`attack-type ${getAttackTypeClass(alert.attack_type)}`}>
                                {alert.attack_type}
                            </span>
                            <span className={`severity-badge ${getSeverityClass(alert.severity)}`}>
                                {(alert.severity * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className="alert-body">
                            <div>
                                <span className="source-ip">{alert.source_ip}</span>
                            </div>
                            <div className="uri">{alert.uri}</div>
                        </div>
                        <div className="alert-time">{formatTime(alert.timestamp)}</div>
                    </div>
                ))
            )}
        </div>
    );
};

export default AlertStream;
