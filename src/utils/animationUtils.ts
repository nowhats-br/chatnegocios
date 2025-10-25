import { prefersReducedMotion, getOptimalAnimationSettings } from '../hooks/useAnimationPerformance';

/**
 * Animation configuration based on user preferences and device capabilities
 */
export interface AnimationConfig {
  duration: number;
  easing: string;
  shouldAnimate: boolean;
  useTransform: boolean;
  useWillChange: boolean;
}

/**
 * Get optimized animation configuration based on user preferences and device capabilities
 */
export function getAnimationConfig(baseDuration: number = 300): AnimationConfig {
  const settings = getOptimalAnimationSettings();
  const reducedMotion = prefersReducedMotion();

  return {
    duration: reducedMotion ? 0 : (baseDuration || settings.recommendedDuration),
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // Tailwind's ease-out
    shouldAnimate: !reducedMotion && !settings.shouldReduceAnimations,
    useTransform: settings.shouldUseTransform,
    useWillChange: settings.shouldUseWillChange
  };
}

/**
 * CSS class generator for optimized animations
 */
export function getOptimizedAnimationClasses(
  baseClasses: string,
  animationType: 'hover' | 'focus' | 'active' | 'enter' | 'exit' = 'hover'
): string {
  const config = getAnimationConfig();
  
  if (!config.shouldAnimate) {
    return 'motion-reduce:transition-none motion-reduce:transform-none';
  }

  // Map duration to Tailwind classes
  const durationClass = config.duration <= 150 ? 'duration-150' : 
                       config.duration <= 200 ? 'duration-200' :
                       config.duration <= 300 ? 'duration-300' : 'duration-500';

  const baseOptimizations = [
    'transform-gpu', // Use GPU acceleration
    'transition-all',
    durationClass,
    'ease-out'
  ];

  const willChangeClass = config.useWillChange ? 'will-change-transform' : '';
  const backfaceClass = 'backface-visibility-hidden'; // Prevent flickering

  // Add animation type specific optimizations
  const typeSpecificClasses = animationType === 'hover' ? ['hover:will-change-transform'] :
                             animationType === 'focus' ? ['focus:will-change-transform'] :
                             animationType === 'active' ? ['active:will-change-transform'] : [];

  return [
    baseClasses,
    ...baseOptimizations,
    willChangeClass,
    backfaceClass,
    ...typeSpecificClasses,
    // Reduced motion fallbacks
    'motion-reduce:transition-none',
    'motion-reduce:transform-none',
    'motion-reduce:will-change-auto'
  ].filter(Boolean).join(' ');
}

/**
 * Performance-optimized hover animation classes
 */
export function getHoverAnimationClasses(scale: number = 1.02, translateY: number = -1): string {
  const config = getAnimationConfig();
  
  if (!config.shouldAnimate) {
    return 'motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0';
  }

  return getOptimizedAnimationClasses(
    `hover:scale-[${scale}] hover:translate-y-[${translateY}px] hover:shadow-lg`,
    'hover'
  );
}

/**
 * Performance-optimized active/click animation classes
 */
export function getActiveAnimationClasses(scale: number = 0.98): string {
  const config = getAnimationConfig();
  
  if (!config.shouldAnimate) {
    return 'motion-reduce:active:scale-100';
  }

  return getOptimizedAnimationClasses(
    `active:scale-[${scale}] active:transition-transform active:duration-150`,
    'active'
  );
}

/**
 * Performance-optimized focus animation classes
 */
export function getFocusAnimationClasses(): string {
  return [
    'focus-visible:ring-2',
    'focus-visible:ring-primary',
    'focus-visible:ring-offset-2',
    'focus-visible:ring-offset-background',
    'focus-visible:outline-none',
    'transition-shadow',
    'duration-200',
    'motion-reduce:transition-none'
  ].join(' ');
}

/**
 * Create CSS custom properties for dynamic animations
 */
