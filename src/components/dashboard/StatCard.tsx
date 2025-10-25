import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowDownRight, ArrowUpRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  change: string;
  changeType: 'increase' | 'decrease';
  color: string;
  borderColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, change, changeType, color, borderColor }) => {
  return (
    <Card className={cn("glassmorphism border-l-4", borderColor)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="typography-body-sm font-medium typography-muted">{title}</CardTitle>
        <Icon className={cn("h-5 w-5", color)} />
      </CardHeader>
      <CardContent>
        <div className="typography-h2 font-bold">{value}</div>
        <p className="typography-caption typography-muted flex items-center">
          <span className={`flex items-center mr-1 ${changeType === 'increase' ? 'text-green-500' : 'text-red-500'}`}>
            {changeType === 'increase' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {change}
          </span>
          em relação a ontem
        </p>
      </CardContent>
    </Card>
  );
};

export default StatCard;
