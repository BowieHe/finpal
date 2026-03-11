'use client';

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidChartProps {
  chart: string;
}

export default function MermaidChart({ chart }: MermaidChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  
  // Use a simple random id if running on client
  const [id] = useState(() => `mermaid-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
    });

    const renderChart = async () => {
      try {
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(renderedSvg);
      } catch (error) {
        console.error('Failed to render mermaid chart:', error);
        setSvg(`<div class="text-red-500 text-sm p-4 border border-red-200 bg-red-50 rounded">图表渲染失败，请检查数据格式是否正确</div>`);
      }
    };

    if (chart) {
      renderChart();
    }
  }, [chart, id]);

  return <div ref={chartRef} dangerouslySetInnerHTML={{ __html: svg }} className="my-4 flex justify-center overflow-x-auto w-full max-w-full bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700" />;
}
