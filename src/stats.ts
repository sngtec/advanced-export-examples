//
// Note:
// Example format of JSON data received by the webhook can be found in docs/example-webhook-data.json
//

type Row = {
    issuekey: string;
    ae_asOf: string;
    ae_changedFields: string;
    ae_changeAuthor: string | null;
    ae_timeToNextChange: number;
    [key: string]: string | number | null;
};

type Column = {
    id: string;
    displayName: string;
    unsupported: boolean;
    special: boolean;
    type: string;
};

export const ACC_FUNCTIONS = ["sum", "avg", "median", "90percentile"] as const;
export type AccFunction = (typeof ACC_FUNCTIONS)[number];

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

export function groupByAndAccumulate(
    rows: Row[],
    columns: Column[],
    groupByFieldId: keyof Row,
    valueFieldId: keyof Row,
    accFunction: AccFunction
) {
    const groupByColumn = columns.find(c => c.id === groupByFieldId)!;
    const valueColumn = columns.find(c => c.id === valueFieldId)!;

    const groups = new Map<string, number[]>();
    for (const row of rows) {
        const group = row[groupByFieldId] as string;
        const value = +row[valueFieldId]! || 0;
        if (groups.has(group)) {
            groups.get(group)!.push(value);
        } else {
            groups.set(group, [value]);
        }
    }

    const accs = new Map<string, number>();
    for (const [group, values] of groups.entries()) {
        if (accFunction === "sum") {
            accs.set(
                group,
                values.reduce((a, b) => a + b, 0)
            );
        } else if (accFunction === "avg") {
            accs.set(group, values.reduce((a, b) => a + b, 0) / values.length);
        } else if (accFunction === "median") {
            values.sort((a, b) => a - b);
            const mid = Math.floor(values.length / 2);
            accs.set(group, values[mid]);
        } else if (accFunction === "90percentile") {
            values.sort((a, b) => a - b);
            const mid = Math.floor(values.length * 0.9);
            accs.set(group, values[mid]);
        }
    }

    let table = `
${groupByColumn.displayName} | ${accFunction}(${valueColumn.displayName})
---|---`;
    for (const [group, acc] of accs.entries()) {
        table += `
${group} | ${acc}`;
    }
    console.log(table);
}