export function createAnimationCustomProperties(element: HTMLElement, config?: Partial<AnimationConfig>) {
  const animConfig = { ...getAnimationConfig(), ...config };
  
  element.style.setProperty('--animation-duration', `${animConfig.duration}ms`);
  element.style.setProperty('--animation-easing', animConfig.easing);
  
  if (animConfig.useWillChange) {
    element.style.willChange = 'transform, opacity';
  }
  
  // Clean up will-change after animation
  const cleanup = () => {
    element.style.willChange = 'auto';
  };
  
  return cleanup;
}

/**
 * Intersection Observer for performance-conscious animations
 */
export function createIntersectionAnimationObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  const config = getAnimationConfig();
  
  // Disable intersection animations if reduced motion is preferred
  if (!config.shouldAnimate) {
    return new IntersectionObserver(() => {}, { threshold: 0 });
  }

  return new IntersectionObserver(callback, {
    threshold: 0.1,
    rootMargin: '50px',
    ...options
  });
}

/**
 * Debounced animation trigger for performance
 */
export function createDebouncedAnimationTrigger(
  callback: () => void,
  delay: number = 16 // ~1 frame at 60fps
): () => void {
  let timeoutId: number;
  
  return () => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(callback, delay);
  };
}

/**
 * Enhanced animation performance monitoring utilities
 */
export class AnimationPerformanceTracker {
  private frameCount = 0;
  private startTime = 0;
  private animationId?: number;
  private frameTimes: number[] = [];
  private lastFrameTime = 0;
  private droppedFrames = 0;
  private performanceObserver?: PerformanceObserver;
  
  constructor() {
    // Initialize performance observer for paint timing
    if ('PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'paint' || entry.entryType === 'measure') {
              // Track paint and layout performance
              console.debug(`Performance entry: ${entry.name} - ${entry.duration}ms`);
            }
          });
        });
        this.performanceObserver.observe({ entryTypes: ['paint', 'measure'] });
      } catch (error) {
        console.warn('Performance Observer not supported:', error);
      }
    }
  }
  
  start() {
    this.frameCount = 0;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.frameTimes = [];
    this.droppedFrames = 0;
    this.tick();
  }
  
  stop(): { 
    fps: number; 
    duration: number; 
    averageFrameTime: number;
    droppedFrames: number;
    performanceGrade: 'excellent' | 'good' | 'fair' | 'poor';
  } {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    const duration = performance.now() - this.startTime;
    const fps = (this.frameCount / duration) * 1000;
    const averageFrameTime = this.frameTimes.length > 0 
      ? this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length 
      : 0;
    
    // Calculate performance grade
    let performanceGrade: 'excellent' | 'good' | 'fair' | 'poor';
    if (fps >= 55 && this.droppedFrames <= 2) {
      performanceGrade = 'excellent';
    } else if (fps >= 45 && this.droppedFrames <= 5) {
      performanceGrade = 'good';
    } else if (fps >= 30 && this.droppedFrames <= 10) {
      performanceGrade = 'fair';
    } else {
      performanceGrade = 'poor';
    }
    
    return { fps, duration, averageFrameTime, droppedFrames: this.droppedFrames, performanceGrade };
  }
  
  private tick = () => {
    const currentTime = performance.now();
    const frameTime = currentTime - this.lastFrameTime;
    
    this.frameCount++;
    this.frameTimes.push(frameTime);
    
    // Track dropped frames (frames taking longer than 20ms at 60fps)
    if (frameTime > 20) {
      this.droppedFrames++;
    }
    
    // Keep only last 60 frame measurements
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }
    
    this.lastFrameTime = currentTime;
    this.animationId = requestAnimationFrame(this.tick);
  };
  
  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }
}

/**
 * Utility to check if an element is currently animating
 */
export function isElementAnimating(element: HTMLElement): boolean {
  const computedStyle = getComputedStyle(element);
  const animationName = computedStyle.animationName;
  const transitionProperty = computedStyle.transitionProperty;
  
  return animationName !== 'none' || transitionProperty !== 'none';
}

