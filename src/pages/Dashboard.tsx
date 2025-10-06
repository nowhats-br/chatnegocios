import React from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Activity, ArrowDownRight, ArrowUpRight, DollarSign, Users } from 'lucide-react';

const kpiData = [
  { title: 'Atendimentos Ativos', value: '12', icon: Activity, change: '+2.5%', changeType: 'increase' },
  { title: 'Atendimentos Resolvidos', value: '316', icon: Users, change: '+12.1%', changeType: 'increase' },
  { title: 'Conversões em Vendas', value: 'R$ 2.350,80', icon: DollarSign, change: '-1.8%', changeType: 'decrease' },
  { title: 'Novos Contatos (Hoje)', value: '45', icon: Users, change: '+5', changeType: 'increase' },
];

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((item, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <item.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                <span className={`flex items-center mr-1 ${item.changeType === 'increase' ? 'text-green-500' : 'text-red-500'}`}>
                  {item.changeType === 'increase' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {item.change}
                </span>
                em relação a ontem
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Visão Geral de Atendimentos</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] flex items-center justify-center">
            <p className="text-muted-foreground">Gráfico de Atendimentos em breve</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Vendas Recentes</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] flex items-center justify-center">
            <p className="text-muted-foreground">Lista de Vendas em breve</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
