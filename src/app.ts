import express from "express";
import fs from "fs";

const app = express();
app.use(express.json());

const UPLOAD_DIR = "./uploads";

function timesInStatuses(
  statusFieldId: string,
  timeFieldId: string,
  rows: any[]
): Map<string, number[]> {
  const timesPerStatus = new Map<string, number[]>();
  for (const row of rows) {
    const status = row[statusFieldId];
    const time = +row[timeFieldId] || 0;
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

function printStats(timesPerStatus: Map<string, number[]>) {
  const avgSecondsPerStatus = new Map<string, number>();
  for (const [status, times] of timesPerStatus.entries()) {
    avgSecondsPerStatus.set(
      status,
      times.reduce((a, b) => a + b, 0) / times.length
    );
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
    )} | ${secondsToDaysHoursMinutes(
      percentile90SecondsPerStatus.get(status)
    )}`;
  }
  console.log(table);
}

app.post("/upload", (req, res) => {
  const contentDisposition = req.headers["content-disposition"];
  const contentType = req.headers["content-type"];

  if (contentType === "application/json") {
    const body = req.body;

    // collect times per each status
    const timesPerStatus = timesInStatuses(
      "status",
      "ae_timeToNextChange",
      body.rows
    );

    // use the collected times to calculate basic stats
    printStats(timesPerStatus);

    res.sendStatus(200);
  } else if (contentDisposition) {
    // process file attachement
    let filename = "file.dat";

    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    let matches = filenameRegex.exec(contentDisposition);
    if (matches != null && matches[1]) {
      filename = matches[1].replace(/['"]/g, "");
    }

    const writeStream = fs.createWriteStream(`${UPLOAD_DIR}/${filename}`);

    req.pipe(writeStream);

    writeStream.on("finish", () => {
      console.log(`Received file ${filename}, ${contentType}`);
      res.sendStatus(200);
    });

    writeStream.on("error", (err) => {
      console.error(`Error writing file: ${err.message}`);
      res.sendStatus(500);
    });
  }
});

app.listen(3002, () => {
  console.log("Server listening on port 3002");
});
