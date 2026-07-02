export class ReportService {
    static async listReports(req, effectiveOwnerId) {
        try {
            const defaultPort = process.env.PORT || '3000';
            const vpsUrl = process.env.CONTRIBUTORS_API_URL || (process.env.INTEGRATED_MODE === 'true' ? `http://127.0.0.1:${defaultPort}` : 'http://127.0.0.1:3010');
            const cleanVpsUrl = vpsUrl.endsWith('/') ? vpsUrl.slice(0, -1) : vpsUrl;

            // Fetch saved reports from VPS
            let url = `${cleanVpsUrl}/api/v1/saved_reports?user_id=${effectiveOwnerId}&exclude_data=true`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch from VPS saved_reports: ${response.statusText}`);
            }
            const reports = await response.json();

            if (!reports || reports.length === 0) {
                return [];
            }

            // Map and parse data
            const mapped = reports.map(r => {
                let parsedData = null;
                if (r.data) {
                    try {
                        parsedData = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
                    } catch (e) {
                        console.error("Error parsing report data JSON:", e);
                    }
                }
                return {
                    id: r.id,
                    name: r.name,
                    record_count: r.record_count,
                    created_at: r.created_at,
                    user_id: r.user_id,
                    church_id: r.church_id,
                    data: parsedData
                };
            });

            // Live session handling: the live session needs full data, the others don't in lists
            const activeReportId = `LIVE_SESSION_${effectiveOwnerId}`;
            const mergedReports = mapped.map(report => {
                if (report.id === activeReportId) {
                    return report;
                }
                return {
                    ...report,
                    data: null // Frontend loads full data on demand
                };
            });

            return mergedReports;
        } catch (err) {
            console.error("[ReportService] Error listing reports:", err);
            throw err;
        }
    }
}
