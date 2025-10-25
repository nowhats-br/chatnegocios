import { useEffect, useRef, useCallback, useState } from 'react';

interface AnimationMetrics {
  frameRate: number;
  droppedFrames: number;
  averageFrameTime: number;
  isPerformant: boolean;
}

interface AnimationPerformanceOptions {
  threshold?: number; // FPS threshold for performance warning (default: 30)
  onPerformanceWarning?: (metrics: AnimationMetrics) => void;
  enabled?: boolean;
}

/**
 * Hook for monitoring animation performance and frame rates
 * Tracks FPS, dropped frames, and provides performance warnings
 */
export function useAnimationPerformance(options: AnimationPerformanceOptions = {}) {
  const {
    threshold = 30,
    onPerformanceWarning,
    enabled = true
  } = options;

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const frameTimesRef = useRef<number[]>([]);
  const animationIdRef = useRef<number>();
  const metricsRef = useRef<AnimationMetrics>({
    frameRate: 60,
    droppedFrames: 0,
    averageFrameTime: 16.67,
    isPerformant: true
  });

  const measureFrame = useCallback(() => {
    if (!enabled) return;

    const now = performance.now();
    const deltaTime = now - lastTimeRef.current;
    
    frameCountRef.current++;
    frameTimesRef.current.push(deltaTime);
    
    // Keep only last 60 frame measurements (1 second at 60fps)
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift();
    }
    
    // Calculate metrics every 30 frames
    if (frameCountRef.current % 30 === 0) {
      const frameTimes = frameTimesRef.current;
      const averageFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
      const frameRate = 1000 / averageFrameTime;
      const droppedFrames = frameTimes.filter(time => time > 20).length; // Frames taking longer than 20ms
      const isPerformant = frameRate >= threshold;
      
      metricsRef.current = {
        frameRate: Math.round(frameRate * 100) / 100,
        droppedFrames,
        averageFrameTime: Math.round(averageFrameTime * 100) / 100,
        isPerformant
      };
      
      // Trigger performance warning if needed
      if (!isPerformant && onPerformanceWarning) {
        onPerformanceWarning(metricsRef.current);
      }
    }
    
    lastTimeRef.current = now;
    
    // Check if requestAnimationFrame is available (for test environments)
    if (typeof requestAnimationFrame !== 'undefined') {
      animationIdRef.current = requestAnimationFrame(measureFrame);
    }
  }, [enabled, threshold, onPerformanceWarning]);

  const startMonitoring = useCallback(() => {
    if (!enabled || typeof requestAnimationFrame === 'undefined') return;
    
    frameCountRef.current = 0;
    lastTimeRef.current = performance.now();
    frameTimesRef.current = [];
    animationIdRef.current = requestAnimationFrame(measureFrame);
  }, [enabled, measureFrame]);

  const stopMonitoring = useCallback(() => {
    if (animationIdRef.current && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = undefined;
    }
  }, []);

  const getMetrics = useCallback((): AnimationMetrics => {
    return { ...metricsRef.current };
  }, []);

  useEffect(() => {
    if (enabled) {
      startMonitoring();
    }
    
    return stopMonitoring;
  }, [enabled, startMonitoring, stopMonitoring]);

  return {
    startMonitoring,
    stopMonitoring,
    getMetrics,
    isMonitoring: !!animationIdRef.current
  };
}

/**
 * Utility function to check if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Utility function to optimize animations based on device capabilities
 */
export function getOptimalAnimationSettings() {
  const isLowEndDevice = navigator.hardwareConcurrency <= 2;
  const isSlowConnection = 'connection' in navigator && 
    (navigator as any).connection?.effectiveType === 'slow-2g' || 
    (navigator as any).connection?.effectiveType === '2g';
  
  return {
    shouldReduceAnimations: isLowEndDevice || isSlowConnection || prefersReducedMotion(),
    recommendedDuration: isLowEndDevice ? 150 : 300,
    shouldUseTransform: true, // Always prefer transform over other properties
    shouldUseWillChange: !isLowEndDevice // Only use will-change on capable devices
  };
}

/**
 * React hook for animation performance optimization
 */
export function useAnimationOptimization() {
  const [shouldAnimate, setShouldAnimate] = useState(true);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (event: MediaQueryListEvent) => {
      setShouldAnimate(!event.matches);
    };
    
    // Set initial state
    setShouldAnimate(!mediaQuery.matches);
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);
  
  const optimizeElement = useCallback((element: HTMLElement | null, options: {
    useWillChange?: boolean;
    useTransform3d?: boolean;
    useBackfaceVisibility?: boolean;
  } = {}) => {
    if (!element || !shouldAnimate) return () => {};
    
    const {
      useWillChange = true,
      useTransform3d = true,
      useBackfaceVisibility = true
    } = options;
    
    const settings = getOptimalAnimationSettings();
    
    if (useWillChange && settings.shouldUseWillChange) {
      element.style.willChange = 'transform, opacity';
    }
    
    if (useTransform3d) {
      element.style.transform = element.style.transform || 'translateZ(0)';
    }
    
    if (useBackfaceVisibility) {
      element.style.backfaceVisibility = 'hidden';
    }
    
    // Return cleanup function
    return () => {
      element.style.willChange = 'auto';
      if (useTransform3d && element.style.transform === 'translateZ(0)') {
        element.style.transform = '';
      }
      if (useBackfaceVisibility) {
        element.style.backfaceVisibility = '';
      }
    };
  }, [shouldAnimate]);
  
  const getOptimizedDuration = useCallback((baseDuration: number): number => {
    if (!shouldAnimate) {
      return 0;
    }
    
    const settings = getOptimalAnimationSettings();
    return Math.min(baseDuration, settings.recommendedDuration);
  }, [shouldAnimate]);
  
  return {
    shouldAnimate,
    optimizeElement,
    getOptimizedDuration
  };
}