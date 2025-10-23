import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '../providers/theme-provider';

const ChannelsChart: React.FC = () => {
  const { theme } = useTheme();

  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'hsl(var(--background))',
      borderColor: 'hsl(var(--border))',
      textStyle: {
        color: 'hsl(var(--foreground))'
      }
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: {
        color: 'hsl(var(--muted-foreground))'
      }
    },
    series: [
      {
        name: 'Canais',
        type: 'pie',
        radius: ['50%', '70%'],
        avoidLabelOverlap: false,
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '20',
            fontWeight: 'bold',
            formatter: '{b}\n{d}%',
            color: 'hsl(var(--foreground))'
          }
        },
        labelLine: {
          show: false
        },
        data: [
          { value: 1048, name: 'WhatsApp' },
          { value: 735, name: 'Instagram' },
          { value: 580, name: 'Website' },
          { value: 484, name: 'Telefone' },
        ],
        itemStyle: {
          borderRadius: 10,
          borderColor: 'hsl(var(--card))',
          borderWidth: 4
        },
        color: [
            'hsl(var(--primary))',
            '#3b82f6', // blue-500
            '#14b8a6', // teal-500
            '#f97316', // orange-500
        ]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} theme={theme === 'dark' ? 'dark' : 'light'} />;
};

export default ChannelsChart;
