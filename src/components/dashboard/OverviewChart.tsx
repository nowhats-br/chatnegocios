import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '../providers/theme-provider';

const OverviewChart: React.FC = () => {
  const { theme } = useTheme();

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'hsl(var(--background))',
      borderColor: 'hsl(var(--border))',
      textStyle: {
        color: 'hsl(var(--foreground))'
      }
    },
    legend: {
      data: ['Atendimentos', 'Resolvidos', 'Pendentes'],
      textStyle: {
        color: 'hsl(var(--muted-foreground))'
      },
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
      axisLine: {
        lineStyle: {
          color: 'hsl(var(--border))'
        }
      },
      axisLabel: {
        color: 'hsl(var(--muted-foreground))'
      }
    },
    yAxis: {
      type: 'value',
      splitLine: {
        lineStyle: {
          type: 'dashed',
          color: 'hsl(var(--border))'
        }
      },
      axisLabel: {
        color: 'hsl(var(--muted-foreground))'
      }
    },
    series: [
      {
        name: 'Atendimentos',
        type: 'line',
        smooth: true,
        data: [120, 132, 101, 134, 90, 230, 210],
        itemStyle: { color: 'hsl(var(--primary))' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{
                offset: 0, color: 'hsla(var(--primary), 0.3)'
            }, {
                offset: 1, color: 'hsla(var(--primary), 0)'
            }]
          }
        }
      },
      {
        name: 'Resolvidos',
        type: 'line',
        smooth: true,
        data: [100, 112, 81, 114, 70, 200, 180],
        itemStyle: { color: 'hsl(142.1 76.2% 36.3%)' }, // Green
      },
      {
        name: 'Pendentes',
        type: 'line',
        smooth: true,
        data: [20, 20, 20, 20, 20, 30, 30],
        itemStyle: { color: 'hsl(0 84.2% 60.2%)' }, // Red
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} theme={theme === 'dark' ? 'dark' : 'light'} />;
};

export default OverviewChart;