/**
 * Safe animation cleanup utility
 */
export function cleanupAnimations(element: HTMLElement) {
  element.style.willChange = 'auto';
  element.style.transform = '';
  element.style.transition = '';
  element.style.animation = '';
}

/**
 * Enhanced reduced motion detection and management
 */
export class ReducedMotionManager {
  private static instance: ReducedMotionManager;
  private mediaQuery: MediaQueryList;
  private listeners: Set<(prefersReduced: boolean) => void> = new Set();
  
  private constructor() {
    this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.mediaQuery.addEventListener('change', this.handleChange);
  }
  
  static getInstance(): ReducedMotionManager {
    if (!ReducedMotionManager.instance) {
      ReducedMotionManager.instance = new ReducedMotionManager();
    }
    return ReducedMotionManager.instance;
  }
  
  private handleChange = (event: MediaQueryListEvent) => {
    this.listeners.forEach(listener => listener(event.matches));
  };
  
  subscribe(callback: (prefersReduced: boolean) => void): () => void {
    this.listeners.add(callback);
    // Call immediately with current state
    callback(this.mediaQuery.matches);
    
    return () => {
      this.listeners.delete(callback);
    };
  }
  
  get prefersReducedMotion(): boolean {
    return this.mediaQuery.matches;
  }
  
  dispose() {
    this.mediaQuery.removeEventListener('change', this.handleChange);
    this.listeners.clear();
  }
}

/**
 * Performance-aware animation controller
 */
export class AnimationController {
  private performanceTracker: AnimationPerformanceTracker;
  private reducedMotionManager: ReducedMotionManager;
  private performanceThreshold = 30; // FPS threshold
  private adaptiveMode = true;
  
  constructor() {
    this.performanceTracker = new AnimationPerformanceTracker();
    this.reducedMotionManager = ReducedMotionManager.getInstance();
  }
  
  /**
   * Check if animations should be enabled based on performance and user preferences
   */
  shouldEnableAnimations(): boolean {
    if (this.reducedMotionManager.prefersReducedMotion) {
      return false;
    }
    
    if (!this.adaptiveMode) {
      return true;
    }
    
    // Check device capabilities
    const settings = getOptimalAnimationSettings();
    return !settings.shouldReduceAnimations;
  }
  
  /**
   * Get optimized animation duration based on performance
   */
  getOptimizedDuration(baseDuration: number): number {
    if (!this.shouldEnableAnimations()) {
      return 0;
    }
    
    const settings = getOptimalAnimationSettings();
    return Math.min(baseDuration, settings.recommendedDuration);
  }
  
  /**
   * Apply performance-optimized styles to an element
   */
  optimizeElement(element: HTMLElement, options: {
    useWillChange?: boolean;
    useTransform3d?: boolean;
    useBackfaceVisibility?: boolean;
  } = {}) {
    const {
      useWillChange = true,
      useTransform3d = true,
      useBackfaceVisibility = true
    } = options;
    
    if (!this.shouldEnableAnimations()) {
      return () => {}; // No-op cleanup
    }
    
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
  }
  
  /**
   * Monitor animation performance for a specific element
   */
  monitorElementPerformance(element: HTMLElement, callback?: (metrics: any) => void) {
    if (!this.shouldEnableAnimations()) {
      return () => {}; // No-op cleanup
    }
    
    this.performanceTracker.start();
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          const metrics = this.performanceTracker.stop();
          callback?.(metrics);
          
          // Adapt animation settings based on performance
          if (metrics.fps < this.performanceThreshold) {
            console.warn('Poor animation performance detected:', metrics);
            // Could trigger adaptive behavior here
          }
        }
      });
    });
    
    observer.observe(element);
    
    return () => {
      observer.disconnect();
      this.performanceTracker.stop();
    };
  }
  
  dispose() {
    this.performanceTracker.dispose();
  }
}

/**
 * Global animation controller instance
 */
export const animationController = new AnimationController();

