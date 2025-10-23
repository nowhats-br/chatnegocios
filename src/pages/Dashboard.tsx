import React from 'react';
import { Activity, CheckCircle, DollarSign, Users, BarChart, TrendingUp, UserPlus } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import OverviewChart from '@/components/dashboard/OverviewChart';
import ChannelsChart from '@/components/dashboard/ChannelsChart';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const userName = user?.email?.split('@')[0] || 'Usuário';

  const kpiData = [
    { title: 'Atendimentos Ativos', value: '12', icon: Activity, change: '+2.5%', changeType: 'increase', color: 'text-blue-500' },
    { title: 'Atendimentos Resolvidos (Hoje)', value: '87', icon: CheckCircle, change: '+12.1%', changeType: 'increase', color: 'text-green-500' },
    { title: 'Conversões em Vendas', value: 'R$ 2.350', icon: DollarSign, change: '-1.8%', changeType: 'decrease', color: 'text-amber-500' },
    { title: 'Novos Contatos (Hoje)', value: '45', icon: UserPlus, change: '+5', changeType: 'increase', color: 'text-purple-500' },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Seja bem-vindo, {userName}!</h1>
        <p className="text-muted-foreground">Aqui está um resumo da sua operação de hoje.</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((item, index) => (
          <StatCard key={index} {...item} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-5 p-4 rounded-lg glassmorphism">
          <h3 className="text-lg font-semibold uppercase tracking-wide font-heading mb-4 flex items-center"><BarChart className="mr-2 h-5 w-5 text-primary" /> Visão Geral de Atendimentos</h3>
          <div className="h-[350px]">
            <OverviewChart />
          </div>
        </div>
        <div className="lg:col-span-2 p-4 rounded-lg glassmorphism">
          <h3 className="text-lg font-semibold uppercase tracking-wide font-heading mb-4 flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-primary" /> Canais de Atendimento</h3>
          <div className="h-[350px]">
            <ChannelsChart />
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg glassmorphism">
        <h3 className="text-lg font-semibold uppercase tracking-wide font-heading mb-4 flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> Atendimentos Recentes</h3>
        <RecentActivity />
      </div>
    </div>
  );
};

export default Dashboard;
