import React, { useContext, useMemo, useState, useRef } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { formatCurrency } from '../utils/formatters';
import { EmptyState } from '../components/EmptyState';
import { SummaryCard } from '../components/SummaryCard';
import { MatchMethod, MatchResult } from '../types';
import { 
    CheckCircleIcon, 
    XCircleIcon, 
    UploadIcon, 
    SparklesIcon,
    UserPlusIcon,
    BrainIcon,
    BoltIcon
} from '../components/Icons';

// --- Chart Components ---

interface LineChartProps {
    data: { date: string; value: number }[];
    formatValue: (value: number) => string;
}

// Helper to generate nice axis ticks
const getNiceTicks = (maxValue: number): { ticks: number[]; max: number } => {
    if (maxValue <= 0) return { ticks: [0], max: 1 }; // Avoid division by zero, max 1 for scale

    const numTicks = 5; // Target number of ticks
    const tickSpacing = maxValue / (numTicks - 1);
    
    // Calculate a 'nice' tick spacing
    const exponent = Math.floor(Math.log10(tickSpacing));
    const powerOf10 = Math.pow(10, exponent);
    const magnitude = tickSpacing / powerOf10;

    let niceMagnitude;
    if (magnitude < 1.5) niceMagnitude = 1;
    else if (magnitude < 3) niceMagnitude = 2;
    else if (magnitude < 7) niceMagnitude = 5;
    else niceMagnitude = 10;
    
    const niceTickSpacing = niceMagnitude * powerOf10;
    
    const niceMaxValue = Math.ceil(maxValue / niceTickSpacing) * niceTickSpacing;
    
    const ticks: number[] = [];
    for (let t = 0; t <= niceMaxValue; t += niceTickSpacing) {
        ticks.push(t);
    }

    return { ticks, max: niceMaxValue };
};

