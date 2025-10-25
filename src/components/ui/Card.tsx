import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'glass';
  hover?: boolean;
  interactive?: boolean;
}

const cardVariants = {
  default: 'rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-300',
  elevated: 'rounded-xl bg-card text-card-foreground shadow-lg border border-border/50 transition-all duration-300',
  outlined: 'rounded-xl border-2 border-border bg-card text-card-foreground shadow-none hover:border-primary/30 transition-all duration-300',
  glass: 'rounded-xl bg-card/60 backdrop-blur-xl text-card-foreground shadow-lg border border-white/10 dark:border-white/5 transition-all duration-300',
};

const hoverEffects = {
  default: 'hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5',
  elevated: 'hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1',
  outlined: 'hover:shadow-md hover:scale-[1.01] hover:border-primary/50',
  glass: 'hover:shadow-xl hover:scale-[1.02] hover:bg-card/70 hover:backdrop-blur-2xl',
};

const interactiveEffects = {
  default: 'cursor-pointer active:scale-[0.99] active:translate-y-0',
  elevated: 'cursor-pointer active:scale-[0.98] active:translate-y-0 active:shadow-lg',
  outlined: 'cursor-pointer active:scale-[0.99] active:border-primary/70',
  glass: 'cursor-pointer active:scale-[0.98] active:bg-card/80',
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hover = false, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        cardVariants[variant],
        hover && hoverEffects[variant],
        interactive && [hoverEffects[variant], interactiveEffects[variant]],
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "typography-h3",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("typography-body-sm typography-muted", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
