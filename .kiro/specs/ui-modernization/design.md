# Design Document

## Overview

Este documento detalha o design para modernização da interface do usuário do sistema de multi atendimento WhatsApp. O objetivo é criar uma experiência visual profissional e moderna, mantendo a funcionalidade existente enquanto melhora significativamente a apresentação visual, especialmente na página de conexões.

O sistema atual utiliza React 18, TypeScript, Tailwind CSS, Radix UI e já possui uma base sólida de componentes. A modernização focará em:
- Aprimoramento visual dos componentes existentes
- Criação de novos padrões visuais profissionais
- Melhoria da tipografia e hierarquia visual
- Implementação de micro-interações e animações sutis

## Architecture

### Design System Structure

```
Design System
├── Colors & Themes
│   ├── Enhanced Color Palette
│   ├── Professional Gradients
│   └── Improved Dark/Light Mode
├── Typography
│   ├── Modern Font Stack
│   ├── Typography Scale
│   └── Semantic Text Styles
├── Components
│   ├── Enhanced Buttons
│   ├── Professional Cards
│   ├── Modern Status Indicators
│   └── Improved Form Elements
└── Layout & Spacing
    ├── Grid System
    ├── Spacing Scale
    └── Responsive Breakpoints
```

### Technology Stack Integration

- **Tailwind CSS**: Extensão das configurações existentes com novas cores, gradientes e animações
- **CSS Custom Properties**: Variáveis CSS para temas dinâmicos e consistência
- **Framer Motion**: Animações e micro-interações (já disponível no projeto)
- **Radix UI**: Manutenção dos componentes acessíveis existentes com styling aprimorado

## Components and Interfaces

### 1. Enhanced Color System

**Professional Color Palette:**
```css
/* Cores primárias aprimoradas */
--primary-50: 248 250 252;
--primary-100: 241 245 249;
--primary-500: 59 130 246;
--primary-600: 37 99 235;
--primary-900: 30 58 138;

/* Gradientes profissionais */
--gradient-primary: linear-gradient(135deg, hsl(var(--primary-500)), hsl(var(--primary-600)));
--gradient-card: linear-gradient(145deg, hsl(var(--card)), hsl(var(--card) / 0.8));

/* Status colors aprimoradas */
--success: 34 197 94;
--warning: 245 158 11;
--error: 239 68 68;
--info: 59 130 246;
```

### 2. Modern Typography System

**Font Stack:**
- Primary: 'Inter', system-ui, sans-serif
- Headings: 'Inter', system-ui, sans-serif (weight: 600-700)
- Body: 'Inter', system-ui, sans-serif (weight: 400-500)

**Typography Scale:**
```css
/* Headings */
.text-display: 3.5rem / 1.1 / 700
.text-h1: 2.5rem / 1.2 / 600
.text-h2: 2rem / 1.3 / 600
.text-h3: 1.5rem / 1.4 / 600

/* Body */
.text-body-lg: 1.125rem / 1.6 / 400
.text-body: 1rem / 1.6 / 400
.text-body-sm: 0.875rem / 1.5 / 400
.text-caption: 0.75rem / 1.4 / 500
```

### 3. Professional Connection Cards

**Card Structure:**
```typescript
interface ConnectionCardProps {
  connection: Connection;
  status: 'connected' | 'connecting' | 'disconnected' | 'paused';
  onConnect: () => void;
  onDisconnect: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}
```

**Visual Design:**
- **Container**: Rounded corners (12px), subtle shadow, hover elevation
- **Status Indicator**: Left border accent + icon + color coding
- **Header**: Instance name (bold) + phone number (muted)
- **Status Badge**: Pill-shaped with appropriate colors and icons
- **Actions**: Modern button group with clear hierarchy
- **Hover Effects**: Subtle scale transform + shadow enhancement

### 4. Enhanced Button System

**Button Variants:**
```typescript
type ButtonVariant = 
  | 'primary'     // Gradient background, white text
  | 'secondary'   // Subtle background, primary text
  | 'outline'     // Border only, transparent background
  | 'ghost'       // No background, hover effect
  | 'destructive' // Red gradient for dangerous actions
  | 'success'     // Green gradient for positive actions
```