const LineChart: React.FC<LineChartProps> = ({ data, formatValue }) => {
    const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; content: string; date: string } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const margin = { top: 10, right: 20, bottom: 25, left: 65 };
    const width = 450;
    const height = 180;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (data.length < 2) {
        return <div className="h-full flex items-center justify-center text-sm text-slate-400">Dados insuficientes para o gráfico.</div>;
    }

    const { ticks: yTicks, max: yMax } = getNiceTicks(Math.max(...data.map(d => d.value)));
    const points = data.map((d, i) => ({
        x: (i / (data.length - 1)) * innerWidth,
        y: yMax > 0 ? innerHeight - (d.value / yMax) * innerHeight : innerHeight,
        original: d
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaPath = `${linePath} V ${innerHeight} L ${points[0].x},${innerHeight} Z`;

    const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const cursorPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
        const mouseX = cursorPoint.x - margin.left;

        let closestPointIndex = 0;
        let minDistance = Infinity;
        points.forEach((point, i) => {
            const distance = Math.abs(point.x - mouseX);
            if (distance < minDistance) {
                minDistance = distance;
                closestPointIndex = i;
            }
        });
        
        const closestPoint = points[closestPointIndex];
        setTooltip({
            visible: true,
            x: cursorPoint.x,
            y: cursorPoint.y,
            date: closestPoint.original.date,
            content: `${closestPoint.original.date}: ${formatValue(closestPoint.original.value)}`
        });
    };

    const handleMouseLeave = () => setTooltip(null);
    
    // Show fewer labels on X axis if there are many points
    const showXLabel = (index: number) => {
        const numPoints = data.length;
        if (numPoints <= 10) return true;
        if (index === 0 || index === numPoints - 1) return true;
        const numLabels = 5;
        const interval = Math.floor(numPoints / numLabels);
        return index % interval === 0;
    }

    return (
        <div className="relative -ml-2 -mr-2"> {/* Offset to fit better in the card */}
            <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto cursor-crosshair" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
                <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    {yTicks.map(tick => {
                        const y = yMax > 0 ? innerHeight - (tick / yMax) * innerHeight : innerHeight;
                        return (
                            <g key={tick} className="text-slate-400">
                                <line x1={0} y1={y} x2={innerWidth} y2={y} className="stroke-current text-slate-200 dark:text-slate-700" strokeDasharray="2" />
                                <text x={-8} y={y} dy="0.3em" textAnchor="end" className="text-xs fill-current">{formatValue(tick)}</text>
                            </g>
                        )
                    })}
                    {points.map((p, i) => (
                         showXLabel(i) && (
                            <text key={i} x={p.x} y={innerHeight + 15} textAnchor="middle" className="text-xs fill-current text-slate-400">
                                {p.original.date.substring(0, 5)}
                            </text>
                         )
                    ))}
                    <path d={areaPath} fill="url(#areaGradient)" />
                    <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {tooltip?.visible && (
                        <>
                            <line x1={points.find(p => p.original.date === tooltip.date)!.x} y1={0} x2={points.find(p => p.original.date === tooltip.date)!.x} y2={innerHeight} stroke="#3b82f6" strokeWidth="1" strokeDasharray="3,3" />
                            <circle cx={points.find(p => p.original.date === tooltip.date)!.x} cy={points.find(p => p.original.date === tooltip.date)!.y} r="4" fill="white" stroke="#3b82f6" strokeWidth="2" />
                        </>
                    )}
                </g>
            </svg>
             {tooltip?.visible && (
                <div 
                    className="absolute p-2 text-xs bg-slate-800 text-white rounded-md shadow-lg pointer-events-none transition-transform"
                    style={{ 
                        left: `${tooltip.x}px`,
                        top: `${tooltip.y}px`,
                        transform: `translate(-50%, -120%)` // Position tooltip above cursor
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
};

interface DonutChartProps {
    data: { value: number; color: string }[];
    centerText: string;
    centerLabel: string;
}

const DonutChart: React.FC<DonutChartProps> = ({ data, centerText, centerLabel }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) {
        return (
             <div className="relative w-36 h-36 mx-auto">
                 <svg viewBox="0 0 36 36" className="w-full h-full">
                    <circle cx="18" cy="18" r="15.9155" className="stroke-current text-slate-200 dark:text-slate-700" strokeWidth="3.8" fill="none" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{centerText}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 max-w-[80px] leading-tight">{centerLabel}</span>
                </div>
            </div>
        )
    }

    let accumulated = 0;
    return (
        <div className="relative w-36 h-36 mx-auto">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {data.map((item, index) => {
                    const percentage = (item.value / total) * 100;
                    const strokeDashoffset = accumulated;
                    accumulated += percentage;
                    return (
                        <circle
                            key={index}
                            cx="18"
                            cy="18"
                            r="15.9155"
                            className={`stroke-current ${item.color}`}
                            strokeWidth="3.8"
                            fill="none"
                            strokeDasharray={`${percentage} ${100 - percentage}`}
                            strokeDashoffset={-strokeDashoffset}
                        />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{centerText}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 max-w-[80px] leading-tight">{centerLabel}</span>
            </div>
        </div>
    );
};

interface BarChartProps {
    data: { label: string; value: number }[];
    formatValue: (value: number) => string;
}

const BarChart: React.FC<BarChartProps> = ({ data, formatValue }) => {
    if (!data || data.length === 0) {
        return <div className="h-48 flex items-center justify-center text-xs text-slate-400">Nenhuma igreja cadastrada.</div>;
    }

    const maxValue = Math.max(...data.map(d => d.value), 1);

    return (
        <div className="h-56 overflow-x-auto overflow-y-hidden pb-4">
            <div className="flex items-end space-x-4 h-full" style={{ width: `${data.length * 4.5}rem`, minWidth: '100%' }}>
                {data.map((item, index) => {
                    const barHeightPercentage = (item.value / maxValue) * 100;
                    
                    return (
                        <div key={index} className="flex flex-col items-center flex-1 h-full pt-4">
                            <div className="relative w-full flex-grow flex items-end justify-center group">
                                <span 
                                    className={`absolute -top-1 text-xs font-bold text-slate-700 dark:text-slate-200 transition-opacity ${barHeightPercentage > 10 ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
                                >
                                    {formatValue(item.value)}
                                </span>
                                <div 
                                    className="w-full bg-blue-500 rounded-t-md transition-all duration-300 group-hover:bg-blue-600"
                                    style={{ height: `${barHeightPercentage}%`, minHeight: '2px' }}
                                    title={`${item.label}: ${formatValue(item.value)}`}
                                />
                            </div>
                            <span 
                                className="mt-2 text-xs text-center text-slate-500 dark:text-slate-400 w-full"
                                style={{
                                    display: '-webkit-box',
                                    WebkitBoxOrient: 'vertical',
                                    WebkitLineClamp: 2,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxHeight: '2.5em', // approx 2 lines
                                }}
                                title={item.label}
                            >
                                {item.label}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};


interface MatchMethodBreakdownProps {
    data: { label: string; value: number; Icon: React.FC<{className?: string}>, color: string }[];
    total: number;
}

const MatchMethodBreakdown: React.FC<MatchMethodBreakdownProps> = ({ data, total }) => {
    return (
        <div className="h-full flex flex-col justify-center space-y-3">
            {data.filter(d => d.value > 0).map(({ label, value, Icon, color }) => (
                <div key={label} className="flex items-center">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${color.replace('text', 'bg').replace('-500', '-100')} dark:${color.replace('text', 'bg').replace('-500', '-900/50')}`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-baseline">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full mt-1">
                            <div
                                className={`h-1.5 rounded-full ${color.replace('text', 'bg')}`}
                                style={{ width: total > 0 ? `${(value / total) * 100}%` : '0%' }}
                            ></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// --- Main View Component ---

export const DashboardView: React.FC = () => {
    const { 
        summary, 
        setActiveView,
        churches,
        savedReports,
    } = useContext(AppContext);
    
    const { t, language } = useTranslation();

    // If there are no saved reports, show an empty state message
    if (savedReports.length === 0) {
        return (
            <EmptyState
                icon={<UploadIcon className="w-8 h-8 text-blue-700 dark:text-blue-400" />}
                title={t('empty.dashboard.saved.title')}
                message={t('empty.dashboard.saved.message')}
                action={{
                    text: t('empty.dashboard.saved.action'),
                    onClick: () => setActiveView('upload'),
                }}
            />
        );
    }
    
    // --- Data processing for charts ---
    const total = summary.identifiedCount + summary.unidentifiedCount;
    const identifiedPercent = total > 0 ? (summary.identifiedCount / total) * 100 : 0;
    
    const allSavedResults = useMemo(() => savedReports.flatMap(report => Object.values(report.incomeData).flat()), [savedReports]);

    const matchMethodCounts = useMemo(() => {
        const counts: Record<MatchMethod, number> = { AUTOMATIC: 0, MANUAL: 0, AI: 0, LEARNED: 0 };
        allSavedResults.forEach(r => {
            if (r.status === 'IDENTIFICADO' && r.matchMethod) {
                counts[r.matchMethod]++;
            } else if (r.status === 'IDENTIFICADO' && !r.matchMethod) {
                counts.AUTOMATIC++;
            }
        });
        return counts;
    }, [allSavedResults]);

    const identificationChartData = [
        { value: summary.identifiedCount, color: 'text-green-500' },
        { value: summary.unidentifiedCount, color: 'text-yellow-300 dark:text-yellow-700/80' },
    ];
    
    const lineChartData = useMemo(() => {
        if (!savedReports || savedReports.length === 0) return [];
            
        return savedReports
            .map(report => {
                const reportDate = new Date(report.createdAt);
                const dateStr = `${reportDate.getDate().toString().padStart(2, '0')}/${(reportDate.getMonth() + 1).toString().padStart(2, '0')}`;
                
                const totalValue = Object.values(report.incomeData)
                    .flat()
                    // FIX: Added explicit type for 'r' to resolve type inference issue.
                    .filter((r: MatchResult) => r.status === 'IDENTIFICADO')
                    // FIX: Added explicit type for 'r' to resolve type inference issue.
                    .reduce((sum: number, r: MatchResult) => sum + r.transaction.amount, 0);

                return { date: dateStr, value: totalValue, timestamp: reportDate.getTime(), name: report.name };
            })
            .sort((a, b) => a.timestamp - b.timestamp) // Sort by date
            .map(({date, value}) => ({date, value})); // Remove timestamp and name for the final structure
    }, [savedReports]);

    const methodBreakdownData = [
        { value: matchMethodCounts.AUTOMATIC, color: 'text-teal-500', label: t('dashboard.matchMethod.automatic'), Icon: BoltIcon },
        { value: matchMethodCounts.AI, color: 'text-blue-500', label: t('dashboard.matchMethod.ai'), Icon: SparklesIcon },
        { value: matchMethodCounts.LEARNED, color: 'text-purple-500', label: t('dashboard.matchMethod.learned'), Icon: BrainIcon },
        { value: matchMethodCounts.MANUAL, color: 'text-slate-500', label: t('dashboard.matchMethod.manual'), Icon: UserPlusIcon },
    ];
    
    const churchValueMap = useMemo(() => new Map(summary.valuePerChurch), [summary.valuePerChurch]);
    const churchBarChartData = useMemo(() => 
        churches
            .map(church => ({
                label: church.name,
                value: churchValueMap.get(church.name) || 0,
            }))
            .sort((a, b) => b.value - a.value),
        [churches, churchValueMap]
    );

    return (
        <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <SummaryCard 
                    title={t('dashboard.autoConfirmed')}
                    count={summary.autoConfirmed.count}
                    value={summary.autoConfirmed.value}
                    icon={<BoltIcon className="w-8 h-8 text-green-600 dark:text-green-500" />} 
                    language={language}
                />
                <SummaryCard 
                    title={t('dashboard.manualConfirmed')}
                    count={summary.manualConfirmed.count}
                    value={summary.manualConfirmed.value}
                    icon={<UserPlusIcon className="w-8 h-8 text-blue-700 dark:text-blue-500" />} 
                    language={language}
                />
                <SummaryCard 
                    title={t('dashboard.pending')} 
                    count={summary.pending.count}
                    value={summary.pending.value}
                    icon={<XCircleIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />} 
                    language={language}
                />
            </div>

            {/* Visual Analysis Section */}
            <div className="mt-8">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">{t('dashboard.visualAnalysis')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('dashboard.identifiedValueByReport')}</h4>
                        <LineChart data={lineChartData} formatValue={(v) => formatCurrency(v, language)} />
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                        <h4 className="text-sm font-semibold text-center text-slate-800 dark:text-slate-200 mb-2">{t('dashboard.identificationRatio')}</h4>
                        <div className="flex-grow flex items-center justify-center">
                           <DonutChart data={identificationChartData} centerText={`${identifiedPercent.toFixed(0)}%`} centerLabel={t('table.status.identified')} />
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('dashboard.identifiedValuesByChurch')}</h4>
                        {churchBarChartData.length > 0 ? (
                            <BarChart data={churchBarChartData} formatValue={(v) => formatCurrency(v, language)} />
                        ) : (
                            <div className="h-48 flex items-center justify-center text-xs text-slate-400">{t('dashboard.noValues')}</div>
                        )}
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">{t('dashboard.matchMethodBreakdown')}</h4>
                        <MatchMethodBreakdown data={methodBreakdownData} total={summary.identifiedCount} />
                    </div>
                </div>
            </div>
        </>
    );
};
