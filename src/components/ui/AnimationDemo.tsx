import { useState, useRef, useEffect } from 'react';
import { useAnimationOptimization } from '../../hooks/useAnimationPerformance';
import { getOptimizedAnimationClasses, getAnimationConfig } from '../../utils/animationUtils';
import { AnimationPerformanceMonitor } from './AnimationPerformanceMonitor';
import { cn } from '../../lib/utils';

/**
 * Demo component showcasing animation performance optimization features
 */
export function AnimationDemo() {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showMonitor, setShowMonitor] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const { shouldAnimate, optimizeElement, getOptimizedDuration } = useAnimationOptimization();
  
  useEffect(() => {
    if (cardRef.current) {
      const cleanup = optimizeElement(cardRef.current, {
        useWillChange: true,
        useTransform3d: true,
        useBackfaceVisibility: true
      });
      
      return cleanup;
    }
  }, [optimizeElement]);
  
  const handleAnimate = () => {
    if (!shouldAnimate) return;
    
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), getOptimizedDuration(1000));
  };
  
  const config = getAnimationConfig();
  const optimizedClasses = getOptimizedAnimationClasses(
    'hover:scale-105 hover:shadow-lg',
    'hover'
  );
  
  return (
    <div className="p-8 space-y-6">
      <div className="space-y-4">
        <h2 className="typography-h2">Animation Performance Demo</h2>
        <p className="typography-body text-muted-foreground">
          This demo showcases the animation performance monitoring and optimization system.
        </p>
      </div>
      
      {/* Animation Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="typography-h6 mb-2">Animation Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Animations Enabled:</span>
              <span className={cn(
                "font-medium",
                shouldAnimate ? "text-success" : "text-warning"
              )}>
                {shouldAnimate ? "Yes" : "No (Reduced Motion)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Duration:</span>
              <span className="font-medium">{config.duration}ms</span>
            </div>
            <div className="flex justify-between">
              <span>Use Transform:</span>
              <span className="font-medium">{config.useTransform ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span>Use Will-Change:</span>
              <span className="font-medium">{config.useWillChange ? "Yes" : "No"}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="typography-h6 mb-2">Performance Monitor</h3>
          <div className="space-y-2">
            <button
              onClick={() => setShowMonitor(!showMonitor)}
              className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              {showMonitor ? "Hide" : "Show"} Performance Monitor
            </button>
            <p className="text-xs text-muted-foreground">
              Toggle the performance monitor to see real-time animation metrics
            </p>
          </div>
        </div>
      </div>
      
      {/* Demo Cards */}
      <div className="space-y-4">
        <h3 className="typography-h3">Interactive Demo</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Optimized Card */}
          <div
            ref={cardRef}
            className={cn(
              "bg-card border border-border rounded-lg p-6 cursor-pointer",
              optimizedClasses,
              isAnimating && "animate-pulse"
            )}
            onClick={handleAnimate}
          >
            <div className="space-y-2">
              <div className="w-8 h-8 bg-primary rounded-full"></div>
              <h4 className="typography-h6">Optimized Card</h4>
              <p className="text-sm text-muted-foreground">
                This card uses performance-optimized animations with GPU acceleration.
              </p>
            </div>
          </div>
          
          {/* Standard Card */}
          <div
            className={cn(
              "bg-card border border-border rounded-lg p-6 cursor-pointer",
              "hover:scale-105 hover:shadow-lg transition-all duration-300",
              "motion-reduce:transition-none motion-reduce:transform-none"
            )}
          >
            <div className="space-y-2">
              <div className="w-8 h-8 bg-secondary rounded-full"></div>
              <h4 className="typography-h6">Standard Card</h4>
              <p className="text-sm text-muted-foreground">
                This card uses standard CSS transitions with reduced motion support.
              </p>
            </div>
          </div>
          
          {/* Heavy Animation Card */}
          <div
            className={cn(
              "bg-card border border-border rounded-lg p-6 cursor-pointer",
              "hover:scale-110 hover:rotate-1 hover:shadow-2xl",
              "transition-all duration-500 ease-in-out",
              "motion-reduce:transition-none motion-reduce:transform-none"
            )}
          >
            <div className="space-y-2">
              <div className="w-8 h-8 bg-warning rounded-full"></div>
              <h4 className="typography-h6">Heavy Animation</h4>
              <p className="text-sm text-muted-foreground">
                This card uses heavier animations that may impact performance.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Performance Tips */}
      <div className="bg-muted/50 border border-border rounded-lg p-6">
        <h3 className="typography-h6 mb-3">Performance Tips</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Use <code className="bg-muted px-1 rounded">transform</code> and <code className="bg-muted px-1 rounded">opacity</code> for best performance</li>
          <li>• Enable GPU acceleration with <code className="bg-muted px-1 rounded">transform: translateZ(0)</code></li>
          <li>• Use <code className="bg-muted px-1 rounded">will-change</code> sparingly and clean up after animations</li>
          <li>• Always respect <code className="bg-muted px-1 rounded">prefers-reduced-motion</code> user preference</li>
          <li>• Monitor frame rates and adapt animations based on device capabilities</li>
        </ul>
      </div>
      
      {/* Performance Monitor */}
      {showMonitor && (
        <AnimationPerformanceMonitor
          showMetrics={true}
          showReducedMotionStatus={true}
          trackGlobalPerformance={true}
          threshold={30}
          onPerformanceIssue={(metrics) => {
            console.warn('Animation performance issue detected:', metrics);
          }}
        />
      )}
    </div>
  );
}