**Button Enhancements:**
- Gradient backgrounds for primary actions
- Improved hover states with subtle animations
- Loading states with modern spinners
- Better focus indicators for accessibility
- Icon + text combinations with proper spacing

### 5. Status Indicator System

**Status Types:**
```typescript
interface StatusConfig {
  connected: {
    color: 'text-green-600';
    bgColor: 'bg-green-50 dark:bg-green-900/20';
    borderColor: 'border-green-200 dark:border-green-800';
    icon: CheckCircle;
    text: 'Conectado';
  };
  connecting: {
    color: 'text-blue-600';
    bgColor: 'bg-blue-50 dark:bg-blue-900/20';
    borderColor: 'border-blue-200 dark:border-blue-800';
    icon: Loader2; // with spin animation
    text: 'Conectando...';
  };
  // ... outros status
}
```

## Data Models

### Theme Configuration
```typescript
interface ThemeConfig {
  colors: {
    primary: ColorScale;
    secondary: ColorScale;
    success: ColorScale;
    warning: ColorScale;
    error: ColorScale;
    neutral: ColorScale;
  };
  typography: {
    fontFamily: {
      sans: string[];
      mono: string[];
    };
    fontSize: Record<string, [string, string]>;
    fontWeight: Record<string, number>;
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
  animations: Record<string, string>;
}
```

### Component Props Extensions
```typescript
// Extensão dos props existentes para suportar novos estilos
interface EnhancedButtonProps extends ButtonProps {
  gradient?: boolean;
  loading?: boolean;
  icon?: React.ComponentType;
  iconPosition?: 'left' | 'right';
}

interface EnhancedCardProps extends CardProps {
  variant?: 'default' | 'elevated' | 'outlined' | 'glass';
  hover?: boolean;
  interactive?: boolean;
}
```

## Error Handling

### Visual Error States
- **Connection Errors**: Red status indicators with clear error messages
- **Loading States**: Skeleton loaders and progress indicators
- **Empty States**: Illustrated empty states with clear call-to-actions
- **Form Validation**: Inline error messages with appropriate styling

### Accessibility Considerations
- High contrast ratios (WCAG AA compliance)
- Focus indicators for keyboard navigation
- Screen reader friendly status announcements
- Reduced motion preferences support

## Testing Strategy

### Visual Regression Testing
- Screenshot comparisons for component variations
- Cross-browser compatibility testing
- Dark/light theme consistency validation

### Accessibility Testing
- Automated accessibility audits
- Keyboard navigation testing
- Screen reader compatibility
- Color contrast validation

### Performance Testing
- Animation performance monitoring
- Bundle size impact assessment
- Loading time optimization

### Component Testing
- Storybook stories for all component variants
- Interactive state testing
- Responsive behavior validation

## Implementation Phases

### Phase 1: Foundation
- Enhanced color system and CSS variables
- Typography improvements
- Basic animation utilities

### Phase 2: Core Components
- Button system enhancements
- Card component modernization
- Status indicator improvements

### Phase 3: Page-Specific Updates
- Connections page redesign
- Layout improvements
- Responsive optimizations

### Phase 4: Polish & Optimization
- Micro-interactions and animations
- Performance optimizations
- Accessibility enhancements

## Design Tokens

### Spacing Scale
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### Border Radius Scale
```css
--radius-sm: 0.375rem;  /* 6px */
--radius-md: 0.5rem;    /* 8px */
--radius-lg: 0.75rem;   /* 12px */
--radius-xl: 1rem;      /* 16px */
--radius-2xl: 1.5rem;   /* 24px */
```

### Shadow Scale
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
```

## Responsive Design Strategy

### Breakpoints
- **Mobile**: 320px - 767px
- **Tablet**: 768px - 1023px  
- **Desktop**: 1024px - 1439px
- **Large Desktop**: 1440px+

### Connection Cards Responsive Behavior
- **Mobile**: Single column, full-width cards
- **Tablet**: 2 columns with adjusted spacing
- **Desktop**: 3 columns with optimal card width
- **Large Desktop**: 4 columns with maximum card width limit

### Typography Responsive Scaling
- Fluid typography using clamp() for smooth scaling
- Adjusted line heights for different screen sizes
- Optimized reading widths for content areas