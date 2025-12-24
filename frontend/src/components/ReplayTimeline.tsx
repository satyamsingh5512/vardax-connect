import { useState, useEffect, useRef } from 'react';
import { useDashboardStore } from '../store';
import { api } from '../api';
import clsx from 'clsx';
import { format } from 'date-fns';

interface ReplayEvent {
  event_id: string;
  timestamp: string;
  request: {
    client_ip: string;
    method: string;
    uri: string;
    user_agent: string;
  };
  features: {
    requests_per_minute: number;
    session_request_count: number;
  };
  result: {
    is_anomaly: boolean;
    severity: string;
    confidence: number;
    attack_category: string;
    top_explanation: string;
  };
}

export function ReplayTimeline() {
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<ReplayEvent | null>(null);
  const [filter, setFilter] = useState<'all' | 'anomalies'>('all');
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Load timeline data
  useEffect(() => {
    const loadTimeline = async () => {
      try {
        const data = await api.getReplayTimeline(60);
        setEvents(data);
      } catch (e) {
        // Use mock data for demo
        setEvents(generateMockEvents());
      }
    };
    loadTimeline();
  }, []);
  
  // Playback logic
  useEffect(() => {
    if (!isPlaying || playbackIndex >= events.length) {
      setIsPlaying(false);
      return;
    }
    
    const timer = setTimeout(() => {
      setPlaybackIndex(prev => prev + 1);
      setSelectedEvent(events[playbackIndex]);
    }, 500 / playbackSpeed);
    
    return () => clearTimeout(timer);
  }, [isPlaying, playbackIndex, playbackSpeed, events]);
  
  // Auto-scroll timeline
  useEffect(() => {
    if (timelineRef.current && isPlaying) {
      const progress = (playbackIndex / events.length) * 100;
      timelineRef.current.scrollLeft = 
        (timelineRef.current.scrollWidth * progress) / 100 - 200;
    }
  }, [playbackIndex, events.length, isPlaying]);
  
  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter(e => e.result.is_anomaly);
  
  const handlePlay = () => {
    if (playbackIndex >= events.length) {
      setPlaybackIndex(0);
    }
    setIsPlaying(true);
  };
  
  const handlePause = () => setIsPlaying(false);
  
  const handleReset = () => {
    setIsPlaying(false);
    setPlaybackIndex(0);
    setSelectedEvent(null);
  };
  
  const handleSeek = (index: number) => {
    setPlaybackIndex(index);
    setSelectedEvent(events[index]);
  };
  
  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white">Attack Replay Timeline</h2>
          <p className="text-sm text-vardax-muted">
            Forensic replay of traffic events for attack chain analysis
          </p>
        </div>
        
        {/* Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              'px-3 py-1 text-xs rounded-full border',
              filter === 'all'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                : 'bg-vardax-card text-vardax-muted border-vardax-border'
            )}
          >
            All Events ({events.length})
          </button>
          <button
            onClick={() => setFilter('anomalies')}
            className={clsx(
              'px-3 py-1 text-xs rounded-full border',
              filter === 'anomalies'
                ? 'bg-severity-high/20 text-severity-high border-severity-high/30'
                : 'bg-vardax-card text-vardax-muted border-vardax-border'
            )}
          >
            Anomalies Only ({events.filter(e => e.result.is_anomaly).length})
          </button>
        </div>
      </div>
      
      {/* Playback Controls */}
      <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
        <div className="flex items-center gap-4">
          {/* Play/Pause */}
          <div className="flex gap-2">
            {isPlaying ? (
              <button
                onClick={handlePause}
                className="w-10 h-10 bg-severity-medium rounded-full flex items-center justify-center hover:bg-severity-medium/80"
              >
                ⏸️
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="w-10 h-10 bg-severity-normal rounded-full flex items-center justify-center hover:bg-severity-normal/80"
              >
                ▶️
              </button>
            )}
            <button
              onClick={handleReset}
              className="w-10 h-10 bg-vardax-border rounded-full flex items-center justify-center hover:bg-vardax-muted/30"
            >
              ⏹️
            </button>
          </div>
          
          {/* Progress */}
          <div className="flex-1">
            <div className="flex justify-between text-xs text-vardax-muted mb-1">
              <span>Event {playbackIndex} of {events.length}</span>
              <span>{((playbackIndex / Math.max(events.length, 1)) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-vardax-border rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${(playbackIndex / Math.max(events.length, 1)) * 100}%` }}
              />
            </div>
          </div>
          
          {/* Speed Control */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-vardax-muted">Speed:</span>
            {[0.5, 1, 2, 4].map(speed => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={clsx(
                  'px-2 py-1 text-xs rounded',
                  playbackSpeed === speed
                    ? 'bg-blue-500 text-white'
                    : 'bg-vardax-border text-vardax-muted'
                )}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Timeline Visualization */}
      <div 
        ref={timelineRef}
        className="bg-vardax-card rounded-lg p-4 border border-vardax-border overflow-x-auto"
      >
        <div className="flex gap-1 min-w-max">
          {filteredEvents.map((event, index) => (
            <div
              key={event.event_id}
              onClick={() => handleSeek(index)}
              className={clsx(
                'w-3 h-12 rounded cursor-pointer transition-all',
                index === playbackIndex && 'ring-2 ring-white',
                event.result.is_anomaly
                  ? event.result.severity === 'critical' || event.result.severity === 'high'
                    ? 'bg-severity-high'
                    : 'bg-severity-medium'
                  : 'bg-severity-normal/50',
                index < playbackIndex && 'opacity-50'
              )}
              title={`${event.request.uri} - ${event.result.severity}`}
            />
          ))}
        </div>
        
        {/* Time markers */}
        <div className="flex justify-between mt-2 text-xs text-vardax-muted">
          {events.length > 0 && (
            <>
              <span>{format(new Date(events[0]?.timestamp), 'HH:mm:ss')}</span>
              <span>{format(new Date(events[Math.floor(events.length / 2)]?.timestamp), 'HH:mm:ss')}</span>
              <span>{format(new Date(events[events.length - 1]?.timestamp), 'HH:mm:ss')}</span>
            </>
          )}
        </div>
      </div>
      
      {/* Selected Event Detail */}
      {selectedEvent && (
        <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border animate-fade-in">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={clsx(
                  'px-2 py-0.5 text-xs rounded',
                  selectedEvent.result.is_anomaly
                    ? 'bg-severity-high/20 text-severity-high'
                    : 'bg-severity-normal/20 text-severity-normal'
                )}>
                  {selectedEvent.result.is_anomaly ? 'ANOMALY' : 'NORMAL'}
                </span>
                <span className="text-xs text-vardax-muted">
                  {format(new Date(selectedEvent.timestamp), 'HH:mm:ss.SSS')}
                </span>
              </div>
              <h3 className="font-medium text-white">
                {selectedEvent.request.method} {selectedEvent.request.uri}
              </h3>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {(selectedEvent.result.confidence * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-vardax-muted">confidence</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-vardax-muted">Client IP</span>
              <div className="font-mono text-vardax-text">{selectedEvent.request.client_ip}</div>
            </div>
            <div>
              <span className="text-vardax-muted">Category</span>
              <div className="text-vardax-text">
                {selectedEvent.result.attack_category?.replace('_', ' ') || 'N/A'}
              </div>
            </div>
            <div>
              <span className="text-vardax-muted">Requests/min</span>
              <div className="text-vardax-text">{selectedEvent.features.requests_per_minute}</div>
            </div>
          </div>
          
          {selectedEvent.result.top_explanation && (
            <div className="mt-4 p-3 bg-vardax-bg rounded border border-vardax-border">
              <span className="text-xs text-vardax-muted">Explanation:</span>
              <div className="text-sm text-vardax-text">{selectedEvent.result.top_explanation}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function generateMockEvents(): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  const now = Date.now();
  
  for (let i = 0; i < 100; i++) {
    const isAnomaly = Math.random() < 0.15;
    events.push({
      event_id: `evt-${i}`,
      timestamp: new Date(now - (100 - i) * 1000).toISOString(),
      request: {
        client_ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        method: ['GET', 'POST', 'PUT'][Math.floor(Math.random() * 3)],
        uri: ['/api/users', '/api/products', '/api/login', '/api/orders'][Math.floor(Math.random() * 4)],
        user_agent: 'Mozilla/5.0',
      },
      features: {
        requests_per_minute: Math.floor(Math.random() * 200),
        session_request_count: Math.floor(Math.random() * 50),
      },
      result: {
        is_anomaly: isAnomaly,
        severity: isAnomaly ? ['medium', 'high', 'critical'][Math.floor(Math.random() * 3)] : 'low',
        confidence: isAnomaly ? 0.6 + Math.random() * 0.4 : Math.random() * 0.3,
        attack_category: isAnomaly ? ['rate_abuse', 'bot_attack', 'credential_stuffing'][Math.floor(Math.random() * 3)] : '',
        top_explanation: isAnomaly ? 'Request rate 340% above baseline' : '',
      },
    });
  }
  
  return events;
}
