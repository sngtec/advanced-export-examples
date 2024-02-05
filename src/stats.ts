//
// Note:
// Example format of JSON data received by the webhook can be found in docs/example-webhook-data.json
//

type Row = {
    issuekey: string;
    ae_asOf: string;
    ae_changedFields: string;
    ae_changeAuthor: string | null;
    status: string;
    ae_timeToNextChange: number;
};

export function timesInStatuses(statusFieldId: keyof Row, timeFieldId: keyof Row, rows: Row[]): Map<string, number[]> {
    const timesPerStatus = new Map<string, number[]>();
    for (const row of rows) {
        const status = row[statusFieldId] as string;
        const time = +row[timeFieldId]! || 0;
        if (timesPerStatus.has(status)) {
            timesPerStatus.get(status)!.push(time);
        } else {
            timesPerStatus.set(status, [time]);
        }
    }
    return timesPerStatus;
}

function secondsToDaysHoursMinutes(seconds: number | undefined): string {
    if (seconds === undefined) {
        return "N/A";
    }
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds -= days * 24 * 60 * 60;
    const hours = Math.floor(seconds / (60 * 60));
    seconds -= hours * 60 * 60;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    return `${days}d ${hours}h ${minutes}m ${Math.floor(seconds)}s`;
}

export function printStats(timesPerStatus: Map<string, number[]>) {
    const avgSecondsPerStatus = new Map<string, number>();
    for (const [status, times] of timesPerStatus.entries()) {
        avgSecondsPerStatus.set(status, times.reduce((a, b) => a + b, 0) / times.length);
    }

    const medianSecondsPerStatus = new Map<string, number>();
    for (const [status, times] of timesPerStatus.entries()) {
        times.sort((a, b) => a - b);
        const mid = Math.floor(times.length / 2);
        medianSecondsPerStatus.set(status, times[mid]);
    }

    const percentile90SecondsPerStatus = new Map<string, number>();
    for (const [status, times] of timesPerStatus.entries()) {
        times.sort((a, b) => a - b);
        const mid = Math.floor(times.length * 0.9);
        percentile90SecondsPerStatus.set(status, times[mid]);
    }

    // print table of statuses in rows and columns: status name, avg, median, 90% percentile
    let table = `
  Status | Avg | Median | 90%
  ---|---|---|---`;
    for (const [status, avg] of avgSecondsPerStatus.entries()) {
        table += `
  ${status} | ${secondsToDaysHoursMinutes(avg)} | ${secondsToDaysHoursMinutes(
            medianSecondsPerStatus.get(status)
        )} | ${secondsToDaysHoursMinutes(percentile90SecondsPerStatus.get(status))}`;
    }
    console.log(table);
}
