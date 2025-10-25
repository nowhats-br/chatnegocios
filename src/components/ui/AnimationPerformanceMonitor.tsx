import { useState, useEffect } from 'react';
import { useAnimationPerformance } from '../../hooks/useAnimationPerformance';
import { cn } from '../../lib/utils';

interface AnimationPerformanceMonitorProps {
  className?: string;
  showMetrics?: boolean;
  threshold?: number;
  onPerformanceIssue?: (metrics: any) => void;
  trackGlobalPerformance?: boolean;
  showReducedMotionStatus?: boolean;
}

/**
 * Component for monitoring and displaying animation performance metrics
 * Useful for development and debugging performance issues
 */
export function AnimationPerformanceMonitor({
  className,
  showMetrics = false,
  threshold = 30,
  onPerformanceIssue,
  trackGlobalPerformance = false,
  showReducedMotionStatus = true
}: AnimationPerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [performanceIssues, setPerformanceIssues] = useState<string[]>([]);
  const [reducedMotionEnabled, setReducedMotionEnabled] = useState(false);
  const [globalPerformance, setGlobalPerformance] = useState<any>(null);

  const { getMetrics, isMonitoring } = useAnimationPerformance({
    threshold,
    onPerformanceWarning: (metrics) => {
      setPerformanceIssues(prev => [
        ...prev.slice(-4), // Keep only last 5 issues
        `Low FPS detected: ${metrics.frameRate.toFixed(1)} fps at ${new Date().toLocaleTimeString()}`
      ]);
      onPerformanceIssue?.(metrics);
    },
    enabled: true
  });

  // Monitor reduced motion preference changes
  useEffect(() => {
    if (!showReducedMotionStatus) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotionEnabled(event.matches);
    };
    
    // Set initial state
    setReducedMotionEnabled(mediaQuery.matches);
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [showReducedMotionStatus]);

  // Global performance tracking
  useEffect(() => {
    if (!trackGlobalPerformance) return;

    let frameCount = 0;
    let startTime = performance.now();
    let animationId: number;
    
    const trackFrame = () => {
      frameCount++;
      animationId = requestAnimationFrame(trackFrame);
    };
    
    trackFrame();

    const interval = setInterval(() => {
      const duration = performance.now() - startTime;
      const fps = (frameCount / duration) * 1000;
      
      setGlobalPerformance({
        fps: Math.round(fps * 100) / 100,
        performanceGrade: fps >= 50 ? 'excellent' : fps >= 30 ? 'good' : fps >= 20 ? 'fair' : 'poor'
      });
      
      // Reset counters
      frameCount = 0;
      startTime = performance.now();
    }, 2000); // Update every 2 seconds

    return () => {
      clearInterval(interval);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [trackGlobalPerformance]);

  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      const currentMetrics = getMetrics();
      setMetrics(currentMetrics);
    }, 1000);

    return () => clearInterval(interval);
  }, [isMonitoring, getMetrics]);

  if (!showMetrics && performanceIssues.length === 0 && !showReducedMotionStatus) {
    return null;
  }

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 max-w-sm",
      "bg-card border border-border rounded-lg shadow-lg",
      "p-4 space-y-3",
      className
    )}>
      {showReducedMotionStatus && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="typography-body-sm font-medium text-foreground">
              Motion Preferences
            </h4>
            <span className={cn(
              "text-xs px-2 py-1 rounded-full font-medium",
              reducedMotionEnabled 
                ? "bg-warning/10 text-warning border border-warning/20" 
                : "bg-success/10 text-success border border-success/20"
            )}>
              {reducedMotionEnabled ? "Reduced" : "Normal"}
            </span>
          </div>
          {reducedMotionEnabled && (
            <p className="text-xs text-muted-foreground">
              Animations are disabled per user preference
            </p>
          )}
        </div>
      )}

      {showMetrics && metrics && (
        <div className="space-y-2">
          <h3 className="typography-h6 text-foreground">Animation Performance</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">FPS:</span>
                <span className={cn(
                  "font-medium",
                  metrics.frameRate >= 50 ? "text-success" :
                  metrics.frameRate >= 30 ? "text-warning" : "text-error"
                )}>
                  {metrics.frameRate.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dropped:</span>
                <span className={cn(
                  "font-medium",
                  metrics.droppedFrames === 0 ? "text-success" :
                  metrics.droppedFrames <= 3 ? "text-warning" : "text-error"
                )}>
                  {metrics.droppedFrames}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Frame:</span>
                <span className="font-medium text-foreground">
                  {metrics.averageFrameTime.toFixed(1)}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={cn(
                  "font-medium",
                  metrics.isPerformant ? "text-success" : "text-error"
                )}>
                  {metrics.isPerformant ? "Good" : "Poor"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {trackGlobalPerformance && globalPerformance && (
        <div className="space-y-2">
          <h4 className="typography-body-sm font-medium text-foreground">
            Global Performance
          </h4>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Grade:</span>
              <span className={cn(
                "font-medium capitalize",
                globalPerformance.performanceGrade === 'excellent' ? "text-success" :
                globalPerformance.performanceGrade === 'good' ? "text-success" :
                globalPerformance.performanceGrade === 'fair' ? "text-warning" : "text-error"
              )}>
                {globalPerformance.performanceGrade}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg FPS:</span>
              <span className="font-medium text-foreground">
                {globalPerformance.fps.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}

      {performanceIssues.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="typography-body-sm font-medium text-warning">
              Performance Issues
            </h4>
            <button
              onClick={() => setPerformanceIssues([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {performanceIssues.map((issue, index) => (
              <div
                key={index}
                className="text-xs text-muted-foreground bg-warning/10 rounded px-2 py-1"
              >
                {issue}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Development-only performance monitor that only shows in development mode
 */
export function DevAnimationPerformanceMonitor(props: AnimationPerformanceMonitorProps) {
  // Check if we're in development mode
  const isDevelopment = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname.includes('dev'));

  if (!isDevelopment) {
    return null;
  }

  return <AnimationPerformanceMonitor {...props} />;
}