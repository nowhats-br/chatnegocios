import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '../providers/theme-provider';
import { Loader2 } from 'lucide-react';

const OverviewChart: React.FC = () => {
  const { theme } = useTheme();
  const [primaryColorValue, setPrimaryColorValue] = useState('');

  useEffect(() => {
    // A small delay to ensure CSS variables are applied after theme switch
    const timer = setTimeout(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const primaryColor = rootStyle.getPropertyValue('--primary').trim();
      // ECharts expects comma-separated HSL values, not space-separated
      const formattedColor = primaryColor.replace(/ /g, ', ');
      setPrimaryColorValue(formattedColor);
    }, 100); // Increased delay slightly for safety
    return () => clearTimeout(timer);
  }, [theme]);

  if (!primaryColorValue) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

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
        itemStyle: { color: `hsl(${primaryColorValue})` },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{
                offset: 0, color: `hsla(${primaryColorValue}, 0.3)`
            }, {
                offset: 1, color: `hsla(${primaryColorValue}, 0)`
            }]
          }
        }
      },
      {
        name: 'Resolvidos',
        type: 'line',
        smooth: true,
        data: [100, 112, 81, 114, 70, 200, 180],
        itemStyle: { color: 'hsl(142.1, 76.2%, 36.3%)' }, // Green
      },
      {
        name: 'Pendentes',
        type: 'line',
        smooth: true,
        data: [20, 20, 20, 20, 20, 30, 30],
        itemStyle: { color: 'hsl(0, 84.2%, 60.2%)' }, // Red
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} theme={theme === 'dark' ? 'dark' : 'light'} notMerge={true} />;
};

export default OverviewChart;
