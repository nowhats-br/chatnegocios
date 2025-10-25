import React from 'react';

interface TabsProps {
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ children, className }) => {
  return <div className={`flex border-b ${className}`}>{children}</div>;
};

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  activeValue: string;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ children, value, activeValue, className, ...props }) => {
  const isActive = value === activeValue;
  return (
    <button
      className={`px-4 py-2 -mb-px typography-body-sm font-semibold border-b-2 transition-colors ${
        isActive
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
